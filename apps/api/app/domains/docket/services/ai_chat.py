from __future__ import annotations
import logging
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import Forbidden, BadRequest
from app.domains.docket.services.helpers import _get_matter_for_participant

logger = logging.getLogger(__name__)

# Soft cap on free-text prompt size (characters)
_MAX_PROMPT_LEN = 4000


async def ask_case_ai(case_id: str, prompt: str, session: CurrentUser) -> dict:
    """
    AI chat scoped to a single case.
    Uses PromptBuilder (base64 isolation + sanitization) for injection resistance.
    """
    matter = _get_matter_for_participant(case_id, session)

    if session.role not in (UserRole.LAWYER, UserRole.ADMIN):
        raise Forbidden("AI chat is available to lawyers only")

    raw_prompt = (prompt or "").strip()
    if not raw_prompt:
        raise BadRequest("Prompt is required")
    if len(raw_prompt) > _MAX_PROMPT_LEN:
        raise BadRequest(
            f"Prompt exceeds maximum length of {_MAX_PROMPT_LEN} characters"
        )

    db = get_db()

    updates_res = (
        db.table("matter_updates")
        .select("content, created_at")
        .eq("matter_id", case_id)
        .eq("is_internal", False)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    updates = updates_res.data or []

    milestones_res = (
        db.table("matter_milestones")
        .select("title, status")
        .eq("matter_id", case_id)
        .execute()
    )
    milestones = milestones_res.data or []

    hearings_res = (
        db.table("hearings")
        .select("hearing_date, purpose, courtroom, judge")
        .eq("matter_id", case_id)
        .execute()
    )
    hearings = hearings_res.data or []

    from app.shared.ai.prompt import PromptBuilder
    from app.shared.ai.registry import get_ai_provider

    context = {
        "title": matter.get("title") or "",
        "summary": matter.get("summary") or "",
        "category": matter.get("category") or "",
        "updates": updates,
        "milestones": milestones,
        "hearings": hearings,
        "prompt": raw_prompt,
    }
    system_prompt, user_prompt = PromptBuilder.build("case_chat", context, version="v1")

    ai_provider = await get_ai_provider(user_id=session.id)

    try:
        response = await ai_provider.generate(
            system_prompt, user_prompt, temperature=0.5
        )
    except Exception as e:
        from fastapi import HTTPException

        if isinstance(e, HTTPException):
            raise
        logger.error("AI generation failed in ask_case_ai: %s", e)
        response = (
            "I encountered an error while consulting the AI provider. Please try again."
        )

    return {
        "response": response,
        "sources": [],
        "case_id": case_id,
    }
