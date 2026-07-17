"""Helper functions for the Docket domain services."""

from datetime import date, datetime, timezone
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import NotFound, Forbidden


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_matter_for_participant(matter_id: str, user: CurrentUser) -> dict:
    """Fetch matter and verify user is a participant."""
    db = get_db()
    result = (
        db.table("matters")
        .select("*")
        .eq("id", matter_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise NotFound("Matter")
    matter = result.data[0]
    if user.role == UserRole.ADMIN:
        return matter
    if user.role == UserRole.LAWYER and matter.get("lawyer_id") == user.id:
        return matter
    if user.role == UserRole.USER and matter.get("user_id") == user.id:
        return matter
    raise Forbidden("You are not a participant in this matter")


def _ensure_lawyer_on_matter(matter_id: str, user: CurrentUser) -> dict:
    """Verify user is the lawyer on this matter (or admin)."""
    matter = _get_matter_for_participant(matter_id, user)
    if user.role == UserRole.ADMIN:
        return matter
    if user.role != UserRole.LAWYER or matter.get("lawyer_id") != user.id:
        raise Forbidden("Only the assigned lawyer can perform this action")
    return matter


def _format_inr(amount: float) -> str:
    """Format amount in Indian ₹ lakhs format."""
    if amount >= 100000:
        lakhs = amount / 100000
        return f"₹{lakhs:,.2f}L"
    return f"₹{amount:,.0f}"


def _status_to_stage(status: str) -> str:
    """Map matter_status enum to 5-stage client progress."""
    mapping = {
        "draft": "filed",
        "intake": "filed",
        "assessment": "filed",
        "matching": "filed",
        "active": "evidence",  # Default active to evidence; refined by hearings/milestones
        "resolved": "judgment",
        "archived": "judgment",
    }
    return mapping.get(status, "filed")


def _stage_to_client_text(stage: str) -> str:
    """Plain-language status for client."""
    texts = {
        "filed": "Your case has been filed and we're waiting for the court to schedule a hearing.",
        "reply": "The other side has been asked to respond. We're waiting for their reply.",
        "evidence": "Both sides are presenting their evidence and documents to the court.",
        "arguments": "The lawyers are making their arguments before the judge.",
        "judgment": "The court has heard all arguments and will deliver its decision.",
    }
    return texts.get(stage, "Your case is being handled by your lawyer.")
