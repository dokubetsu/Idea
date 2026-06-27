"""
Facts Engine — the most important domain component.

Converts raw natural language → structured, typed, durable facts.

Facts are:
- Provider-independent (structured JSON, not narrative)
- Re-runnable (change description, re-extract)
- Verifiable (lawyer can confirm or correct each fact)
- Durable (outlive any AI model upgrade)

Every assessment, document draft, and CRM view is built from facts, not raw text.
"""

from __future__ import annotations
import re as _re
import logging
from pydantic import BaseModel

from app.domains.intake.schemas import ExtractedFact, FactsExtractionResult

log = logging.getLogger(__name__)


# ── Fact schemas by category ─────────────────────────────────────
# Defines what facts we want per category.
# Used for completeness scoring and follow-up questions.

FACT_SCHEMAS: dict[str, dict[str, str]] = {
    "cheque_bounce": {
        # ── Core keys (present in every category) ───────────────────
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Name of the cheque drawer",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        # ── Category-specific keys ───────────────────────────────────
        "cheque_amount": "Amount on the cheque (₹)",
        "cheque_date": "Date on the cheque",
        "dishonour_date": "Date cheque was returned",
        "dishonour_reason": "Reason for dishonour (e.g. insufficient funds)",
        "legal_notice_sent": "Has legal notice been sent?",
        "notice_date": "Date legal notice was sent (if sent)",
        "underlying_debt_type": "Nature of underlying debt (loan, service, goods)",
    },
    "consumer": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Company / seller name",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "product_service": "Product or service in dispute",
        "purchase_amount": "Amount paid (₹)",
        "purchase_date": "Date of purchase",
        "company_name": "Company / seller name",
        "defect_type": "Nature of defect or deficiency",
        "complaint_sent": "Has written complaint been sent to company?",
        "company_response": "Company's response (if any)",
    },
    "rera": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Builder / developer name",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "project_name": "Name of the housing project",
        "builder_name": "Builder / developer name",
        "flat_number": "Flat or unit number",
        "total_paid_amount": "Total amount paid (₹)",
        "promised_possession_date": "Possession date promised in agreement",
        "actual_possession": "Actual possession given (if any)",
        "rera_registered": "Is project RERA registered?",
    },
    "property": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Other party name",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "property_type": "Type of property (land, flat, commercial)",
        "dispute_type": "Nature of dispute (ownership, encroachment, title)",
        "property_location": "Location of the property",
        "documents_available": "Documents available (title deed, agreement)",
    },
    "labour": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Employer name",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "issue_type": "Type of labour issue (termination, salary, PF)",
        "employer_name": "Employer name",
        "employment_duration": "How long were you employed there?",
        "amount_in_dispute": "Amount in dispute (₹) if applicable",
        "termination_date": "Date of termination (if terminated)",
    },
    "family": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Name of the other party",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "marriage_date": "Date of marriage",
        "children_involved": "Are children involved? (yes/no + how many)",
        "relief_sought": "What outcome are you looking for?",
    },
    "criminal": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Name of the other party / accused",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "offence_type": "Nature of the offence",
        "fir_filed": "Has an FIR been filed?",
        "police_station": "Police station name (if FIR filed)",
    },
    "cyber": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Person / entity involved (if known)",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "cyber_incident_type": "Type of cyber incident",
        "amount_lost": "Amount lost (₹) if any",
        "platform_name": "Platform or website involved",
    },
    "motor_vehicles": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Other party name",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "accident_date": "Date of accident",
        "accident_location": "Location of accident",
        "claimant_age": "Age of the claimant/deceased",
        "employment_type": "Employment type",
        "disability_percentage": "Disability percentage (if any)",
        "offending_vehicle_registration": "Offending vehicle registration number",
        "offending_vehicle_insurer": "Insurer of offending vehicle",
        "six_month_limitation_check": "Is it within 6 months of accident?",
    },
    "other": {
        "incident_date": "When did this happen?",
        "incident_location": "Where did this happen? (city / state)",
        "opponent_name": "Other party involved",
        "urgency_level": "How urgent is this?",
        "preferred_language": "Preferred language for communication",
        "prior_legal_action": "Has any FIR or case been filed?",
        "dispute_type": "Nature of the dispute",
        "amount_involved": "Amount involved (₹) if any",
        "key_dates": "Important dates",
    },
}


# ── Keyword-based extraction (offline fallback) ───────────────────


