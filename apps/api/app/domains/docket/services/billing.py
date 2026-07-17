from __future__ import annotations
import logging
from datetime import date, datetime
from typing import Optional

from app.domains.docket.schemas import InvoiceCreate
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import NotFound, BadRequest

from app.domains.docket.services.helpers import (
    _today,
    _get_matter_for_participant,
    _ensure_lawyer_on_matter,
)

logger = logging.getLogger(__name__)


# ── Billing ──────────────────────────────────────────────────────


def get_billing(matter_id: str, user: CurrentUser) -> dict:
    """Get role-filtered billing data."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    if user.role in (UserRole.LAWYER, UserRole.ADMIN):
        return _lawyer_billing(db, matter_id)
    else:
        return _client_billing(db, matter_id)


def _lawyer_billing(db, matter_id: str) -> dict:
    """Full billing data for the lawyer."""
    # Unbilled time entries
    te_result = (
        db.table("time_entries")
        .select("*")
        .eq("matter_id", matter_id)
        .eq("status", "unbilled")
        .order("entry_date", desc=True)
        .execute()
    )
    unbilled_entries = te_result.data or []
    unbilled_wip = sum(float(e.get("amount_inr") or 0) for e in unbilled_entries)

    # All invoices
    inv_result = (
        db.table("invoices")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    invoices = inv_result.data or []

    billed_ar = sum(
        float(i.get("total_inr") or 0)
        for i in invoices
        if i.get("status") in ("sent", "overdue")
    )
    paid_to_date = sum(
        float(i.get("total_inr") or 0) for i in invoices if i.get("status") == "paid"
    )
    has_overdue = any(i.get("status") == "overdue" for i in invoices)

    # Fee arrangement
    fa_result = (
        db.table("fee_arrangements").select("*").eq("matter_id", matter_id).execute()
    )
    fee_arrangement = fa_result.data[0] if fa_result.data else None

    # Trust/retainer balance
    trust_balance = 0.0
    if fee_arrangement and fee_arrangement.get("type") == "retainer":
        retainer_amount = float(fee_arrangement.get("retainer_amount") or 0)
        retainer_used = float(fee_arrangement.get("retainer_used") or 0)
        trust_balance = retainer_amount - retainer_used

    # Disbursements
    disb_result = (
        db.table("disbursements")
        .select("*")
        .eq("matter_id", matter_id)
        .order("incurred_on", desc=True)
        .execute()
    )

    return {
        "role": "lawyer",
        "unbilled_wip": unbilled_wip,
        "billed_ar": billed_ar,
        "paid_to_date": paid_to_date,
        "trust_balance": trust_balance,
        "has_overdue": has_overdue,
        "fee_arrangement": fee_arrangement,
        "unbilled_entries": unbilled_entries,
        "invoices": invoices,
        "disbursements": disb_result.data or [],
    }


def _client_billing(db, matter_id: str) -> dict:
    """Filtered billing data for the client — no time entry details."""
    inv_result = (
        db.table("invoices")
        .select(
            "id,invoice_number,period_start,period_end,total_inr,status,due_date,paid_at,work_summary,gstin,hsn_sac,place_of_supply,irn,qr_code_data"
        )
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    invoices = inv_result.data or []

    # Amount due (overdue or sent)
    amount_due = 0.0
    amount_due_invoice = None
    days_overdue = None
    for inv in invoices:
        if inv.get("status") in ("sent", "overdue"):
            amount_due += float(inv.get("total_inr") or 0)
            if not amount_due_invoice:
                amount_due_invoice = inv.get("invoice_number")
                if inv.get("due_date"):
                    try:
                        due = date.fromisoformat(inv["due_date"])
                        overdue_days = (_today() - due).days
                        days_overdue = overdue_days if overdue_days > 0 else None
                    except (ValueError, TypeError):
                        pass

    paid_to_date = sum(
        float(i.get("total_inr") or 0) for i in invoices if i.get("status") == "paid"
    )

    # Fee arrangement (client can see description + type)
    fa_result = (
        db.table("fee_arrangements")
        .select("type,description,engagement_doc_path,retainer_amount,retainer_used")
        .eq("matter_id", matter_id)
        .execute()
    )
    fa = fa_result.data[0] if fa_result.data else None

    return {
        "role": "client",
        "amount_due": amount_due,
        "amount_due_invoice": amount_due_invoice,
        "days_overdue": days_overdue,
        "retainer_amount": (
            float(fa["retainer_amount"]) if fa and fa.get("retainer_amount") else None
        ),
        "retainer_used": (
            float(fa["retainer_used"]) if fa and fa.get("retainer_used") else None
        ),
        "paid_to_date": paid_to_date,
        "fee_description": fa.get("description") if fa else None,
        "engagement_doc_path": fa.get("engagement_doc_path") if fa else None,
        "invoices": invoices,
    }


# ── CRUD: Time Entries ───────────────────────────────────────────


def create_time_entry(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "lawyer_id": user.id,
        "activity": data["activity"],
        "hours": data["hours"],
        "entry_date": (data.get("entry_date") or _today()).isoformat(),
    }
    if data.get("rate_per_hour") is not None:
        payload["rate_per_hour"] = data["rate_per_hour"]
    else:
        # Try to get rate from fee arrangement
        fa = (
            db.table("fee_arrangements")
            .select("rate_per_hour")
            .eq("matter_id", matter_id)
            .execute()
        )
        if fa.data and fa.data[0].get("rate_per_hour"):
            payload["rate_per_hour"] = float(fa.data[0]["rate_per_hour"])

    result = db.table("time_entries").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create time entry")
    return result.data[0]


def list_time_entries(matter_id: str, user: CurrentUser) -> list:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("time_entries")
        .select("*")
        .eq("matter_id", matter_id)
        .order("entry_date", desc=True)
        .execute()
    )
    return result.data or []


def update_time_entry(
    matter_id: str, entry_id: str, user: CurrentUser, data: dict
) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "entry_date" in update_data and isinstance(update_data["entry_date"], date):
        update_data["entry_date"] = update_data["entry_date"].isoformat()
    result = (
        db.table("time_entries")
        .update(update_data)
        .eq("id", entry_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Time entry")
    return result.data[0]


def delete_time_entry(matter_id: str, entry_id: str, user: CurrentUser) -> None:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    db.table("time_entries").delete().eq("id", entry_id).eq(
        "matter_id", matter_id
    ).execute()


# ── CRUD: Invoices ───────────────────────────────────────────────


def _resolve_invoice_states(db, matter_id: str, data: InvoiceCreate) -> tuple[str, str]:
    """Return (place_of_supply, supplier_state) for GST."""
    from app.config import settings
    from app.shared.gst import resolve_place_of_supply, normalize_state

    matter = (
        db.table("matters")
        .select("user_id, lawyer_id")
        .eq("id", matter_id)
        .single()
        .execute()
        .data
        or {}
    )
    client_state = lawyer_state = None
    if matter.get("user_id"):
        cp = (
            db.table("profiles")
            .select("state")
            .eq("id", matter["user_id"])
            .execute()
            .data
        )
        if cp:
            client_state = cp[0].get("state")
    if matter.get("lawyer_id"):
        lp = (
            db.table("profiles")
            .select("state")
            .eq("id", matter["lawyer_id"])
            .execute()
            .data
        )
        if lp:
            lawyer_state = lp[0].get("state")

    place = resolve_place_of_supply(
        client_state=client_state,
        lawyer_state=lawyer_state,
        explicit=data.place_of_supply,
    )
    supplier = (
        normalize_state(data.supplier_state)
        or normalize_state(lawyer_state)
        or normalize_state(settings.GST_SUPPLIER_STATE)
        or "Delhi"
    )
    return place, supplier


def create_invoice(matter_id: str, user: CurrentUser, data: InvoiceCreate) -> dict:
    """Create invoice atomically via create_invoice_rpc when available."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    time_entry_ids = data.time_entry_ids or []
    disbursement_ids = data.disbursement_ids or []
    place, supplier = _resolve_invoice_states(db, matter_id, data)

    try:
        res = db.rpc(
            "create_invoice_rpc",
            {
                "p_matter_id": matter_id,
                "p_lawyer_id": user.id,
                "p_time_entry_ids": time_entry_ids or None,
                "p_disbursement_ids": disbursement_ids or None,
                "p_period_start": (
                    data.period_start.isoformat() if data.period_start else None
                ),
                "p_period_end": (
                    data.period_end.isoformat() if data.period_end else None
                ),
                "p_work_summary": data.work_summary,
                "p_due_date": data.due_date.isoformat() if data.due_date else None,
                "p_place_of_supply": place,
                "p_supplier_state": supplier,
                "p_draw_retainer": data.draw_retainer,
            },
        ).execute()
        invoice = res.data
        if isinstance(invoice, list) and invoice:
            invoice = invoice[0]
        if isinstance(invoice, dict) and invoice.get("id"):
            return invoice
        raise BadRequest("Failed to create invoice")
    except BadRequest:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "does not exist" in msg or "could not find" in msg or "pgrst202" in msg:
            logger.warning(
                "create_invoice_rpc unavailable, using multi-step fallback: %s", e
            )
        elif "already billed" in msg or "missing" in msg or "not on this matter" in msg:
            raise BadRequest(str(e)) from e
        else:
            logger.error("create_invoice_rpc failed: %s", e)
            raise BadRequest(str(e)) from e

    # ── Fallback (pre-migration 061) ─────────────────────────────
    from app.config import settings
    from app.shared.gst import compute_gst
    import hashlib

    year = _today().year
    try:
        seq_res = db.rpc("generate_next_invoice_number", {"p_year": year}).execute()
        invoice_number = seq_res.data
    except Exception as e:
        logger.error("Failed to generate invoice number: %s", e)
        raise BadRequest("Failed to generate unique invoice number")

    irn = hashlib.sha256(f"INV-{invoice_number}".encode()).hexdigest()
    qr_code_data = (
        f"GST-EINVOICE-MOCK-SIGNATURE-DATA-FOR-{invoice_number}-IRN-{irn[:16]}"
    )

    subtotal = 0.0

    if time_entry_ids:
        te_result = (
            db.table("time_entries")
            .select("amount_inr, matter_id, status")
            .in_("id", time_entry_ids)
            .execute()
        )
        for te in te_result.data or []:
            if te.get("matter_id") != matter_id:
                raise BadRequest(
                    f"Time entry {te.get('id')} does not belong to this matter"
                )
            if te.get("status") != "unbilled":
                raise BadRequest(f"Time entry {te.get('id')} is not unbilled")
        subtotal += sum(float(e.get("amount_inr") or 0) for e in (te_result.data or []))

    if disbursement_ids:
        disb_result = (
            db.table("disbursements")
            .select("amount_inr, matter_id, invoice_id")
            .in_("id", disbursement_ids)
            .execute()
        )
        for disb in disb_result.data or []:
            if disb.get("matter_id") != matter_id:
                raise BadRequest(
                    f"Disbursement {disb.get('id')} does not belong to this matter"
                )
            if disb.get("invoice_id"):
                raise BadRequest(f"Disbursement {disb.get('id')} already invoiced")
        subtotal += sum(
            float(d.get("amount_inr") or 0) for d in (disb_result.data or [])
        )

    gst = compute_gst(
        subtotal,
        place_of_supply=place,
        supplier_state=supplier,
        gstin=settings.GST_SUPPLIER_GSTIN,
    )

    invoice_payload = {
        "matter_id": matter_id,
        "invoice_number": invoice_number,
        "period_start": (data.period_start.isoformat() if data.period_start else None),
        "period_end": (data.period_end.isoformat() if data.period_end else None),
        "subtotal_inr": subtotal,
        "gst_percent": gst.gst_percent,
        "gst_amount_inr": gst.gst_amount_inr,
        "total_inr": gst.total_inr,
        "work_summary": data.work_summary,
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "gstin": gst.gstin,
        "hsn_sac": gst.hsn_sac,
        "place_of_supply": gst.place_of_supply,
        "supplier_state": gst.supplier_state,
        "cgst_amount_inr": gst.cgst_amount_inr,
        "sgst_amount_inr": gst.sgst_amount_inr,
        "igst_amount_inr": gst.igst_amount_inr,
        "is_inter_state": gst.is_inter_state,
        "irn": irn,
        "qr_code_data": qr_code_data,
    }

    result = db.table("invoices").insert(invoice_payload).execute()
    if not result.data:
        raise BadRequest("Failed to create invoice")
    invoice = result.data[0]

    if time_entry_ids:
        db.table("time_entries").update(
            {"status": "billed", "invoice_id": invoice["id"]}
        ).in_("id", time_entry_ids).eq("status", "unbilled").execute()

    if disbursement_ids:
        db.table("disbursements").update({"invoice_id": invoice["id"]}).in_(
            "id", disbursement_ids
        ).is_("invoice_id", "null").execute()

    if data.draw_retainer and gst.total_inr > 0:
        _draw_retainer(db, matter_id, gst.total_inr, invoice_id=invoice.get("id"))

    return invoice


