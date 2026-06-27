from typing import Any, cast
import anthropic
from app.shared.ai.base import BaseAiProvider
from app.config import settings


class ClaudeProvider(BaseAiProvider):
    def __init__(self):
        self.client = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self.client is None:
            self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)
        return self.client

    @property
    def name(self) -> str:
        return "claude"

    async def health(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("Anthropic API key is not configured.")

        client = self._get_client()
        msg = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return cast(Any, msg.content[0]).text.strip()
