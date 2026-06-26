"""Matter service — business logic separate from HTTP layer."""

from __future__ import annotations
from app.shared.events import sync_emit, EventType
from app.shared.exceptions import NotFound, Forbidden
from app.shared.dependencies import CurrentUser, UserRole

SELECT = "*, " "up:profiles!user_id(full_name), " "lp:profiles!lawyer_id(full_name)"

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["intake"],
    "intake": ["assessment", "matching"],
    "assessment": ["matching", "active"],
    "matching": ["active"],
    "active": ["resolved"],
    "resolved": ["archived"],
    "archived": [],
}


def enrich(row: dict, with_facts: bool = False) -> dict:
    row["user_name"] = (row.pop("up", None) or {}).get("full_name")
    row["lawyer_name"] = (row.pop("lp", None) or {}).get("full_name")
    if not with_facts:
        row["facts"] = []
    return row


def get_matter_or_403(db, matter_id: str, user: CurrentUser) -> dict:
    r = db.table("matters").select(SELECT).eq("id", matter_id).single().execute()
    if not r.data:
        raise NotFound("Matter")
    m = r.data
    if user.role == UserRole.USER and m["user_id"] != user.id:
        raise Forbidden()
    if user.role == UserRole.LAWYER and m["lawyer_id"] != user.id:
        raise Forbidden()
    return m


def transition_status(db, matter_id: str, new_status: str, actor_id: str) -> None:
    try:
        res = db.rpc(
            "transition_matter_status",
            {
                "p_matter_id": matter_id,
                "p_new_status": new_status,
                "p_actor_id": actor_id,
            },
        ).execute()

        if not res.data or len(res.data) == 0:
            raise NotFound("Matter")
        old_status = res.data[0]["old_status"]
    except Exception as e:
        if "Invalid status transition" in str(e):
            from app.shared.exceptions import BadRequest

            raise BadRequest(str(e))
        if "Matter not found" in str(e):
            raise NotFound("Matter")
        raise e

    sync_emit(
        EventType.MATTER_STATUS_CHANGED,
        actor_id=actor_id,
        matter_id=matter_id,
        payload={"from": old_status, "to": new_status},
    )
