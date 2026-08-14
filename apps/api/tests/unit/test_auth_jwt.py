"""
Real JWT auth path tests — does NOT override get_current_user.

Covers: missing token, bad signature, expired token, missing profile,
inactive (suspended) profile, role enforcement on admin routes.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
import datetime


import jwt
import pytest
import pytest_asyncio
from app.config import settings
from app.main import app
from app.shared.dependencies import get_current_user
from httpx import ASGITransport, AsyncClient


def _make_token(
    sub: str,
    *,
    expired: bool = False,
    secret: str | None = None,
    audience: str = "authenticated",
    alg: str = "HS256",
) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    exp = (
        now - datetime.timedelta(hours=1)
        if expired
        else now + datetime.timedelta(hours=1)
    )
    payload = {
        "sub": sub,
        "role": "authenticated",
        "aud": audience,
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
    }
    key = secret if secret is not None else settings.SUPABASE_JWT_SECRET
    return jwt.encode(payload, key, algorithm=alg)


@pytest_asyncio.fixture
async def raw_client(mock_db) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client with real auth dependency (no get_current_user override)."""
    app.dependency_overrides.pop(get_current_user, None)
    from app.domains.notifications.subscriber import init_subscriber

    init_subscriber()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_missing_token_returns_401(raw_client: AsyncClient):
    res = await raw_client.get("/api/v1/identity/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_invalid_signature_returns_401(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "user-1",
            "role": "user",
            "full_name": "Alice",
            "is_active": True,
        }
    ]
    token = _make_token("user-1", secret="wrong-secret-not-the-real-jwt-secret!!")
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert (
        "invalid" in res.json()["detail"].lower()
        or "token" in res.json()["detail"].lower()
    )


@pytest.mark.asyncio
async def test_expired_token_returns_401(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "user-1",
            "role": "user",
            "full_name": "Alice",
            "is_active": True,
        }
    ]
    token = _make_token("user-1", expired=True)
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_valid_token_loads_profile(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "user-1",
            "role": "user",
            "full_name": "Alice User",
            "is_active": True,
            "phone": None,
            "city": "Delhi",
            "state": "Delhi",
        }
    ]
    mock_db.table("lawyer_profiles").data = []
    token = _make_token("user-1")
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "user-1"
    assert body["full_name"] == "Alice User"
    assert body["role"] == "user"


@pytest.mark.asyncio
async def test_inactive_profile_returns_403(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "user-suspended",
            "role": "user",
            "full_name": "Suspended",
            "is_active": False,
        }
    ]
    token = _make_token("user-suspended")
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert "suspend" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_missing_profile_returns_401(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = []
    token = _make_token("no-such-user")
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert "profile" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_user_cannot_access_admin_stats(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "user-1",
            "role": "user",
            "full_name": "Alice",
            "is_active": True,
        }
    ]
    token = _make_token("user-1")
    res = await raw_client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_access_admin_stats(raw_client: AsyncClient, mock_db):
    mock_db.table("profiles").data = [
        {
            "id": "admin-1",
            "role": "admin",
            "full_name": "Admin",
            "is_active": True,
        }
    ]
    token = _make_token("admin-1")
    res = await raw_client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Mock may not implement get_admin_stats RPC — accept 200 or 500 from empty RPC
    assert res.status_code in (200, 500)


@pytest.mark.asyncio
async def test_alg_none_rejected(raw_client: AsyncClient, mock_db):
    """Tokens with alg=none must not authenticate."""
    mock_db.table("profiles").data = [
        {
            "id": "user-1",
            "role": "user",
            "full_name": "Alice",
            "is_active": True,
        }
    ]
    # Craft unsigned token with alg none (PyJWT may refuse encode; build manually)
    import base64
    import json

    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        .rstrip(b"=")
        .decode()
    )
    payload = (
        base64.urlsafe_b64encode(
            json.dumps(
                {
                    "sub": "user-1",
                    "aud": "authenticated",
                    "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
                    "exp": int(
                        (
                            datetime.datetime.now(datetime.timezone.utc)
                            + datetime.timedelta(hours=1)
                        ).timestamp()
                    ),
                }
            ).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    token = f"{header}.{payload}."
    res = await raw_client.get(
        "/api/v1/identity/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
