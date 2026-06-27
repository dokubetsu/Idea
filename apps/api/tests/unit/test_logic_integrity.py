from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from app.domains.intake.facts_engine import _mock_extract
from app.shared.ai.validator import Normalizer
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app


@pytest.mark.asyncio
async def test_respond_to_request_status_guard(client: AsyncClient, mock_db):
    # Set current user as a verified lawyer
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer"
    )

    try:
        # Seed lawyer profile verification status to True in mock db
        mock_db.table("lawyer_profiles").data = [
            {
                "id": "test-lawyer-id",
                "is_verified": True,
            }
        ]

        # Seed an already declined request in mock database
        mock_db.table("lawyer_requests").data = [
            {
                "id": "req-1",
                "lawyer_id": "test-lawyer-id",
                "user_id": "test-user-id",
                "matter_id": "test-matter-id",
                "status": "declined",
            }
        ]

        # Try to accept it
        payload = {"accept": True}
        res = await client.patch("/api/v1/matching/requests/req-1", json=payload)

        # Must return 400 Bad Request
        assert res.status_code == 400
        assert "already been processed" in res.json()["detail"]

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_contact_lawyer_idor(client: AsyncClient, mock_db):
    # Set current user as a standard client user
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Client"
    )

    try:
        # Seed a matter belonging to another user
        mock_db.table("matters").data = [
            {
                "id": "matter-other-user",
                "user_id": "other-user-uuid",
                "title": "Other User Matter",
                "summary": "Summary",
                "category": "other",
                "status": "active",
            }
        ]

        # Try to contact a lawyer attaching another user's matter
        payload = {"matter_id": "matter-other-user", "message": "Please help"}
        res = await client.post("/api/v1/matching/lawyers/some-lawyer-id/contact", json=payload)

        # Must return 403 Forbidden
        assert res.status_code == 403
        assert "does not belong to you" in res.json()["detail"]

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_verify_fact_idor(client: AsyncClient, mock_db):
    # Set current user as an unassigned lawyer
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="unassigned-lawyer-id", role=UserRole.LAWYER, full_name="Unassigned Lawyer"
    )

    try:
        # Seed a matter assigned to a different lawyer
        mock_db.table("matters").data = [
            {
                "id": "matter-1",
                "user_id": "client-uuid",
                "lawyer_id": "assigned-lawyer-id",
                "title": "Some Case",
                "summary": "Summary",
                "category": "other",
                "status": "active",
                "up": {"full_name": "Client Name"},
                "lp": {"full_name": "Assigned Lawyer Name"},
            }
        ]
        # Seed a fact for this matter
        mock_db.table("facts").data = [
            {
                "id": "fact-1",
                "matter_id": "matter-1",
                "key": "some_fact",
                "value": "original value",
                "value_type": "string",
                "is_verified": False,
            }
        ]

        # Seed lawyer profile verification status to True in mock db
        mock_db.table("lawyer_profiles").data = [
            {
                "id": "unassigned-lawyer-id",
                "is_verified": True,
            }
        ]

        # Try to verify the fact on this matter
        payload = {"is_verified": True, "value": "new value"}
        res = await client.patch("/api/v1/matters/matter-1/facts/fact-1", json=payload)

        # Must return 403 Forbidden
        assert res.status_code == 403

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_user_cannot_update_lawyer_only_fields(client: AsyncClient, mock_db):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Client"
    )

    try:
        mock_db.table("matters").data = [
            {
                "id": "matter-1",
                "user_id": "test-user-id",
                "title": "Case",
                "summary": "Summary",
                "category": "other",
                "status": "active",
                "priority": "medium",
                "court_name": None,
                "case_number": None,
                "next_hearing_at": None,
            }
        ]

        res = await client.patch(
            "/api/v1/matters/matter-1",
            json={"status": "resolved", "priority": "urgent"},
        )

        assert res.status_code == 403
        assert "Access denied" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_verify_fact_rejects_stale_updated_at(client: AsyncClient, mock_db):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer"
    )

    try:
        mock_db.table("matters").data = [
            {
                "id": "matter-1",
                "user_id": "client-uuid",
                "lawyer_id": "lawyer-id",
                "title": "Case",
                "summary": "Summary",
                "category": "other",
                "status": "active",
            }
        ]
        mock_db.table("facts").data = [
            {
                "id": "fact-1",
                "matter_id": "matter-1",
                "key": "some_fact",
                "value": "original value",
                "value_type": "string",
                "is_verified": False,
                "updated_at": "2024-01-01T00:00:00+00:00",
            }
        ]
        mock_db.table("lawyer_profiles").data = [{"id": "lawyer-id", "is_verified": True}]

        res = await client.patch(
            "/api/v1/matters/matter-1/facts/fact-1",
            json={"is_verified": True, "updated_at": "2024-01-02T00:00:00+00:00"},
        )

        assert res.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_mock_extract_completeness_score_counts_only_schema_keys():
    result = _mock_extract("Title", "")

    assert result.completeness_score == 0.0


def test_normalizer_swaps_inverted_budget_and_timeline_ranges():
    payload = {
        "timeline_min_months": 24,
        "timeline_max_months": 6,
        "budget_min_inr": 60000,
        "budget_max_inr": 20000,
    }

    normalized = Normalizer.normalize_assessment(
        type("Model", (), {"model_dump": lambda self: payload})(),
        provider_name="test",
        model_name="test-model",
        prompt_version="v1",
        temperature=0.1,
    )

    assert normalized["timeline_min_months"] == 6
    assert normalized["timeline_max_months"] == 24
    assert normalized["budget_min_inr"] == 20000
    assert normalized["budget_max_inr"] == 60000
