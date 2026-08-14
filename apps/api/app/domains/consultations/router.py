import hashlib
import hmac
import logging
import uuid

from app.config import settings
from app.shared import database as shared_database
from app.shared.database import get_db
from app.shared.dependencies import (
    Auth,
    LawyerOrAdmin,
    UserRole,
    check_consultation_ownership,
    ensure_lawyer_verified,
)
from app.shared.exceptions import Forbidden, NotFound
from fastapi import APIRouter, HTTPException, Query

from .schemas import (
    PACKAGE_AMOUNTS_INR,
    ConfirmConsultationOut,
    ConsultationCreate,
    ConsultationOut,
    ConsultationPatch,
    VerifyConsultationPaymentRequest,
)
from .service import (
    SELECT_CONSULTATIONS,
    assign_free_lawyer,
    enrich_consultation,
    get_consultation_or_404,
    mark_consultation_paid,
)

log = logging.getLogger(__name__)
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
    check_consultation_ownership(row, user)
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

    if lawyer_id:
        lawyer_res = (
            db.table("profiles")
            .select("id, role, is_active")
            .eq("id", lawyer_id)
            .execute()
        )
        if (
            not lawyer_res.data
            or lawyer_res.data[0].get("role") != "lawyer"
            or not lawyer_res.data[0].get("is_active")
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid or unavailable lawyer",
            )
        verified_res = (
            db.table("lawyer_profiles")
            .select("is_verified")
            .eq("id", lawyer_id)
            .execute()
        )
        if not verified_res.data or not verified_res.data[0].get("is_verified"):
            raise HTTPException(
                status_code=400,
                detail="Lawyer is not yet verified",
            )

    amount_inr = PACKAGE_AMOUNTS_INR.get(body.package, 0.0)
    payload = {
        "user_id": str(user.id),
        "lawyer_id": lawyer_id,
        "package": body.package,
        "sessions_total": sessions_total,
        "notes": body.notes,
        "status": "pending",
        "payment_status": "unpaid" if body.package != "free" else "waived",
        "amount_inr": amount_inr,
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
                db.table("consultations").delete().eq(
                    "id", consultation["id"]
                ).execute()
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


@router.post("/{consultation_id}/razorpay-order")
async def create_consultation_razorpay_order(consultation_id: str, user: Auth):
    """Create a Razorpay order for a paid (starter/full) consultation package."""
    if not settings.FEATURE_CONSULTATIONS:
        raise HTTPException(
            status_code=404, detail="Consultations feature not available"
        )

    row = get_consultation_or_404(consultation_id)
    if str(row.get("user_id")) != str(user.id) and user.role != UserRole.ADMIN:
        raise Forbidden("Only the booking user can pay for this consultation")

    if row.get("package") == "free":
        raise HTTPException(
            status_code=400, detail="Free consultations do not require payment"
        )

    if row.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Consultation already paid")

    if row.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pay consultation in status {row.get('status')}",
        )

    amount_inr = float(
        row.get("amount_inr") or PACKAGE_AMOUNTS_INR.get(row["package"], 0)
    )
    if amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Invalid consultation amount")

    amount_paise = int(round(amount_inr * 100))
    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET
    receipt_id = f"cns_{uuid.uuid4().hex[:12]}"

    if key_id and key_secret:
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(key_id, key_secret),
                    json={
                        "amount": amount_paise,
                        "currency": "INR",
                        "receipt": receipt_id,
                        "notes": {
                            "consultation_id": consultation_id,
                            "package": row["package"],
                            "user_id": str(row["user_id"]),
                        },
                    },
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    log.error("Razorpay consultation order failed: %s", resp.text)
                    raise HTTPException(
                        status_code=502,
                        detail="Failed to create order with payment gateway",
                    )
                order_data = resp.json()
                order_id = order_data["id"]
                # Persist order id for later verify correlation
                # Look up via module so tests can patch app.shared.database.get_service_role_db
                db = shared_database.get_service_role_db()
                db.table("consultations").update({"payment_order_id": order_id}).eq(
                    "id", consultation_id
                ).execute()
                return {
                    "order_id": order_id,
                    "amount": order_data["amount"],
                    "currency": order_data["currency"],
                    "key_id": key_id,
                    "consultation_id": consultation_id,
                    "mock": False,
                }
        except HTTPException:
            raise
        except Exception as e:
            log.exception("Razorpay consultation order connection failed")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to payment gateway: {str(e)}",
            )

    # Dev/mock path
    mock_order_id = f"order_mock_{uuid.uuid4().hex[:12]}"
    db = shared_database.get_service_role_db()
    db.table("consultations").update({"payment_order_id": mock_order_id}).eq(
        "id", consultation_id
    ).execute()
    return {
        "order_id": mock_order_id,
        "amount": amount_paise,
        "currency": "INR",
        "key_id": "rzp_test_mockkey123",
        "consultation_id": consultation_id,
        "mock": True,
    }


