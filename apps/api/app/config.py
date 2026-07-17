import os

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
        # Production: process/platform env and secret files must win over a
        # baked-in .env (containers, Render, K8s). Locally, prefer .env so
        # developer overrides stay convenient without exporting every var.
        if os.environ.get("APP_ENV", "").lower() == "production":
            return (
                init_settings,
                env_settings,
                file_secret_settings,
                dotenv_settings,
            )
        return init_settings, dotenv_settings, env_settings, file_secret_settings

    SUPABASE_URL: str = "http://placeholder.supabase.co"
    APP_URL: str = "http://localhost:3001"
    SUPABASE_SERVICE_ROLE_KEY: str | None = "placeholder-key"
    SUPABASE_SECRET_KEY: str | None = None
    SUPABASE_ANON_KEY: str | None = "placeholder-key"
    SUPABASE_PUBLISHABLE_KEY: str | None = None
    SUPABASE_JWT_SECRET: str

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
    PAYMENT_WEBHOOK_SECRET: str

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    FEATURE_CONSULTATIONS: bool = True
    FEATURE_PRACTICE: bool = False
    FEATURE_BILLING: bool = False
    FEATURE_HEARINGS: bool = False
    FEATURE_MILESTONES: bool = False
    FEATURE_AI_SUMMARIES: bool = False

    # ── Interest rates (RERA / legal tools) ─────────────────
    # Prefer env override so ops can update monthly without redeploying code.
    SBI_MCLR_RATE: float | None = None
    SBI_MCLR_AS_OF: str = ""  # YYYY-MM-DD
    # Optional JSON feed URL: {"rate": 9.0, "as_of": "2026-07-01"}
    SBI_MCLR_FETCH_URL: str = ""
    # Platform supplier state for GST place-of-supply defaults
    GST_SUPPLIER_STATE: str = "Delhi"
    GST_SUPPLIER_GSTIN: str = "07LEADG1234A1Z5"

    # ── E-invoice IRP (NIC) ─────────────────────────────────
    EINVOICE_PROVIDER: str = "mock"  # mock | nic
    EINVOICE_NIC_BASE_URL: str = ""
    EINVOICE_NIC_USERNAME: str = ""
    EINVOICE_NIC_PASSWORD: str = ""
    EINVOICE_NIC_GSTIN: str = ""

    # Court holiday JSON feed (optional)
    COURT_HOLIDAY_FEED_URL: str = ""

    # ── AI cost controls ───────────────────────────────────
    # Max AI generate() calls per user per UTC day (0 = unlimited).
    AI_USER_DAILY_REQUEST_LIMIT: int = 20
    # Hard circuit-breaker: if cumulative calls in this process exceed this
    # threshold within a single UTC day, all AI calls are rejected (0 = off).
    AI_GLOBAL_DAILY_REQUEST_LIMIT: int = 0

    SUPABASE_TEST_PROJECT_URL: str | None = None
    SUPABASE_TEST_SERVICE_ROLE_KEY: str | None = None
    SUPABASE_TEST_ANON_KEY: str | None = None

    APP_ENV: str = "development"
    API_VERSION: str = "v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    REDIS_URL: str = "memory://"
    TRUST_PROXY: bool = False
    PAYMENT_WEBHOOK_SKIP_VERIFICATION: bool = False
    START_OUTBOX_WORKER: bool = True
    # Expose Prometheus /metrics. Default off in production (set true only on
    # a private scrape network). Always available in non-production for local debug.
    EXPOSE_METRICS: bool | None = None

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
            raise ValueError(
                "Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY must be provided."
            )
        if not self.SUPABASE_ANON_KEY:
            raise ValueError(
                "Either SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY must be provided."
            )
        if self.APP_ENV == "production" and (
            not self.APP_URL
            or "localhost" in self.APP_URL
            or "127.0.0.1" in self.APP_URL
        ):
            raise ValueError(
                "APP_URL must be set to a valid non-localhost production URL when APP_ENV is production."
            )
        if self.APP_ENV == "production" and (
            not self.PAYMENT_WEBHOOK_SECRET
            or self.PAYMENT_WEBHOOK_SECRET in ("", "test_webhook_secret")
        ):
            raise ValueError(
                "PAYMENT_WEBHOOK_SECRET must be set to a valid production secret when APP_ENV is production."
            )
        if self.APP_ENV == "production" and (
            not self.REDIS_URL or self.REDIS_URL.startswith("memory://")
        ):
            raise ValueError(
                "REDIS_URL must be set to a valid Redis URL when APP_ENV is production."
            )
        if self.APP_ENV == "production" and self.PAYMENT_WEBHOOK_SKIP_VERIFICATION:
            raise ValueError(
                "PAYMENT_WEBHOOK_SKIP_VERIFICATION must be False in production. "
                "Signature verification cannot be disabled in a live environment."
            )
        if self.APP_ENV == "production" and not self.RAZORPAY_KEY_SECRET:
            raise ValueError(
                "RAZORPAY_KEY_SECRET must be set when APP_ENV is production."
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def should_expose_metrics(self) -> bool:
        if self.EXPOSE_METRICS is not None:
            return self.EXPOSE_METRICS
        return not self.is_production

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
