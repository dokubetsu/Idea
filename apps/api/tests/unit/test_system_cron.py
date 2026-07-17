"""System cron endpoint auth and no-op behaviour."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from app.main import app
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.config import settings


@pytest.mark.asyncio
async def test_cron_rejects_missing_secret(client: AsyncClient, mock_db):
    res = await client.post("/api/v1/system/cron/cleanup-sessions")
    assert res.status_code == 401
    assert (
        "cron" in res.json()["detail"].lower()
        or "invalid" in res.json()["detail"].lower()
    )


@pytest.mark.asyncio
async def test_cron_rejects_wrong_secret(client: AsyncClient, mock_db):
    res = await client.post(
        "/api/v1/system/cron/cleanup-sessions",
        headers={"X-Cron-Secret": "definitely-wrong-secret"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_cron_accepts_valid_secret_cleanup(client: AsyncClient, mock_db):
    mock_db.table("intake_sessions").data = []
    res = await client.post(
        "/api/v1/system/cron/cleanup-sessions",
        headers={"X-Cron-Secret": settings.CRON_SECRET},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert "sessions_deleted" in body


@pytest.mark.asyncio
async def test_cron_hearing_reminders_empty(client: AsyncClient, mock_db):
    mock_db.table("hearings").data = []
    res = await client.post(
        "/api/v1/system/cron/hearing-reminders",
        headers={"X-Cron-Secret": settings.CRON_SECRET},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["reminders_sent"] == 0


@pytest.mark.asyncio
async def test_features_endpoint_public(client: AsyncClient):
    # Features is intentionally unauthenticated
    app.dependency_overrides.pop(get_current_user, None)
    try:
        res = await client.get("/api/v1/system/features")
        assert res.status_code == 200
        body = res.json()
        assert "consultations" in body
        assert "billing" in body
    finally:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="test-user-id", role=UserRole.USER, full_name="Test"
        )
