"""Docket domain — Pydantic schemas for request/response models."""

from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional

# ── Time Entries ─────────────────────────────────────────────────


class TimeEntryCreate(BaseModel):
    activity: str = Field(..., min_length=1, max_length=500)
    hours: float = Field(..., gt=0, le=24)
    rate_per_hour: Optional[float] = None
    entry_date: Optional[date] = None


class TimeEntryUpdate(BaseModel):
    activity: Optional[str] = Field(None, min_length=1, max_length=500)
    hours: Optional[float] = Field(None, gt=0, le=24)
    rate_per_hour: Optional[float] = None
    entry_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern=r"^(unbilled|billed|written_off)$")


class TimeEntryOut(BaseModel):
    id: str
    matter_id: str
    lawyer_id: str
    activity: str
    hours: float
    rate_per_hour: Optional[float]
    amount_inr: Optional[float]
    entry_date: date
    status: str
    invoice_id: Optional[str]
    created_at: datetime
    updated_at: datetime


# ── Invoices ─────────────────────────────────────────────────────


class InvoiceCreate(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    time_entry_ids: list[str] = Field(default_factory=list)
    disbursement_ids: list[str] = Field(default_factory=list)
    work_summary: Optional[str] = None
    due_date: Optional[date] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = Field(
        None, pattern=r"^(draft|sent|paid|overdue|cancelled)$"
    )
    work_summary: Optional[str] = None
    due_date: Optional[date] = None
    paid_at: Optional[datetime] = None


class InvoiceOut(BaseModel):
    id: str
    matter_id: str
    invoice_number: str
    period_start: Optional[date]
    period_end: Optional[date]
    subtotal_inr: float
    gst_percent: float
    gst_amount_inr: float
    total_inr: float
    status: str
    due_date: Optional[date]
    paid_at: Optional[datetime]
    work_summary: Optional[str]
    created_at: datetime
    updated_at: datetime


# Client sees a simplified invoice view
class InvoiceClientOut(BaseModel):
    id: str
    invoice_number: str
    period_start: Optional[date]
    period_end: Optional[date]
    total_inr: float
    status: str
    due_date: Optional[date]
    paid_at: Optional[datetime]
    work_summary: Optional[str]


# ── Disbursements ────────────────────────────────────────────────


class DisbursementCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount_inr: float = Field(..., ge=0)
    incurred_on: Optional[date] = None
    invoice_id: Optional[str] = None


class DisbursementOut(BaseModel):
    id: str
    matter_id: str
    invoice_id: Optional[str]
    description: str
    amount_inr: float
    incurred_on: date
    created_at: datetime


# ── Tasks ────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None


class TaskOut(BaseModel):
    id: str
    matter_id: str
    assigned_to: Optional[str]
    title: str
    description: Optional[str]
    due_date: Optional[date]
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ── Timeline Events ──────────────────────────────────────────────


class TimelineEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    lawyer_description: str = Field(..., min_length=1)
    client_description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    metadata: Optional[dict] = None


class TimelineEventOut(BaseModel):
    id: str
    matter_id: str
    event_type: str
    description: str  # role-filtered: lawyer_description or client_description
    occurred_at: datetime
    metadata: Optional[dict]
    created_at: datetime


# ── Internal Notes ───────────────────────────────────────────────


class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class NoteOut(BaseModel):
    id: str
    matter_id: str
    author_id: str
    content: str
    created_at: datetime
    updated_at: datetime


# ── Fee Arrangements ─────────────────────────────────────────────


class FeeArrangementCreate(BaseModel):
    type: str = Field(..., pattern=r"^(hourly|fixed|retainer|contingency)$")
    rate_per_hour: Optional[float] = None
    fixed_amount: Optional[float] = None
    retainer_amount: Optional[float] = None
    description: Optional[str] = None
    engagement_doc_path: Optional[str] = None


class FeeArrangementUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern=r"^(hourly|fixed|retainer|contingency)$")
    rate_per_hour: Optional[float] = None
    fixed_amount: Optional[float] = None
    retainer_amount: Optional[float] = None
    retainer_used: Optional[float] = None
    description: Optional[str] = None
    engagement_doc_path: Optional[str] = None


