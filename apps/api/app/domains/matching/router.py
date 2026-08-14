"""Matching domain — lawyer discovery and contact requests."""

from app.shared.database import get_db
from app.shared.dependencies import Auth, LawyerAuth, UserRole
from app.shared.events import EventType, emit
from app.shared.exceptions import NotFound
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/matching", tags=["matching"])

# Public-facing columns only — never return bar_council_id / internal fields
# to arbitrary authenticated users.
LP_SELECT = (
    "id, specializations, court_types, languages, experience_years, bio, "
    "consultation_fee, is_verified, is_available, rating, total_matters, "
    "profiles!inner(full_name, city, state, avatar_url)"
)

_PUBLIC_LP_KEYS = {
    "id",
    "specializations",
    "court_types",
    "languages",
    "experience_years",
    "bio",
    "consultation_fee",
    "is_verified",
    "is_available",
    "rating",
    "total_matters",
}


def _build_lawyer_out(row: dict) -> dict:
    """Project a lawyer_profiles row to a public DTO (no bar IDs / secrets)."""
    p = row.get("profiles", {}) or {}
    public = {k: row.get(k) for k in _PUBLIC_LP_KEYS if k in row or k == "id"}
    public["id"] = row.get("id") or public.get("id")
    public["full_name"] = p.get("full_name")
    public["city"] = p.get("city")
    public["state"] = p.get("state")
    public["avatar_url"] = p.get("avatar_url")
    return public


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

    # Order and page accurately
    if city or state:
        rows = q.order("created_at", desc=True).execute().data or []
        out = [_build_lawyer_out(r) for r in rows]
        if city:
            city_lower = city.strip().lower()
            out = [r for r in out if (r.get("city") or "").lower() == city_lower]
        if state:
            state_lower = state.strip().lower()
            out = [r for r in out if (r.get("state") or "").lower() == state_lower]
        return out[off : off + per_page]
    else:
        rows = (
            q.order("created_at", desc=True)
            .range(off, off + per_page - 1)
            .execute()
            .data
            or []
        )
        return [_build_lawyer_out(r) for r in rows]


@router.get("/lawyers/{lawyer_id}")
async def get_lawyer(lawyer_id: str, user: Auth):
    """Return a verified lawyer's public profile.

    Unverified profiles are only visible to admins (and the lawyer themselves).
    """
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

    row = r.data
    is_verified = bool(row.get("is_verified"))
    is_self = str(lawyer_id) == str(user.id)
    is_admin = user.role == UserRole.ADMIN
    if not is_verified and not is_self and not is_admin:
        raise NotFound("Lawyer")

    return _build_lawyer_out(row)


class ContactRequest(BaseModel):
    matter_id: str | None = None
    message: str | None = Field(default=None, max_length=500)


@router.post("/lawyers/{lawyer_id}/contact", status_code=201)
async def contact_lawyer(lawyer_id: str, body: ContactRequest, user: Auth):
    db = get_db()

    # Validate target is a verified lawyer
    from fastapi import HTTPException

    target = (
        db.table("lawyer_profiles")
        .select("id, is_verified")
        .eq("id", lawyer_id)
        .execute()
    )
    if not target.data or not target.data[0].get("is_verified"):
        raise HTTPException(status_code=400, detail="Target must be a verified lawyer")

    matter_id = body.matter_id
    if matter_id:
        from app.shared.exceptions import Forbidden

        matter_resp = (
            db.table("matters").select("user_id").eq("id", matter_id).execute()
        )
        if not matter_resp.data:
            raise NotFound("Matter")
        if str(matter_resp.data[0]["user_id"]) != str(user.id):
            raise Forbidden("Matter does not belong to you")
    else:
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
            # Derive the caller's identity from auth.uid() inside the DB function.
            # The supabase client forwards the user's JWT automatically.
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
    """Accept or decline a lawyer request.

    Accept uses matching_accept_rpc so request status + matter assignment are
    atomic (no stuck 'accepted' request without a matter assign).
    """
    from app.shared.exceptions import BadRequest
    from fastapi import HTTPException

    db = get_db()

    if body.accept:
        try:
            res = db.rpc("matching_accept_rpc", {"p_request_id": request_id}).execute()
            data = res.data
            if isinstance(data, list) and data:
                data = data[0]
            if not isinstance(data, dict):
                data = {}
            matter_id = data.get("matter_id")
            await emit(
                EventType.LAWYER_ACCEPTED,
                actor_id=user.id,
                matter_id=matter_id,
                payload={
                    "request_id": request_id,
                    "matter_assigned": data.get("matter_assigned"),
                },
            )
            return {
                "ok": True,
                "status": "accepted",
                "matter_id": matter_id,
                "matter_assigned": data.get("matter_assigned"),
            }
        except Exception as e:
            msg = str(e).lower()
            if "does not exist" in msg or "could not find" in msg or "pgrst202" in msg:
                # Fall through to legacy multi-step path
                pass
            elif "not found" in msg:
                raise NotFound("Request") from e
            elif "already been processed" in msg:
                raise BadRequest("Request has already been processed") from e
            elif "no longer in the matching" in msg:
                raise HTTPException(
                    status_code=409,
                    detail="This matter is no longer in the matching state.",
                ) from e
            elif "already been assigned" in msg:
                raise HTTPException(
                    status_code=409,
                    detail="This matter has already been assigned to another lawyer.",
                ) from e
            else:
                raise HTTPException(status_code=400, detail=str(e)) from e

    # Decline (or accept fallback when RPC missing)
    status = "accepted" if body.accept else "declined"
    r = (
        db.table("lawyer_requests")
        .update({"status": status})
        .eq("id", request_id)
        .eq("lawyer_id", user.id)
        .eq("status", "pending")
        .execute()
    )
    if not r.data:
        exists_resp = (
            db.table("lawyer_requests")
            .select("status")
            .eq("id", request_id)
            .eq("lawyer_id", user.id)
            .execute()
        )
        if not exists_resp.data:
            raise NotFound("Request")
        raise BadRequest("Request has already been processed")
    req = r.data[0]

    if body.accept and req.get("matter_id"):
        from datetime import datetime, timezone

        matter_row = (
            db.table("matters")
            .select("status")
            .eq("id", req["matter_id"])
            .single()
            .execute()
            .data
        )
        if not matter_row or matter_row.get("status") != "matching":
            # Roll back request accept to avoid stuck accepted state
            db.table("lawyer_requests").update({"status": "pending"}).eq(
                "id", request_id
            ).eq("status", "accepted").execute()
            raise HTTPException(
                status_code=409,
                detail="This matter is no longer in the matching state.",
            )

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
            .eq("status", "matching")
            .is_("lawyer_id", "null")
            .execute()
        )

        if not update_result.data:
            db.table("lawyer_requests").update({"status": "pending"}).eq(
                "id", request_id
            ).eq("status", "accepted").execute()
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
