from __future__ import annotations

from app.domains.docket.services.helpers import _ensure_lawyer_on_matter
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser
from app.shared.exceptions import BadRequest


def create_note(matter_id: str, user: CurrentUser, content: str) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("internal_notes")
        .insert(
            {
                "matter_id": matter_id,
                "author_id": user.id,
                "content": content,
            }
        )
        .execute()
    )
    if not result.data:
        raise BadRequest("Failed to create note")
    return result.data[0]


def list_notes(matter_id: str, user: CurrentUser) -> list:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("internal_notes")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []
