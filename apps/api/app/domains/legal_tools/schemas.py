"""
Pydantic schemas for Legal Tools Calculators.
"""
from datetime import date
from pydantic import BaseModel, Field
from typing import Optional


class ChequeBounceRequest(BaseModel):
    cheque_date: date = Field(..., description="Date written on the cheque")
    dishonour_date: date = Field(..., description="Date on bank Cheque Return Memo")
    notice_date: Optional[date] = Field(None, description="Date notice was sent to the drawer")
    notice_receipt_date: Optional[date] = Field(None, description="Date notice was received by the drawer")
    complaint_filed_date: Optional[date] = Field(None, description="Date complaint was filed in court")
    current_date: Optional[date] = Field(None, description="Optional baseline date (defaults to today)")


class RERARequest(BaseModel):
    total_paid_amount: float = Field(..., gt=0, description="Total amount paid to developer in INR")
    promised_possession_date: date = Field(..., description="Possession date promised in sale agreement")
    actual_possession_date: Optional[date] = Field(None, description="Actual date possession was offered (if any)")
    custom_interest_rate: Optional[float] = Field(None, ge=0, description="Optional custom rate override")
    current_date: Optional[date] = Field(None, description="Optional baseline date (defaults to today)")


class SummarySuitRequest(BaseModel):
    claim_amount: float = Field(..., gt=0, description="Principal debt amount in INR")
    due_date: date = Field(..., description="Date the debt became due")
    state: str = Field("default", description="Indian state for court fee lookup (e.g. 'delhi', 'maharashtra')")
    current_date: Optional[date] = Field(None, description="Optional baseline date (defaults to today)")


class DocumentDraftRequest(BaseModel):
    matter_id: str = Field(..., description="UUID of the matter")
    document_type: str = Field(..., description="Type of document: 'vakalatnama' | 'legal_notice_138' | 'rera_complaint_form_m'")

