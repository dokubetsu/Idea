"""
Abstract provider interface.
Every AI provider must implement this contract.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from pydantic import BaseModel


class AssessmentInput(BaseModel):
    title: str
    facts: dict[str, str]  # key → value from facts engine
    raw_description: str | None  # fallback context


class AssessmentOutput(BaseModel):
    category: str
    risk_level: str  # low | medium | high | urgent
    success_probability: int  # 0–100
    success_rationale: str
    timeline_min_months: int
    timeline_max_months: int
    budget_min_inr: int
    budget_max_inr: int
    key_statutes: list[str]
    immediate_actions: list[str]
    evidence_needed: list[str]
    recommended_forum: str
    limitation_risk: str | None
    complexity: str  # simple | moderate | complex
    notes: str
    provider: str | None = None  # which provider produced this
    model: str | None = None
    prompt_version: str | None = None
    temperature: float | None = None
    created_at: str | None = None


class BaseAssessmentProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def assess(self, input: AssessmentInput) -> AssessmentOutput: ...
