"""
Unit tests for AI Pipeline components.
"""
import pytest
from pydantic import BaseModel
from app.shared.ai.base import BaseAiProvider
from app.shared.ai.context import ContextBuilder
from app.shared.ai.prompt import PromptBuilder
from app.shared.ai.validator import ResponseValidator, Normalizer
from app.shared.ai.registry import ai_registry, get_ai_provider


class DummyModel(BaseModel):
    name: str
    amount: int


def test_context_builder():
    # 1. Intake context
    intake = ContextBuilder.build_intake_context("Salary dispute", "Employer terminated without notice")
    assert intake["title"] == "Salary dispute"
    assert intake["raw_description"] == "Employer terminated without notice"

    # 2. Assessment context
    facts_dict = {"cheque_amount": "50000", "notice_sent": "true"}
    assess = ContextBuilder.build_assessment_context("Cheque bounce", facts_dict, "My cheque was returned")
    assert assess["title"] == "Cheque bounce"
    assert assess["facts"] == facts_dict
    assert assess["raw_description"] == "My cheque was returned"

    # 3. Matter context
    matter = {"id": "m123", "title": "Real estate claim", "category": "rera", "status": "active", "summary": "Delayed project"}
    facts = [{"key": "project_name", "value": "Aura Heights"}, {"key": "total_paid", "value": "1200000"}]
    docs = [{"name": "Agreement.pdf", "file_type": "pdf", "summary": "Sale agreement signed"}]
    hist = [{"author_name": "Advocate Sharma", "content": "Notice served", "created_at": "2026-06-01T10:00:00"}]

    full_context = ContextBuilder.build_matter_context(matter, facts, docs, hist)
    assert full_context["matter_id"] == "m123"
    assert full_context["facts"] == {"project_name": "Aura Heights", "total_paid": "1200000"}
    assert len(full_context["documents"]) == 1
    assert full_context["documents"][0]["name"] == "Agreement.pdf"
    assert len(full_context["history"]) == 1
    assert full_context["history"][0]["author"] == "Advocate Sharma"


def test_prompt_builder():
    context = {"title": "Test case", "raw_description": "Hello world", "facts": {"amount": "100"}}
    
    # Extraction v1
    sys_prompt, user_prompt = PromptBuilder.build("extraction", context, version="v1")
    assert "detected_category" in sys_prompt
    assert "<title>\nTest case\n</title>" in user_prompt

    # Assessment v1
    sys_prompt_ass, user_prompt_ass = PromptBuilder.build("assessment", context, version="v1")
    assert "risk_level" in sys_prompt_ass
    assert "amount: 100" in user_prompt_ass

    # Unknown
    with pytest.raises(ValueError):
        PromptBuilder.build("extraction", context, version="v99")


def test_response_validator():
    raw_json = '```json\n{"name": "Legal Draft", "amount": 25000}\n```'
    validated = ResponseValidator.validate(raw_json, DummyModel)
    assert validated.name == "Legal Draft"
    assert validated.amount == 25000

    bad_json = '{"name": "incomplete"'
    with pytest.raises(ValueError):
        ResponseValidator.validate(bad_json, DummyModel)


def test_normalizer():
    class TestAssessment(BaseModel):
        timeline_min_months: int
        timeline_max_months: int
        success_probability: int

    validated = TestAssessment(timeline_min_months=-5, timeline_max_months=-12, success_probability=120)
    normalized = Normalizer.normalize_assessment(
        validated,
        provider_name="test_provider",
        model_name="test_model",
        prompt_version="test_v1",
        temperature=0.1
    )
    
    # Constraints check
    assert normalized["timeline_min_months"] == 0
    assert normalized["timeline_max_months"] == 0
    assert normalized["success_probability"] == 100
    
    # Metadata check
    assert normalized["provider"] == "test_provider"
    assert normalized["model"] == "test_model"
    assert normalized["prompt_version"] == "test_v1"
    assert normalized["temperature"] == 0.1
    assert "created_at" in normalized


@pytest.mark.asyncio
async def test_provider_registry_and_fallbacks():
    # Resolve mock provider
    provider = await ai_registry.resolve("mock")
    assert provider.name == "mock"
    assert await provider.health() is True

    # Resolve an unhealthy provider (which doesn't have credentials configured in tests)
    # It should raise RuntimeError since mock is opt-in only, not in the fallback chain
    with pytest.raises(RuntimeError) as exc_info:
        await ai_registry.resolve("gemini")
    assert "All configured AI providers are unhealthy or unavailable" in str(exc_info.value)
