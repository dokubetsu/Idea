"""
Abstract Base AI Provider interface.
All concrete models (Gemini, Claude, local open-source models) implement this class.
"""
from abc import ABC, abstractmethod


class BaseAiProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the provider (e.g. 'gemini', 'claude', 'openai_compatible')."""
        pass

    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        """
        Sends prompts to the LLM and returns the raw string output.
        Validation, parsing, and normalization are handled by separate wrapper services.
        """
        pass

    @abstractmethod
    async def health(self) -> bool:
        """
        Runs a quick check to see if the provider is responsive.
        Used by the ProviderRegistry to determine whether to trigger fallback rules.
        """
        pass
