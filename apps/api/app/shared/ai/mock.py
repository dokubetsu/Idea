"""
Mock Provider — deterministic offline fallback for local development and tests.
"""

import json
from app.shared.ai.base import BaseAiProvider

_ASSESSMENT_TEMPLATES = {
    "cheque_bounce": {
        "category": "cheque_bounce",
        "risk_level": "medium",
        "success_probability": 74,
        "success_rationale": "Strong statutory framework under Section 138 NI Act. Success hinges on sending notice within 30 days and filing within limitation. Documentary evidence typically decisive.",
        "timeline_min_months": 6,
        "timeline_max_months": 24,
        "budget_min_inr": 15000,
        "budget_max_inr": 50000,
        "key_statutes": ["Section 138 NI Act", "Section 142 NI Act"],
        "immediate_actions": [
            "Send legal notice within 30 days of dishonour memo",
            "Preserve original cheque and bank memo",
            "Document all prior communications about the debt",
            "File complaint if drawer doesn't pay within 15 days of notice",
        ],
        "evidence_needed": [
            "Original cheque",
            "Bank dishonour memo",
            "Proof of underlying debt",
            "Copy of legal notice with postal receipt",
        ],
        "recommended_forum": "Judicial Magistrate / Metropolitan Magistrate",
        "limitation_risk": "File within 1 month of expiry of 15-day notice period.",
        "complexity": "simple",
        "notes": "High case load in Magistrate courts — mediation faster if amount < ₹1 lakh.",
    },
    "consumer": {
        "category": "consumer",
        "risk_level": "low",
        "success_probability": 68,
        "success_rationale": "Consumer forums have pro-consumer bias under Consumer Protection Act 2019. Cases with clear deficiency of service and documentary evidence succeed consistently.",
        "timeline_min_months": 3,
        "timeline_max_months": 18,
        "budget_min_inr": 5000,
        "budget_max_inr": 25000,
        "key_statutes": [
            "Section 35 Consumer Protection Act 2019",
            "Section 2(7) — deficiency of service",
        ],
        "immediate_actions": [
            "Send written complaint to company grievance officer first",
            "Preserve all invoices and communications",
            "File on NCH portal 1915",
            "Approach DCDRC if claim < ₹50 lakh",
        ],
        "evidence_needed": [
            "Purchase invoice",
            "Warranty card",
            "Written complaint + company response",
            "Photos of defect",
        ],
        "recommended_forum": "District Consumer Disputes Redressal Commission",
        "limitation_risk": "File within 2 years of cause of action.",
        "complexity": "simple",
        "notes": "No court fee for claims under ₹5 lakh.",
    },
    "rera": {
        "category": "rera",
        "risk_level": "high",
        "success_probability": 61,
        "success_rationale": "RERA offers strong statutory protections for home buyers. Success depends on project RERA registration status and documented possession delay.",
        "timeline_min_months": 6,
        "timeline_max_months": 30,
        "budget_min_inr": 20000,
        "budget_max_inr": 80000,
        "key_statutes": [
            "Section 18 RERA 2016 — delayed possession",
            "Section 31 — complaint filing",
        ],
        "immediate_actions": [
            "Verify project RERA registration on state portal",
            "Calculate interest owed at SBI MCLR + 2%",
            "Send formal notice demanding possession or refund",
            "File on state RERA portal",
        ],
        "evidence_needed": [
            "Allotment letter and agreement",
            "All payment receipts",
            "RERA project registration certificate",
            "Builder communications about delay",
        ],
        "recommended_forum": "State RERA Authority",
        "limitation_risk": "File complaint on state RERA portal.",
        "complexity": "moderate",
        "notes": "Homebuyer associations significantly strengthen individual complaints.",
    },
    "motor_vehicles": {
        "category": "motor_vehicles",
        "risk_level": "medium",
        "success_probability": 65,
        "success_rationale": "MACT claims have structured guidelines (Sarla Verma multiplier) for compensation. Success depends on insurance cover validation and filing within the 6-month limitation window.",
        "timeline_min_months": 8,
        "timeline_max_months": 24,
        "budget_min_inr": 10000,
        "budget_max_inr": 40000,
        "key_statutes": [
            "Section 166 Motor Vehicles Act 1988",
            "Section 140/141 — No Fault Liability",
        ],
        "immediate_actions": [
            "File / obtain Detailed Accident Report (DAR) from police",
            "Verify offending vehicle registration and insurance coverage",
            "Obtain disability certificate from medical board if injured",
            "File MACT petition within 6 months of accident / death",
        ],
        "evidence_needed": [
            "FIR and Post-Mortem / Disability Certificate",
            "Offending vehicle insurance policy copy",
            "Income proof of victim (salary slips / ITR)",
            "Medical expense invoices and treatment summaries",
        ],
        "recommended_forum": "Motor Accident Claims Tribunal (MACT)",
        "limitation_risk": "Petition MUST be filed within 6 months of the accident.",
        "complexity": "moderate",
        "notes": "Third-party insurer bears primary financial liability.",
    },
    "other": {
        "category": "other",
        "risk_level": "medium",
        "success_probability": 55,
        "success_rationale": "Situation requiring detailed civil review. Key facts and documentation will be decisive.",
        "timeline_min_months": 6,
        "timeline_max_months": 36,
        "budget_min_inr": 20000,
        "budget_max_inr": 100000,
        "key_statutes": ["Relevant IPC/CPC/BNS provisions (advocate to determine)"],
        "immediate_actions": [
            "Consult a qualified advocate immediately",
            "Preserve all written communications",
            "Compile a chronological timeline",
        ],
        "evidence_needed": [
            "All written communications",
            "Financial records",
            "Agreements or contracts",
        ],
        "recommended_forum": "Civil Court",
        "limitation_risk": "Consult advocate immediately to determine limitation period.",
        "complexity": "moderate",
        "notes": "Professional legal assessment essential before filing.",
    },
}


