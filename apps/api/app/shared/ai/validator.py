"""
Response Validator & Normalizer.
Validates raw LLM outputs against Pydantic models, cleans up data, and appends runtime metadata.
"""

import re
import json
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Type, TypeVar, Any

T = TypeVar("T", bound=BaseModel)


class ResponseValidator:
    @staticmethod
    def validate(raw: str, response_model: Type[T]) -> T:
        """
        Strips markdown wrappers, parses JSON, and validates it against the Pydantic schema.
        """
        cleaned = raw.strip()

        # Extract JSON block between first '{' and last '}' (or '[' and ']')
        start_idx = -1
        end_idx = -1

        brace_start = cleaned.find("{")
        bracket_start = cleaned.find("[")

        if brace_start != -1 and (bracket_start == -1 or brace_start < bracket_start):
            start_idx = brace_start
            end_idx = cleaned.rfind("}")
        elif bracket_start != -1:
            start_idx = bracket_start
            end_idx = cleaned.rfind("]")

        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx : end_idx + 1]
        else:
            # Fallback to stripping markers if no braces found
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = re.sub(r"^~~~(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*~~~$", "", cleaned)

        try:
            data = json.loads(cleaned)
        except Exception as e:
            # H9: Do NOT include the raw AI response in the exception message.
            # It may contain sensitive prompt content or user data. Log it server-side only.
            import logging

            logging.getLogger(__name__).debug(
                "AI JSON parse failure. Raw response (first 200 chars): %.200s", raw
            )
            raise ValueError(f"AI response is not valid JSON: {e}")

        # Pydantic validation and coercion
        return response_model.model_validate(data)


class Normalizer:
    @staticmethod
    def normalize_assessment(
        validated_data: Any,
        provider_name: str,
        model_name: str,
        prompt_version: str,
        temperature: float,
    ) -> dict[str, Any]:
        """
        Normalizes legal assessment fields and embeds execution metadata.
        """
        data = validated_data.model_dump()

        # Enforce calendar and numeric safety constraints
        if data.get("timeline_min_months", 0) < 0:
            data["timeline_min_months"] = 0
        if data.get("timeline_max_months", 0) < 0:
            data["timeline_max_months"] = 0

        # Check success probability is within 0-100
        prob = data.get("success_probability", 50)
        data["success_probability"] = max(0, min(100, prob))

        # Populate flat Pydantic model fields
        data["provider"] = provider_name
        data["model"] = model_name
        data["prompt_version"] = prompt_version
        data["temperature"] = temperature
        data["created_at"] = datetime.now(timezone.utc).isoformat()

        return data

    @staticmethod
    def normalize_facts(
        validated_data: Any,
        provider_name: str,
        model_name: str,
        prompt_version: str,
        temperature: float,
    ) -> dict[str, Any]:
        """
        Normalizes extracted facts fields and embeds execution metadata.
        """
        data = validated_data.model_dump()

        # Ensure categories are lowercased and snake_cased
        if "detected_category" in data:
            data["detected_category"] = data["detected_category"].strip().lower()

        # Embed AI run metadata
        data["provider_metadata"] = {
            "provider": provider_name,
            "model": model_name,
            "prompt_version": prompt_version,
            "temperature": temperature,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        return data
