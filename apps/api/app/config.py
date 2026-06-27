from pydantic import model_validator
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
    PydanticBaseSettingsSource,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Prioritize local .env file over system/shell environment variables
        return init_settings, dotenv_settings, env_settings, file_secret_settings

    SUPABASE_URL: str = "http://placeholder.supabase.co"
    APP_URL: str = "http://localhost:3001"
    SUPABASE_SERVICE_ROLE_KEY: str | None = "placeholder-key"
    SUPABASE_SECRET_KEY: str | None = None
    SUPABASE_ANON_KEY: str | None = "placeholder-key"
    SUPABASE_PUBLISHABLE_KEY: str | None = None
    SUPABASE_JWT_SECRET: str = "placeholder-secret-minimum-32-characters-long"

    # AI providers — at least one should be set; falls back to mock
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # OpenAI-compatible / local models configuration
    AI_PROVIDER_TYPE: str = ""  # gemini, claude, openai_compatible, mock
    AI_API_BASE_URL: str = ""  # e.g., http://localhost:11434/v1 for Ollama
    AI_MODEL_NAME: str = ""  # e.g., llama3.1
    AI_API_KEY: str = ""  # optional API key for custom endpoint

    # ── Notification channels ─────────────────────────────
    # Resend (email). Leave blank to use console mock.
    RESEND_API_KEY: str = ""
    RESEND_FROM_ADDRESS: str = "LeAd <noreply@lead.ai>"

    # Twilio (SMS). Leave blank to use console mock.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""  # E.164 format, e.g. +14155238886

    # ── Cron security ─────────────────────────────────────
    # Required — no default. Set this in your environment.
    # Never hardcode a fallback here; the absence of this value at startup is intentional.
    CRON_SECRET: str

    # ── Payment Webhook security ──────────────────────────
    PAYMENT_WEBHOOK_SECRET: str = "test_webhook_secret"

    FEATURE_CONSULTATIONS: bool = True
    FEATURE_BILLING: bool = False
    FEATURE_HEARINGS: bool = False
    FEATURE_MILESTONES: bool = False
    FEATURE_AI_SUMMARIES: bool = False

    SUPABASE_TEST_PROJECT_URL: str | None = None
    SUPABASE_TEST_SERVICE_ROLE_KEY: str | None = None

    APP_ENV: str = "development"
    API_VERSION: str = "v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    @model_validator(mode="after")
    def validate_keys(self) -> "Settings":
        # Resolve secret/service_role keys
        if not self.SUPABASE_SERVICE_ROLE_KEY and self.SUPABASE_SECRET_KEY:
            self.SUPABASE_SERVICE_ROLE_KEY = self.SUPABASE_SECRET_KEY
        elif self.SUPABASE_SERVICE_ROLE_KEY and not self.SUPABASE_SECRET_KEY:
            self.SUPABASE_SECRET_KEY = self.SUPABASE_SERVICE_ROLE_KEY

        # Resolve publishable/anon keys
        if not self.SUPABASE_ANON_KEY and self.SUPABASE_PUBLISHABLE_KEY:
            self.SUPABASE_ANON_KEY = self.SUPABASE_PUBLISHABLE_KEY
        elif self.SUPABASE_ANON_KEY and not self.SUPABASE_PUBLISHABLE_KEY:
            self.SUPABASE_PUBLISHABLE_KEY = self.SUPABASE_ANON_KEY

        if not self.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY must be provided.")
        if not self.SUPABASE_ANON_KEY:
            raise ValueError("Either SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY must be provided.")
        if self.APP_ENV == "production" and (
            not self.APP_URL or "localhost" in self.APP_URL or "127.0.0.1" in self.APP_URL
        ):
            raise ValueError("APP_URL must be set to a valid non-localhost production URL when APP_ENV is production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def ai_provider(self) -> str:
        """Auto-select available provider if not explicitly configured."""
        if self.AI_PROVIDER_TYPE:
            return self.AI_PROVIDER_TYPE
        if self.ANTHROPIC_API_KEY:
            return "claude"
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.AI_API_BASE_URL:
            return "openai_compatible"
        return "mock"


settings = Settings()  # type: ignore[call-arg]
