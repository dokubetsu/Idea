from app.shared.database import get_db
from app.shared.exceptions import NotFound

SELECT_CONSULTATIONS = "*, up:profiles!user_id(full_name), lp:profiles!lawyer_id(full_name)"


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
    row = db.table("consultations").select(SELECT_CONSULTATIONS).eq("id", consultation_id).single().execute().data
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
    res = db.rpc("assign_free_lawyer_rpc", {"p_consultation_id": consultation_id}).execute()

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
