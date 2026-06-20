import asyncio
import google.generativeai as genai
from app.shared.ai.base import BaseAiProvider
from app.config import settings


class GeminiProvider(BaseAiProvider):
    def __init__(self):
        self._configured = False

    def _ensure_configured(self):
        if not self._configured:
            if settings.GEMINI_API_KEY:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._configured = True

    @property
    def name(self) -> str:
        return "gemini"

    async def health(self) -> bool:
        if not settings.GEMINI_API_KEY:
            return False
        try:
            self._ensure_configured()
            model = genai.GenerativeModel("gemini-2.5-flash-lite")
            response = await asyncio.to_thread(
                model.generate_content,
                "ping",
                generation_config={"max_output_tokens": 5}
            )
            return bool(response.text.strip())
        except Exception:
            return False

    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        if not settings.GEMINI_API_KEY:
            raise ValueError("Gemini API key is not configured.")

        self._ensure_configured()
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            system_instruction=system_prompt
        )

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    model.generate_content,
                    user_prompt,
                    generation_config={"temperature": temperature}
                ),
                timeout=30.0
            )
            return response.text.strip()
        except asyncio.TimeoutError:
            raise TimeoutError("Gemini generation timed out after 30 seconds")

