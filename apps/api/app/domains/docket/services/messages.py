from __future__ import annotations
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser
from app.shared.exceptions import BadRequest
from app.domains.docket.services.helpers import (
    _now,
    _get_matter_for_participant,
)


def list_messages(matter_id: str, user: CurrentUser) -> list:
    """List chat messages for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    result = (
        db.table("case_messages")
        .select(
            "id,matter_id,sender_id,content,message_type,attachment_path,read_at,created_at"
        )
        .eq("matter_id", matter_id)
        .order("created_at")
        .execute()
    )
    messages = result.data or []

    # Mark unread messages (sent by the other participant) as read
    unread_ids = [
        m["id"]
        for m in messages
        if m.get("sender_id") != user.id and not m.get("read_at")
    ]
    if unread_ids:
        db.table("case_messages").update({"read_at": _now().isoformat()}).in_(
            "id", unread_ids
        ).execute()
        for m in messages:
            if m["id"] in unread_ids:
                m["read_at"] = _now().isoformat()

    return messages


def send_message(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Send a chat message in a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    payload = {
        "matter_id": matter_id,
        "sender_id": user.id,
        "content": data["content"],
        "message_type": data.get("message_type", "text"),
        "attachment_path": data.get("attachment_path"),
    }

    result = db.table("case_messages").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to send message")
    return result.data[0]
