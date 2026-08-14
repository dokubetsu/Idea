"""Phase 1 unit tests: matching accept RPC, apply_payment RPC, intake step CAS."""

import pytest
from app.domains.matters.payments import apply_payment
from app.main import app
from app.shared.dependencies import CurrentUser, UserRole, get_current_user
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_matching_accept_atomic(client: AsyncClient, mock_db):
    mock_db.table("lawyer_profiles").data = [
        {"id": "lawyer-1", "is_verified": True, "is_available": True}
    ]
    mock_db.table("lawyer_requests").data = [
        {
            "id": "req-1",
            "user_id": "user-1",
            "lawyer_id": "lawyer-1",
            "matter_id": "matter-1",
            "status": "pending",
        }
    ]
    mock_db.table("matters").data = [
        {
            "id": "matter-1",
            "title": "Case",
            "user_id": "user-1",
            "lawyer_id": None,
            "status": "matching",
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="lawyer-1", role=UserRole.LAWYER, full_name="Advocate"
    )

    try:
        res = await client.patch(
            "/api/v1/matching/requests/req-1", json={"accept": True}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "accepted"
        assert body.get("matter_assigned") is True
        assert mock_db.table("lawyer_requests").data[0]["status"] == "accepted"
        assert mock_db.table("matters").data[0]["lawyer_id"] == "lawyer-1"
        assert mock_db.table("matters").data[0]["status"] == "active"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_matching_accept_already_assigned(client: AsyncClient, mock_db):
    mock_db.table("lawyer_profiles").data = [{"id": "lawyer-1", "is_verified": True}]
    mock_db.table("lawyer_requests").data = [
        {
            "id": "req-1",
            "user_id": "user-1",
            "lawyer_id": "lawyer-1",
            "matter_id": "matter-1",
            "status": "pending",
        }
    ]
    mock_db.table("matters").data = [
        {
            "id": "matter-1",
            "title": "Case",
            "user_id": "user-1",
            "lawyer_id": "other-lawyer",
            "status": "matching",
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="lawyer-1", role=UserRole.LAWYER, full_name="Advocate"
    )

    try:
        res = await client.patch(
            "/api/v1/matching/requests/req-1", json={"accept": True}
        )
        assert res.status_code == 409
        # Request must remain pending (atomic RPC never accepted)
        assert mock_db.table("lawyer_requests").data[0]["status"] == "pending"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_apply_payment_rpc_idempotent(mock_db):
    mock_db.table("matter_milestones").data = [
        {
            "id": "ms-1",
            "matter_id": "matter-1",
            "amount_inr": 1000.0,
            "is_paid": False,
        }
    ]
    mock_db.table("payments").data = []

    first = await apply_payment(
        mock_db,
        milestone_id="ms-1",
        payment_id="pay_1",
        idemp_key="idemp_pay_1",
        amount_inr=1000.0,
        user_id="user-1",
    )
    assert first["is_paid"] is True

    second = await apply_payment(
        mock_db,
        milestone_id="ms-1",
        payment_id="pay_1",
        idemp_key="idemp_pay_1",
        amount_inr=1000.0,
        user_id="user-1",
    )
    assert second["is_paid"] is True
    # Only one payment row
    assert len(mock_db.table("payments").data) == 1


@pytest.mark.asyncio
async def test_intake_facts_cas(client: AsyncClient, mock_db):
    mock_db.table("intake_sessions").data = [
        {
            "id": "sess-1",
            "user_id": "test-user-id",
            "step": "facts_review",
            "extracted_facts": {
                "title": "Cheque bounce",
                "facts": [{"key": "amount", "value": "50000"}],
            },
            "is_committed": False,
            "assessment_result": None,
            "provider_used": "mock",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="User"
    )

    try:
        res = await client.patch(
            "/api/v1/intake/sess-1/facts",
            json={
                "facts": [
                    {
                        "key": "amount",
                        "value": "60000",
                        "label": "Amount",
                        "source": "user",
                        "confidence": 1.0,
                    }
                ]
            },
        )
        assert res.status_code == 200
        assert mock_db.table("intake_sessions").data[0]["step"] == "assessment"

        # Force step to something invalid for CAS
        mock_db.table("intake_sessions").data[0]["step"] = "confirm"
        res2 = await client.patch(
            "/api/v1/intake/sess-1/facts",
            json={
                "facts": [
                    {
                        "key": "amount",
                        "value": "70000",
                        "label": "Amount",
                        "source": "user",
                        "confidence": 1.0,
                    }
                ]
            },
        )
        # Pre-check rejects wrong step, or CAS returns concurrent error
        assert res2.status_code == 400
    finally:
        app.dependency_overrides.clear()
