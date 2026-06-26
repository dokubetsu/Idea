"""Matching domain — lawyer discovery and contact requests."""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from app.shared.database import get_db
from app.shared.dependencies import Auth, LawyerAuth
from app.shared.events import emit, EventType
from app.shared.exceptions import NotFound

router = APIRouter(prefix="/matching", tags=["matching"])

LP_SELECT = "*, profiles!inner(full_name, city, state, avatar_url)"


def _build_lawyer_out(row: dict) -> dict:
    p = row.pop("profiles", {}) or {}
    return {
        **row,
        "full_name": p.get("full_name"),
        "city": p.get("city"),
        "state": p.get("state"),
        "avatar_url": p.get("avatar_url"),
    }


@router.get("/lawyers")
async def list_lawyers(
    user: Auth,
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    specialization: str | None = Query(default=None),
    min_experience: int | None = Query(default=None, ge=0),
    max_fee: float | None = Query(default=None),
    available_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    db = get_db()
    off = (page - 1) * per_page
    q = db.table("lawyer_profiles").select(LP_SELECT).eq("is_verified", True)

    if available_only:
        q = q.eq("is_available", True)
    if min_experience is not None:
        q = q.gte("experience_years", min_experience)
    if max_fee is not None:
        q = q.lte("consultation_fee", max_fee)

    if specialization:
        q = q.contains("specializations", [specialization])

    # FIX F: PostgREST resource-embedding filters (profiles.city / profiles.state)
    # silently no-op in many versions of the supabase-py client. Filter in Python
    # after the join is resolved instead. Fetch a slightly larger window to
    # compensate for rows dropped by the Python filter.
    fetch_limit = per_page * 3 if (city or state) else per_page
    rows = q.range(off, off + fetch_limit - 1).execute().data or []

    out = [_build_lawyer_out(r) for r in rows]

    if city:
        city_lower = city.strip().lower()
        out = [r for r in out if (r.get("city") or "").lower() == city_lower]
    if state:
        state_lower = state.strip().lower()
        out = [r for r in out if (r.get("state") or "").lower() == state_lower]

    return out[:per_page]


@router.get("/lawyers/{lawyer_id}")
async def get_lawyer(lawyer_id: str, user: Auth):
    db = get_db()
    r = (
        db.table("lawyer_profiles")
        .select(LP_SELECT)
        .eq("id", lawyer_id)
        .single()
        .execute()
    )
    if not r.data:
        raise NotFound("Lawyer")
    return _build_lawyer_out(r.data)


class ContactRequest(BaseModel):
    matter_id: str | None = None
    message: str | None = Field(default=None, max_length=500)


@router.post("/lawyers/{lawyer_id}/contact", status_code=201)
async def contact_lawyer(lawyer_id: str, body: ContactRequest, user: Auth):
    db = get_db()

    matter_id = body.matter_id
    if not matter_id:
        latest_matter = (
            db.table("matters")
            .select("id")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_matter:
            matter_id = latest_matter[0]["id"]

    res = db.rpc(
        "contact_lawyer_rpc",
        {
            # C7: p_user_id removed — migration 026 rewrites contact_lawyer_rpc
            # to derive the caller's identity from auth.uid() inside the DB function.
            # The supabase-py client forwards the user's JWT automatically.
            "p_lawyer_id": lawyer_id,
            "p_matter_id": matter_id,
            "p_message": body.message,
        },
    ).execute()

    result = res.data

    if not result.get("already_exists", False):
        await emit(
            EventType.LAWYER_REQUESTED,
            actor_id=user.id,
            matter_id=matter_id,
            payload={"lawyer_id": lawyer_id},
        )

    return {"ok": result["ok"], "message": result["message"]}


@router.get("/requests/incoming")
async def incoming_requests(
    user: LawyerAuth,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    db = get_db()
    off = (page - 1) * per_page
    rows = (
        db.table("lawyer_requests")
        .select(
            "*, requester:profiles!user_id(full_name,city,phone), matters(title,category,status)"
        )
        .eq("lawyer_id", user.id)
        .order("created_at", desc=True)
        .range(off, off + per_page - 1)
        .execute()
        .data
        or []
    )
    return rows


class RespondRequest(BaseModel):
    accept: bool


@router.patch("/requests/{request_id}")
async def respond_to_request(request_id: str, body: RespondRequest, user: LawyerAuth):
    db = get_db()
    status = "accepted" if body.accept else "declined"
    r = (
        db.table("lawyer_requests")
        .update({"status": status})
        .eq("id", request_id)
        .eq("lawyer_id", user.id)
        .execute()
    )
    if not r.data:
        raise NotFound("Request")
    req = r.data[0]

    if body.accept and req.get("matter_id"):
        from datetime import datetime, timezone
        from fastapi import HTTPException

        # H2: Optimistic locking — only assign if lawyer_id is still NULL.
        # If two lawyers accept the same pending matter concurrently, the second
        # UPDATE finds no rows (lawyer_id already set by the first winner) and
        # returns a 409 rather than silently overwriting the first assignment.
        update_result = (
            db.table("matters")
            .update(
                {
                    "lawyer_id": user.id,
                    "status": "active",
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", req["matter_id"])
            .is_("lawyer_id", "null")  # optimistic lock: only update unassigned matters
            .execute()
        )

        if not update_result.data:
            raise HTTPException(
                status_code=409,
                detail="This matter has already been assigned to another lawyer.",
            )

    event = EventType.LAWYER_ACCEPTED if body.accept else EventType.LAWYER_DECLINED
    await emit(
        event,
        actor_id=user.id,
        matter_id=req.get("matter_id"),
        payload={"request_id": request_id},
    )
    return {"ok": True, "status": status}


@router.patch("/me/availability")
async def toggle_availability(available: bool, user: LawyerAuth):
    db = get_db()
    db.table("lawyer_profiles").update({"is_available": available}).eq(
        "id", user.id
    ).execute()
    return {"ok": True, "is_available": available}