def _draw_retainer(
    db, matter_id: str, amount: float, invoice_id: str | None = None
) -> None:
    """Apply invoice total against remaining retainer (ledger RPC preferred)."""
    try:
        db.rpc(
            "post_retainer_ledger",
            {
                "p_matter_id": matter_id,
                "p_entry_type": "drawdown",
                "p_amount_inr": float(amount),
                "p_invoice_id": invoice_id,
                "p_payment_id": None,
                "p_note": "Invoice drawdown",
                "p_created_by": None,
            },
        ).execute()
        return
    except Exception as e:
        logger.warning("post_retainer_ledger unavailable, simple drawdown: %s", e)

    fa = (
        db.table("fee_arrangements")
        .select("*")
        .eq("matter_id", matter_id)
        .eq("type", "retainer")
        .execute()
        .data
    )
    if not fa:
        return
    row = fa[0]
    remaining = float(row.get("retainer_amount") or 0) - float(
        row.get("retainer_used") or 0
    )
    if remaining <= 0:
        return
    draw = min(remaining, float(amount))
    db.table("fee_arrangements").update(
        {"retainer_used": float(row.get("retainer_used") or 0) + draw}
    ).eq("id", row["id"]).execute()


def list_invoices(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("invoices")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def update_invoice(
    matter_id: str, invoice_id: str, user: CurrentUser, data: dict
) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "due_date" in update_data and isinstance(update_data["due_date"], date):
        update_data["due_date"] = update_data["due_date"].isoformat()
    if "paid_at" in update_data and isinstance(update_data["paid_at"], datetime):
        update_data["paid_at"] = update_data["paid_at"].isoformat()
    result = (
        db.table("invoices")
        .update(update_data)
        .eq("id", invoice_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Invoice")
    return result.data[0]


# ── CRUD: Fee Arrangements ───────────────────────────────────────


def get_fee_arrangement(matter_id: str, user: CurrentUser) -> Optional[dict]:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("fee_arrangements").select("*").eq("matter_id", matter_id).execute()
    )
    return result.data[0] if result.data else None


def create_fee_arrangement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "type": data["type"],
        "rate_per_hour": data.get("rate_per_hour"),
        "fixed_amount": data.get("fixed_amount"),
        "retainer_amount": data.get("retainer_amount"),
        "description": data.get("description"),
        "engagement_doc_path": data.get("engagement_doc_path"),
    }
    result = db.table("fee_arrangements").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create fee arrangement")
    return result.data[0]


def update_fee_arrangement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    result = (
        db.table("fee_arrangements")
        .update(update_data)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Fee arrangement")
    return result.data[0]


# ── CRUD: Disbursements ──────────────────────────────────────────


def create_disbursement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "description": data["description"],
        "amount_inr": data["amount_inr"],
        "incurred_on": (data.get("incurred_on") or _today()).isoformat(),
        "invoice_id": data.get("invoice_id"),
    }
    result = db.table("disbursements").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create disbursement")
    return result.data[0]


def list_disbursements(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("disbursements")
        .select("*")
        .eq("matter_id", matter_id)
        .order("incurred_on", desc=True)
        .execute()
    )
    return result.data or []
