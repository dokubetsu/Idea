from pydantic import BaseModel, Field
from app.domains.intake.facts_engine import ExtractedFact


class StartIntakeRequest(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=30)


class UpdateFactsRequest(BaseModel):
    facts: list[ExtractedFact]


class CommitIntakeRequest(BaseModel):
    session_id: str | None = None
    confirmed_facts: list[dict]  # key/value pairs user has reviewed



class IntakeSessionOut(BaseModel):
    id: str
    step: str
    raw_description: str | None
    extracted_facts: dict
    assessment_result: dict | None
    completeness_score: float | None = None
    missing_keys: list[str] = []
    provider_used: str | None
    is_committed: bool
    matter_id: str | None
    created_at: str
