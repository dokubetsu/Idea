"""
AI Provider Registry.
Manages registering, resolving, and running health checks/fallbacks for AI models.
"""

import logging
from app.shared.ai.base import BaseAiProvider
from app.config import settings

log = logging.getLogger(__name__)


class ProviderRegistry:
    def __init__(self):
        # We store registered instantiated providers
        self._providers: dict[str, BaseAiProvider] = {}
        # We store mappings of provider names to their class import paths/initializers
        self._deferred_initializers = {
            "mock": self._init_mock,
            "gemini": self._init_gemini,
            "claude": self._init_claude,
            "openai_compatible": self._init_openai_compatible,
        }

    def _init_mock(self) -> BaseAiProvider:
        from app.shared.ai.mock import MockProvider

        return MockProvider()

    def _init_gemini(self) -> BaseAiProvider:
        from app.shared.ai.gemini import GeminiProvider

        return GeminiProvider()

    def _init_claude(self) -> BaseAiProvider:
        from app.shared.ai.claude import ClaudeProvider

        return ClaudeProvider()

    def _init_openai_compatible(self) -> BaseAiProvider:
        from app.shared.ai.openai_compatible import OpenAiCompatibleProvider

        return OpenAiCompatibleProvider()

    def register(self, name: str, provider: BaseAiProvider):
        """Register a provider instance."""
        self._providers[name] = provider
        log.info("Registered AI provider: %s", name)

    def _get_or_init_provider(self, name: str) -> BaseAiProvider | None:
        """Lazily load and initialize the provider by name."""
        if name in self._providers:
            return self._providers[name]

        init_fn = self._deferred_initializers.get(name)
        if init_fn:
            try:
                provider = init_fn()
                self._providers[name] = provider
                log.info("Initialized AI provider: %s", name)
                return provider
            except Exception as e:
                log.warning("Failed to initialize AI provider '%s': %s", name, e)
                return None
        return None

    async def resolve(self, name: str) -> BaseAiProvider:
        """
        Resolves a provider by name.
        If the target provider fails its health check, it falls back sequentially through the fallback chain.
        """
        requested = self._get_or_init_provider(name)
        if requested:
            try:
                if await requested.health():
                    return requested
                log.warning(
                    "AI provider '%s' is unhealthy. Initiating fallback...", name
                )
            except Exception as e:
                log.error(
                    "AI provider '%s' health check threw exception: %s. Initiating fallback...",
                    name,
                    e,
                )

        # Fallback chain: requested -> claude -> gemini -> openai_compatible
        fallback_order = ["claude", "gemini", "openai_compatible"]
        if name in fallback_order:
            fallback_order.remove(name)

        for fallback_name in fallback_order:
            provider = self._get_or_init_provider(fallback_name)
            if provider:
                try:
                    if await provider.health():
                        log.info(
                            "Successfully fell back to healthy provider: '%s'",
                            fallback_name,
                        )
                        return provider
                except Exception:
                    continue

        # If mock is explicitly requested (opt-in), return it
        if name == "mock":
            mock_provider = self._get_or_init_provider("mock")
            if not mock_provider:
                from app.shared.ai.mock import MockProvider

                mock_provider = MockProvider()
            return mock_provider

        raise RuntimeError("All configured AI providers are unhealthy or unavailable.")


# Global registry instance
ai_registry = ProviderRegistry()


async def get_ai_provider() -> BaseAiProvider:
    """
    Utility function to resolve the active AI provider based on environment config.
    """
    return await ai_registry.resolve(settings.ai_provider)
