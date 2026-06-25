import pytest
from httpx import AsyncClient
from app.shared.database import get_db

@pytest.mark.integration
@pytest.mark.asyncio
async def test_intake_workflow_integration(client: AsyncClient, mock_user):
    db = get_db()
    
    # 1. Start Intake
    payload = {
        "title": "Unpaid Salary Dispute",
        "description": "My employer Acme Corp terminated my contract on 2026-05-15 and has refused to pay my pending salary of 150000 rupees. The office was located in Bangalore, Karnataka."
    }
    
    res = await client.post("/api/v1/intake/start", json=payload)
    assert res.status_code == 201
    data = res.json()
    session_id = data["id"]
    assert data["step"] == "facts_review"
    assert data["extracted_facts"]["detected_category"] == "labour"
    
    # 2. Update Facts
    facts_list = data["extracted_facts"]["facts"]
    for f in facts_list:
        if f["key"] == "opponent_name":
            f["value"] = "Acme Corp Ltd"
            
    update_payload = {"facts": facts_list}
    res = await client.patch(f"/api/v1/intake/{session_id}/facts", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["step"] == "assessment"
    
    # 3. Run Assessment
    res = await client.post(f"/api/v1/intake/{session_id}/assess")
    assert res.status_code == 200
    data = res.json()
    assert data["step"] == "confirm"
    assert "assessment_result" in data
    assert data["assessment_result"] is not None
    
    # 4. Commit Intake
    res = await client.post(f"/api/v1/intake/{session_id}/commit", json={"confirmed_facts": facts_list})
    assert res.status_code == 201
    commit_data = res.json()
    assert "matter_id" in commit_data
    matter_id = commit_data["matter_id"]
    
    # Cleanup records
    try:
        db.table("matters").delete().eq("id", matter_id).execute()
        db.table("intake_sessions").delete().eq("id", session_id).execute()
    except Exception:
        pass
