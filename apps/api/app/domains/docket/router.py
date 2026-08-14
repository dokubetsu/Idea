"""Docket domain — API router."""

from __future__ import annotations

from app.domains.docket import service
from app.domains.docket.schemas import (
    DisbursementCreate,
    DocumentRequestCreate,
    DocumentReview,
    DocumentUpdateNote,
    FeeArrangementCreate,
    FeeArrangementUpdate,
    HearingUpdate,
    InvoiceCreate,
    InvoiceUpdate,
    MessageCreate,
    NoteCreate,
    TaskCreate,
    TaskUpdate,
    TimeEntryCreate,
    TimeEntryUpdate,
    TimelineEventCreate,
)
from app.shared.dependencies import Auth, LawyerVerifiedAuth, UserRole
from app.shared.exceptions import Forbidden
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(prefix="/docket", tags=["docket"])


# ── Dashboard Endpoints ──────────────────────────────────────────


@router.get("/lawyer/dashboard")
async def lawyer_dashboard(user: LawyerVerifiedAuth):
    return service.get_lawyer_dashboard(user)


@router.get("/client/dashboard")
async def client_dashboard(user: Auth):
    if user.role not in (UserRole.USER, UserRole.ADMIN):
        raise Forbidden("Client dashboard is for petitioners only")
    return service.get_client_dashboard(user)


# ── Case Overview ────────────────────────────────────────────────


@router.get("/matters/{matter_id}/overview")
async def case_overview(matter_id: str, user: Auth):
    return service.get_case_overview(matter_id, user)


# ── Billing ──────────────────────────────────────────────────────


@router.get("/matters/{matter_id}/billing")
async def case_billing(matter_id: str, user: Auth):
    return service.get_billing(matter_id, user)


# ── Time Entries ─────────────────────────────────────────────────


