import pytest
import uuid
from httpx import AsyncClient
from app.shared.database import get_db


@pytest.mark.integration
@pytest.mark.asyncio
async def test_payment_capture_idempotency_integration(
    client: AsyncClient, mock_user, monkeypatch
):
    # Enable FEATURE_BILLING and FEATURE_MILESTONES for test
    from app.config import settings

    monkeypatch.setattr(settings, "FEATURE_BILLING", True)
    monkeypatch.setattr(settings, "FEATURE_MILESTONES", True)

    db = get_db()

    # 1. Upsert mock user
    user_data = {
        "id": mock_user.id,
        "full_name": mock_user.full_name,
        "role": "user",
        "is_active": True,
    }
    db.table("profiles").upsert(user_data).execute()

    # 2. Insert mock matter
    matter_id = str(uuid.uuid4())
    matter_data = {
        "id": matter_id,
        "user_id": mock_user.id,
        "title": "Idempotency Test Case",
        "summary": "This is a test case",
        "category": "other",
        "status": "active",
        "priority": "medium",
    }
    db.table("matters").insert(matter_data).execute()

    # 3. Insert mock milestone
    milestone_id = str(uuid.uuid4())
    milestone_data = {
        "id": milestone_id,
        "matter_id": matter_id,
        "title": "Retainer Fee",
        "order_index": 1,
        "status": "current",
        "amount_inr": 25000.00,
        "is_paid": False,
    }
    db.table("matter_milestones").insert(milestone_data).execute()

    idemp_key = f"pay_key_{milestone_id}_12345"

    try:
        # 4. Pay the milestone (first time)
        payload = {
            "is_paid": True,
            "payment_gateway_ref": "pay_tx_123",
            "payment_idempotency_key": idemp_key,
        }
        res1 = await client.patch(
            f"/api/v1/matters/{matter_id}/milestones/{milestone_id}", json=payload
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["is_paid"] is True
        assert data1["payment_gateway_ref"] == "pay_tx_123"
        assert data1["payment_idempotency_key"] == idemp_key

        # 5. Pay the milestone (second time, retrying with same key but different payment_gateway_ref)
        payload2 = {
            "is_paid": True,
            "payment_gateway_ref": "pay_tx_456",
            "payment_idempotency_key": idemp_key,
        }
        res2 = await client.patch(
            f"/api/v1/matters/{matter_id}/milestones/{milestone_id}", json=payload2
        )
        assert res2.status_code == 200
        data2 = res2.json()
        # It must return the original milestone details, NOT the updated pay_tx_456!
        assert data2["is_paid"] is True
        assert data2["payment_gateway_ref"] == "pay_tx_123"
        assert data2["payment_idempotency_key"] == idemp_key

        # 6. Try to use the same idempotency key for another milestone (should be rejected)
        milestone_id2 = str(uuid.uuid4())
        milestone_data2 = {
            "id": milestone_id2,
            "matter_id": matter_id,
            "title": "Filing Fee",
            "order_index": 2,
            "status": "pending",
            "amount_inr": 5000.00,
            "is_paid": False,
        }
        db.table("matter_milestones").insert(milestone_data2).execute()

        try:
            payload3 = {
                "is_paid": True,
                "payment_gateway_ref": "pay_tx_789",
                "payment_idempotency_key": idemp_key,
            }
            res3 = await client.patch(
                f"/api/v1/matters/{matter_id}/milestones/{milestone_id2}", json=payload3
            )
            # Should fail because idempotency key is already used for milestone 1
            assert res3.status_code == 400
        finally:
            db.table("matter_milestones").delete().eq("id", milestone_id2).execute()

    finally:
        # Cleanup
        try:
            db.table("matter_milestones").delete().eq("id", milestone_id).execute()
            db.table("matters").delete().eq("id", matter_id).execute()
            db.table("profiles").delete().eq("id", mock_user.id).execute()
        except Exception:
            pass