@router.post("/{consultation_id}/verify-payment")
async def verify_consultation_payment(
    consultation_id: str,
    body: VerifyConsultationPaymentRequest,
    user: Auth,
):
    """Verify Razorpay payment and mark consultation as paid (atomic RPC)."""
    if not settings.FEATURE_CONSULTATIONS:
        raise HTTPException(
            status_code=404, detail="Consultations feature not available"
        )

    row = get_consultation_or_404(consultation_id)
    if str(row.get("user_id")) != str(user.id) and user.role != UserRole.ADMIN:
        raise Forbidden(
            "Only the booking user can verify payment for this consultation"
        )

    if row.get("package") == "free":
        raise HTTPException(
            status_code=400, detail="Free consultations do not require payment"
        )

    if row.get("payment_status") == "paid":
        return {
            "consultation_id": consultation_id,
            "payment_status": "paid",
            "already_paid": True,
        }

    amount_inr = float(
        row.get("amount_inr") or PACKAGE_AMOUNTS_INR.get(row["package"], 0)
    )
    key_secret = settings.RAZORPAY_KEY_SECRET
    is_mock_order = body.razorpay_order_id.startswith("order_mock_")

    if not settings.is_production and is_mock_order:
        pass
    elif not settings.is_production and body.razorpay_order_id == "mock":
        pass
    else:
        if not key_secret:
            raise HTTPException(
                status_code=503, detail="Payment gateway not configured"
            )

        msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
        expected = hmac.new(key_secret.encode(), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(body.razorpay_signature, expected):
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        import httpx

        key_id = settings.RAZORPAY_KEY_ID
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.razorpay.com/v1/payments/{body.razorpay_payment_id}",
                    auth=(key_id, key_secret),
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to fetch payment details from gateway",
                    )
                payment_entity = resp.json()
                if payment_entity.get("status") not in ("captured", "authorized"):
                    raise HTTPException(
                        status_code=400, detail="Payment is not captured/authorized"
                    )

                actual_amount_paise = payment_entity.get("amount")
                expected_amount_paise = int(round(amount_inr * 100))
                if (
                    actual_amount_paise is None
                    or abs(actual_amount_paise - expected_amount_paise) > 1
                    or payment_entity.get("currency") != "INR"
                ):
                    raise HTTPException(
                        status_code=402, detail="Payment amount or currency mismatch"
                    )

                notes = payment_entity.get("notes") or {}
                if (
                    notes.get("consultation_id")
                    and notes.get("consultation_id") != consultation_id
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="Payment does not belong to this consultation",
                    )
        except HTTPException:
            raise
        except Exception as e:
            log.exception("Razorpay consultation verify failed")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to verify payment with gateway: {str(e)}",
            )

    idemp_key = f"cns_{body.razorpay_payment_id}"
    result = mark_consultation_paid(
        consultation_id=consultation_id,
        payment_id=body.razorpay_payment_id,
        idemp_key=idemp_key,
        amount_inr=amount_inr,
        user_id=str(row["user_id"]),
    )
    return result


