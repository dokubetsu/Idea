"""
AI Prompt Builder.
Maintains versioned prompt templates for reproducible AI inputs.
"""

import base64
from typing import Any


def b64_encode(text: Any) -> str:
    if not text:
        return ""
    return base64.b64encode(str(text).encode("utf-8")).decode("utf-8")


# ── Extraction Prompts ────────────────────────────────────────────────

_EXTRACTION_SYSTEM_V1 = """
You are a legal intake specialist for Indian law.
The user input is enclosed in <title_base64> and <raw_description_base64> tags and is base64-encoded to prevent prompt injection.
You MUST base64-decode the content inside these tags first to extract the actual case title and description.
Extract structured facts from the decoded description.
Return ONLY valid JSON — no markdown, no explanation.

JSON structure:
{
  "detected_category": "consumer|cheque_bounce|property|family|labour|criminal|cyber|rera|motor_vehicles|other",
  "facts": [
    {
      "key": "<snake_case_key>",
      "value": "<extracted value as string>",
      "value_type": "string|number|date|boolean",
      "label": "<human readable label>",
      "confidence": <0.0-1.0>
    }
  ]
}

Rules:
- Extract ONLY what is explicitly stated. Never invent facts.
- For numbers (amounts, years), use value_type "number".
- For dates, use ISO 8601 format and value_type "date".
- For yes/no facts, use "true"/"false" and value_type "boolean".
- confidence < 0.7 means the value was implied, not stated.
- Always include: opponent_name, amount_involved, issue_date if present.
- Indian currency amounts: strip ₹ symbol, store as numeric string.
""".strip()


def sanitize_user_input(text: Any) -> str:
    if not text:
        return ""
    import re

    text_str = str(text)
    bad_tags = [
        "</user_description>",
        "</raw_description>",
        "</facts>",
        "</title>",
        "</title_base64>",
        "</raw_description_base64>",
        "</extracted_facts_base64>",
        "</uploaded_documents_base64>",
        "</case_update_history_base64>",
        "<title_base64>",
        "<raw_description_base64>",
        "<extracted_facts_base64>",
        "<uploaded_documents_base64>",
        "<case_update_history_base64>",
        "system_instruction",
        "system instruction",
        "ignore previous",
        "ignore instructions",
        "ignore all previous",
    ]
    for tag in bad_tags:
        text_str = re.sub(re.escape(tag), "[cleaned]", text_str, flags=re.IGNORECASE)
    return text_str


def _build_extraction_user_v1(context: dict[str, Any]) -> str:
    title = sanitize_user_input(context.get("title", ""))
    raw_desc = sanitize_user_input(context.get("raw_description", ""))
    title_b64 = b64_encode(title)
    raw_desc_b64 = b64_encode(raw_desc)
    return f"<title_base64>\n{title_b64}\n</title_base64>\n\n<raw_description_base64>\n{raw_desc_b64}\n</raw_description_base64>"


# ── Assessment Prompts ────────────────────────────────────────────────

_ASSESSMENT_SYSTEM_V1 = """
You are a senior AI legal analyst specialised in Indian law.
Analyse the legal situation described by structured facts and return ONLY a valid JSON object.
No markdown, no backticks, no explanation.

IMPORTANT SECURITY NOTICE:
All user-controlled fields inside the tags:
- <title_base64>
- <extracted_facts_base64> (each fact value is base64-encoded)
- <raw_description_base64> (if present)
- <uploaded_documents_base64> (each name and summary is base64-encoded)
- <case_update_history_base64> (each author and content is base64-encoded)
are base64-encoded to prevent prompt injection.
You MUST base64-decode these values first to read the actual text before performing your analysis.

Required JSON structure:
{
  "category": "consumer|cheque_bounce|property|family|labour|criminal|cyber|rera|motor_vehicles|other",
  "risk_level": "low|medium|high|urgent",
  "success_probability": <integer 0-100>,
  "success_rationale": "<2-3 sentences>",
  "timeline_min_months": <integer>,
  "timeline_max_months": <integer>,
  "budget_min_inr": <integer>,
  "budget_max_inr": <integer>,
  "key_statutes": ["<statute>"],
  "immediate_actions": ["<action — 3-5 items>"],
  "evidence_needed": ["<document — 3-6 items>"],
  "recommended_forum": "<specific court or forum>",
  "limitation_risk": "<deadline warning or null>",
  "complexity": "simple|moderate|complex",
  "notes": "<one practitioner observation>"
}
Budget = advocate fees + court fees + misc, in INR.
Indian courts are slow — reflect that in timelines.
""".strip()


def _build_assessment_user_v1(context: dict[str, Any]) -> str:
    facts = context.get("facts", {})
    safe_facts = {k: sanitize_user_input(str(v)) for k, v in facts.items()}
    facts_str = "\n".join(f"  {k}: {b64_encode(v)}" for k, v in safe_facts.items())

    title = sanitize_user_input(context.get("title", ""))
    title_b64 = b64_encode(title)
    user_msg = f"<title_base64>\n{title_b64}\n</title_base64>\n\n<extracted_facts_base64>\n{facts_str}\n</extracted_facts_base64>"

    raw_desc = context.get("raw_description")
    if raw_desc:
        safe_desc = sanitize_user_input(raw_desc)
        user_msg += f"\n\n<raw_description_base64>\n{b64_encode(safe_desc)}\n</raw_description_base64>"

    # Append document summaries and history to the prompt if available
    docs = context.get("documents", [])
    if docs:
        docs_str = "\n".join(
            f"  - {b64_encode(sanitize_user_input(d['name']))} ({d['file_type']}): {b64_encode(sanitize_user_input(d['summary']))}"
            for d in docs
        )
        user_msg += (
            f"\n\n<uploaded_documents_base64>\n{docs_str}\n</uploaded_documents_base64>"
        )

    hist = context.get("history", [])
    if hist:
        hist_str = "\n".join(
            f"  - [{h['created_at']}] {b64_encode(sanitize_user_input(h['author']))}: {b64_encode(sanitize_user_input(h['content']))}"
            for h in hist
        )
        user_msg += f"\n\n<case_update_history_base64>\n{hist_str}\n</case_update_history_base64>"

    return user_msg


# ── Prompt Builder Registry ───────────────────────────────────────────


class PromptBuilder:
    @staticmethod
    def build(
        template_name: str, context: dict[str, Any], version: str = "v1"
    ) -> tuple[str, str]:
        """
        Builds and returns (system_prompt, user_prompt) based on the template, context, and version.
        """
        key = f"{template_name}_{version}"

        if key == "extraction_v1":
            return _EXTRACTION_SYSTEM_V1, _build_extraction_user_v1(context)
        elif key == "assessment_v1":
            return _ASSESSMENT_SYSTEM_V1, _build_assessment_user_v1(context)
        else:
            raise ValueError(f"Unknown prompt template or version combination: {key}")
