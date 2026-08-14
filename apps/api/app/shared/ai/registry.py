"""
AI Provider Registry.
Manages registering, resolving, and running health checks/fallbacks for AI models.
"""

import logging

from app.config import settings
from app.shared.ai.base import BaseAiProvider

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


class _AiRateLimiter:
    """
    Per-user and global daily AI call counter.

    Uses Redis (INCR + EXPIRE) when REDIS_URL is a real Redis instance so
    multi-worker / multi-instance deployments share one budget. Falls back to
    in-process counters for memory:// or when Redis is unreachable.
    """

    def __init__(self):
        from collections import defaultdict

        self._day: str = ""
        self._per_user: dict[str, int] = defaultdict(int)
        self._global_count: int = 0
        self._redis = None
        self._redis_failed = False

    def _maybe_reset(self, today: str) -> None:
        if today != self._day:
            from collections import defaultdict

            self._day = today
            self._per_user = defaultdict(int)
            self._global_count = 0

    def _get_redis(self):
        if self._redis_failed:
            return None
        if self._redis is not None:
            return self._redis
        url = settings.REDIS_URL or ""
        if not url or url.startswith("memory://"):
            return None
        try:
            import redis

            self._redis = redis.from_url(url, decode_responses=True)
            # Validate connectivity once
            self._redis.ping()
            return self._redis
        except Exception as exc:
            log.warning(
                "AI rate limiter: Redis unavailable (%s); using in-process counters",
                exc,
            )
            self._redis_failed = True
            self._redis = None
            return None

    def _check_and_increment_redis(
        self, r, today: str, bucket: str, limit_user: int, limit_global: int
    ) -> None:
        user_key = f"ai:rl:user:{bucket}:{today}"
        global_key = f"ai:rl:global:{today}"
        # TTL slightly over 1 day so keys expire after the UTC day rolls
        ttl = 60 * 60 * 26

        pipe = r.pipeline()
        pipe.incr(user_key)
        pipe.expire(user_key, ttl, nx=True)
        pipe.incr(global_key)
        pipe.expire(global_key, ttl, nx=True)
        results = pipe.execute()
        user_count = int(results[0])
        global_count = int(results[2])

        # After increment: if over limit, we already consumed a slot. Acceptable
        # for rate limits (slight overshoot under concurrency).
        if limit_global > 0 and global_count > limit_global:
            raise RuntimeError(
                "AI global daily request limit reached. Try again tomorrow."
            )
        if limit_user > 0 and user_count > limit_user:
            raise RuntimeError(
                f"AI daily request limit of {limit_user} reached for this user. "
                "Try again tomorrow."
            )

    def _check_and_increment_memory(
        self, today: str, bucket: str, limit_user: int, limit_global: int
    ) -> None:
        self._maybe_reset(today)

        if limit_global > 0 and self._global_count >= limit_global:
            raise RuntimeError(
                "AI global daily request limit reached. Try again tomorrow."
            )

        if limit_user > 0 and self._per_user[bucket] >= limit_user:
            raise RuntimeError(
                f"AI daily request limit of {limit_user} reached for this user. "
                "Try again tomorrow."
            )

        self._per_user[bucket] += 1
        self._global_count += 1

    def check_and_increment(self, user_id: str | None) -> None:
        """
        Raise RuntimeError if any configured budget is exceeded;
        otherwise record the call. user_id=None counts against a shared
        'anonymous' bucket — always pass authenticated user ids when available.
        """
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        limit_user = settings.AI_USER_DAILY_REQUEST_LIMIT
        limit_global = settings.AI_GLOBAL_DAILY_REQUEST_LIMIT
        bucket = user_id or "anonymous"

        if limit_user <= 0 and limit_global <= 0:
            return

        r = self._get_redis()
        if r is not None:
            try:
                self._check_and_increment_redis(
                    r, today, bucket, limit_user, limit_global
                )
                return
            except RuntimeError:
                raise
            except Exception as exc:
                log.warning(
                    "AI rate limiter: Redis error (%s); falling back to in-process",
                    exc,
                )
                self._redis_failed = True

        self._check_and_increment_memory(today, bucket, limit_user, limit_global)

    def usage(self, user_id: str | None) -> dict:
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        bucket = user_id or "anonymous"
        user_calls = 0
        global_calls = 0

        r = self._get_redis()
        if r is not None:
            try:
                user_calls = int(r.get(f"ai:rl:user:{bucket}:{today}") or 0)
                global_calls = int(r.get(f"ai:rl:global:{today}") or 0)
            except Exception:
                r = None

        if r is None:
            self._maybe_reset(today)
            user_calls = self._per_user[bucket]
            global_calls = self._global_count

        return {
            "date": today,
            "user_calls_today": user_calls,
            "user_limit": settings.AI_USER_DAILY_REQUEST_LIMIT,
            "global_calls_today": global_calls,
            "global_limit": settings.AI_GLOBAL_DAILY_REQUEST_LIMIT,
        }


ai_rate_limiter = _AiRateLimiter()


async def get_ai_provider(user_id: str | None = None) -> BaseAiProvider:
    """
    Resolves the active AI provider based on environment config.
    Enforces per-user and global daily request limits before returning the provider.
    Pass user_id from the authenticated request so the circuit-breaker can track
    per-user consumption.
    """
    try:
        ai_rate_limiter.check_and_increment(user_id)
    except RuntimeError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return await ai_registry.resolve(settings.ai_provider)
