"""Matter payments — Razorpay orders, verify, webhook, apply_payment."""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.domains.matters.service import get_matter_or_403
from app.shared.database import get_db, get_service_role_db
from app.shared.dependencies import Auth
from app.shared.events import EventType, emit

log = logging.getLogger(__name__)
router = APIRouter(tags=["matters-payments"])


async def apply_payment(
    db,
    milestone_id: str,
    payment_id: str,
    idemp_key: str | None,
    amount_inr: float | None,
    user_id: str | None,
) -> dict:
    """Atomic helper to mark a milestone as paid and insert payment record.

    Prefers apply_payment_rpc (single DB transaction). Falls back to multi-step
    PostgREST only if the RPC is unavailable (legacy DBs).

    `db` should be a service-role client (callers already pass one).
    """
    try:
        res = db.rpc(
            "apply_payment_rpc",
            {
                "p_milestone_id": milestone_id,
                "p_payment_id": payment_id,
                "p_idemp_key": idemp_key,
                "p_amount_inr": float(amount_inr) if amount_inr is not None else None,
                "p_user_id": user_id,
            },
        ).execute()
        data = res.data
        if isinstance(data, list) and data:
            milestone = data[0] if isinstance(data[0], dict) else {}
        elif isinstance(data, dict):
            milestone = data
        else:
            milestone = {}

        if not milestone.get("id"):
            # Unexpected shape — re-fetch
            milestone_res = (
                db.table("matter_milestones")
                .select("*")
                .eq("id", milestone_id)
                .execute()
            )
            if not milestone_res.data:
                raise HTTPException(status_code=404, detail="Milestone not found")
            milestone = milestone_res.data[0]

        already_paid = bool(milestone.get("already_paid"))
        if not already_paid:
            actor_id = user_id or "00000000-0000-0000-0000-000000000000"
            await emit(
                EventType.MILESTONE_UPDATED,
                actor_id=actor_id,
                matter_id=milestone.get("matter_id"),
                payload={"milestone_id": milestone_id, "status": "completed"},
            )
        # Strip RPC-only keys before returning
        milestone.pop("already_paid", None)
        return milestone
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "idempotency key already used" in msg:
            raise HTTPException(
                status_code=400,
                detail="Idempotency key already used for another milestone",
            ) from e
        if "not found" in msg:
            raise HTTPException(status_code=404, detail="Milestone not found") from e
        if "does not exist" in msg or "could not find" in msg or "pgrst202" in msg:
            log.warning(
                "apply_payment_rpc unavailable, using multi-step fallback: %s", e
            )
        else:
            log.exception("apply_payment_rpc failed: %s", e)
            raise HTTPException(status_code=400, detail=str(e)) from e

    # ── Fallback (pre-migration 059) ─────────────────────────────
    milestone_res = (
        db.table("matter_milestones").select("*").eq("id", milestone_id).execute()
    )
    if not milestone_res.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone = milestone_res.data[0]

    if milestone.get("is_paid"):
        return milestone

    if idemp_key:
        existing_key_res = (
            db.table("matter_milestones")
            .select("id", "is_paid", "payment_gateway_ref")
            .eq("payment_idempotency_key", idemp_key)
            .execute()
        )
        if existing_key_res.data:
            existing = existing_key_res.data[0]
            if existing["id"] == milestone_id:
                return milestone
            raise HTTPException(
                status_code=400,
                detail="Idempotency key already used for another milestone",
            )

    update_data = {
        "is_paid": True,
        "payment_gateway_ref": payment_id,
        "payment_idempotency_key": idemp_key,
        "completed_at": datetime.now(UTC).isoformat(),
    }

    result = (
        db.table("matter_milestones")
        .update(update_data)
        .eq("id", milestone_id)
        .eq("is_paid", False)
        .execute()
    )
    if not result.data:
        return milestone

    if amount_inr is not None and float(amount_inr) > 0:
        payment_data = {
            "milestone_id": milestone_id,
            "user_id": user_id,
            "amount_inr": float(amount_inr),
            "status": "completed",
            "payment_id": payment_id,
            "payment_idempotency_key": idemp_key,
        }
        pay_res = db.table("payments").insert(payment_data).execute()
        if pay_res.data:
            payment_record_id = pay_res.data[0].get("id")
            db.table("matter_milestones").update(
                {"payment_record_id": payment_record_id}
            ).eq("id", milestone_id).execute()

    actor_id = user_id or "00000000-0000-0000-0000-000000000000"
    await emit(
        EventType.MILESTONE_UPDATED,
        actor_id=actor_id,
        matter_id=milestone["matter_id"],
        payload={"milestone_id": milestone_id, "status": "completed"},
    )

    milestone_res = (
        db.table("matter_milestones").select("*").eq("id", milestone_id).execute()
    )
    return milestone_res.data[0]


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


