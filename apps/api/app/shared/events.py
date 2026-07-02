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
from enum import Enum
from app.shared import database

log = logging.getLogger(__name__)


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


def _write_event(row: dict) -> None:
    db = database.get_service_role_db()
    db.table("events").insert(row).execute()


def _get_event_value(event_type: EventType | str) -> str:
    if isinstance(event_type, Enum):
        return event_type.value
    return str(event_type)


def _write_pending_notifications(rows: list[dict]) -> None:
    db = database.get_service_role_db()
    db.table("pending_notifications").insert(rows).execute()


def _resolve_subscriber(name: str):
    for sub in _subscribers:
        sub_name = f"{sub.__module__}.{sub.__name__}" if hasattr(sub, "__name__") else str(sub)
        if sub_name == name:
            return sub
    # Fallback to importing or checking common name
    if "handle_domain_event" in name:
        from app.domains.notifications.subscriber import handle_domain_event
        return handle_domain_event
    return None


async def process_pending_notifications() -> None:
    db = database.get_service_role_db()
    try:
        res = (
            db.table("pending_notifications")
            .select("*")
            .or_("status.eq.pending,status.eq.failed")
            .execute()
        )
    except Exception as e:
        log.error("Outbox: failed to fetch pending notifications: %s", e)
        return

    rows = res.data or []
    if not rows:
        return

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)

    for row in rows:
        attempts = row["attempts"]
        last_attempt_at_str = row.get("last_attempt_at")
        
        # Check backoff if failed
        if row["status"] == "failed" and last_attempt_at_str:
            try:
                last_attempt_at = datetime.fromisoformat(last_attempt_at_str.replace("Z", "+00:00"))
                backoff_seconds = (2 ** (attempts - 1)) * 5  # 5s, 10s, 20s, 40s, 80s
                if now < last_attempt_at + timedelta(seconds=backoff_seconds):
                    continue
            except Exception:
                pass

        sub_name = row["subscriber_name"]
        sub = _resolve_subscriber(sub_name)
        
        if not sub:
            log.error("Outbox: could not resolve subscriber %s", sub_name)
            try:
                db.table("pending_notifications").update({
                    "status": "failed_permanently",
                    "error_message": f"Subscriber {sub_name} not found",
                    "updated_at": now.isoformat(),
                }).eq("id", row["id"]).execute()
            except Exception:
                pass
            continue

        try:
            # Increment attempt count in DB
            new_attempts = attempts + 1
            db.table("pending_notifications").update({
                "attempts": new_attempts,
                "last_attempt_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }).eq("id", row["id"]).execute()

            # Execute subscriber
            if asyncio.iscoroutinefunction(sub):
                await sub(row["event_type"], row["actor_id"], row["matter_id"], row["payload"])
            else:
                await asyncio.to_thread(sub, row["event_type"], row["actor_id"], row["matter_id"], row["payload"])

            # Mark as completed
            db.table("pending_notifications").update({
                "status": "completed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", row["id"]).execute()

        except Exception as e:
            error_msg = str(e)
            log.warning("Outbox: notification task %s failed (attempt %d): %s", row["id"], attempts + 1, error_msg)
            next_status = "failed"
            if attempts + 1 >= 5:
                next_status = "failed_permanently"
                log.error("Outbox: notification task %s permanently failed after 5 attempts", row["id"])

            try:
                db.table("pending_notifications").update({
                    "status": next_status,
                    "error_message": error_msg,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", row["id"]).execute()
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
        row = {
            "event_type": event_str,
            "payload": payload or {},
        }
        if actor_id:
            row["actor_id"] = actor_id
        if matter_id:
            row["matter_id"] = matter_id

        await asyncio.to_thread(_write_event, row)

        # Write to pending_notifications (Outbox)
        pending_rows = []
        for sub in list(_subscribers):
            sub_name = f"{sub.__module__}.{sub.__name__}" if hasattr(sub, "__name__") else str(sub)
            pending_rows.append({
                "event_type": event_str,
                "actor_id": actor_id,
                "matter_id": matter_id,
                "payload": payload or {},
                "subscriber_name": sub_name,
                "status": "pending",
                "attempts": 0,
            })
        
        if pending_rows:
            await asyncio.to_thread(_write_pending_notifications, pending_rows)
            # Trigger execution immediately
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

    import threading

    def run_in_thread():
        try:
            asyncio.run(coro)
        except Exception as e:
            log.error("Failed to run coroutine in background thread: %s", e)

    threading.Thread(target=run_in_thread, daemon=True).start()


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
        row = {"event_type": event_str, "payload": payload or {}}
        if actor_id:
            row["actor_id"] = actor_id
        if matter_id:
            row["matter_id"] = matter_id
        _write_event(row)

        pending_rows = []
        for sub in list(_subscribers):
            sub_name = f"{sub.__module__}.{sub.__name__}" if hasattr(sub, "__name__") else str(sub)
            pending_rows.append({
                "event_type": event_str,
                "actor_id": actor_id,
                "matter_id": matter_id,
                "payload": payload or {},
                "subscriber_name": sub_name,
                "status": "pending",
                "attempts": 0,
            })
        
        if pending_rows:
            _write_pending_notifications(pending_rows)
            # Trigger execution immediately
            _run_coroutine_in_new_loop(process_pending_notifications())

    except Exception as exc:
        log.error("Event emit failed [%s]: %s", event_type, exc)
