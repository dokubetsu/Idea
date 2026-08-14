from datetime import date

import pytest

from app.domains.docket.schemas import InvoiceCreate
from app.domains.docket.services.billing import (
    create_invoice,
    create_time_entry,
)
from app.domains.docket.services.helpers import _format_inr, _get_matter_for_participant
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import Forbidden


def test_format_inr():
    assert _format_inr(0) == "₹0"
    assert _format_inr(1500.0) == "₹1,500"
    assert _format_inr(100000) == "₹1.00L"
    assert _format_inr(1234567.89) == "₹12.35L"


def test_get_matter_for_participant_access_control(mock_db):
    matter_id = "test-matter-id"
    mock_db.table("matters").data = [
        {
            "id": matter_id,
            "title": "Test Case",
            "user_id": "client-id",
            "lawyer_id": "lawyer-id",
            "deleted_at": None,
        }
    ]

    # Authorized lawyer
    lawyer_user = CurrentUser(
        id="lawyer-id", role=UserRole.LAWYER, full_name="Jane Lawyer"
    )
    matter = _get_matter_for_participant(matter_id, lawyer_user)
    assert matter["id"] == matter_id

    # Authorized client
    client_user = CurrentUser(
        id="client-id", role=UserRole.USER, full_name="John Client"
    )
    matter = _get_matter_for_participant(matter_id, client_user)
    assert matter["id"] == matter_id

    # Unauthorized user
    intruder_user = CurrentUser(
        id="intruder-id", role=UserRole.USER, full_name="Intruder"
    )
    with pytest.raises(Forbidden):
        _get_matter_for_participant(matter_id, intruder_user)


def test_create_time_entry_with_fee_arrangement_fallback(mock_db):
    matter_id = "test-matter-id"
    lawyer_id = "lawyer-id"
    mock_db.table("matters").data = [
        {
            "id": matter_id,
            "title": "Test Case",
            "user_id": "client-id",
            "lawyer_id": lawyer_id,
            "deleted_at": None,
        }
    ]
    mock_db.table("fee_arrangements").data = [
        {
            "matter_id": matter_id,
            "rate_per_hour": 5000.0,
            "type": "hourly",
        }
    ]
    mock_db.table("time_entries").data = []

    lawyer_user = CurrentUser(
        id=lawyer_id, role=UserRole.LAWYER, full_name="Jane Lawyer"
    )

    # Create time entry without explicit rate - should fallback to fee arrangement rate
    entry_data = {
        "activity": "Drafting petition",
        "hours": 2.5,
        "entry_date": date(2026, 7, 6),
        "rate_per_hour": None,
    }

    entry = create_time_entry(matter_id, lawyer_user, entry_data)
    assert entry["rate_per_hour"] == 5000.0
    assert entry["hours"] == 2.5
    assert entry["activity"] == "Drafting petition"
    assert len(mock_db.table("time_entries").data) == 1


def test_create_invoice_calculation(mock_db):
    matter_id = "test-matter-id"
    lawyer_id = "lawyer-id"

    mock_db.table("matters").data = [
        {
            "id": matter_id,
            "title": "Test Case",
            "user_id": "client-id",
            "lawyer_id": lawyer_id,
            "deleted_at": None,
        }
    ]
    mock_db.table("time_entries").data = [
        {
            "id": "te-1",
            "matter_id": matter_id,
            "amount_inr": 10000.0,
            "status": "unbilled",
        },
        {
            "id": "te-2",
            "matter_id": matter_id,
            "amount_inr": 5000.0,
            "status": "unbilled",
        },
    ]
    mock_db.table("disbursements").data = [
        {
            "id": "db-1",
            "matter_id": matter_id,
            "amount_inr": 2000.0,
            "status": "unpaid",
            "invoice_id": None,
        }
    ]
    mock_db.table("invoices").data = []

    lawyer_user = CurrentUser(
        id=lawyer_id, role=UserRole.LAWYER, full_name="Jane Lawyer"
    )

    invoice_req = InvoiceCreate(
        period_start=date(2026, 7, 1),
        period_end=date(2026, 7, 6),
        time_entry_ids=["te-1", "te-2"],
        disbursement_ids=["db-1"],
        work_summary="Completed initial drafting and filing fees.",
        due_date=date(2026, 7, 20),
    )

    invoice = create_invoice(matter_id, lawyer_user, invoice_req)

    # Subtotal: 10000 + 5000 + 2000 = 17000
    assert invoice["subtotal_inr"] == 17000.0
    # GST: 18% of 17000 = 3060
    assert invoice["gst_amount_inr"] == 3060.0
    # Total: 17000 + 3060 = 20060
    assert invoice["total_inr"] == 20060.0
    assert invoice["invoice_number"].startswith("INV-")
    assert invoice["gstin"] in ("27LEADG1234A1Z0", "07LEADG1234A1Z5")
    assert invoice["hsn_sac"] == "998211"
    assert invoice.get("place_of_supply")  # state-aware GST

    # Verify time entries and disbursements were updated to point to invoice
    assert mock_db.table("time_entries").data[0]["status"] == "billed"
    assert mock_db.table("time_entries").data[0]["invoice_id"] == invoice["id"]
    assert mock_db.table("disbursements").data[0]["invoice_id"] == invoice["id"]