@router.post("/{matter_id}/milestones/{milestone_id}/razorpay-order")
async def create_razorpay_order(matter_id: str, milestone_id: str, user: Auth):
    if not settings.FEATURE_BILLING:
        raise HTTPException(status_code=404, detail="Billing feature not available")

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    # Fetch milestone
    milestone_res = (
        db.table("matter_milestones")
        .select("*")
        .eq("id", milestone_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not milestone_res.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone = milestone_res.data[0]

    if milestone.get("is_paid"):
        raise HTTPException(status_code=400, detail="Milestone already paid")

    amount_inr = float(milestone.get("amount_inr") or 0)
    if amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Invalid milestone amount")

    amount_paise = int(amount_inr * 100)

    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET

    receipt_id = f"rcpt_{uuid.uuid4().hex[:12]}"

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
                        "notes": {"milestone_id": milestone_id, "matter_id": matter_id},
                    },
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    log.error("Razorpay order creation failed: %s", resp.text)
                    raise HTTPException(
                        status_code=502,
                        detail="Failed to create order with payment gateway",
                    )
                order_data = resp.json()
                return {
                    "order_id": order_data["id"],
                    "amount": order_data["amount"],
                    "currency": order_data["currency"],
                    "key_id": key_id,
                    "mock": False,
                }
        except Exception as e:
            log.exception("Razorpay connection failed")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to payment gateway: {str(e)}",
            )
    else:
        # Create mock order for development/testing
        mock_order_id = f"order_mock_{uuid.uuid4().hex[:12]}"
        return {
            "order_id": mock_order_id,
            "amount": amount_paise,
            "currency": "INR",
            "key_id": "rzp_test_mockkey123",
            "mock": True,
        }


@router.post("/{matter_id}/milestones/{milestone_id}/verify-payment")
async def verify_payment(
    matter_id: str, milestone_id: str, body: VerifyPaymentRequest, user: Auth
):
    if not settings.FEATURE_BILLING:
        raise HTTPException(status_code=404, detail="Billing feature not available")

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    # Fetch milestone
    milestone_res = (
        db.table("matter_milestones")
        .select("*")
        .eq("id", milestone_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not milestone_res.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone = milestone_res.data[0]

    if milestone.get("is_paid"):
        return milestone

    key_secret = settings.RAZORPAY_KEY_SECRET

    is_mock_order = body.razorpay_order_id.startswith("order_mock_")

    if (
        not settings.is_production
        and is_mock_order
        or not settings.is_production
        and body.razorpay_order_id == "mock"
    ):
        pass  # mock bypass
    else:
        # Require real verification
        if not key_secret:
            raise HTTPException(
                status_code=503,
                detail="Payment gateway not configured",
            )

        msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
        expected = hmac.new(key_secret.encode(), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(body.razorpay_signature, expected):
            audit_data = {
                "actor_id": user.id,
                "action": "payment_signature_mismatch",
                "target_type": "matter_milestones",
                "target_id": milestone_id,
                "changes": {
                    "razorpay_order_id": body.razorpay_order_id,
                    "razorpay_payment_id": body.razorpay_payment_id,
                    "razorpay_signature": body.razorpay_signature,
                },
            }
            service_db = get_service_role_db()
            service_db.table("audit_logs").insert(audit_data).execute()
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        # Server-to-server validation with Razorpay API
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
                    log.error("Razorpay payment fetch failed: %s", resp.text)
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to fetch payment details from gateway",
                    )

                payment_entity = resp.json()

                # Check status
                if payment_entity.get("status") not in ("captured", "authorized"):
                    raise HTTPException(
                        status_code=400, detail="Payment is not captured/authorized"
                    )

                # Check amount & currency
                actual_amount_paise = payment_entity.get("amount")
                actual_currency = payment_entity.get("currency")
                expected_amount_paise = int(
                    float(milestone.get("amount_inr") or 0) * 100
                )

                amount_mismatch = False
                if (
                    actual_amount_paise is None
                    or abs(actual_amount_paise - expected_amount_paise) > 1
                ):
                    amount_mismatch = True

                if amount_mismatch or actual_currency != "INR":
                    audit_data = {
                        "actor_id": user.id,
                        "action": "payment_mismatch",
                        "target_type": "matter_milestones",
                        "target_id": milestone_id,
                        "changes": {
                            "expected_amount_paise": expected_amount_paise,
                            "actual_amount_paise": actual_amount_paise,
                            "expected_currency": "INR",
                            "actual_currency": actual_currency,
                            "payment_id": body.razorpay_payment_id,
                        },
                    }
                    service_db = get_service_role_db()
                    service_db.table("audit_logs").insert(audit_data).execute()
                    raise HTTPException(
                        status_code=402, detail="Payment amount or currency mismatch"
                    )

                # Check milestone_id in notes
                notes = payment_entity.get("notes", {})
                if notes.get("milestone_id") != milestone_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Payment does not belong to this milestone",
                    )
        except HTTPException:
            raise
        except Exception as e:
            log.exception("Razorpay connection failed in verify-payment")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to verify payment with gateway: {str(e)}",
            )

    service_db = get_service_role_db()
    idemp_key = f"idemp_{body.razorpay_payment_id}"
    return await apply_payment(
        service_db,
        milestone_id=milestone_id,
        payment_id=body.razorpay_payment_id,
        idemp_key=idemp_key,
        amount_inr=milestone.get("amount_inr"),
        user_id=user.id,
    )


