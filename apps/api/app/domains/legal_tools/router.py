"""
FastAPI router for Legal Tools domain.
Exposes endpoints for calculators.
"""

from fastapi import APIRouter, HTTPException
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

router = APIRouter(prefix="/legal-tools", tags=["legal-tools"])


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