@router.post("/matters/{matter_id}/time-entries", status_code=201)
async def create_time_entry(
    matter_id: str, body: TimeEntryCreate, user: LawyerVerifiedAuth
):
    return service.create_time_entry(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/time-entries")
async def list_time_entries(matter_id: str, user: LawyerVerifiedAuth):
    return service.list_time_entries(matter_id, user)


@router.patch("/matters/{matter_id}/time-entries/{entry_id}")
async def update_time_entry(
    matter_id: str, entry_id: str, body: TimeEntryUpdate, user: LawyerVerifiedAuth
):
    return service.update_time_entry(
        matter_id, entry_id, user, body.model_dump(exclude_none=True)
    )


@router.delete("/matters/{matter_id}/time-entries/{entry_id}", status_code=204)
async def delete_time_entry(matter_id: str, entry_id: str, user: LawyerVerifiedAuth):
    service.delete_time_entry(matter_id, entry_id, user)


# ── Invoices ─────────────────────────────────────────────────────


@router.post("/matters/{matter_id}/invoices", status_code=201)
async def create_invoice(matter_id: str, body: InvoiceCreate, user: LawyerVerifiedAuth):
    return service.create_invoice(matter_id, user, body)


@router.get("/matters/{matter_id}/invoices")
async def list_invoices(matter_id: str, user: Auth):
    return service.list_invoices(matter_id, user)


@router.patch("/matters/{matter_id}/invoices/{invoice_id}")
async def update_invoice(
    matter_id: str, invoice_id: str, body: InvoiceUpdate, user: LawyerVerifiedAuth
):
    return service.update_invoice(
        matter_id, invoice_id, user, body.model_dump(exclude_none=True)
    )


@router.post("/matters/{matter_id}/invoices/{invoice_id}/einvoice", status_code=200)
async def generate_einvoice(matter_id: str, invoice_id: str, user: LawyerVerifiedAuth):
    """Generate IRP e-invoice (mock or NIC) and persist ack/QR on the invoice."""
    from app.domains.docket.services.helpers import _ensure_lawyer_on_matter
    from app.shared.database import get_db
    from app.shared.einvoice import generate_einvoice_for_invoice
    from app.shared.exceptions import NotFound

    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    inv = (
        db.table("invoices")
        .select("*")
        .eq("id", invoice_id)
        .eq("matter_id", matter_id)
        .execute()
        .data
    )
    if not inv:
        raise NotFound("Invoice")
    return await generate_einvoice_for_invoice(db, inv[0])


# ── Retainer / trust ledger ──────────────────────────────────────


class RetainerEntryBody(BaseModel):
    amount_inr: float = Field(..., gt=0)
    note: str | None = None


@router.get("/matters/{matter_id}/retainer")
async def retainer_balance(matter_id: str, user: Auth):
    return service.get_retainer_balance(matter_id, user)


@router.get("/matters/{matter_id}/retainer/ledger")
async def retainer_ledger(matter_id: str, user: Auth):
    return service.list_retainer_ledger(matter_id, user)


@router.post("/matters/{matter_id}/retainer/deposit", status_code=201)
async def retainer_deposit(
    matter_id: str, body: RetainerEntryBody, user: LawyerVerifiedAuth
):
    return service.deposit_retainer(matter_id, user, body.amount_inr, body.note)


@router.post("/matters/{matter_id}/retainer/refund", status_code=201)
async def retainer_refund(
    matter_id: str, body: RetainerEntryBody, user: LawyerVerifiedAuth
):
    return service.refund_retainer(matter_id, user, body.amount_inr, body.note)


# ── Internal Notes ───────────────────────────────────────────────


@router.post("/matters/{matter_id}/notes", status_code=201)
async def create_note(matter_id: str, body: NoteCreate, user: LawyerVerifiedAuth):
    return service.create_note(matter_id, user, body.content)


@router.get("/matters/{matter_id}/notes")
async def list_notes(matter_id: str, user: LawyerVerifiedAuth):
    return service.list_notes(matter_id, user)


# ── Tasks ────────────────────────────────────────────────────────


@router.post("/matters/{matter_id}/tasks", status_code=201)
async def create_task(matter_id: str, body: TaskCreate, user: LawyerVerifiedAuth):
    return service.create_task(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/tasks")
async def list_tasks(matter_id: str, user: Auth):
    return service.list_tasks(matter_id, user)


@router.patch("/matters/{matter_id}/tasks/{task_id}")
async def update_task(matter_id: str, task_id: str, body: TaskUpdate, user: Auth):
    return service.update_task(
        matter_id, task_id, user, body.model_dump(exclude_none=True)
    )


# ── Timeline ─────────────────────────────────────────────────────


@router.post("/matters/{matter_id}/timeline", status_code=201)
async def create_timeline_event(
    matter_id: str, body: TimelineEventCreate, user: LawyerVerifiedAuth
):
    return service.create_timeline_event(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/timeline")
async def list_timeline_events(matter_id: str, user: Auth):
    return service.list_timeline_events(matter_id, user)


# ── Fee Arrangements ─────────────────────────────────────────────


@router.get("/matters/{matter_id}/fee-arrangement")
async def get_fee_arrangement(matter_id: str, user: Auth):
    return service.get_fee_arrangement(matter_id, user)


@router.post("/matters/{matter_id}/fee-arrangement", status_code=201)
async def create_fee_arrangement(
    matter_id: str, body: FeeArrangementCreate, user: LawyerVerifiedAuth
):
    return service.create_fee_arrangement(matter_id, user, body.model_dump())


@router.patch("/matters/{matter_id}/fee-arrangement")
async def update_fee_arrangement(
    matter_id: str, body: FeeArrangementUpdate, user: LawyerVerifiedAuth
):
    return service.update_fee_arrangement(
        matter_id, user, body.model_dump(exclude_none=True)
    )


# ── Disbursements ────────────────────────────────────────────────


@router.post("/matters/{matter_id}/disbursements", status_code=201)
async def create_disbursement(
    matter_id: str, body: DisbursementCreate, user: LawyerVerifiedAuth
):
    return service.create_disbursement(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/disbursements")
async def list_disbursements(matter_id: str, user: Auth):
    return service.list_disbursements(matter_id, user)


# ── AI Chat ──────────────────────────────────────────────────────


class AskCaseAiRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)


class ScheduleHearingRequest(BaseModel):
    hearing_date: str = Field(..., min_length=10)
    courtroom: str | None = None
    judge: str | None = None
    purpose: str | None = None


@router.post("/matters/{matter_id}/ai-chat")
async def ask_case_ai(matter_id: str, body: AskCaseAiRequest, user: Auth):
    return await service.ask_case_ai(matter_id, body.prompt, user)


# ── Nudge Client ────────────────────────────────────────────────


@router.post("/matters/{matter_id}/tasks/{task_id}/nudge", status_code=200)
async def nudge_client(matter_id: str, task_id: str, user: LawyerVerifiedAuth):
    return service.nudge_client(matter_id, task_id, user)


# ── Hearings ────────────────────────────────────────────────────


@router.post("/matters/{matter_id}/hearings", status_code=201)
async def schedule_hearing(
    matter_id: str, body: ScheduleHearingRequest, user: LawyerVerifiedAuth
):
    return service.schedule_hearing(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/hearings")
async def list_hearings(matter_id: str, user: Auth):
    return service.list_hearings(matter_id, user)


@router.patch("/matters/{matter_id}/hearings/{hearing_id}")
async def update_hearing(
    matter_id: str, hearing_id: str, body: HearingUpdate, user: LawyerVerifiedAuth
):
    return service.update_hearing(
        matter_id, hearing_id, user, body.model_dump(exclude_none=True)
    )


# ── Documents (Review) ──────────────────────────────────────────


@router.get("/matters/{matter_id}/documents")
async def list_documents(matter_id: str, user: Auth):
    return service.list_documents(matter_id, user)


@router.patch("/matters/{matter_id}/documents/{doc_id}/review")
async def review_document(
    matter_id: str, doc_id: str, body: DocumentReview, user: LawyerVerifiedAuth
):
    return service.review_document(matter_id, doc_id, user, body.model_dump())


@router.patch("/matters/{matter_id}/documents/{doc_id}/note")
async def update_document_note(
    matter_id: str, doc_id: str, body: DocumentUpdateNote, user: LawyerVerifiedAuth
):
    return service.update_document_note(matter_id, doc_id, user, body.lawyer_note)


@router.get("/matters/{matter_id}/documents/{doc_id}/download-url")
async def get_document_download_url(matter_id: str, doc_id: str, user: Auth):
    return service.get_document_download_url(matter_id, doc_id, user)


# ── Document Requests ────────────────────────────────────────────


@router.post("/matters/{matter_id}/document-requests", status_code=201)
async def create_document_request(
    matter_id: str, body: DocumentRequestCreate, user: LawyerVerifiedAuth
):
    return service.create_document_request(matter_id, user, body.model_dump())


@router.get("/matters/{matter_id}/document-requests")
async def list_document_requests(matter_id: str, user: Auth):
    return service.list_document_requests(matter_id, user)


@router.patch("/matters/{matter_id}/document-requests/{request_id}/cancel")
async def cancel_document_request(
    matter_id: str, request_id: str, user: LawyerVerifiedAuth
):
    return service.cancel_document_request(matter_id, request_id, user)


@router.post(
    "/matters/{matter_id}/document-requests/{request_id}/fulfill", status_code=201
)
async def fulfill_document_request(
    matter_id: str,
    request_id: str,
    user: Auth,
    file: UploadFile = File(...),
):
    from app.shared.file_validation import validate_upload_stream

    file_bytes, content_type = await validate_upload_stream(file)
    return service.fulfill_document_request(
        matter_id,
        request_id,
        user,
        filename=file.filename or "document",
        content_type=content_type,
        file_bytes=file_bytes,
    )


# ── Messages ────────────────────────────────────────────────────


@router.get("/matters/{matter_id}/messages")
async def list_messages(matter_id: str, user: Auth):
    return service.list_messages(matter_id, user)


@router.post("/matters/{matter_id}/messages", status_code=201)
async def send_message(matter_id: str, body: MessageCreate, user: Auth):
    return service.send_message(matter_id, user, body.model_dump())
