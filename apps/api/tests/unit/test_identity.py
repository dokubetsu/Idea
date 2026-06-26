import pytest
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app


@pytest.mark.asyncio
async def test_lawyer_registration_defaults_to_user(
    client: AsyncClient, mock_db, monkeypatch
):
    # Mock JWT decoding for profile registration
    monkeypatch.setattr(
        "app.domains.identity.router._decode_signup_jwt",
        lambda token: {"sub": "test-lawyer-id", "email": "lawyer@example.com"},
    )

    # Submit profile creation request
    payload = {
        "full_name": "Advocate Jane Doe",
        "phone": "9999999999",
        "city": "Delhi",
        "state": "Delhi",
    }

    headers = {"Authorization": "Bearer fake-signup-token"}
    res = await client.post("/api/v1/identity/profile", json=payload, headers=headers)

    assert res.status_code == 201
    data = res.json()

    # Assert database profile was created with role='user'
    assert data["role"] == "user"
    assert data["full_name"] == "Advocate Jane Doe"

    # Assert lawyer_profiles record was NOT created for standard registration
    lp_table = mock_db.table("lawyer_profiles")
    assert len(lp_table.data) == 0

    # Assert profiles table insert got role='user'
    p_table = mock_db.table("profiles")
    assert len(p_table.data) == 1
    assert p_table.data[0]["role"] == "user"


@pytest.mark.asyncio
async def test_admin_verify_lawyer_promotes_role(client: AsyncClient, mock_db):
    # Override current user to be an Admin
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-admin-id", role=UserRole.ADMIN, full_name="System Admin"
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


@pytest.mark.asyncio
async def test_register_profile_preserves_existing_role(
    client: AsyncClient, mock_db, monkeypatch
):
    # Seed an existing lawyer profile in the mock database
    lawyer_id = "existing-lawyer-uuid"
    mock_db.table("profiles").data.append(
        {
            "id": lawyer_id,
            "role": "lawyer",
            "full_name": "Advocate Jane Doe",
            "phone": "9999999999",
            "city": "Delhi",
            "state": "Delhi",
        }
    )

    # Mock JWT decoding for profile registration
    monkeypatch.setattr(
        "app.domains.identity.router._decode_signup_jwt",
        lambda token: {"sub": lawyer_id, "email": "lawyer@example.com"},
    )

    # Track calls to update_user_by_id
    updated_role = None

    def mock_update_user_by_id(uid, attributes):
        nonlocal updated_role
        if uid == lawyer_id:
            updated_role = attributes.get("app_metadata", {}).get("role")
        return {"id": uid, "attributes": attributes}

    monkeypatch.setattr(mock_db.auth.admin, "update_user_by_id", mock_update_user_by_id)

    payload = {
        "role": "lawyer",
        "full_name": "Advocate Jane Doe",
        "phone": "9999999999",
        "city": "Delhi",
        "state": "Delhi",
    }

    headers = {"Authorization": "Bearer fake-signup-token"}
    res = await client.post("/api/v1/identity/profile", json=payload, headers=headers)

    assert res.status_code == 201
    # Check that database profile role is still lawyer
    p_table = mock_db.table("profiles")
    p_row = next(r for r in p_table.data if r["id"] == lawyer_id)
    assert p_row["role"] == "lawyer"

    # Check that auth metadata was updated to lawyer, not user!
    assert updated_role == "lawyer"
