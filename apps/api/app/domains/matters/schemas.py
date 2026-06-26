from __future__ import annotations
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field

MatterStatus = Literal[
    "draft", "intake", "assessment", "matching", "active", "resolved", "archived"
]
MatterPriority = Literal["low", "medium", "high", "urgent"]


class HearingOut(BaseModel):
    id: str
    matter_id: str
    hearing_date: datetime
    courtroom: str | None = None
    judge: str | None = None
    purpose: str | None = None
    notes: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class HearingCreate(BaseModel):
    hearing_date: datetime
    courtroom: str | None = None
    judge: str | None = None
    purpose: str | None = None
    notes: str | None = None
    status: str = "scheduled"


class HearingUpdate(BaseModel):
    hearing_date: datetime | None = None
    courtroom: str | None = None
    judge: str | None = None
    purpose: str | None = None
    notes: str | None = None
    status: str | None = None


class MilestoneOut(BaseModel):
    id: str
    matter_id: str
    title: str
    description: str | None = None
    order_index: int
    status: str
    amount_inr: float | None = None
    is_paid: bool = False
    # H12: payment_gateway_ref is the external gateway string (e.g. Razorpay "pay_XYZ").
    # payment_record_id is the FK to our internal payments table.
    payment_gateway_ref: str | None = None  # was: payment_id
    payment_record_id: str | None = None    # FK -> payments.id (nullable until paid)
    payment_idempotency_key: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MilestoneCreate(BaseModel):
    title: str
    description: str | None = None
    order_index: int
    status: str = "pending"
    amount_inr: float | None = None


class MilestoneUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    order_index: int | None = None
    status: str | None = None
    amount_inr: float | None = None
    is_paid: bool | None = None
    payment_gateway_ref: str | None = None  # was: payment_id (external gateway ref)
    payment_record_id: str | None = None    # FK -> payments.id
    payment_idempotency_key: str | None = None
    completed_at: datetime | None = None


class MeetingOut(BaseModel):
    id: str
    matter_id: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    meeting_link: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class MeetingCreate(BaseModel):
    scheduled_at: datetime
    duration_minutes: int = 30
    notes: str | None = None
    meeting_link: str | None = None


class MeetingUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    status: str | None = None
    meeting_link: str | None = None
    notes: str | None = None


class MatterOut(BaseModel):
    id: str
    user_id: str | None = None  # Make nullable for un-registered client invites
    lawyer_id: str | None
    intake_session_id: str | None = None
    title: str
    summary: str
    category: str
    status: str
    priority: str
    court_name: str | None
    case_number: str | None
    next_hearing_at: date | None
    assigned_at: datetime | None
    resolved_at: datetime | None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    user_name: str | None = None
    lawyer_name: str | None = None
    client_email: str | None = None
    client_phone: str | None = None
    facts: list[dict] = []
    hearings: list[HearingOut] = []
    milestones: list[MilestoneOut] = []
    meetings: list[MeetingOut] = []


class MatterUpdateRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    status: MatterStatus | None = None
    court_name: str | None = None
    case_number: str | None = None
    next_hearing_at: date | None = None
    priority: MatterPriority | None = None
    client_email: str | None = None
    client_phone: str | None = None


class MatterCreateRequest(BaseModel):
    title: str
    summary: str = ""
    category: str
    priority: MatterPriority = "medium"
    client_email: str
    client_phone: str | None = None
    court_name: str | None = None
    case_number: str | None = None


class PostUpdateRequest(BaseModel):
    content: str = Field(min_length=5)
    is_internal: bool = False
    parent_id: str | None = None


class UpdateOut(BaseModel):
    id: str
    matter_id: str
    author_id: str
    author_name: str | None = None
    content: str
    is_internal: bool
    parent_id: str | None = None
    created_at: datetime
    replies: list[UpdateOut] = []


class FactOut(BaseModel):
    id: str
    matter_id: str
    key: str
    value: str
    value_type: str
    label: str | None
    source: str
    confidence: float
    is_verified: bool
    created_at: datetime


class VerifyFactRequest(BaseModel):
    value: str | None = None  # optionally correct the value
    is_verified: bool = True


class AssignLawyerRequest(BaseModel):
    lawyer_id: str
    notes: str | None = None
