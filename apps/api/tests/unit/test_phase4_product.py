"""Phase 4: GST, MCLR, court calendar states, open-for-matching, overdue, retainer."""

from __future__ import annotations

from datetime import date

import pytest
from httpx import AsyncClient

from app.domains.docket.schemas import InvoiceCreate
from app.domains.docket.services.billing import create_invoice
from app.domains.legal_tools.services.interest import InterestSource
from app.main import app
from app.shared.court_calendar import is_court_working_day, next_working_day
from app.shared.dependencies import CurrentUser, UserRole, get_current_user
from app.shared.gst import compute_gst, normalize_state, resolve_place_of_supply


def test_gst_intra_state_splits_cgst_sgst():
    g = compute_gst(10000, place_of_supply="Maharashtra", supplier_state="Maharashtra")
    assert g.is_inter_state is False
    assert g.gst_amount_inr == 1800.0
    assert g.cgst_amount_inr == 900.0
    assert g.sgst_amount_inr == 900.0
    assert g.igst_amount_inr == 0.0
    assert g.total_inr == 11800.0


def test_gst_inter_state_uses_igst():
    g = compute_gst(10000, place_of_supply="Karnataka", supplier_state="Delhi")
    assert g.is_inter_state is True
    assert g.igst_amount_inr == 1800.0
    assert g.cgst_amount_inr == 0.0
    assert g.sgst_amount_inr == 0.0


def test_resolve_place_of_supply_prefers_client():
    pos = resolve_place_of_supply(
        client_state="maharashtra", lawyer_state="Delhi", explicit=None
    )
    assert pos == "Maharashtra"


def test_normalize_state_aliases():
    assert normalize_state("nct of delhi") == "Delhi"
    assert normalize_state("ORISSA") == "Odisha"


def test_maharashtra_day_not_working():
    # 1 May 2026 is Friday and Maharashtra Day in STATE_HOLIDAYS
    d = date(2026, 5, 1)
    assert is_court_working_day(d) is True  # national calendar only
    assert is_court_working_day(d, state="Maharashtra") is False
    assert next_working_day(d, state="Maharashtra") > d


def test_mclr_default_and_env(monkeypatch):
    InterestSource._cached_rate = None
    InterestSource._cached_as_of = None
    from app.config import settings

    monkeypatch.setattr(settings, "SBI_MCLR_RATE", None)
    monkeypatch.setattr(settings, "SBI_MCLR_FETCH_URL", "")
    info = InterestSource.get_sbi_mclr()
    assert info["source"] == "default"
    assert info["rera_statutory_rate"] == info["rate"] + 2.0

    monkeypatch.setattr(settings, "SBI_MCLR_RATE", 8.75)
    monkeypatch.setattr(settings, "SBI_MCLR_AS_OF", "2026-06-15")
    info2 = InterestSource.get_sbi_mclr()
    assert info2["source"] == "env"
    assert info2["rate"] == 8.75
    assert info2["rera_statutory_rate"] == 10.75


def test_create_invoice_inter_state_and_retainer(mock_db):
    matter_id = "m-1"
    lawyer_id = "lawyer-1"
    mock_db.table("matters").data = [
        {
            "id": matter_id,
            "user_id": "client-1",
            "lawyer_id": lawyer_id,
            "deleted_at": None,
            "title": "Case",
        }
    ]
    mock_db.table("profiles").data = [
        {"id": "client-1", "state": "Karnataka", "role": "user", "is_active": True},
        {"id": lawyer_id, "state": "Delhi", "role": "lawyer", "is_active": True},
    ]
    mock_db.table("time_entries").data = [
        {
            "id": "te-1",
            "matter_id": matter_id,
            "amount_inr": 10000.0,
            "status": "unbilled",
        }
    ]
    mock_db.table("disbursements").data = []
    mock_db.table("invoices").data = []
    mock_db.table("fee_arrangements").data = [
        {
            "id": "fa-1",
            "matter_id": matter_id,
            "type": "retainer",
            "retainer_amount": 50000,
            "retainer_used": 0,
        }
    ]

    user = CurrentUser(id=lawyer_id, role=UserRole.LAWYER, full_name="Lawyer")
    inv = create_invoice(
        matter_id,
        user,
        InvoiceCreate(time_entry_ids=["te-1"], draw_retainer=True),
    )
    assert inv["is_inter_state"] is True
    assert inv["igst_amount_inr"] == 1800.0
    assert inv["place_of_supply"] == "Karnataka"
    assert inv["supplier_state"] == "Delhi"
    assert mock_db.table("fee_arrangements").data[0]["retainer_used"] == 11800.0


@pytest.mark.asyncio
async def test_open_for_matching(client: AsyncClient, mock_db):
    mock_db.table("matters").data = [
        {
            "id": "matter-assess",
            "user_id": "test-user-id",
            "lawyer_id": None,
            "status": "assessment",
            "title": "Assessed case",
            "summary": "Summary",
            "category": "consumer",
            "priority": "medium",
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Client"
    )
    try:
        res = await client.post("/api/v1/matters/matter-assess/open-for-matching")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "matching"
        assert body["already_open"] is False
        assert mock_db.table("matters").data[0]["status"] == "matching"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_open_for_matching_wrong_status(client: AsyncClient, mock_db):
    mock_db.table("matters").data = [
        {
            "id": "matter-active",
            "user_id": "test-user-id",
            "lawyer_id": "l1",
            "status": "active",
            "title": "Active",
            "summary": "S",
            "category": "consumer",
            "priority": "medium",
        }
    ]
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Client"
    )
    try:
        res = await client.post("/api/v1/matters/matter-active/open-for-matching")
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_mark_invoices_overdue_cron(client: AsyncClient, mock_db):
    from app.config import settings

    mock_db.table("invoices").data = [
        {
            "id": "inv-1",
            "status": "sent",
            "due_date": "2020-01-01",
            "matter_id": "m1",
        },
        {
            "id": "inv-2",
            "status": "sent",
            "due_date": "2099-01-01",
            "matter_id": "m1",
        },
    ]
    res = await client.post(
        "/api/v1/system/cron/mark-invoices-overdue",
        headers={"X-Cron-Secret": settings.CRON_SECRET},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["invoices_marked_overdue"] >= 1
    assert mock_db.table("invoices").data[0]["status"] == "overdue"
    assert mock_db.table("invoices").data[1]["status"] == "sent"


@pytest.mark.asyncio
async def test_mclr_endpoint(client: AsyncClient, mock_db):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="u1", role=UserRole.USER, full_name="U"
    )
    try:
        res = await client.get("/api/v1/legal-tools/rates/mclr")
        assert res.status_code == 200
        body = res.json()
        assert "rate" in body
        assert "rera_statutory_rate" in body
        assert body["source"] in ("default", "env", "feed")
    finally:
        app.dependency_overrides.clear()
