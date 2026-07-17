"""
FastAPI router for Legal Tools domain.
Exposes endpoints for calculators.
"""

from fastapi import APIRouter, HTTPException, Query
from app.shared.dependencies import Auth
from app.domains.legal_tools.schemas import (
    ChequeBounceRequest,
    RERARequest,
    SummarySuitRequest,
    DocumentDraftRequest,
)
from app.domains.legal_tools.services.calculators import (
    ChequeBounceCalculator,
    RERACalculator,
    SummarySuitCalculator,
)
from app.domains.legal_tools.services.draft import DocumentDraftService
from app.domains.legal_tools.services.interest import InterestSource
from app.shared.court_calendar import (
    is_court_working_day,
    next_working_day,
    list_supported_states,
)
from datetime import date

router = APIRouter(prefix="/legal-tools", tags=["legal-tools"])


@router.get("/rates/mclr")
async def get_mclr_rate(
    user: Auth,
    refresh: bool = Query(default=False, description="Force re-fetch from feed URL"),
):
    """
    Current SBI 1-year MCLR and derived RERA statutory rate (MCLR + 2%).
    Ops can override via SBI_MCLR_RATE / SBI_MCLR_FETCH_URL env vars.
    """
    return InterestSource.get_sbi_mclr(force_refresh=refresh)


@router.get("/court-calendar/working-day")
async def check_court_working_day(
    user: Auth,
    day: date = Query(..., description="Date to check (YYYY-MM-DD)"),
    state: str | None = Query(default=None, description="State for local holidays"),
):
    """Check if a date is a court working day (national + optional state holidays)."""
    working = is_court_working_day(day, state=state)
    nxt = next_working_day(day, state=state)
    return {
        "date": day.isoformat(),
        "state": state,
        "is_working_day": working,
        "next_working_day": nxt.isoformat(),
        "supported_states": list_supported_states(),
    }


@router.post("/court-calendar/refresh")
async def refresh_court_holidays(
    user: Auth,
    url: str | None = Query(default=None, description="Override feed URL"),
):
    """
    Fetch holiday JSON feed (or load DB cache) and merge into the in-process calendar.
    Admin recommended; any authenticated user may refresh when feed URL is configured.
    """
    from app.shared import database as shared_database
    from app.shared.holiday_feed import refresh_holiday_feed

    db = shared_database.get_service_role_db()
    return await refresh_holiday_feed(db, url=url)


@router.post("/calculators/cheque-bounce")
async def calculate_cheque_bounce(body: ChequeBounceRequest, user: Auth):
    """
    Computes presentation, notice, and complaint filing timelines under Section 138 NI Act.
    """
    try:
        return ChequeBounceCalculator.calculate(
            cheque_date=body.cheque_date,
            dishonour_date=body.dishonour_date,
            notice_date=body.notice_date,
            notice_receipt_date=body.notice_receipt_date,
            complaint_filed_date=body.complaint_filed_date,
            current_date=body.current_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculators/rera")
async def calculate_rera_delay(body: RERARequest, user: Auth):
    """
    Computes RERA delay days and statutory interest (SBI MCLR + 2% per annum).
    """
    try:
        return RERACalculator.calculate(
            total_paid_amount=body.total_paid_amount,
            promised_possession_date=body.promised_possession_date,
            actual_possession_date=body.actual_possession_date,
            custom_interest_rate=body.custom_interest_rate,
            current_date=body.current_date,
            installments=(
                [inst.model_dump() for inst in body.installments]
                if body.installments
                else None
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculators/summary-suit")
async def calculate_summary_suit(body: SummarySuitRequest, user: Auth):
    """
    Checks Order 37 CPC limitation period (3 years) and estimates court fees by state.
    """
    try:
        return SummarySuitCalculator.calculate(
            claim_amount=body.claim_amount,
            due_date=body.due_date,
            state=body.state,
            current_date=body.current_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/documents/draft")
async def generate_document_draft(body: DocumentDraftRequest, user: Auth):
    """
    Generates standard legal drafts (Vakalatnama, 138 Legal Notice, RERA Form M) populated with matter facts.
    """
    from fastapi import HTTPException

    try:
        return DocumentDraftService.generate(
            matter_id=body.matter_id,
            document_type=body.document_type,
            current_user=user,
        )
    except HTTPException as e:
        raise e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging

        logging.getLogger(__name__).error(
            "Failed to generate document draft: %s", e, exc_info=True
        )
        raise HTTPException(
            status_code=500, detail="Failed to generate document draft."
        )
