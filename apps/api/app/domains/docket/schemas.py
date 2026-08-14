"""Docket domain — Pydantic schemas for request/response models."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

# ── Time Entries ─────────────────────────────────────────────────


class TimeEntryCreate(BaseModel):
    activity: str = Field(..., min_length=1, max_length=500)
    hours: float = Field(..., gt=0, le=24)
    rate_per_hour: float | None = None
    entry_date: date | None = None


class TimeEntryUpdate(BaseModel):
    activity: str | None = Field(None, min_length=1, max_length=500)
    hours: float | None = Field(None, gt=0, le=24)
    rate_per_hour: float | None = None
    entry_date: date | None = None
    status: str | None = Field(None, pattern=r"^(unbilled|billed|written_off)$")


class TimeEntryOut(BaseModel):
    id: str
    matter_id: str
    lawyer_id: str
    activity: str
    hours: float
    rate_per_hour: float | None
    amount_inr: float | None
    entry_date: date
    status: str
    invoice_id: str | None
    created_at: datetime
    updated_at: datetime


# ── Invoices ─────────────────────────────────────────────────────


class InvoiceCreate(BaseModel):
    period_start: date | None = None
    period_end: date | None = None
    time_entry_ids: list[str] = Field(default_factory=list)
    disbursement_ids: list[str] = Field(default_factory=list)
    work_summary: str | None = None
    due_date: date | None = None
    # GST: recipient place of supply (state). Defaults from client profile.
    place_of_supply: str | None = None
    supplier_state: str | None = None
    draw_retainer: bool = True


class InvoiceUpdate(BaseModel):
    status: str | None = Field(None, pattern=r"^(draft|sent|paid|overdue|cancelled)$")
    work_summary: str | None = None
    due_date: date | None = None
    paid_at: datetime | None = None


class InvoiceOut(BaseModel):
    id: str
    matter_id: str
    invoice_number: str
    period_start: date | None
    period_end: date | None
    subtotal_inr: float
    gst_percent: float
    gst_amount_inr: float
    total_inr: float
    status: str
    due_date: date | None
    paid_at: datetime | None
    work_summary: str | None
    created_at: datetime
    updated_at: datetime
    gstin: str | None = None
    hsn_sac: str | None = None
    place_of_supply: str | None = None
    supplier_state: str | None = None
    cgst_amount_inr: float | None = None
    sgst_amount_inr: float | None = None
    igst_amount_inr: float | None = None
    is_inter_state: bool | None = None
    irn: str | None = None
    qr_code_data: str | None = None


# Client sees a simplified invoice view
class InvoiceClientOut(BaseModel):
    id: str
    invoice_number: str
    period_start: date | None
    period_end: date | None
    total_inr: float
    status: str
    due_date: date | None
    paid_at: datetime | None
    work_summary: str | None
    gstin: str | None = None
    hsn_sac: str | None = None
    place_of_supply: str | None = None
    irn: str | None = None
    qr_code_data: str | None = None


# ── Disbursements ────────────────────────────────────────────────


class DisbursementCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount_inr: float = Field(..., ge=0)
    incurred_on: date | None = None
    invoice_id: str | None = None


class DisbursementOut(BaseModel):
    id: str
    matter_id: str
    invoice_id: str | None
    description: str
    amount_inr: float
    incurred_on: date
    created_at: datetime


# ── Tasks ────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    assigned_to: str | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    assigned_to: str | None = None
    due_date: date | None = None
    is_completed: bool | None = None


class TaskOut(BaseModel):
    id: str
    matter_id: str
    assigned_to: str | None
    title: str
    description: str | None
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Timeline Events ──────────────────────────────────────────────


class TimelineEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    lawyer_description: str = Field(..., min_length=1)
    client_description: str | None = None
    occurred_at: datetime | None = None
    metadata: dict | None = None


class TimelineEventOut(BaseModel):
    id: str
    matter_id: str
    event_type: str
    description: str  # role-filtered: lawyer_description or client_description
    occurred_at: datetime
    metadata: dict | None
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
    rate_per_hour: float | None = None
    fixed_amount: float | None = None
    retainer_amount: float | None = None
    description: str | None = None
    engagement_doc_path: str | None = None


class FeeArrangementUpdate(BaseModel):
    type: str | None = Field(None, pattern=r"^(hourly|fixed|retainer|contingency)$")
    rate_per_hour: float | None = None
    fixed_amount: float | None = None
    retainer_amount: float | None = None
    retainer_used: float | None = None
    description: str | None = None
    engagement_doc_path: str | None = None


class FeeArrangementOut(BaseModel):
    id: str
    matter_id: str
    type: str
    rate_per_hour: float | None
    fixed_amount: float | None
    retainer_amount: float | None
    retainer_used: float | None
    description: str | None
    engagement_doc_path: str | None
    created_at: datetime
    updated_at: datetime


# ── Dashboard Aggregation ────────────────────────────────────────


class KpiCard(BaseModel):
    value: str
    caption: str
    trend: str | None = None  # e.g. "+2 from last week"


class HearingRow(BaseModel):
    id: str
    matter_id: str
    time: str
    court: str | None
    case_name: str
    judge: str | None
    purpose: str | None


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
    case_number: str | None
    stage: str
    next_hearing_at: str | None
    next_hearing_countdown: str | None
    is_urgent: bool
    client_avatar: str | None
    matter_health: str | None
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
    case_number: str | None
    lawyer_name: str | None
    lawyer_avatar: str | None
    next_hearing_date: str | None
    next_hearing_description: str | None
    next_hearing_attend: bool


class ClientTaskOut(BaseModel):
    id: str
    title: str
    due_date: date | None
    is_overdue: bool


class ClientTimelineEntry(BaseModel):
    id: str
    description: str
    occurred_at: datetime


class ClientDashboardOut(BaseModel):
    greeting: str
    date_display: str
    case: ClientCaseOut | None
    pending_tasks: list[ClientTaskOut]
    recent_updates: list[ClientTimelineEntry]
    stats: dict  # hearings_count, documents_count, months_running


# ── Documents ───────────────────────────────────────────────────


class DocumentReview(BaseModel):
    status: str = Field(..., pattern=r"^(approved|rejected)$")
    lawyer_note: str | None = Field(None, max_length=2000)


class DocumentUpdateNote(BaseModel):
    lawyer_note: str = Field(..., min_length=1, max_length=2000)


class DocumentRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    label: str = Field(default="other", pattern=r"^(evidence|research|other)$")


# ── Messages ────────────────────────────────────────────────────


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: str = Field(default="text", pattern=r"^(text|file|system)$")
    attachment_path: str | None = None


# ── Hearings (expanded) ─────────────────────────────────────────


class HearingUpdate(BaseModel):
    courtroom: str | None = None
    judge: str | None = None
    purpose: str | None = None
    notes: str | None = None
    status: str | None = Field(
        None, pattern=r"^(scheduled|adjourned|completed|cancelled)$"
    )
    outcome: str | None = None
    next_date: str | None = None  # If adjourned, the new date


# ── Billing Aggregation ──────────────────────────────────────────


class LawyerBillingOut(BaseModel):
    unbilled_wip: float
    billed_ar: float
    paid_to_date: float
    trust_balance: float
    has_overdue: bool
    fee_arrangement: FeeArrangementOut | None
    unbilled_entries: list[TimeEntryOut]
    invoices: list[InvoiceOut]
    disbursements: list[DisbursementOut]


class ClientBillingOut(BaseModel):
    amount_due: float
    amount_due_invoice: str | None  # invoice number
    days_overdue: int | None
    retainer_amount: float | None
    retainer_used: float | None
    paid_to_date: float
    fee_description: str | None
    engagement_doc_path: str | None
    invoices: list[InvoiceClientOut]
