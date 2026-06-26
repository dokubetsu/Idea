from fastapi import APIRouter, Query, HTTPException
from app.shared.dependencies import Auth, LawyerOrAdmin, UserRole, ensure_lawyer_verified
from app.shared.database import get_db
from app.shared.exceptions import Forbidden, NotFound
from .schemas import (
    ConsultationCreate,
    ConsultationOut,
    ConfirmConsultationOut,
    ConsultationPatch,
)
from .service import (
    enrich_consultation,
    get_consultation_or_404,
    assign_free_lawyer,
    SELECT_CONSULTATIONS,
)

router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.get("", response_model=list[ConsultationOut])
async def list_consultations(
    user: Auth,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    db = get_db()
    off = (page - 1) * per_page
    q = db.table("consultations").select(SELECT_CONSULTATIONS)

    if user.role == UserRole.USER:
        q = q.eq("user_id", user.id)
    elif user.role == UserRole.LAWYER:
        ensure_lawyer_verified(user)
        q = q.eq("lawyer_id", user.id)

    if status:
        q = q.eq("status", status)

    rows = (
        q.order("created_at", desc=True).range(off, off + per_page - 1).execute().data
        or []
    )
    return [enrich_consultation(r) for r in rows]


@router.get("/{consultation_id}", response_model=ConsultationOut)
async def get_consultation(consultation_id: str, user: Auth):
    row = get_consultation_or_404(consultation_id)
    if user.role == UserRole.USER and row["user_id"] != str(user.id):
        raise Forbidden("Not your consultation")
    if user.role == UserRole.LAWYER:
        ensure_lawyer_verified(user)
        if row["lawyer_id"] != str(user.id):
            raise Forbidden("Not your assigned consultation")
    return row


@router.post("", response_model=ConsultationOut, status_code=201)
async def create_consultation(body: ConsultationCreate, user: Auth):
    if user.role != UserRole.USER:
        raise Forbidden("Only users can book consultations")

    db = get_db()

    sessions_total = 1
    if body.package == "starter":
        sessions_total = 3
    elif body.package == "full":
        sessions_total = 5

    lawyer_id = body.lawyer_id
    needs_auto_assign = body.package == "free" and not lawyer_id

    payload = {
        "user_id": str(user.id),
        "lawyer_id": lawyer_id,
        "package": body.package,
        "sessions_total": sessions_total,
        "notes": body.notes,
        "status": "pending",
        "payment_status": "unpaid" if body.package != "free" else "waived",
    }
    if body.idempotency_key:
        payload["idempotency_key"] = body.idempotency_key

    try:
        res = (
            db.table("consultations")
            .insert(payload)
            .select(SELECT_CONSULTATIONS)
            .execute()
        )
        consultation = res.data[0]

        if needs_auto_assign:
            assigned_lawyer_id = assign_free_lawyer(consultation["id"])
            if not assigned_lawyer_id:
                db.table("consultations").delete().eq("id", consultation["id"]).execute()
                raise HTTPException(
                    status_code=400,
                    detail="No lawyers currently available for free consultations",
                )
            consultation = get_consultation_or_404(consultation["id"])

        return enrich_consultation(consultation)
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "already exists" in msg or "unique" in msg:
            if body.idempotency_key:
                existing = (
                    db.table("consultations")
                    .select(SELECT_CONSULTATIONS)
                    .eq("idempotency_key", body.idempotency_key)
                    .execute()
                )
                if existing.data:
                    return enrich_consultation(existing.data[0])
        raise e


@router.patch("/{consultation_id}/confirm", response_model=ConfirmConsultationOut)
async def confirm_consultation(consultation_id: str, user: LawyerOrAdmin):
    db = get_db()
    # Ownership Check
    row = (
        db.table("consultations")
        .select("lawyer_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    if (
        row.get("lawyer_id") is not None
        and row["lawyer_id"] != str(user.id)
        and user.role != UserRole.ADMIN
    ):
        raise Forbidden("This consultation is not assigned to you")

    try:
        # H3 security fix: p_lawyer_id is no longer passed to the RPC.
        # Migration 022 rewrote confirm_consultation to derive the lawyer identity
        # from auth.uid() inside the DB function — it cannot be spoofed by the caller.
        # The ownership and role checks happen atomically in the SECURITY DEFINER function.
        res = db.rpc(
            "confirm_consultation",
            {"p_consultation_id": consultation_id},
        ).execute()

        if res.data:
            return ConfirmConsultationOut(**res.data[0])
        raise HTTPException(status_code=500, detail="Failed to confirm consultation")
    except Exception as e:
        msg = str(e)
        if "must be pending" in msg:
            raise HTTPException(
                status_code=400, detail="Consultation is no longer pending"
            )
        raise e


@router.patch("/{consultation_id}/cancel", response_model=ConsultationOut)
async def cancel_consultation(consultation_id: str, user: Auth):
    if user.role != UserRole.USER:
        raise Forbidden("Only users can cancel consultations via this endpoint")

    db = get_db()
    row = (
        db.table("consultations")
        .select("user_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    if row["user_id"] != str(user.id):
        raise Forbidden("This consultation is not yours to cancel")
    if row["status"] != "pending":
        raise HTTPException(
            status_code=400, detail="Can only cancel pending consultations"
        )

    res = (
        db.table("consultations")
        .update({"status": "cancelled"})
        .eq("id", consultation_id)
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    return enrich_consultation(res.data[0])


@router.patch("/{consultation_id}/decline", response_model=ConsultationOut)
async def decline_consultation(consultation_id: str, user: LawyerOrAdmin):
    db = get_db()
    row = (
        db.table("consultations")
        .select("lawyer_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    if (
        row.get("lawyer_id") is None or row["lawyer_id"] != str(user.id)
    ) and user.role != UserRole.ADMIN:
        raise Forbidden("This consultation is not assigned to you")
    if row.get("status") != "pending":
        raise HTTPException(
            status_code=400, detail="Can only decline pending consultations"
        )

    res = (
        db.table("consultations")
        .update({"status": "declined"})
        .eq("id", consultation_id)
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    return enrich_consultation(res.data[0])


@router.patch("/{consultation_id}", response_model=ConsultationOut)
async def patch_consultation(
    consultation_id: str, body: ConsultationPatch, user: LawyerOrAdmin
):
    db = get_db()
    row = (
        db.table("consultations")
        .select("lawyer_id")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    if (
        row.get("lawyer_id") is None or row["lawyer_id"] != str(user.id)
    ) and user.role != UserRole.ADMIN:
        raise Forbidden("This consultation is not assigned to you")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return get_consultation_or_404(consultation_id)

    res = (
        db.table("consultations")
        .update(updates)
        .eq("id", consultation_id)
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    return enrich_consultation(res.data[0])