@router.patch("/{consultation_id}/confirm", response_model=ConfirmConsultationOut)
async def confirm_consultation(consultation_id: str, user: LawyerOrAdmin):
    db = get_db()
    # Ownership Check
    row = (
        db.table("consultations")
        .select("user_id, lawyer_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    check_consultation_ownership(row, user, allow_unassigned_lawyer=True)

    try:
        # Derive the lawyer identity from auth.uid() inside confirm_consultation DB function
        # to ensure it cannot be spoofed by the caller. Ownership and role checks happen atomically.
        res = db.rpc(
            "confirm_consultation",
            {"p_consultation_id": consultation_id},
        ).execute()

        if res.data:
            data = res.data[0] if isinstance(res.data, list) else res.data
            return ConfirmConsultationOut(**data)
        raise HTTPException(status_code=500, detail="Failed to confirm consultation")
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "must be pending" in msg:
            raise HTTPException(
                status_code=400, detail="Consultation is no longer pending"
            )
        if "payment_status is unpaid" in msg or "unpaid for package" in msg:
            raise HTTPException(
                status_code=400,
                detail="Cannot confirm consultation until payment is completed",
            ) from e
        raise HTTPException(status_code=400, detail=msg) from e


@router.patch("/{consultation_id}/cancel", response_model=ConsultationOut)
async def cancel_consultation(consultation_id: str, user: Auth):
    if user.role not in (UserRole.USER, UserRole.LAWYER, UserRole.ADMIN):
        raise Forbidden("Only clients and lawyers can cancel consultations")

    db = get_db()
    row = get_consultation_or_404(consultation_id)
    check_consultation_ownership(row, user)

    scheduled_at_str = row.get("scheduled_at")
    if scheduled_at_str:
        from datetime import datetime, timezone

        scheduled = datetime.fromisoformat(scheduled_at_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if (scheduled - now).total_seconds() < 24 * 3600:
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel within 24 hours of scheduled time. Contact support.",
            )

    if row["status"] != "pending":
        raise HTTPException(
            status_code=400, detail="Can only cancel pending consultations"
        )

    res = (
        db.table("consultations")
        .update({"status": "cancelled"})
        .eq("id", consultation_id)
        .eq("status", "pending")
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=400, detail="Consultation is no longer pending")
    return enrich_consultation(res.data[0])


@router.patch("/{consultation_id}/decline", response_model=ConsultationOut)
async def decline_consultation(consultation_id: str, user: LawyerOrAdmin):
    db = get_db()
    row = (
        db.table("consultations")
        .select("user_id, lawyer_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    check_consultation_ownership(row, user)
    if row.get("status") != "pending":
        raise HTTPException(
            status_code=400, detail="Can only decline pending consultations"
        )

    res = (
        db.table("consultations")
        .update({"status": "declined"})
        .eq("id", consultation_id)
        .eq("status", "pending")
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=400, detail="Consultation is no longer pending")
    return enrich_consultation(res.data[0])


@router.patch("/{consultation_id}", response_model=ConsultationOut)
async def patch_consultation(
    consultation_id: str, body: ConsultationPatch, user: LawyerOrAdmin
):
    db = get_db()
    row = (
        db.table("consultations")
        .select("user_id, lawyer_id, status")
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    check_consultation_ownership(row, user)

    terminal_states = {"cancelled", "completed", "declined"}
    if row.get("status") in terminal_states:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot modify a consultation that is already {row['status']}",
        )

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return get_consultation_or_404(consultation_id)

    scheduled_at = updates.get("scheduled_at")
    if scheduled_at and row.get("lawyer_id"):
        from datetime import datetime, timedelta

        if isinstance(scheduled_at, str):
            scheduled_datetime = datetime.fromisoformat(
                scheduled_at.replace("Z", "+00:00")
            )
        else:
            scheduled_datetime = scheduled_at

        window_start = scheduled_datetime - timedelta(minutes=30)
        window_end = scheduled_datetime + timedelta(minutes=30)

        conflicts = (
            db.table("consultations")
            .select("id")
            .eq("lawyer_id", row["lawyer_id"])
            .in_("status", ["pending", "confirmed"])
            .neq("id", consultation_id)
            .gte("scheduled_at", window_start.isoformat())
            .lte("scheduled_at", window_end.isoformat())
            .execute()
        )
        if conflicts.data:
            raise HTTPException(
                status_code=400, detail="This time slot is already booked"
            )

        updates["scheduled_at"] = scheduled_datetime.isoformat()

    res = (
        db.table("consultations")
        .update(updates)
        .eq("id", consultation_id)
        .select(SELECT_CONSULTATIONS)
        .execute()
    )
    return enrich_consultation(res.data[0])
