import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_commit_intake_success(client: AsyncClient, mock_db, monkeypatch):
    # Mock _get_session to return a mock intake session
    monkeypatch.setattr(
        "app.domains.intake.router._get_session",
        lambda db, sid, uid: {
            "id": sid,
            "user_id": uid,
            "step": "confirm",
            "is_committed": False,
            "extracted_facts": {
                "title": "Property Dispute",
                "detected_category": "property",
                "facts": [{"key": "property_value", "value": "1000000"}]
            },
            "assessment_result": {
                "category": "property",
                "risk_level": "low",
                "success_rationale": "Clear title documentation"
            }
        }
    )
    
    # Mock event emit
    async def mock_emit(*args, **kwargs):
        pass
    monkeypatch.setattr("app.domains.intake.router.emit", mock_emit)
    
    response = await client.post("/api/v1/intake/mock-session-id/commit")
    assert response.status_code == 201
    data = response.json()
    assert data["matter_id"] == "mock-matter-id"
    assert data["status"] == "assessment"
    assert data["category"] == "property"
