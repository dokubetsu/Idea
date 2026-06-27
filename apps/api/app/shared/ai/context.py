"""
AI Context Builder.
Aggregates and formats context (Matters, Facts, Documents, and history updates) for the AI pipeline.
"""

from typing import Any


class ContextBuilder:
    @staticmethod
    def build_intake_context(title: str, description: str) -> dict[str, Any]:
        """
        Builds context for initial facts extraction.
        """
        return {
            "title": title,
            "raw_description": description,
        }

    @staticmethod
    def build_assessment_context(
        title: str, facts: dict[str, Any], raw_description: str | None = None
    ) -> dict[str, Any]:
        """
        Builds context for legal assessment.
        """
        return {
            "title": title,
            "facts": facts,
            "raw_description": raw_description,
        }

    @staticmethod
    def build_matter_context(
        matter: dict[str, Any],
        facts: list[dict[str, Any]],
        documents: list[dict[str, Any]] | None = None,
        history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Builds context for full matter reviews or document generation.
        Aggregates matter metadata, verified facts, uploaded document summaries, and update history.
        """
        # Convert list of facts to key-value pairs
        facts_dict = {f["key"]: f["value"] for f in facts if f.get("key") and f.get("value") is not None}

        return {
            "matter_id": matter.get("id"),
            "title": matter.get("title"),
            "category": matter.get("category"),
            "status": matter.get("status"),
            "summary": matter.get("summary"),
            "facts": facts_dict,
            "documents": [
                {
                    "name": d.get("name"),
                    "file_type": d.get("file_type"),
                    "summary": d.get("summary") or "No summary available",
                }
                for d in (documents or [])
            ],
            "history": [
                {
                    "author": h.get("author_name") or h.get("author_id") or "System",
                    "content": h.get("content"),
                    "created_at": str(h.get("created_at", "")),
                }
                for h in (history or [])
            ],
        }
