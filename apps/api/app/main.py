"""
LeAd Platform — FastAPI application bootstrap.

Startup sequence:
1. Load settings → validate env vars
2. Verify Supabase connection
3. Register middleware (CORS, trusted hosts)
4. Register domain routers
5. Register lifecycle events
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, cast

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.domains.admin.router import router as admin_router
from app.domains.assessment.router import router as assessment_router
from app.domains.consultations.router import router as consultations_router
from app.domains.docket import docket_router
from app.domains.identity.router import router as identity_router
from app.domains.intake.router import router as intake_router
from app.domains.legal_tools.router import router as legal_tools_router
from app.domains.matching.router import router as matching_router
from app.domains.matters.router import router as matters_router
from app.domains.notifications.router import router as notifications_router
from app.domains.practice import practice_router
from app.domains.system.router import router as system_router
from app.shared.body_size_limit import BodySizeLimitMiddleware, SizeLimitError
from app.shared.limiter import limiter
from app.shared.middleware import RequestTracingMiddleware, request_id_var

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger(__name__)

# Sentry initialization

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        send_default_pii=False,
        traces_sample_rate=1.0,
    )

# Structured JSON logging in production
if settings.APP_ENV == "production":
    import structlog

    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

# Session cleanup is performed via the HTTP cron endpoint: POST /api/v1/system/cron/cleanup-sessions.
# Call this from an external scheduler every 6 hours.


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    from app.domains.assessment.service import get_provider
    from app.domains.notifications.subscriber import init_subscriber
    from app.shared.database import get_service_role_db
    from app.shared.events import start_outbox_worker

    init_subscriber()
    if settings.START_OUTBOX_WORKER:
        start_outbox_worker()

    log.info("Environment: %s", settings.APP_ENV)

    if (
        settings.SUPABASE_URL == "http://placeholder.supabase.co"
        or "placeholder" in settings.SUPABASE_JWT_SECRET
    ):
        log.error(
            "❌ SUPABASE_URL or SUPABASE_JWT_SECRET is missing or using default placeholder values."
        )
        raise ValueError(
            "Invalid database configuration: environment variables must be populated."
        )

    try:
        get_service_role_db().table("profiles").select("id").limit(1).execute()
        log.info("✅ Supabase connection verified")
    except Exception as exc:
        log.warning("⚠️  Supabase check failed: %s", exc)

    provider = get_provider()
    log.info("✅ Assessment provider: %s", provider.name)

    if settings.FEATURE_PRACTICE:
        from app.domains.practice.scenario_loader import (
            load_all_scenarios,
            sync_to_database,
        )

        try:
            load_all_scenarios()
            sync_to_database()
        except Exception as sync_exc:
            log.error("Failed to load/sync practice scenarios on startup: %s", sync_exc)

    yield
    # ── Shutdown ─────────────────────────────────────────────
    log.info("Shutting down")


app = FastAPI(
    title="LeAd Platform API",
    description="Legal workflow platform for India",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Prometheus metrics instrumentation — never leave /metrics public in prod
# unless EXPOSE_METRICS is explicitly enabled (private scrape networks only).
_instrumentator = Instrumentator().instrument(app)
if settings.should_expose_metrics:
    _instrumentator.expose(app)
else:
    log.info("Prometheus /metrics endpoint is not exposed (production default)")

# Register rate limiter instance and handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))


@app.exception_handler(SizeLimitError)
async def size_limit_handler(request: Request, exc: SizeLimitError) -> JSONResponse:
    return JSONResponse(status_code=413, content={"detail": "Payload too large"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = request_id_var.get()
    log.error(
        "[%s] Unhandled exception on %s %s",
        request_id,
        request.method,
        request.url.path,
        exc_info=exc,
    )
    headers = {"X-Request-ID": request_id} if request_id else {}
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
        headers=headers,
    )


# ── Middleware ────────────────────────────────────────────────────


app.add_middleware(BodySizeLimitMiddleware)
# SlowAPI after RequestTracing so rate-limit keys can use request.state.user_id
# (Starlette runs last-added middleware outermost; RequestTracing is added after
# SlowAPI so it wraps SlowAPI and populates state first.)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(RequestTracingMiddleware)

if settings.is_production:
    if "*" in settings.CORS_ORIGINS or any(
        origin == "*" for origin in settings.CORS_ORIGINS
    ):
        raise ValueError(
            "CORS misconfiguration: Wildcard origins ('*') are not allowed in production when allow_credentials=True."
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
)

# ── Routers ───────────────────────────────────────────────────────

PREFIX = f"/api/{settings.API_VERSION}"

app.include_router(identity_router, prefix=PREFIX)
app.include_router(intake_router, prefix=PREFIX)
app.include_router(matters_router, prefix=PREFIX)
app.include_router(assessment_router, prefix=PREFIX)
app.include_router(matching_router, prefix=PREFIX)
app.include_router(admin_router, prefix=PREFIX)
app.include_router(legal_tools_router, prefix=PREFIX)
app.include_router(notifications_router, prefix=PREFIX)
app.include_router(consultations_router, prefix=PREFIX)
app.include_router(practice_router, prefix=PREFIX)
app.include_router(docket_router, prefix=PREFIX)
app.include_router(system_router, prefix=PREFIX)


# ── System endpoints ──────────────────────────────────────────────


@app.get("/livez", tags=["system"])
async def livez():
    return {"status": "alive"}


@app.get("/readyz", tags=["system"])
async def readyz():
    # 1. Check Supabase DB connectivity
    try:
        from app.shared.database import get_service_role_db

        db = get_service_role_db()
        db.table("profiles").select("id").limit(1).execute()
    except Exception as e:
        log.error("Readiness check failed - Supabase DB unreachable: %s", e)
        raise HTTPException(status_code=503, detail="Database connection failed")

    # 2. Check Redis connectivity (if not using mock memory://)
    if settings.REDIS_URL and not settings.REDIS_URL.startswith("memory://"):
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(settings.REDIS_URL)
            await r.ping()
        except Exception as e:
            log.error("Readiness check failed - Redis unreachable: %s", e)
            raise HTTPException(status_code=503, detail="Redis connection failed")

    return {"status": "ready"}
