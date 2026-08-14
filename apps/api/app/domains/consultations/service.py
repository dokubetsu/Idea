from app.shared import database as shared_database
from app.shared.database import get_db
from app.shared.exceptions import NotFound
from fastapi import HTTPException

SELECT_CONSULTATIONS = (
    "*, up:profiles!user_id(full_name), lp:profiles!lawyer_id(full_name)"
)


def mark_consultation_paid(
    consultation_id: str,
    payment_id: str,
    idemp_key: str | None,
    amount_inr: float,
    user_id: str,
) -> dict:
    """Atomically mark a consultation paid via DB RPC (service role)."""
    db = shared_database.get_service_role_db()
    try:
        res = db.rpc(
            "mark_consultation_paid",
            {
                "p_consultation_id": consultation_id,
                "p_payment_id": payment_id,
                "p_idemp_key": idemp_key,
                "p_amount_inr": amount_inr,
                "p_user_id": user_id,
            },
        ).execute()
    except Exception as e:
        msg = str(e)
        if "amount does not match" in msg.lower():
            raise HTTPException(
                status_code=402, detail="Payment amount mismatch"
            ) from e
        if "already used" in msg.lower() or "idempotency" in msg.lower():
            raise HTTPException(status_code=400, detail=msg) from e
        if "not found" in msg.lower():
            raise NotFound("Consultation not found") from e
        raise HTTPException(status_code=400, detail=msg) from e

    data = res.data
    if isinstance(data, list) and data:
        return data[0] if isinstance(data[0], dict) else {"result": data[0]}
    if isinstance(data, dict):
        return data
    return {"consultation_id": consultation_id, "payment_status": "paid"}


def enrich_consultation(row: dict) -> dict:
    if not row:
        return row
    up = row.pop("up", None)
    lp = row.pop("lp", None)
    row["user_name"] = up["full_name"] if up else None
    row["lawyer_name"] = lp["full_name"] if lp else None
    return row


def get_consultation_or_404(consultation_id: str) -> dict:
    db = get_db()
    row = (
        db.table("consultations")
        .select(SELECT_CONSULTATIONS)
        .eq("id", consultation_id)
        .single()
        .execute()
        .data
    )
    if not row:
        raise NotFound("Consultation not found")
    return enrich_consultation(row)


def assign_free_lawyer(consultation_id: str) -> str | None:
    """Atomically assign an available free-consult lawyer to a pending consultation.

    Returns the assigned lawyer's UUID as a string, or None if no lawyer is available.

    H3 fix: The Supabase RPC deserialises the function's return value into a Python
    list/dict, not a raw UUID string. We must extract the UUID explicitly; otherwise
    `if not assign_free_lawyer(...)` would always be False for a non-empty list,
    silently bypassing the "no lawyer available" error path.
    """
    db = get_db()
    res = db.rpc(
        "assign_free_lawyer_rpc", {"p_consultation_id": consultation_id}
    ).execute()

    data = res.data

    # RPC may return:
    #   - A UUID string directly: "xxxxxxxx-xxxx-..."
    #   - A single-item list:    ["xxxxxxxx-xxxx-..."]
    #   - A dict with the UUID:  {"assign_free_lawyer_rpc": "xxxxxxxx-xxxx-..."}
    if not data:
        return None
    if isinstance(data, str):
        return data
    if isinstance(data, list):
        return str(data[0]) if data else None
    if isinstance(data, dict):
        # Supabase may wrap the return value under the function name
        for v in data.values():
            if v:
                return str(v)
    return None
