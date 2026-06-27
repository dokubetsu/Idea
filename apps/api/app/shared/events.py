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


async def emit(
    event_type: EventType | str,
    *,
    actor_id: str | None = None,
    matter_id: str | None = None,
    payload: dict | None = None,
) -> None:
    """
    Write an event row. Fire-and-forget — failures are logged, not raised.
    Uses asyncio.to_thread to avoid blocking FastAPI's async event loop.
    Then dispatches the event to all registered subscribers.

    H5 DURABILITY WARNING: Subscriber tasks are in-process asyncio tasks only.
    If the server restarts mid-flight (e.g., during a deployment), pending notification
    tasks will be silently lost with no retry. For production reliability, replace
    asyncio.create_task() below with a persistent job queue (Celery, RQ, or a
    transactional outbox pattern writing to the `events` table + a worker).
    """
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

        # Dispatch to subscribers
        # TODO(durability): Replace asyncio.create_task with a persistent job queue
        # to survive process restarts. See H5 warning in docstring above.
        for sub in list(_subscribers):
            try:
                if asyncio.iscoroutinefunction(sub):
                    task = asyncio.create_task(sub(event_str, actor_id, matter_id, payload or {}))
                    BACKGROUND_TASKS.add(task)
                    task.add_done_callback(BACKGROUND_TASKS.discard)
                else:
                    sub(event_str, actor_id, matter_id, payload or {})
            except Exception as sub_exc:
                log.error("Subscriber callback failed for event %s: %s", event_str, sub_exc)

    except Exception as exc:
        log.error("Event emit failed [%s]: %s", event_type, exc)


def _run_coroutine_in_new_loop(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


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

        # Dispatch to subscribers
        for sub in list(_subscribers):
            try:
                if asyncio.iscoroutinefunction(sub):
                    _run_coroutine_in_new_loop(sub(event_str, actor_id, matter_id, payload or {}))
                else:
                    sub(event_str, actor_id, matter_id, payload or {})
            except Exception as sub_exc:
                log.error("Subscriber callback failed for event %s: %s", event_str, sub_exc)
    except Exception as exc:
        log.error("Event emit failed [%s]: %s", event_type, exc)
