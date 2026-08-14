"""
Event Bus — every domain state change emits an event.
Events are written to the `events` table (immutable).
Downstream: analytics, notifications, audit trail.

Usage:
    await emit(EventType.MATTER_CREATED, matter_id=matter_id, actor_id=user_id, payload={...})
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC
from enum import Enum

from app.shared import database

log = logging.getLogger(__name__)

_event_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="events_worker")


class EventType(str, Enum):
    # Intake
    INTAKE_STARTED = "intake.started"
    INTAKE_FACTS_SAVED = "intake.facts_saved"
    INTAKE_COMPLETED = "intake.completed"

    # Matter lifecycle
    MATTER_CREATED = "matter.created"
    MATTER_STATUS_CHANGED = "matter.status_changed"
    MATTER_RESOLVED = "matter.resolved"
    MATTER_ARCHIVED = "matter.archived"

    # Facts
    FACT_EXTRACTED = "fact.extracted"
    FACT_VERIFIED = "fact.verified"
    FACT_UPDATED = "fact.updated"

    # Assessment
    ASSESSMENT_STARTED = "assessment.started"
    ASSESSMENT_COMPLETED = "assessment.completed"

    # Lawyer
    LAWYER_REQUESTED = "lawyer.requested"
    LAWYER_ASSIGNED = "lawyer.assigned"
    LAWYER_ACCEPTED = "lawyer.accepted"
    LAWYER_DECLINED = "lawyer.declined"
    LAWYER_REMOVED = "lawyer.removed"

    # Documents
    DOCUMENT_UPLOADED = "document.uploaded"

    # Updates
    UPDATE_POSTED = "update.posted"

    # Hearings, Meetings & Milestones
    HEARING_SCHEDULED = "hearing.scheduled"
    HEARING_UPDATED = "hearing.updated"
    MEETING_SCHEDULED = "meeting.scheduled"
    MEETING_COMPLETED = "meeting.completed"
    MILESTONE_UPDATED = "milestone.updated"

    # Practice Scenarios
    PRACTICE_SESSION_STARTED = "practice.session_started"
    PRACTICE_SESSION_COMPLETED = "practice.session_completed"


BACKGROUND_TASKS: set[asyncio.Task] = set()

_subscribers: list = []


def subscribe(callback) -> None:
    """Subscribe a callback to the event bus."""
    if callback not in _subscribers:
        _subscribers.append(callback)


def unsubscribe(callback) -> None:
    """Unsubscribe a callback from the event bus."""
    if callback in _subscribers:
        _subscribers.remove(callback)


def _get_event_value(event_type: EventType | str) -> str:
    if isinstance(event_type, Enum):
        return event_type.value
    return str(event_type)


def _resolve_subscriber(name: str):
    for sub in _subscribers:
        sub_name = (
            f"{sub.__module__}.{sub.__name__}" if hasattr(sub, "__name__") else str(sub)
        )
        if sub_name == name:
            return sub
    # Fallback to importing or checking common name
    if "handle_domain_event" in name:
        from app.domains.notifications.subscriber import handle_domain_event

        return handle_domain_event
    return None


# Atomic event and outbox write via single DB transaction RPC


def _emit_event_with_outbox(
    event_str: str,
    actor_id: str | None,
    matter_id: str | None,
    payload: dict,
    pending_rows: list[dict],
) -> None:
    """Write the event record and all outbox rows in one DB transaction.

    Uses the emit_event_with_outbox() plpgsql function (migration 036) so
    that if the outbox insert fails the event insert is also rolled back —
    preventing the 'event logged but notification never queued' bug.
    """
    db = database.get_service_role_db()
    db.rpc(
        "emit_event_with_outbox",
        {
            "p_event_type": event_str,
            "p_actor_id": actor_id,
            "p_matter_id": matter_id,
            "p_payload": payload,
            "p_pending": [
                {"subscriber_name": r["subscriber_name"]} for r in pending_rows
            ],
        },
    ).execute()


# Atomic outbox claim using FOR UPDATE SKIP LOCKED


async def process_pending_notifications() -> None:
    """Claim and process outbox rows.

    Uses the claim_pending_notifications() plpgsql function (migration 035)
    which atomically transitions rows to 'processing' using
    FOR UPDATE SKIP LOCKED.  This prevents the polling loop and the
    immediate-trigger task from claiming the same row concurrently,
    eliminating duplicate subscriber executions and duplicate notifications.
    """
    db = database.get_service_role_db()
    try:
        res = db.rpc("claim_pending_notifications", {"p_batch_size": 50}).execute()
    except Exception as e:
        log.error("Outbox: failed to claim pending notifications: %s", e)
        return

    rows = res.data or []
    if not rows:
        return

    from datetime import datetime

    for row in rows:
        now = datetime.now(UTC)
        attempts = row["attempts"]
        sub_name = row["subscriber_name"]
        sub = _resolve_subscriber(sub_name)

        if not sub:
            log.error("Outbox: could not resolve subscriber %s", sub_name)
            try:
                db.table("pending_notifications").update(
                    {
                        "status": "failed_permanently",
                        "error_message": f"Subscriber {sub_name} not found",
                        "updated_at": now.isoformat(),
                    }
                ).eq("id", row["id"]).execute()
            except Exception:
                pass
            continue

        try:
            # Increment attempt count before executing subscriber
            new_attempts = attempts + 1
            db.table("pending_notifications").update(
                {
                    "attempts": new_attempts,
                    "last_attempt_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }
            ).eq("id", row["id"]).execute()

            # Execute subscriber
            if asyncio.iscoroutinefunction(sub):
                await sub(
                    row["event_type"], row["actor_id"], row["matter_id"], row["payload"]
                )
            else:
                await asyncio.to_thread(
                    sub,
                    row["event_type"],
                    row["actor_id"],
                    row["matter_id"],
                    row["payload"],
                )

            # Mark as completed
            db.table("pending_notifications").update(
                {
                    "status": "completed",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", row["id"]).execute()

        except Exception as e:
            error_msg = str(e)
            log.warning(
                "Outbox: notification task %s failed (attempt %d): %s",
                row["id"],
                attempts + 1,
                error_msg,
            )
            next_status = "failed"
            if attempts + 1 >= 5:
                next_status = "failed_permanently"
                log.error(
                    "Outbox: notification task %s permanently failed after 5 attempts",
                    row["id"],
                )

            try:
                db.table("pending_notifications").update(
                    {
                        "status": next_status,
                        "error_message": error_msg,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("id", row["id"]).execute()
            except Exception:
                pass


def start_outbox_worker() -> None:
    async def outbox_loop():
        log.info("Starting outbox processing loop")
        while True:
            try:
                await process_pending_notifications()
            except Exception as e:
                log.error("Error in outbox processing loop: %s", e)
            await asyncio.sleep(5)

    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(outbox_loop())
        BACKGROUND_TASKS.add(task)
        task.add_done_callback(BACKGROUND_TASKS.discard)
    except RuntimeError:
        pass


async def emit(
    event_type: EventType | str,
    *,
    actor_id: str | None = None,
    matter_id: str | None = None,
    payload: dict | None = None,
) -> None:
    try:
        event_str = _get_event_value(event_type)

        # Build subscriber list for outbox rows
        pending_rows = []
        for sub in list(_subscribers):
            sub_name = (
                f"{sub.__module__}.{sub.__name__}"
                if hasattr(sub, "__name__")
                else str(sub)
            )
            pending_rows.append({"subscriber_name": sub_name})

        # Single atomic write — event + outbox rows in one DB transaction
        await asyncio.to_thread(
            _emit_event_with_outbox,
            event_str,
            actor_id,
            matter_id,
            payload or {},
            pending_rows,
        )

        if pending_rows:
            # Immediate processing: claim_pending_notifications uses FOR UPDATE SKIP LOCKED,
            # so concurrent polling loops cannot double-process the same row.
            task = asyncio.create_task(process_pending_notifications())
            BACKGROUND_TASKS.add(task)
            task.add_done_callback(BACKGROUND_TASKS.discard)

    except Exception as exc:
        log.error("Event emit failed [%s]: %s", event_type, exc)


def _run_coroutine_in_new_loop(coro):

    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(coro)
        BACKGROUND_TASKS.add(task)
        task.add_done_callback(BACKGROUND_TASKS.discard)
        return
    except RuntimeError:
        pass

    def run_in_thread():
        try:
            asyncio.run(coro)
        except Exception as e:
            log.error("Failed to run coroutine in background thread: %s", e)

    _event_executor.submit(run_in_thread)


def sync_emit(
    event_type: EventType | str,
    *,
    actor_id: str | None = None,
    matter_id: str | None = None,
    payload: dict | None = None,
) -> None:
    """Synchronous version for use in sync contexts."""
    try:
        event_str = _get_event_value(event_type)

        pending_rows = []
        for sub in list(_subscribers):
            sub_name = (
                f"{sub.__module__}.{sub.__name__}"
                if hasattr(sub, "__name__")
                else str(sub)
            )
            pending_rows.append({"subscriber_name": sub_name})

        # Single atomic write — event + outbox rows in one DB transaction
        _emit_event_with_outbox(
            event_str, actor_id, matter_id, payload or {}, pending_rows
        )

        if pending_rows:
            # Immediate processing with row-level locking
            _run_coroutine_in_new_loop(process_pending_notifications())

    except Exception as exc:
        log.error("Event emit failed [%s]: %s", event_type, exc)
