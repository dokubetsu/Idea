from fastapi import APIRouter, Depends, Query, Request, HTTPException
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import asyncio
import uuid
import time
from sse_starlette.sse import EventSourceResponse

from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.shared.database import get_db
from app.domains.notifications.models import NotificationOut, NotificationStatus
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster
import app.domains.notifications.service as service
import app.domains.notifications.preferences as prefs_service

bearer = HTTPBearer(auto_error=False)

# Dictionary mapping ticket_id -> {"user_id": str, "expires_at": float}
SSE_TICKETS: Dict[str, dict] = {}
TICKET_EXPIRY_SECONDS = 30
MAX_TOTAL_TICKETS = 5000
MAX_TICKETS_PER_USER = 5


def _clean_expired_tickets():
    now = time.time()
    expired = [k for k, v in SSE_TICKETS.items() if now > v["expires_at"]]
    for k in expired:
        SSE_TICKETS.pop(k, None)


# ── SSE auth helper (native EventSource with short-lived tickets) ─────────────
async def get_sse_user(
    ticket: Optional[str] = Query(None),
    db=Depends(get_db),
) -> CurrentUser:
    if not ticket:
        raise HTTPException(status_code=401, detail="Not authenticated")

    ticket_data = SSE_TICKETS.pop(ticket, None)
    if not ticket_data:
        raise HTTPException(status_code=401, detail="Invalid or expired ticket")
    if time.time() > ticket_data["expires_at"]:
        raise HTTPException(status_code=401, detail="Ticket expired")

    result = (
        db.table("profiles")
        .select("id,role,full_name,is_active")
        .eq("id", ticket_data["user_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Profile not found")

    p = result.data[0]
    if not p["is_active"]:
        raise HTTPException(status_code=403, detail="Account suspended")

    return CurrentUser(id=p["id"], role=UserRole(p["role"]), full_name=p["full_name"])


# ── Preference request/response models ───────────────────────────────────────
class PreferenceItem(BaseModel):
    type: str
    channel: str
    enabled: bool


class PreferenceOut(BaseModel):
    id: str
    user_id: str
    type: str
    channel: str
    enabled: bool


# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationOut])
def get_notifications(
    status: Optional[NotificationStatus] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db=Depends(get_db),
):
    return service.get_notifications(db, user.id, status, limit, offset)


@router.patch("/{id}/read", response_model=NotificationOut)
def mark_read(
    id: str,
    user: CurrentUser = Depends(get_current_user),
    db=Depends(get_db),
):
    return service.mark_as_read(db, id, user.id)


@router.post("/read-all", response_model=List[NotificationOut])
def mark_all_read(
    user: CurrentUser = Depends(get_current_user),
    db=Depends(get_db),
):
    return service.mark_all_as_read(db, user.id)


# ── Preferences endpoints ─────────────────────────────────────────────────────
@router.get("/preferences", response_model=List[PreferenceOut])
def get_preferences(
    user: CurrentUser = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return the current user's notification delivery preferences."""
    return prefs_service.get_preferences(db, user.id)


@router.patch("/preferences", response_model=List[PreferenceOut])
def update_preferences(
    updates: List[PreferenceItem],
    user: CurrentUser = Depends(get_current_user),
    db=Depends(get_db),
):
    """Bulk-upsert notification preferences for the current user."""
    return prefs_service.bulk_upsert_preferences(
        db,
        user.id,
        [u.model_dump() for u in updates],
    )


@router.post("/ticket")
async def create_sse_ticket(
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Generate a short-lived SSE connection ticket for the current user."""
    _clean_expired_tickets()

    # 1. Cap total active tickets to prevent memory exhaustion DoS
    if len(SSE_TICKETS) >= MAX_TOTAL_TICKETS:
        raise HTTPException(
            status_code=429, detail="Server is busy. Please try again later."
        )

    # 2. Cap tickets per user. If limit exceeded, evict oldest to make room.
    user_tickets = [k for k, v in SSE_TICKETS.items() if v.get("user_id") == user.id]
    if len(user_tickets) >= MAX_TICKETS_PER_USER:
        sorted_keys = sorted(
            user_tickets, key=lambda k: SSE_TICKETS[k].get("expires_at", 0)
        )
        SSE_TICKETS.pop(sorted_keys[0], None)

    ticket_id = str(uuid.uuid4())
    SSE_TICKETS[ticket_id] = {
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name,
        "expires_at": time.time() + TICKET_EXPIRY_SECONDS,
    }
    return {"ticket": ticket_id}


# ── SSE stream ────────────────────────────────────────────────────────────────
@router.get("/stream")
async def stream_notifications(
    request: Request,
    user: CurrentUser = Depends(get_sse_user),
):
    user_id = user.id
    queue = sse_broadcaster.subscribe(user_id)

    async def event_generator():
        try:
            yield {"event": "connect", "data": "connected"}

            while True:
                if await request.is_disconnected():
                    break
                try:
                    notification = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield {"event": "notification", "data": json.dumps(notification)}
                except asyncio.TimeoutError:
                    yield {"comment": "keep-alive"}
        finally:
            sse_broadcaster.unsubscribe(user_id, queue)

    return EventSourceResponse(event_generator())
