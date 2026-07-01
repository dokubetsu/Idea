from fastapi import APIRouter, Depends, HTTPException, Query
from app.config import settings
from app.shared.dependencies import Auth
from app.domains.practice.service import PracticeService
from app.domains.practice.schemas import (
    StartSessionRequest,
    DecisionRequest,
    SessionOut,
    DecisionResponse,
    DebriefResponse,
    PracticeProfileResponse,
    ScenarioListResponse,
    SessionHistoryItem,
)


def verify_practice_enabled() -> None:
    if not settings.FEATURE_PRACTICE:
        raise HTTPException(status_code=404, detail="Practice system is disabled")


router = APIRouter(
    prefix="/practice",
    tags=["Practice"],
    dependencies=[Depends(verify_practice_enabled)],
)


@router.get("/scenarios", response_model=ScenarioListResponse)
def list_scenarios(
    user: Auth,
    domain: str | None = Query(None),
    difficulty: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    return PracticeService.list_scenarios(
        domain=domain, difficulty=difficulty, page=page, per_page=per_page
    )


@router.post("/sessions", response_model=SessionOut)
def start_session(body: StartSessionRequest, user: Auth):
    return PracticeService.start_session(user.id, body.scenario_key)


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: str, user: Auth):
    return PracticeService.get_session(user.id, session_id)


@router.post("/sessions/{session_id}/decide", response_model=DecisionResponse)
def submit_decision(
    session_id: str, body: DecisionRequest, user: Auth
):
    return PracticeService.submit_decision(
        user_id=user.id,
        session_id=session_id,
        choice_id=body.choice_id,
        input_value=body.input_value,
        time_taken_ms=body.time_taken_ms,
    )


@router.get("/sessions/{session_id}/debrief", response_model=DebriefResponse)
def get_debrief(session_id: str, user: Auth):
    return PracticeService.get_debrief(user.id, session_id)


@router.get("/profile", response_model=PracticeProfileResponse)
def get_profile(user: Auth):
    return PracticeService.get_profile(user.id)


@router.get("/history", response_model=list[SessionHistoryItem])
def get_history(
    user: Auth,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    return PracticeService.get_history(user.id, page=page, per_page=per_page)
