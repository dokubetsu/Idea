import pytest
from app.main import app
from app.shared.dependencies import CurrentUser, UserRole, get_current_user
from httpx import AsyncClient


def make_mock_consultation(overrides: dict) -> dict:
    base = {
        "id": "c-123",
        "user_id": "test-user-id",
        "lawyer_id": "test-lawyer-id",
        "status": "pending",
        "package": "starter",
        "sessions_total": 3,
        "sessions_used": 0,
        "payment_status": "unpaid",
        "amount_inr": 2999.0,
        "created_at": "2026-06-25T12:00:00Z",
        "updated_at": "2026-06-25T12:00:00Z",
        "up": {"full_name": "Test Petitioner"},
        "lp": {"full_name": "Test Lawyer"},
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_cancel_consultation_success(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"user_id": "test-user-id"})
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/cancel")
        assert res.status_code == 200
        assert res.json()["status"] == "cancelled"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_cancel_consultation_not_owner(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"user_id": "owner-user-id"})
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="malicious-user-id", role=UserRole.USER, full_name="Malicious User"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/cancel")
        assert res.status_code == 403
        assert "yours to cancel" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_cancel_consultation_not_pending(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"user_id": "test-user-id", "status": "confirmed"})
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/cancel")
        assert res.status_code == 400
        assert "Can only cancel pending" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_decline_consultation_success(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"lawyer_id": "test-lawyer-id"})
    ]
    mock_db.table("lawyer_profiles").data = [
        {"id": "test-lawyer-id", "is_verified": True}
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/decline")
        assert res.status_code == 200
        assert res.json()["status"] == "declined"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_decline_consultation_unverified_lawyer(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"lawyer_id": "test-lawyer-id"})
    ]
    mock_db.table("lawyer_profiles").data = [
        {"id": "test-lawyer-id", "is_verified": False}
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/decline")
        assert res.status_code == 403
        assert "pending verification" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_decline_consultation_not_assigned(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"lawyer_id": "test-lawyer-id"})
    ]
    mock_db.table("lawyer_profiles").data = [
        {"id": "other-lawyer-id", "is_verified": True}
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="other-lawyer-id", role=UserRole.LAWYER, full_name="Other Lawyer"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/decline")
        assert res.status_code == 403
        assert "not assigned to you" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_consultation_razorpay_order_mock(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation({"package": "starter", "amount_inr": 2999.0})
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )

    try:
        res = await client.post("/api/v1/consultations/c-123/razorpay-order")
        assert res.status_code == 200
        body = res.json()
        assert body["amount"] == 299900
        assert body["currency"] == "INR"
        assert body["mock"] is True
        assert body["order_id"].startswith("order_mock_")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_consultation_verify_payment_mock(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation(
            {
                "package": "starter",
                "amount_inr": 2999.0,
                "payment_status": "unpaid",
            }
        )
    ]
    mock_db.table("payments").data = []

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )

    try:
        res = await client.post(
            "/api/v1/consultations/c-123/verify-payment",
            json={
                "razorpay_payment_id": "pay_mock_abc",
                "razorpay_order_id": "order_mock_xyz",
                "razorpay_signature": "mock",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["payment_status"] == "paid"
        assert body["already_paid"] is False
        assert mock_db.table("consultations").data[0]["payment_status"] == "paid"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_consultation_verify_payment_idempotent(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [
        make_mock_consultation(
            {
                "package": "full",
                "amount_inr": 7999.0,
                "payment_status": "paid",
                "payment_gateway_ref": "pay_already",
            }
        )
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )

    try:
        res = await client.post(
            "/api/v1/consultations/c-123/verify-payment",
            json={
                "razorpay_payment_id": "pay_already",
                "razorpay_order_id": "order_mock_xyz",
                "razorpay_signature": "mock",
            },
        )
        assert res.status_code == 200
        assert res.json()["already_paid"] is True
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_confirm_blocks_unpaid_package(client: AsyncClient, mock_db):
    """Confirm RPC path: mock raises when payment unpaid for paid package."""
    mock_db.table("consultations").data = [
        make_mock_consultation({"payment_status": "unpaid", "package": "starter"})
    ]
    mock_db.table("lawyer_profiles").data = [
        {"id": "test-lawyer-id", "is_verified": True}
    ]

    # Force confirm_consultation RPC to raise like production payment gate
    original_rpc = mock_db.rpc

    def rpc_gate(name, params=None, *args, **kwargs):
        if name == "confirm_consultation":
            raise RuntimeError(
                "Cannot confirm consultation: payment_status is unpaid for package starter"
            )
        return original_rpc(name, params, *args, **kwargs)

    mock_db.rpc = rpc_gate

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/confirm")
        assert res.status_code in (400, 500)
    finally:
        mock_db.rpc = original_rpc
        app.dependency_overrides.clear()
