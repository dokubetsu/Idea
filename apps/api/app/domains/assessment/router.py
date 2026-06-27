"""Assessment domain — expose provider info and standalone re-runs."""

from fastapi import APIRouter, Response, Request
from app.shared.dependencies import Auth
from app.domains.assessment.service import get_provider, run_assessment
from app.domains.assessment.providers.base import AssessmentInput
from app.shared.limiter import limiter
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
@limiter.limit("5/minute")
async def run(request: Request, body: StandaloneAssessRequest, user: Auth, response: Response):
    result = await run_assessment(AssessmentInput(**body.model_dump()))
    return result
