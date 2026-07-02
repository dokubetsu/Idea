from typing import Any
from datetime import datetime
from pydantic import BaseModel


# Requests
class StartSessionRequest(BaseModel):
    scenario_key: str


class DecisionRequest(BaseModel):
    choice_id: str
    input_value: str | int | float | None = None
    time_taken_ms: int | None = None


# Responses
class ScenarioSummary(BaseModel):
    id: str
    scenario_key: str
    title: str
    domain: str
    difficulty: str
    based_on: str | None = None
    estimated_minutes: int
    tags: list[str]
    version: int
    is_active: bool = True

    class Config:
        from_attributes = True


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioSummary]
    total: int


class SessionNodeChoice(BaseModel):
    id: str
    text: str


class SessionNodeState(BaseModel):
    node_id: str
    text: str
    player_input: bool = False
    input_type: str | None = None
    choices: list[SessionNodeChoice]


class SessionOut(BaseModel):
    id: str
    scenario_key: str
    scenario_title: str
    domain: str
    status: str
    score: int
    max_score: int
    decisions_count: int
    correct_count: int
    started_at: datetime
    completed_at: datetime | None = None
    generated_facts: dict[str, Any]
    estimated_decisions: int
    current_node: SessionNodeState | None = None

    class Config:
        from_attributes = True


class DecisionResponse(BaseModel):
    choice_id: str
    is_correct: bool
    score_awarded: int
    feedback: str
    citation: str | None = None
    issue_tag: str | None = None
    next_node: SessionNodeState | None = None


class DebriefDecision(BaseModel):
    node_id: str
    choice_id: str
    choice_text: str
    is_correct: bool
    score_awarded: int
    feedback: str
    citation: str | None = None
    issue_tag: str | None = None
    input_value: Any | None = None
    time_taken_ms: int | None = None


class DebriefResponse(BaseModel):
    session_id: str
    scenario_title: str
    domain: str
    score: int
    max_score: int
    decisions_count: int
    correct_count: int
    started_at: datetime
    completed_at: datetime | None = None
    decisions: list[DebriefDecision]


class BlindSpotDetail(BaseModel):
    issue_tag: str
    domain: str
    attempts: int
    correct: int
    accuracy: float
    streak: int
    last_attempted: datetime


class PracticeProfileResponse(BaseModel):
    blind_spots: list[BlindSpotDetail]
    strengths: list[BlindSpotDetail]


class SessionHistoryItem(BaseModel):
    id: str
    scenario_title: str
    domain: str
    difficulty: str
    score: int
    max_score: int
    status: str
    completed_at: datetime | None = None
