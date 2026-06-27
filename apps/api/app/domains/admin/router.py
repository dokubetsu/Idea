from fastapi import APIRouter, Query
from app.shared.database import get_db
from app.shared.dependencies import AdminAuth
from app.shared.events import emit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def stats(user: AdminAuth):
    db = get_db()
    res = db.rpc("get_admin_stats").execute()
    return res.data or {}


@router.get("/lawyers/pending")
async def pending_lawyers(user: AdminAuth):
    db = get_db()
    return (
        db.table("lawyer_profiles")
        .select("*, profiles!inner(full_name, city, state, phone, created_at)")
        .eq("is_verified", False)
        .order("created_at")
        .execute()
        .data
        or []
    )


@router.patch("/lawyers/{lawyer_id}/verify")
async def verify_lawyer(lawyer_id: str, user: AdminAuth):
    db = get_db()
    db.rpc("verify_lawyer_rpc", {"p_lawyer_id": lawyer_id}).execute()

    await emit(
        "admin.lawyer_verified", actor_id=user.id, payload={"lawyer_id": lawyer_id}
    )
    return {"ok": True}


@router.patch("/lawyers/{lawyer_id}/suspend")
async def suspend_lawyer(lawyer_id: str, user: AdminAuth):
    db = get_db()
    db.rpc("suspend_lawyer_rpc", {"p_lawyer_id": lawyer_id}).execute()
    await emit(
        "lawyer.suspended", actor_id=user.id, payload={"lawyer_id": lawyer_id}
    )
    return {"ok": True}


@router.get("/users")
async def list_users(
    user: AdminAuth,
    role: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    page: int | None = Query(default=None, ge=1),
    per_page: int | None = Query(default=None, ge=1, le=100),
):
    db = get_db()
    q = db.table("profiles").select("*")
    if role:
        q = q.eq("role", role)

    if cursor:
        q = q.lt("created_at", cursor)
        return q.order("created_at", desc=True).limit(limit).execute().data or []
    else:
        p = page or 1
        pp = per_page or limit
        off = (p - 1) * pp
        return (
            q.order("created_at", desc=True).range(off, off + pp - 1).execute().data
            or []
        )


@router.get("/matters")
async def list_all_matters(
    user: AdminAuth,
    status: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    page: int | None = Query(default=None, ge=1),
    per_page: int | None = Query(default=None, ge=1, le=100),
):
    db = get_db()
    q = db.table("matters").select(
        "*, up:profiles!user_id(full_name), lp:profiles!lawyer_id(full_name)"
    )
    if status:
        q = q.eq("status", status)

    if cursor:
        q = q.lt("created_at", cursor)
        return q.order("created_at", desc=True).limit(limit).execute().data or []
    else:
        p = page or 1
        pp = per_page or limit
        off = (p - 1) * pp
        return (
            q.order("created_at", desc=True).range(off, off + pp - 1).execute().data
            or []
        )


@router.get("/events")
async def recent_events(user: AdminAuth, limit: int = Query(default=50, le=200)):
    db = get_db()
    return (
        db.table("events")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
