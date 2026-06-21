from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator

ConsultationPackage = Literal['free', 'starter', 'full']
ConsultationStatus = Literal['pending', 'confirmed', 'completed', 'cancelled', 'declined']
ConsultationPaymentStatus = Literal['unpaid', 'paid', 'waived']

class ConsultationCreate(BaseModel):
    lawyer_id: str | None = None
    package: ConsultationPackage = 'free'
    notes: str | None = None

    @model_validator(mode="after")
    def lawyer_required_for_paid_packages(self) -> "ConsultationCreate":
        """
        Paid packages (starter, full) must have an explicit lawyer_id.
        Free packages auto-assign a lawyer when none is provided.
        Without this check, a paid booking without lawyer_id would silently create an
        invalid row (violating the 'lawyer_id nullable only when package=free' invariant).
        """
        if self.package in ("starter", "full") and not self.lawyer_id:
            raise ValueError(
                f"A lawyer_id is required when booking a '{self.package}' package. "
                "Please select a lawyer before proceeding."
            )
        return self


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
