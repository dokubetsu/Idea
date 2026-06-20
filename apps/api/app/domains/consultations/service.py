from app.shared.database import get_db
from app.shared.exceptions import NotFound, Forbidden

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

def assign_free_lawyer(category: str) -> str | None:
    """Finds the first available lawyer opted into free consultations"""
    db = get_db()
    # Ideally, we would match by category/specialization, but for v1 simplification
    # we just find the first available lawyer offering free consultations.
    # We query lawyer_profiles joined with profiles for is_active.
    # Note: Postgrest doesn't easily do complex joins with filters on both sides in one go,
    # so we use a simpler query.
    res = db.table("lawyer_profiles") \
        .select("id") \
        .eq("is_available", True) \
        .eq("offers_free_consultation", True) \
        .limit(1) \
        .execute()
    
    if res.data and len(res.data) > 0:
        return res.data[0]["id"]
    return None
