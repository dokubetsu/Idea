import pytest
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app


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
        "created_at": "2026-06-25T12:00:00Z",
        "updated_at": "2026-06-25T12:00:00Z",
        "up": {"full_name": "Test Petitioner"},
        "lp": {"full_name": "Test Lawyer"},
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_cancel_consultation_success(client: AsyncClient, mock_db):
    mock_db.table("consultations").data = [make_mock_consultation({"user_id": "test-user-id"})]

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
    mock_db.table("consultations").data = [make_mock_consultation({"user_id": "owner-user-id"})]

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
    mock_db.table("consultations").data = [make_mock_consultation({"user_id": "test-user-id", "status": "confirmed"})]

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
    mock_db.table("consultations").data = [make_mock_consultation({"lawyer_id": "test-lawyer-id"})]
    mock_db.table("lawyer_profiles").data = [{"id": "test-lawyer-id", "is_verified": True}]

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
    mock_db.table("consultations").data = [make_mock_consultation({"lawyer_id": "test-lawyer-id"})]
    mock_db.table("lawyer_profiles").data = [{"id": "test-lawyer-id", "is_verified": False}]

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
    mock_db.table("consultations").data = [make_mock_consultation({"lawyer_id": "test-lawyer-id"})]
    mock_db.table("lawyer_profiles").data = [{"id": "other-lawyer-id", "is_verified": True}]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="other-lawyer-id", role=UserRole.LAWYER, full_name="Other Lawyer"
    )

    try:
        res = await client.patch("/api/v1/consultations/c-123/decline")
        assert res.status_code == 403
        assert "not assigned to you" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()
