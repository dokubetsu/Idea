"""Retainer / trust accounting: deposits, drawdowns, refunds, ledger."""

from __future__ import annotations
import logging
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import BadRequest, Forbidden, NotFound
from app.domains.docket.services.helpers import (
    _ensure_lawyer_on_matter,
    _get_matter_for_participant,
)

logger = logging.getLogger(__name__)


def get_retainer_balance(matter_id: str, user: CurrentUser) -> dict:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    fa = (
        db.table("fee_arrangements")
        .select("*")
        .eq("matter_id", matter_id)
        .eq("type", "retainer")
        .execute()
        .data
    )
    if not fa:
        return {
            "matter_id": matter_id,
            "has_retainer": False,
            "retainer_amount": 0.0,
            "retainer_used": 0.0,
            "balance": 0.0,
        }
    row = fa[0]
    amount = float(row.get("retainer_amount") or 0)
    used = float(row.get("retainer_used") or 0)
    return {
        "matter_id": matter_id,
        "has_retainer": True,
        "fee_arrangement_id": row.get("id"),
        "retainer_amount": amount,
        "retainer_used": used,
        "balance": amount - used,
    }


def list_retainer_ledger(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    res = (
        db.table("retainer_ledger")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def post_retainer_entry(
    matter_id: str,
    user: CurrentUser,
    *,
    entry_type: str,
    amount_inr: float,
    note: str | None = None,
    invoice_id: str | None = None,
) -> dict:
    """
    Post deposit / refund / adjustment. Drawdowns normally happen on invoice create;
    lawyers may also post manual drawdowns.
    """
    if entry_type not in ("deposit", "drawdown", "refund", "adjustment"):
        raise BadRequest("Invalid entry_type")
    if amount_inr <= 0:
        raise BadRequest("amount_inr must be positive")

    # Clients may only request? No — only lawyer/admin post ledger entries
    if user.role not in (UserRole.LAWYER, UserRole.ADMIN):
        raise Forbidden("Only lawyers or admins can post retainer ledger entries")
    _ensure_lawyer_on_matter(matter_id, user)

    db = get_db()
    try:
        res = db.rpc(
            "post_retainer_ledger",
            {
                "p_matter_id": matter_id,
                "p_entry_type": entry_type,
                "p_amount_inr": amount_inr,
                "p_invoice_id": invoice_id,
                "p_payment_id": None,
                "p_note": note,
                "p_created_by": user.id,
            },
        ).execute()
    except Exception as e:
        msg = str(e)
        if "No retainer" in msg:
            raise NotFound("Retainer fee arrangement") from e
        if "Insufficient" in msg or "exceeds" in msg:
            raise BadRequest(msg) from e
        raise BadRequest(msg) from e

    data = res.data
    if isinstance(data, list) and data:
        return data[0] if isinstance(data[0], dict) else {"result": data[0]}
    if isinstance(data, dict):
        return data
    return {"ok": True}


def deposit_retainer(
    matter_id: str, user: CurrentUser, amount_inr: float, note: str | None = None
) -> dict:
    return post_retainer_entry(
        matter_id, user, entry_type="deposit", amount_inr=amount_inr, note=note
    )


def refund_retainer(
    matter_id: str, user: CurrentUser, amount_inr: float, note: str | None = None
) -> dict:
    return post_retainer_entry(
        matter_id, user, entry_type="refund", amount_inr=amount_inr, note=note
    )
