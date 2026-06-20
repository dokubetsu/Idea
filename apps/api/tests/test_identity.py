import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_profile_success(client: AsyncClient, mock_db, monkeypatch):
    # Mock JWT decode for signup JWT
    monkeypatch.setattr(
        "app.domains.identity.router._decode_signup_jwt",
        lambda token: {"sub": "test-user-id", "aud": "authenticated"}
    )
    
    # Pre-populate empty db response
    mock_db.table("profiles").data = []
    
    headers = {"Authorization": "Bearer mock-token"}
    payload = {
        "role": "user",
        "full_name": "John Petitioner",
        "phone": "9999999999",
        "city": "Mumbai",
        "state": "Maharashtra"
    }
    
    response = await client.post("/api/v1/identity/profile", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "user"
    assert data["full_name"] == "John Petitioner"

@pytest.mark.asyncio
async def test_register_profile_invalid_role(client: AsyncClient, mock_db, monkeypatch):
    # Mock JWT decode for signup JWT
    monkeypatch.setattr(
        "app.domains.identity.router._decode_signup_jwt",
        lambda token: {"sub": "test-user-id", "aud": "authenticated"}
    )
    
    headers = {"Authorization": "Bearer mock-token"}
    # Trying to register as admin (which should be rejected by Pydantic Literal check)
    payload = {
        "role": "admin",
        "full_name": "Admin Attacker",
    }
    
    response = await client.post("/api/v1/identity/profile", json=payload, headers=headers)
    assert response.status_code == 422 # Pydantic validation error
    assert "role" in response.text
