from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

ConsultationPackage = Literal['free', 'starter', 'full']
ConsultationStatus = Literal['pending', 'confirmed', 'completed', 'cancelled', 'declined']
ConsultationPaymentStatus = Literal['unpaid', 'paid', 'waived']

class ConsultationCreate(BaseModel):
    lawyer_id: str | None = None
    package: ConsultationPackage = 'free'
    notes: str | None = None

class ConsultationOut(BaseModel):
    id: str
    user_id: str
    lawyer_id: str | None
    package: ConsultationPackage
    sessions_total: int
    sessions_used: int
    status: ConsultationStatus
    payment_status: ConsultationPaymentStatus
    matter_id: str | None = None
    notes: str | None = None
    scheduled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Enriched fields
    user_name: str | None = None
    lawyer_name: str | None = None

class ConsultationPatch(BaseModel):
    # Only allowed specific state transitions via specialized RPC or endpoints
    # but we can provide a generic patch for things like notes/scheduled_at
    notes: str | None = None
    scheduled_at: datetime | None = None

class ConfirmConsultationOut(BaseModel):
    matter_id: str
    already_confirmed: bool
