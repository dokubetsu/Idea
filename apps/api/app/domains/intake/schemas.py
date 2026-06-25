from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator

class FactType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    ARRAY = "array"

class ExtractedFact(BaseModel):
    key: str
    value: Any
    type: FactType = Field(default=FactType.TEXT, alias="value_type")
    label: str
    confidence: float | None = 0.9
    source: str | None = "ai"

    model_config = {
        "populate_by_name": True
    }

    @field_validator("type", mode="before")
    @classmethod
    def normalize_fact_type(cls, v):
        if v == "string":
            return "text"
        if v == "json":
            return "array"
        return v

    @field_validator("value", mode="before")
    @classmethod
    def handle_null(cls, v):
        if v is None:
            return ""
        return v

class FactsExtractionResult(BaseModel):
    facts: list[ExtractedFact] = Field(default_factory=list)
    detected_category: str
    completeness_score: float
    missing_keys: list[str] = Field(default_factory=list)
    provider: str

class StartIntakeRequest(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=30)

class UpdateFactsRequest(BaseModel):
    facts: list[ExtractedFact] = Field(default_factory=list)

class CommitIntakeRequest(BaseModel):
    session_id: str | None = None
    confirmed_facts: list[dict] = Field(default_factory=list)

class ExtractedFactsPayload(BaseModel):
    title: str | None = None
    detected_category: str | None = None
    completeness_score: float | None = None
    missing_keys: list[str] = Field(default_factory=list)
    facts: list[ExtractedFact] = Field(default_factory=list)

class IntakeSessionOut(BaseModel):
    id: str
    step: str
    raw_description: str | None
    extracted_facts: ExtractedFactsPayload
    assessment_result: dict | None
    completeness_score: float | None = None
    missing_keys: list[str] = Field(default_factory=list)
    provider_used: str | None
    is_committed: bool
    matter_id: str | None
    created_at: str
