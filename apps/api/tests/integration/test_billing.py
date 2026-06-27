import pytest
import uuid
import hmac
import hashlib
import json
from httpx import AsyncClient
from app.shared.database import get_db


@pytest.mark.integration
@pytest.mark.asyncio
async def test_payment_capture_idempotency_integration(client: AsyncClient, mock_user, monkeypatch):
    # Enable FEATURE_BILLING and FEATURE_MILESTONES for test
    from app.config import settings

    monkeypatch.setattr(settings, "FEATURE_BILLING", True)
    monkeypatch.setattr(settings, "FEATURE_MILESTONES", True)
    monkeypatch.setattr(settings, "PAYMENT_WEBHOOK_SECRET", "test_webhook_secret")

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
        # 4. Attempt to self-report payment as complete via client PATCH (should be ignored/filtered out)
        client_patch_payload = {
            "is_paid": True,
            "payment_gateway_ref": "pay_tx_123",
            "payment_idempotency_key": idemp_key,
        }
        res_patch = await client.patch(
            f"/api/v1/matters/{matter_id}/milestones/{milestone_id}", json=client_patch_payload
        )
        assert res_patch.status_code == 200
        # Assert is_paid remains False because user role cannot modify is_paid
        assert res_patch.json()["is_paid"] is False

        # Helper to generate Razorpay webhook payload and signature
        def make_webhook_req(pay_id, m_id, key):
            body = {
                "event": "payment.captured",
                "payload": {
                    "payment": {
                        "entity": {
                            "id": pay_id,
                            "amount": 2500000,
                            "notes": {"milestone_id": m_id, "payment_idempotency_key": key},
                        }
                    }
                },
            }
            body_bytes = json.dumps(body).encode()
            sig = hmac.new("test_webhook_secret".encode(), body_bytes, hashlib.sha256).hexdigest()
            return body, sig

        # 5. Test Webhook Signature verification failure
        body, sig = make_webhook_req("pay_tx_123", milestone_id, idemp_key)
        res_bad_sig = await client.post(
            "/api/v1/matters/webhook/payment", json=body, headers={"X-Razorpay-Signature": "invalid_signature"}
        )
        assert res_bad_sig.status_code == 401

        # 6. Pay the milestone via verified webhook (first time)
        res1 = await client.post("/api/v1/matters/webhook/payment", json=body, headers={"X-Razorpay-Signature": sig})
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "success"
        assert data1["milestone_id"] == milestone_id

        # Verify database got updated
        milestone_db = db.table("matter_milestones").select("*").eq("id", milestone_id).execute().data[0]
        assert milestone_db["is_paid"] is True
        assert milestone_db["payment_gateway_ref"] == "pay_tx_123"

        # 7. Pay the milestone (second time, retrying with same key but different payment_gateway_ref)
        body2, sig2 = make_webhook_req("pay_tx_456", milestone_id, idemp_key)
        res2 = await client.post("/api/v1/matters/webhook/payment", json=body2, headers={"X-Razorpay-Signature": sig2})
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "success"

        # It must return/keep the original payment_gateway_ref details, NOT updated to pay_tx_456!
        milestone_db2 = db.table("matter_milestones").select("*").eq("id", milestone_id).execute().data[0]
        assert milestone_db2["is_paid"] is True
        assert milestone_db2["payment_gateway_ref"] == "pay_tx_123"

        # 8. Try to use the same idempotency key for another milestone (should be rejected)
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
            body3, sig3 = make_webhook_req("pay_tx_789", milestone_id2, idemp_key)
            res3 = await client.post(
                "/api/v1/matters/webhook/payment", json=body3, headers={"X-Razorpay-Signature": sig3}
            )
            # Should fail because idempotency key is already used for milestone 1
            assert res3.status_code == 400
        finally:
            db.table("matter_milestones").delete().eq("id", milestone_id2).execute()

    finally:
        # Cleanup
        try:
            db.table("payments").delete().eq("milestone_id", milestone_id).execute()
            db.table("matter_milestones").delete().eq("id", milestone_id).execute()
            db.table("matters").delete().eq("id", matter_id).execute()
            db.table("profiles").delete().eq("id", mock_user.id).execute()
        except Exception:
            pass
