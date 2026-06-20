"""Matter service — business logic separate from HTTP layer."""
from __future__ import annotations
from app.shared.database import get_db
from app.shared.events import sync_emit, EventType
from app.shared.exceptions import NotFound, Forbidden
from app.shared.dependencies import CurrentUser, UserRole


SELECT = (
    "*, "
    "up:profiles!user_id(full_name), "
    "lp:profiles!lawyer_id(full_name)"
)

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft":      ["intake"],
    "intake":     ["assessment", "matching"],
    "assessment": ["matching", "active"],
    "matching":   ["active"],
    "active":     ["resolved"],
    "resolved":   ["archived"],
    "archived":   [],
}


def enrich(row: dict, with_facts: bool = False) -> dict:
    row["user_name"]   = (row.pop("up",  None) or {}).get("full_name")
    row["lawyer_name"] = (row.pop("lp",  None) or {}).get("full_name")
    if not with_facts:
        row["facts"] = []
    return row


def get_matter_or_403(db, matter_id: str, user: CurrentUser) -> dict:
    r = db.table("matters").select(SELECT).eq("id", matter_id).single().execute()
    if not r.data:
        raise NotFound("Matter")
    m = r.data
    if user.role == UserRole.USER   and m["user_id"]   != user.id:
        raise Forbidden()
    if user.role == UserRole.LAWYER and m["lawyer_id"] != user.id:
        raise Forbidden()
    return m


def transition_status(db, matter_id: str, new_status: str, actor_id: str) -> None:
    r = db.table("matters").select("status").eq("id", matter_id).single().execute()
    if not r.data:
        raise NotFound("Matter")
    current = r.data["status"]
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        from app.shared.exceptions import BadRequest
        raise BadRequest(f"Cannot transition {current} → {new_status}. Allowed: {allowed}")

    from datetime import datetime, timezone
    extra: dict = {}
    if new_status == "resolved":
        extra["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if new_status == "archived":
        extra["archived_at"] = datetime.now(timezone.utc).isoformat()

    db.table("matters").update({"status": new_status, **extra}).eq("id", matter_id).execute()
    sync_emit(EventType.MATTER_STATUS_CHANGED, actor_id=actor_id, matter_id=matter_id,
              payload={"from": current, "to": new_status})