class MockProvider(BaseAiProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def health(self) -> bool:
        return True

    async def generate(
        self, system_prompt: str, user_prompt: str, temperature: float = 0.1
    ) -> str:
        text = (system_prompt + " " + user_prompt).lower()

        # 1. Detect category from text keywords
        category = "other"
        if any(w in text for w in ["cheque", "bounce", "dishonour", "138", "ni act"]):
            category = "cheque_bounce"
        elif any(w in text for w in ["consumer", "defective", "service deficiency"]):
            category = "consumer"
        elif any(
            w in text for w in ["rera", "builder", "flat", "possession", "developer"]
        ):
            category = "rera"
        elif any(
            w in text for w in ["accident", "injury", "mact", "insurer", "motor", "vehicle"]
        ):
            category = "motor_vehicles"

        # 2. Check if this is a Facts Extraction request based on the system prompt
        if (
            "detected_category" in system_prompt.lower()
            and "risk_level" not in system_prompt.lower()
        ):
            # Return Mock Facts JSON
            facts = [
                {
                    "key": "category",
                    "value": category,
                    "value_type": "string",
                    "label": "Case category",
                    "confidence": 0.85,
                },
            ]
            if category == "cheque_bounce":
                facts.extend(
                    [
                        {
                            "key": "cheque_amount",
                            "value": "150000",
                            "value_type": "number",
                            "label": "Cheque amount (INR)",
                            "confidence": 0.95,
                        },
                        {
                            "key": "cheque_date",
                            "value": "2026-03-01",
                            "value_type": "date",
                            "label": "Cheque Date",
                            "confidence": 0.90,
                        },
                        {
                            "key": "dishonour_date",
                            "value": "2026-03-05",
                            "value_type": "date",
                            "label": "Return Memo Date",
                            "confidence": 0.90,
                        },
                        {
                            "key": "legal_notice_sent",
                            "value": "false",
                            "value_type": "boolean",
                            "label": "Legal Notice Sent",
                            "confidence": 0.80,
                        },
                    ]
                )
            elif category == "rera":
                facts.extend(
                    [
                        {
                            "key": "project_name",
                            "value": "Golden Heights Phase 2",
                            "value_type": "string",
                            "label": "Project Name",
                            "confidence": 0.95,
                        },
                        {
                            "key": "total_paid_amount",
                            "value": "2500000",
                            "value_type": "number",
                            "label": "Total Amount Paid",
                            "confidence": 0.90,
                        },
                        {
                            "key": "promised_possession_date",
                            "value": "2025-12-31",
                            "value_type": "date",
                            "label": "Promised Possession Date",
                            "confidence": 0.85,
                        },
                    ]
                )
            elif category == "motor_vehicles":
                facts.extend(
                    [
                        {
                            "key": "accident_date",
                            "value": "2026-04-15",
                            "value_type": "date",
                            "label": "Accident Date",
                            "confidence": 0.95,
                        },
                        {
                            "key": "claimant_age",
                            "value": "35",
                            "value_type": "number",
                            "label": "Claimant Age",
                            "confidence": 0.90,
                        },
                        {
                            "key": "offending_vehicle_insurer",
                            "value": "National Insurance Co",
                            "value_type": "string",
                            "label": "Offending Vehicle Insurer",
                            "confidence": 0.85,
                        },
                    ]
                )

            return json.dumps({"detected_category": category, "facts": facts})

        # 3. Otherwise, return Mock Assessment JSON
        tpl = _ASSESSMENT_TEMPLATES.get(category, _ASSESSMENT_TEMPLATES["other"])
        return json.dumps(tpl)
