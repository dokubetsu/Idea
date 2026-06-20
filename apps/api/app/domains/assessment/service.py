"""
Assessment Service.
Provider-agnostic legal assessment orchestration routing through the AI Pipeline.
"""
from __future__ import annotations
import logging
from app.config import settings
from app.domains.assessment.providers.base import AssessmentInput, AssessmentOutput
from app.shared.ai.mock import MockProvider

log = logging.getLogger(__name__)


class LegacyProviderWrapper:
    def __init__(self, name: str):
        self.name = name


def get_provider():
    """Synchronous wrapper for startup checks."""
    chosen = settings.ai_provider
    return LegacyProviderWrapper(chosen)


async def run_assessment(input: AssessmentInput) -> AssessmentOutput:
    """
    Primary entry point for running a legal assessment.
    Coordinates context construction, versioned prompts, provider execution,
    validation, and normalization.
    """
    from app.shared.ai import ContextBuilder, PromptBuilder, ResponseValidator, Normalizer, get_ai_provider
    
    # 1. Build Context
    context = ContextBuilder.build_assessment_context(
        title=input.title,
        facts=input.facts,
        raw_description=input.raw_description
    )
    
    # 2. Build versioned prompt
    system_prompt, user_prompt = PromptBuilder.build("assessment", context, version="v1")
    
    provider_name = "mock"
    try:
        # 3. Resolve active provider (handles fallback if unhealthy)
        provider = await get_ai_provider()
        provider_name = provider.name
        
        # 4. Generate raw response
        raw = await provider.generate(system_prompt, user_prompt, temperature=0.1)
        
        # 5. Validate against Pydantic schema
        validated = ResponseValidator.validate(raw, AssessmentOutput)
        
        # 6. Normalize and flat-map metadata
        model_name = settings.AI_MODEL_NAME or provider.name
        normalized = Normalizer.normalize_assessment(
            validated,
            provider_name=provider.name,
            model_name=model_name,
            prompt_version="assessment_v1",
            temperature=0.1
        )
        
        return AssessmentOutput(**normalized)
        
    except Exception as exc:
        log.error("AI legal assessment failed using '%s': %s — falling back to mock", provider_name, exc)
        # Safe deterministic local fallback
        mock = MockProvider()
        raw_mock = await mock.generate(system_prompt, user_prompt)
        validated_mock = ResponseValidator.validate(raw_mock, AssessmentOutput)
        normalized_mock = Normalizer.normalize_assessment(
            validated_mock,
            provider_name="mock",
            model_name="mock",
            prompt_version="assessment_v1",
            temperature=0.1
        )
        return AssessmentOutput(**normalized_mock)