@router.post("/webhook/payment")
async def payment_webhook(request: Request):
    # Enforce body size limit of 64KB on webhook payload
    content_length = request.headers.get("Content-Length")
    if content_length:
        try:
            if int(content_length) > 64 * 1024:
                raise HTTPException(status_code=413, detail="Payload too large")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length header")
    else:
        raise HTTPException(status_code=411, detail="Length required")

    # 1. Read request body
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    # 2. Verify signature
    # In non-production, allow signature verification bypass if signature is "mock"
    is_mock = settings.PAYMENT_WEBHOOK_SKIP_VERIFICATION and signature == "mock"

    if not is_mock:
        if not signature:
            raise HTTPException(
                status_code=400, detail="Missing X-Razorpay-Signature header"
            )

        expected_sig = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = payload.get("event")
    if event != "payment.captured":
        return {"status": "ignored", "reason": f"Unhandled event type: {event}"}

    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment_entity.get("id")
    notes = payment_entity.get("notes") or {}
    milestone_id = notes.get("milestone_id")
    consultation_id = notes.get("consultation_id")
    idemp_key = notes.get("payment_idempotency_key")

    db = get_service_role_db()
    actual_amount_paise = payment_entity.get("amount")
    actual_currency = payment_entity.get("currency")

    # ── Consultation payment path ─────────────────────────────────
    if consultation_id:
        from app.domains.consultations.schemas import PACKAGE_AMOUNTS_INR
        from app.domains.consultations.service import mark_consultation_paid

        c_res = (
            db.table("consultations").select("*").eq("id", consultation_id).execute()
        )
        if not c_res.data:
            raise HTTPException(status_code=404, detail="Consultation not found")
        consultation = c_res.data[0]
        amount_inr = float(
            consultation.get("amount_inr")
            or PACKAGE_AMOUNTS_INR.get(consultation.get("package", ""), 0)
        )
        expected_amount_paise = int(round(amount_inr * 100))
        if (
            actual_amount_paise is None
            or abs(actual_amount_paise - expected_amount_paise) > 1
            or actual_currency != "INR"
        ):
            raise HTTPException(
                status_code=402,
                detail="Payment mismatch: amount or currency does not match consultation.",
            )
        c_idemp = idemp_key or f"cns_{payment_id}"
        result = mark_consultation_paid(
            consultation_id=consultation_id,
            payment_id=payment_id,
            idemp_key=c_idemp,
            amount_inr=amount_inr,
            user_id=str(consultation["user_id"]),
        )
        return {"status": "success", "type": "consultation", **result}

    if not milestone_id:
        raise HTTPException(
            status_code=400,
            detail="Missing milestone_id or consultation_id in notes",
        )

    # ── Milestone payment path ────────────────────────────────────
    milestone_res = (
        db.table("matter_milestones").select("*").eq("id", milestone_id).execute()
    )
    if not milestone_res.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone = milestone_res.data[0]

    expected_amount_paise = int(float(milestone.get("amount_inr") or 0) * 100)

    amount_mismatch = False
    if (
        actual_amount_paise is None
        or abs(actual_amount_paise - expected_amount_paise) > 1
    ):
        amount_mismatch = True

    matter_id = milestone["matter_id"]
    matter_res = db.table("matters").select("user_id").eq("id", matter_id).execute()
    user_id = None
    if matter_res.data:
        user_id = matter_res.data[0].get("user_id")

    if amount_mismatch or actual_currency != "INR":
        audit_data = {
            "actor_id": user_id,
            "action": "payment_mismatch",
            "target_type": "matter_milestones",
            "target_id": milestone_id,
            "changes": {
                "expected_amount_paise": expected_amount_paise,
                "actual_amount_paise": actual_amount_paise,
                "expected_currency": "INR",
                "actual_currency": actual_currency,
                "payment_id": payment_id,
            },
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        db.table("audit_logs").insert(audit_data).execute()
        raise HTTPException(
            status_code=402,
            detail="Payment mismatch: amount or currency does not match milestone.",
        )

    res = await apply_payment(
        db,
        milestone_id=milestone_id,
        payment_id=payment_id,
        idemp_key=idemp_key or f"idemp_{payment_id}",
        amount_inr=milestone.get("amount_inr"),
        user_id=user_id,
    )
    return {
        "status": "success",
        "type": "milestone",
        "milestone_id": milestone_id,
        "payment_gateway_ref": payment_id,
        "payment_record_id": res.get("payment_record_id"),
    }
