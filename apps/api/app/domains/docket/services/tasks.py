from __future__ import annotations

from datetime import date

from app.domains.docket.services.helpers import (
    _ensure_lawyer_on_matter,
    _get_matter_for_participant,
    _now,
)
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser
from app.shared.exceptions import BadRequest, NotFound


def create_task(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "title": data["title"],
        "description": data.get("description"),
        "assigned_to": data.get("assigned_to"),
        "due_date": data["due_date"].isoformat() if data.get("due_date") else None,
    }
    result = db.table("case_tasks").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create task")
    return result.data[0]


def list_tasks(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("case_tasks")
        .select("*")
        .eq("matter_id", matter_id)
        .order("is_completed")
        .order("due_date")
        .execute()
    )
    return result.data or []


def update_task(matter_id: str, task_id: str, user: CurrentUser, data: dict) -> dict:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "due_date" in update_data and isinstance(update_data["due_date"], date):
        update_data["due_date"] = update_data["due_date"].isoformat()
    if update_data.get("is_completed"):
        update_data["completed_at"] = _now().isoformat()
    elif "is_completed" in update_data and not update_data["is_completed"]:
        update_data["completed_at"] = None
    result = (
        db.table("case_tasks")
        .update(update_data)
        .eq("id", task_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Task")
    return result.data[0]


def nudge_client(matter_id: str, task_id: str, user: CurrentUser) -> dict:
    """Send a nudge to the client about a pending task."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Verify task exists and is incomplete
    task_result = (
        db.table("case_tasks")
        .select("id,title,assigned_to")
        .eq("id", task_id)
        .eq("matter_id", matter_id)
        .eq("is_completed", False)
        .execute()
    )
    if not task_result.data:
        raise NotFound("Task")

    task = task_result.data[0]

    # Create a timeline event recording the nudge
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "nudge",
            "lawyer_description": f"Sent reminder to client about: {task['title']}",
            "client_description": f"Your lawyer sent a reminder: {task['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"task_id": task_id},
        }
    ).execute()

    return {"nudged": True, "task_id": task_id, "title": task["title"]}
