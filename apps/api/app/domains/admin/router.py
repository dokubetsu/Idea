from fastapi import APIRouter, Query
from app.shared.database import get_db
from app.shared.dependencies import AdminAuth
from app.shared.events import emit, EventType

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def stats(user: AdminAuth):
    db = get_db()
    return {
        "total_users": (
            db.table("profiles")
            .select("id", count="exact")
            .eq("role", "user")
            .execute()
        ).count
        or 0,
        "total_lawyers": (
            db.table("profiles")
            .select("id", count="exact")
            .eq("role", "lawyer")
            .execute()
        ).count
        or 0,
        "total_matters": (
            db.table("matters").select("id", count="exact").execute()
        ).count
        or 0,
        "open_matters": (
            db.table("matters")
            .select("id", count="exact")
            .in_("status", ["intake", "assessment", "matching", "active"])
            .execute()
        ).count
        or 0,
        "pending_verifications": (
            db.table("lawyer_profiles")
            .select("id", count="exact")
            .eq("is_verified", False)
            .execute()
        ).count
        or 0,
        "total_facts": (db.table("facts").select("id", count="exact").execute()).count
        or 0,
    }


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
    db.table("lawyer_profiles").update({"is_verified": True}).eq(
        "id", lawyer_id
    ).execute()
    db.table("profiles").update({"role": "lawyer"}).eq("id", lawyer_id).execute()

    try:
        from gotrue import AdminUserAttributes

        db.auth.admin.update_user_by_id(
            lawyer_id, AdminUserAttributes(app_metadata={"role": "lawyer"})
        )
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(
            "Failed to sync lawyer role to app_metadata: %s", e
        )

    await emit(
        "admin.lawyer_verified", actor_id=user.id, payload={"lawyer_id": lawyer_id}
    )
    return {"ok": True}


@router.patch("/lawyers/{lawyer_id}/suspend")
async def suspend_lawyer(lawyer_id: str, user: AdminAuth):
    db = get_db()
    db.table("profiles").update({"is_active": False}).eq("id", lawyer_id).execute()
    db.table("lawyer_profiles").update({"is_available": False}).eq(
        "id", lawyer_id
    ).execute()
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
