import pytest
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app

@pytest.mark.asyncio
async def test_lawyer_registration_defaults_to_user(client: AsyncClient, mock_db, monkeypatch):
    # Mock JWT decoding for profile registration
    monkeypatch.setattr("app.domains.identity.router._decode_signup_jwt", lambda token: {"sub": "test-lawyer-id", "email": "lawyer@example.com"})

    # Submit profile creation request with role='lawyer'
    payload = {
        "role": "lawyer",
        "full_name": "Advocate Jane Doe",
        "phone": "9999999999",
        "city": "Delhi",
        "state": "Delhi"
    }
    
    headers = {"Authorization": "Bearer fake-signup-token"}
    res = await client.post("/api/v1/identity/profile", json=payload, headers=headers)
    
    assert res.status_code == 201
    data = res.json()
    
    # Assert database profile was created with role='user'
    assert data["role"] == "user"
    assert data["full_name"] == "Advocate Jane Doe"

    # Assert lawyer_profiles record was created for lawyer registration
    lp_table = mock_db.table("lawyer_profiles")
    assert len(lp_table.data) == 1
    assert lp_table.data[0]["id"] == "test-lawyer-id"

    # Assert profiles table insert got role='user'
    p_table = mock_db.table("profiles")
    assert len(p_table.data) == 1
    assert p_table.data[0]["role"] == "user"


@pytest.mark.asyncio
async def test_admin_verify_lawyer_promotes_role(client: AsyncClient, mock_db):
    # Override current user to be an Admin
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-admin-id",
        role=UserRole.ADMIN,
        full_name="System Admin"
    )

    try:
        # Trigger admin verify endpoint
        res = await client.patch("/api/v1/admin/lawyers/test-lawyer-id/verify")
        assert res.status_code == 200
        assert res.json() == {"ok": True}

        # Check profiles update query was issued to change role to 'lawyer'
        p_table = mock_db.table("profiles")
        updates = [q for q in p_table.queries if q[0] == "update"]
        assert len(updates) == 1
        assert updates[0][1] == {"role": "lawyer"}

        # Check lawyer_profiles update query set is_verified to True
        lp_table = mock_db.table("lawyer_profiles")
        lp_updates = [q for q in lp_table.queries if q[0] == "update"]
        assert len(lp_updates) == 1
        assert lp_updates[0][1] == {"is_verified": True}
        
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()
