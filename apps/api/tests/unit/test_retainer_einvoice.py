"""Retainer ledger + e-invoice mock provider tests."""

from __future__ import annotations
import pytest
from httpx import AsyncClient

from app.main import app
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.shared.einvoice import MockEinvoiceProvider, build_irp_payload
from app.domains.docket.services.retainer import (
    deposit_retainer,
    refund_retainer,
    get_retainer_balance,
)


@pytest.mark.asyncio
async def test_mock_einvoice_generate():
    provider = MockEinvoiceProvider()
    payload = build_irp_payload(
        {
            "invoice_number": "INV-2026-001",
            "subtotal_inr": 1000,
            "gst_percent": 18,
            "gst_amount_inr": 180,
            "cgst_amount_inr": 90,
            "sgst_amount_inr": 90,
            "igst_amount_inr": 0,
            "total_inr": 1180,
            "place_of_supply": "Delhi",
            "supplier_state": "Delhi",
            "gstin": "07LEADG1234A1Z5",
            "hsn_sac": "998211",
            "work_summary": "Legal fees",
            "created_at": "2026-07-01T00:00:00Z",
        },
        seller={"name": "Firm"},
        buyer={"name": "Client"},
    )
    result = await provider.generate(payload)
    assert result.status == "generated"
    assert result.irn and len(result.irn) == 64
    assert result.ack_no
    assert result.signed_qr


def test_retainer_deposit_and_refund(mock_db):
    mock_db.table("matters").data = [
        {
            "id": "m1",
            "lawyer_id": "lawyer-1",
            "user_id": "c1",
            "deleted_at": None,
        }
    ]
    mock_db.table("fee_arrangements").data = [
        {
            "id": "fa1",
            "matter_id": "m1",
            "type": "retainer",
            "retainer_amount": 10000,
            "retainer_used": 0,
        }
    ]
    mock_db.table("retainer_ledger").data = []
    user = CurrentUser(id="lawyer-1", role=UserRole.LAWYER, full_name="L")

    dep = deposit_retainer("m1", user, 5000, note="Initial deposit")
    assert dep["entry_type"] == "deposit"
    assert dep["balance_after"] == 15000

    bal = get_retainer_balance("m1", user)
    assert bal["balance"] == 15000

    ref = refund_retainer("m1", user, 2000, note="Partial refund")
    assert ref["entry_type"] == "refund"
    assert get_retainer_balance("m1", user)["balance"] == 13000


@pytest.mark.asyncio
async def test_retainer_api_deposit(client: AsyncClient, mock_db):
    mock_db.table("matters").data = [
        {
            "id": "m1",
            "lawyer_id": "test-lawyer-id",
            "user_id": "c1",
            "deleted_at": None,
        }
    ]
    mock_db.table("fee_arrangements").data = [
        {
            "id": "fa1",
            "matter_id": "m1",
            "type": "retainer",
            "retainer_amount": 1000,
            "retainer_used": 0,
        }
    ]
    mock_db.table("retainer_ledger").data = []
    mock_db.table("lawyer_profiles").data = [
        {"id": "test-lawyer-id", "is_verified": True}
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-lawyer-id", role=UserRole.LAWYER, full_name="Lawyer"
    )
    try:
        res = await client.post(
            "/api/v1/docket/matters/m1/retainer/deposit",
            json={"amount_inr": 2500, "note": "Top-up"},
        )
        assert res.status_code == 201
        assert res.json()["entry_type"] == "deposit"
    finally:
        app.dependency_overrides.clear()
