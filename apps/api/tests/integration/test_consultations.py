import uuid

import pytest
from httpx import AsyncClient

from app.shared.database import get_db


@pytest.mark.integration
@pytest.mark.asyncio
async def test_consultations_idempotency_integration(client: AsyncClient, mock_user):
    db = get_db()

    # 1. Use seeded verified lawyer in DB
    lawyer_id = "00000000-0000-0000-0000-000000000002"

    # Generate a unique idempotency key
    idem_key = f"test-idem-{uuid.uuid4()}"

    payload = {
        "lawyer_id": lawyer_id,
        "package": "starter",
        "notes": "Need employment agreement advice",
        "idempotency_key": idem_key,
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
        db_res = (
            db.table("consultations")
            .select("id")
            .eq("idempotency_key", idem_key)
            .execute()
        )
        assert len(db_res.data) == 1

    finally:
        # Cleanup created consultation record
        import contextlib

        if consultation_id:
            with contextlib.suppress(Exception):
                db.table("consultations").delete().eq("id", consultation_id).execute()
