"""Assessment domain — expose provider info and standalone re-runs."""

from fastapi import APIRouter, Response
from app.shared.dependencies import Auth
from app.domains.assessment.service import get_provider, run_assessment
from app.domains.assessment.providers.base import AssessmentInput
from pydantic import BaseModel

router = APIRouter(prefix="/assessment", tags=["assessment"])


@router.get("/provider")
async def provider_info(_: Auth):
    p = get_provider()
    return {"provider": p.name, "status": "ready"}


class StandaloneAssessRequest(BaseModel):
    title: str
    facts: dict[str, str]
    raw_description: str | None = None


@router.post("/run")
async def run(body: StandaloneAssessRequest, user: Auth, response: Response):
    result = await run_assessment(AssessmentInput(**body.model_dump()))
    response.headers["X-AI-Provider"] = result.provider or "unknown"
    return result
