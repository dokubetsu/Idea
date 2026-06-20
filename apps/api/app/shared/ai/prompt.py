"""
AI Prompt Builder.
Maintains versioned prompt templates for reproducible AI inputs.
"""
from typing import Any

# ── Extraction Prompts ────────────────────────────────────────────────

_EXTRACTION_SYSTEM_V1 = """
You are a legal intake specialist for Indian law.
Extract structured facts from the user's description.
Return ONLY valid JSON — no markdown, no explanation.

JSON structure:
{
  "detected_category": "consumer|cheque_bounce|property|family|labour|criminal|cyber|rera|other",
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
    text_str = str(text)
    # Strip potential injection wrappers / escape markers
    bad_tags = ["</user_description>", "</raw_description>", "</facts>", "</title>", "system_instruction", "system instruction", "ignore previous"]
    for tag in bad_tags:
        text_str = text_str.replace(tag, "[cleaned]")
    return text_str

def _build_extraction_user_v1(context: dict[str, Any]) -> str:
    title = sanitize_user_input(context.get('title', ''))
    raw_desc = sanitize_user_input(context.get('raw_description', ''))
    return f"<title>\n{title}\n</title>\n\n<raw_description>\n{raw_desc}\n</raw_description>"



# ── Assessment Prompts ────────────────────────────────────────────────

_ASSESSMENT_SYSTEM_V1 = """
You are a senior AI legal analyst specialised in Indian law.
Analyse the legal situation described by structured facts and return ONLY a valid JSON object.
No markdown, no backticks, no explanation.

Required JSON structure:
{
  "category": "consumer|cheque_bounce|property|family|labour|criminal|cyber|rera|other",
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
    facts_str = "\n".join(f"  {k}: {v}" for k, v in facts.items())
    
    title = sanitize_user_input(context.get('title', ''))
    user_msg = f"<title>\n{title}\n</title>\n\n<extracted_facts>\n{facts_str}\n</extracted_facts>"
    
    raw_desc = context.get("raw_description")
    if raw_desc:
        user_msg += f"\n\n<raw_description>\n{sanitize_user_input(raw_desc)}\n</raw_description>"
        
    # Append document summaries and history to the prompt if available
    docs = context.get("documents", [])
    if docs:
        docs_str = "\n".join(f"  - {d['name']} ({d['file_type']}): {sanitize_user_input(d['summary'])}" for d in docs)
        user_msg += f"\n\n<uploaded_documents>\n{docs_str}\n</uploaded_documents>"
        
    hist = context.get("history", [])
    if hist:
        hist_str = "\n".join(f"  - [{h['created_at']}] {h['author']}: {sanitize_user_input(h['content'])}" for h in hist)
        user_msg += f"\n\n<case_update_history>\n{hist_str}\n</case_update_history>"
        
    return user_msg


# ── Prompt Builder Registry ───────────────────────────────────────────

class PromptBuilder:
    @staticmethod
    def build(template_name: str, context: dict[str, Any], version: str = "v1") -> tuple[str, str]:
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