class FeeArrangementOut(BaseModel):
    id: str
    matter_id: str
    type: str
    rate_per_hour: Optional[float]
    fixed_amount: Optional[float]
    retainer_amount: Optional[float]
    retainer_used: Optional[float]
    description: Optional[str]
    engagement_doc_path: Optional[str]
    created_at: datetime
    updated_at: datetime


# ── Dashboard Aggregation ────────────────────────────────────────


class KpiCard(BaseModel):
    value: str
    caption: str
    trend: Optional[str] = None  # e.g. "+2 from last week"


class HearingRow(BaseModel):
    id: str
    matter_id: str
    time: str
    court: Optional[str]
    case_name: str
    judge: Optional[str]
    purpose: Optional[str]


class AttentionItem(BaseModel):
    id: str
    matter_id: str
    type: str  # limitation_warning | overdue | unread_message | pending_signature
    severity: str  # danger | warning | info
    message: str


class CaseCardOut(BaseModel):
    id: str
    client_name: str
    case_name: str
    case_number: Optional[str]
    stage: str
    next_hearing_at: Optional[str]
    next_hearing_countdown: Optional[str]
    is_urgent: bool
    client_avatar: Optional[str]
    matter_health: Optional[str]
    category: str


class LawyerDashboardOut(BaseModel):
    greeting: str
    date_display: str
    summary_line: str
    kpis: list[KpiCard]
    today_hearings: list[HearingRow]
    attention_items: list[AttentionItem]
    cases: list[CaseCardOut]


class ClientCaseOut(BaseModel):
    id: str
    title: str
    plain_title: str
    status_text: str
    stage: str  # filed | reply | evidence | arguments | judgment
    case_number: Optional[str]
    lawyer_name: Optional[str]
    lawyer_avatar: Optional[str]
    next_hearing_date: Optional[str]
    next_hearing_description: Optional[str]
    next_hearing_attend: bool


class ClientTaskOut(BaseModel):
    id: str
    title: str
    due_date: Optional[date]
    is_overdue: bool


class ClientTimelineEntry(BaseModel):
    id: str
    description: str
    occurred_at: datetime


class ClientDashboardOut(BaseModel):
    greeting: str
    date_display: str
    case: Optional[ClientCaseOut]
    pending_tasks: list[ClientTaskOut]
    recent_updates: list[ClientTimelineEntry]
    stats: dict  # hearings_count, documents_count, months_running


# ── Documents ───────────────────────────────────────────────────


class DocumentReview(BaseModel):
    status: str = Field(..., pattern=r"^(approved|rejected)$")
    lawyer_note: Optional[str] = Field(None, max_length=2000)


class DocumentUpdateNote(BaseModel):
    lawyer_note: str = Field(..., min_length=1, max_length=2000)


class DocumentRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    label: str = Field(default="other", pattern=r"^(evidence|research|other)$")


# ── Messages ────────────────────────────────────────────────────


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: str = Field(default="text", pattern=r"^(text|file|system)$")
    attachment_path: Optional[str] = None


# ── Hearings (expanded) ─────────────────────────────────────────


class HearingUpdate(BaseModel):
    courtroom: Optional[str] = None
    judge: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(
        None, pattern=r"^(scheduled|adjourned|completed|cancelled)$"
    )
    outcome: Optional[str] = None
    next_date: Optional[str] = None  # If adjourned, the new date


# ── Billing Aggregation ──────────────────────────────────────────


class LawyerBillingOut(BaseModel):
    unbilled_wip: float
    billed_ar: float
    paid_to_date: float
    trust_balance: float
    has_overdue: bool
    fee_arrangement: Optional[FeeArrangementOut]
    unbilled_entries: list[TimeEntryOut]
    invoices: list[InvoiceOut]
    disbursements: list[DisbursementOut]


class ClientBillingOut(BaseModel):
    amount_due: float
    amount_due_invoice: Optional[str]  # invoice number
    days_overdue: Optional[int]
    retainer_amount: Optional[float]
    retainer_used: Optional[float]
    paid_to_date: float
    fee_description: Optional[str]
    engagement_doc_path: Optional[str]
    invoices: list[InvoiceClientOut]
