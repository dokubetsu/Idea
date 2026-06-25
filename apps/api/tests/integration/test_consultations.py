import pytest
import uuid
from httpx import AsyncClient
from app.shared.database import get_db

@pytest.mark.integration
@pytest.mark.asyncio
async def test_consultations_idempotency_integration(client: AsyncClient, mock_user):
    db = get_db()
    
    # 1. Setup mock user and lawyer profiles in DB
    lawyer_id = str(uuid.uuid4())
    
    user_profile = {
        "id": mock_user.id,
        "full_name": mock_user.full_name,
        "role": "user",
        "is_active": True
    }
    lawyer_profile = {
        "id": lawyer_id,
        "full_name": "Verified Advocate",
        "role": "lawyer",
        "is_active": True
    }
    lawyer_detail = {
        "id": lawyer_id,
        "is_verified": True,
        "is_available": True,
        "specializations": ["labour", "rera"]
    }
    
    db.table("profiles").upsert(user_profile).execute()
    db.table("profiles").upsert(lawyer_profile).execute()
    db.table("lawyer_profiles").upsert(lawyer_detail).execute()
    
    # Generate a unique idempotency key
    idem_key = f"test-idem-{uuid.uuid4()}"
    
    payload = {
        "lawyer_id": lawyer_id,
        "package": "starter",
        "notes": "Need employment agreement advice",
        "idempotency_key": idem_key
    }
    
    consultation_id = None
    try:
        # 2. First submission
        res1 = await client.post("/api/v1/consultations", json=payload)
        assert res1.status_code == 201
        data1 = res1.json()
        consultation_id = data1["id"]
        assert data1["idempotency_key"] == idem_key
        
        # 3. Second submission (with same idempotency key)
        res2 = await client.post("/api/v1/consultations", json=payload)
        assert res2.status_code == 201
        data2 = res2.json()
        assert data2["id"] == consultation_id
        
        # 4. Verify in database that only ONE consultation was created
        db_res = db.table("consultations").select("id").eq("idempotency_key", idem_key).execute()
        assert len(db_res.data) == 1
        
    finally:
        # Cleanup
        if consultation_id:
            try:
                db.table("consultations").delete().eq("id", consultation_id).execute()
            except Exception:
                pass
        try:
            db.table("lawyer_profiles").delete().eq("id", lawyer_id).execute()
            db.table("profiles").delete().eq("id", lawyer_id).execute()
            db.table("profiles").delete().eq("id", mock_user.id).execute()
        except Exception:
            pass