def _detect_category(text: str) -> str:
    text = text.lower()
    kw = {
        "cheque_bounce": [
            "cheque",
            "bounce",
            "dishonour",
            "dishonored",
            "138",
            "ni act",
        ],
        "consumer": [
            "consumer",
            "defective",
            "product",
            "service deficiency",
            "refund",
        ],
        "rera": ["rera", "builder", "flat", "possession", "developer", "apartment"],
        "property": ["property", "land", "encroachment", "title", "ownership"],
        "family": ["divorce", "custody", "maintenance", "alimony", "matrimonial"],
        "labour": ["termination", "salary", "employer", "pf", "gratuity", "labour"],
        "criminal": ["fir", "police", "criminal", "arrest", "assault", "theft"],
        "cyber": ["cyber", "hack", "fraud", "online", "phishing", "scam"],
        "motor_vehicles": [
            "accident",
            "collision",
            "mact",
            "motor vehicle",
            "hit and run",
            "licence",
            "driving licence",
            "rto",
            "vehicle",
        ],
    }
    for cat, words in kw.items():
        if any(w in text for w in words):
            return cat
    return "other"


def _extract_amount(text: str) -> str | None:
    m = _re.search(r"₹?\s*([\d,]+(?:\.\d+)?)\s*(?:rupees?|lakh|thousand)?", text, _re.I)
    if m:
        return m.group(1).replace(",", "")
    return None


def _extract_date(text: str) -> str | None:
    patterns = [
        r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}",
        r"\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}",
    ]
    for p in patterns:
        m = _re.search(p, text, _re.I)
        if m:
            return m.group()
    return None


def _mock_extract(title: str, description: str) -> FactsExtractionResult:
    text = (title + " " + description).lower()
    category = _detect_category(text)
    facts: list[ExtractedFact] = [
        ExtractedFact(
            key="category",
            value=category,
            label="Case category",
            source="system",
            confidence=0.85,
        ),
        ExtractedFact(
            key="issue_summary",
            value=title,
            label="Issue summary",
            source="user",
            confidence=1.0,
        ),
    ]
    amount = _extract_amount(description)
    if amount:
        facts.append(
            ExtractedFact(
                key="amount_involved",
                value=amount,
                value_type="number",
                label="Amount involved (₹)",
                confidence=0.9,
            )
        )
    date = _extract_date(description)
    if date:
        facts.append(
            ExtractedFact(
                key="key_date",
                value=date,
                value_type="date",
                label="Key date mentioned",
                confidence=0.8,
            )
        )

    schema = FACT_SCHEMAS.get(category, FACT_SCHEMAS["other"])
    schema_keys = set(schema)
    found_keys = {f.key for f in facts if f.key in schema_keys}
    missing = [v for k, v in schema.items() if k not in found_keys]
    completeness_score = min(1.0, len(found_keys) / max(len(schema), 1))

    return FactsExtractionResult(
        facts=facts,
        detected_category=category,
        completeness_score=completeness_score,
        missing_keys=missing[:4],
        provider="mock",
    )


# ── Main extraction function ──────────────────────────────────────


class FactsExtractionSchema(BaseModel):
    detected_category: str
    facts: list[ExtractedFact]


async def extract_facts(title: str, description: str) -> FactsExtractionResult:
    """
    Primary entry point. Uses AI if available, falls back to keyword extraction.
    Assessment runs on these facts — not on the raw description.
    """
    from app.config import settings

    if settings.ai_provider != "mock":
        try:
            return await _ai_extract(title, description)
        except Exception as e:
            log.exception(
                "AI facts extraction failed, falling back to keyword extraction: %s", e
            )

    return _mock_extract(title, description)


async def _ai_extract(title: str, description: str) -> FactsExtractionResult:
    from app.shared.ai import (
        ContextBuilder,
        PromptBuilder,
        ResponseValidator,
        Normalizer,
        get_ai_provider,
    )
    from app.config import settings

    # 1. Build Context
    context = ContextBuilder.build_intake_context(title, description)

    # 2. Build Prompts (Versioned)
    system_prompt, user_prompt = PromptBuilder.build(
        "extraction", context, version="v1"
    )

    # 3. Resolve Provider via registry
    provider = await get_ai_provider()

    # 4. Generate raw text from provider
    raw = await provider.generate(system_prompt, user_prompt, temperature=0.1)

    # 5. Validate raw output against Pydantic schema
    validated = ResponseValidator.validate(raw, FactsExtractionSchema)

    # 6. Normalize and append model metadata
    model_name = settings.AI_MODEL_NAME or provider.name
    normalized = Normalizer.normalize_facts(
        validated,
        provider_name=provider.name,
        model_name=model_name,
        prompt_version="extraction_v1",
        temperature=0.1,
    )

    category = normalized.get("detected_category", "other")
    facts = [ExtractedFact(**f) for f in normalized.get("facts", [])]
    schema = FACT_SCHEMAS.get(category, FACT_SCHEMAS["other"])
    schema_keys = set(schema)
    found = {f.key for f in facts if f.key in schema_keys}
    missing = [v for k, v in schema.items() if k not in found]
    completeness_score = min(1.0, len(found) / max(len(schema), 1))

    return FactsExtractionResult(
        facts=facts,
        detected_category=category,
        completeness_score=completeness_score,
        missing_keys=missing[:4],
        provider=provider.name,
    )
