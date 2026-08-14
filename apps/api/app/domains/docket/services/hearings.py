from __future__ import annotations

import logging

from app.domains.docket.services.helpers import (
    _ensure_lawyer_on_matter,
    _get_matter_for_participant,
    _now,
)
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import BadRequest, NotFound

logger = logging.getLogger(__name__)


# ── Hearings ────────────────────────────────────────────────────


def schedule_hearing(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Schedule a hearing for a matter."""
    _ensure_lawyer_on_matter(matter_id, user)

    from datetime import date

    from app.shared.court_calendar import is_court_working_day

    try:
        hearing_date_str = data["hearing_date"][:10]
        h_date = date.fromisoformat(hearing_date_str)
        if not is_court_working_day(h_date):
            raise BadRequest(
                "Selected hearing date falls on a court holiday or weekend"
            )
    except (ValueError, TypeError):
        raise BadRequest("Invalid hearing date format")

    db = get_db()

    payload = {
        "matter_id": matter_id,
        "hearing_date": data["hearing_date"],
        "courtroom": data.get("courtroom"),
        "judge": data.get("judge"),
        "purpose": data.get("purpose"),
        "status": "scheduled",
    }

    result = db.table("hearings").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to schedule hearing")

    hearing = result.data[0]

    # Update next_hearing_at on the matter
    db.table("matters").update({"next_hearing_at": data["hearing_date"]}).eq(
        "id", matter_id
    ).execute()

    # Record timeline event
    hearing_date_fmt = data["hearing_date"][:10]
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "hearing_scheduled",
            "lawyer_description": f"Hearing scheduled for {hearing_date_fmt}",
            "client_description": f"A court hearing has been scheduled for {hearing_date_fmt}",
            "occurred_at": _now().isoformat(),
            "metadata": {"hearing_id": hearing["id"]},
        }
    ).execute()

    # Emit event for subscriber notifications
    from app.shared.events import EventType, sync_emit

    sync_emit(
        EventType.HEARING_SCHEDULED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"hearing_id": hearing["id"]},
    )

    return hearing


def list_hearings(matter_id: str, user: CurrentUser) -> list:
    """List all hearings for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("hearings")
        .select("*")
        .eq("matter_id", matter_id)
        .order("hearing_date", desc=True)
        .execute()
    )
    return result.data or []


def update_hearing(
    matter_id: str, hearing_id: str, user: CurrentUser, data: dict
) -> dict:
    """Update hearing details (add notes, change status, record outcome)."""
    _ensure_lawyer_on_matter(matter_id, user)

    from datetime import date

    from app.shared.court_calendar import is_court_working_day

    if "hearing_date" in data and data["hearing_date"]:
        try:
            hearing_date_str = data["hearing_date"][:10]
            h_date = date.fromisoformat(hearing_date_str)
            if not is_court_working_day(h_date):
                raise BadRequest(
                    "Selected hearing date falls on a court holiday or weekend"
                )
        except (ValueError, TypeError):
            raise BadRequest("Invalid hearing date format")

    if "next_date" in data and data["next_date"]:
        try:
            next_date_str = data["next_date"][:10]
            nd_date = date.fromisoformat(next_date_str)
            if not is_court_working_day(nd_date):
                raise BadRequest(
                    "Selected next/adjourned hearing date falls on a court holiday or weekend"
                )
        except (ValueError, TypeError):
            raise BadRequest("Invalid next hearing date format")

    db = get_db()

    # Handle outcome as metadata
    metadata_update = {}
    if "outcome" in data:
        metadata_update["outcome"] = data.pop("outcome")
    if "next_date" in data:
        metadata_update["next_date"] = data.pop("next_date")

    update_payload = {k: v for k, v in data.items()}
    if metadata_update:
        # Merge into existing hearing notes
        existing = db.table("hearings").select("notes").eq("id", hearing_id).execute()
        if existing.data:
            current_notes = existing.data[0].get("notes") or ""
            if metadata_update.get("outcome"):
                outcome_text = f"\n[Outcome: {metadata_update['outcome']}]"
                update_payload["notes"] = (current_notes + outcome_text).strip()

    result = (
        db.table("hearings")
        .update(update_payload)
        .eq("id", hearing_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Hearing")

    # If adjourned with a new date, schedule the next hearing
    if data.get("status") == "adjourned" and metadata_update.get("next_date"):
        new_date = metadata_update["next_date"]
        hearing = result.data[0]
        new_hearing_res = (
            db.table("hearings")
            .insert(
                {
                    "matter_id": matter_id,
                    "hearing_date": new_date,
                    "courtroom": hearing.get("courtroom"),
                    "judge": hearing.get("judge"),
                    "purpose": "Adjourned from "
                    + (hearing.get("hearing_date") or "previous")[:10],
                    "status": "scheduled",
                }
            )
            .execute()
        )
        db.table("matters").update({"next_hearing_at": new_date}).eq(
            "id", matter_id
        ).execute()

        # Emit event for the newly scheduled adjourned hearing
        if new_hearing_res.data:
            new_hearing = new_hearing_res.data[0]
            from app.shared.events import EventType, sync_emit

            sync_emit(
                EventType.HEARING_SCHEDULED,
                actor_id=user.id,
                matter_id=matter_id,
                payload={"hearing_id": new_hearing["id"]},
            )

    # Record timeline event
    if data.get("status") == "completed":
        db.table("timeline_events").insert(
            {
                "matter_id": matter_id,
                "event_type": "hearing_completed",
                "lawyer_description": "Hearing completed"
                + (
                    f" — {metadata_update.get('outcome', '')}"
                    if metadata_update.get("outcome")
                    else ""
                ),
                "client_description": "A hearing was completed in your case.",
                "occurred_at": _now().isoformat(),
                "metadata": {"hearing_id": hearing_id},
            }
        ).execute()

    return result.data[0]


# ── CRUD: Timeline Events ────────────────────────────────────────


def create_timeline_event(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "event_type": data["event_type"],
        "lawyer_description": data["lawyer_description"],
        "client_description": data.get("client_description"),
        "occurred_at": (data.get("occurred_at") or _now()).isoformat(),
        "metadata": data.get("metadata", {}),
    }
    result = db.table("timeline_events").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create timeline event")
    return result.data[0]


def list_timeline_events(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("timeline_events")
        .select("*")
        .eq("matter_id", matter_id)
        .order("occurred_at", desc=True)
        .execute()
    )
    events = result.data or []

    # Role-filter the description field
    if user.role == UserRole.USER:
        return [
            {**e, "description": e["client_description"]}
            for e in events
            if e.get("client_description")
        ]
    else:
        return [{**e, "description": e["lawyer_description"]} for e in events]
