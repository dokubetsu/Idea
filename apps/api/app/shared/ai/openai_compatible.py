from openai import AsyncOpenAI
from app.shared.ai.base import BaseAiProvider
from app.config import settings


class OpenAiCompatibleProvider(BaseAiProvider):
    def __init__(self):
        self.client = None

    def _get_client(self) -> AsyncOpenAI:
        if self.client is None:
            self.client = AsyncOpenAI(
                base_url=settings.AI_API_BASE_URL or "https://api.openai.com/v1",
                api_key=settings.AI_API_KEY or "none",
                timeout=30.0,
            )
        return self.client

    @property
    def name(self) -> str:
        return "openai_compatible"

    async def health(self) -> bool:
        # Check if we have at least a base URL or api key configured
        if not settings.AI_API_BASE_URL:
            return False
        try:
            client = AsyncOpenAI(
                base_url=settings.AI_API_BASE_URL,
                api_key=settings.AI_API_KEY or "none",
                timeout=5.0,
            )
            # Fetch models list to verify connectivity
            await client.models.list()
            return True
        except Exception:
            return False

    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        client = self._get_client()

        # Fallback default model if not configured
        model = settings.AI_MODEL_NAME or "gpt-4o"

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""
