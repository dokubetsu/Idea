"""Docket domain — service facade."""

from __future__ import annotations

# Import and expose helpers
from app.domains.docket.services.helpers import (
    _today,
    _now,
    _get_matter_for_participant,
    _ensure_lawyer_on_matter,
    _format_inr,
    _status_to_stage,
    _stage_to_client_text,
)

# Import and expose case/dashboard functions
from app.domains.docket.services.dashboards import (
    get_lawyer_dashboard,
    get_client_dashboard,
)
from app.domains.docket.services.case_overview import (
    get_case_overview,
)
from app.domains.docket.services.notes import (
    create_note,
    list_notes,
)
from app.domains.docket.services.tasks import (
    create_task,
    list_tasks,
    update_task,
    nudge_client,
)
from app.domains.docket.services.ai_chat import (
    ask_case_ai,
)
from app.domains.docket.services.messages import (
    list_messages,
    send_message,
)

# Import and expose billing functions
from app.domains.docket.services.billing import (
    get_billing,
    create_time_entry,
    list_time_entries,
    update_time_entry,
    delete_time_entry,
    create_invoice,
    list_invoices,
    update_invoice,
    get_fee_arrangement,
    create_fee_arrangement,
    update_fee_arrangement,
    create_disbursement,
    list_disbursements,
)
from app.domains.docket.services.retainer import (
    get_retainer_balance,
    list_retainer_ledger,
    deposit_retainer,
    refund_retainer,
    post_retainer_entry,
)

# Import and expose hearing/timeline functions
from app.domains.docket.services.hearings import (
    schedule_hearing,
    list_hearings,
    update_hearing,
    create_timeline_event,
    list_timeline_events,
)

# Import and expose document functions
from app.domains.docket.services.documents import (
    list_documents,
    review_document,
    update_document_note,
    create_document_request,
    list_document_requests,
    cancel_document_request,
    fulfill_document_request,
    get_document_download_url,
)

__all__ = [
    # Helpers
    "_today",
    "_now",
    "_get_matter_for_participant",
    "_ensure_lawyer_on_matter",
    "_format_inr",
    "_status_to_stage",
    "_stage_to_client_text",
    # Cases
    "get_lawyer_dashboard",
    "get_client_dashboard",
    "get_case_overview",
    "create_note",
    "list_notes",
    "create_task",
    "list_tasks",
    "update_task",
    "ask_case_ai",
    "nudge_client",
    "list_messages",
    "send_message",
    # Billing
    "get_billing",
    "create_time_entry",
    "list_time_entries",
    "update_time_entry",
    "delete_time_entry",
    "create_invoice",
    "list_invoices",
    "update_invoice",
    "get_fee_arrangement",
    "create_fee_arrangement",
    "update_fee_arrangement",
    "create_disbursement",
    "list_disbursements",
    "get_retainer_balance",
    "list_retainer_ledger",
    "deposit_retainer",
    "refund_retainer",
    "post_retainer_entry",
    # Hearings
    "schedule_hearing",
    "list_hearings",
    "update_hearing",
    "create_timeline_event",
    "list_timeline_events",
    # Documents
    "list_documents",
    "review_document",
    "update_document_note",
    "create_document_request",
    "list_document_requests",
    "cancel_document_request",
    "fulfill_document_request",
    "get_document_download_url",
]
