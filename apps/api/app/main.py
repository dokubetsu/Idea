"""
LeAd Platform — FastAPI application bootstrap.

Startup sequence:
1. Load settings → validate env vars
2. Verify Supabase connection
3. Register middleware (CORS, trusted hosts)
4. Register domain routers
5. Register lifecycle events
"""

from contextlib import asynccontextmanager
import logging
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.config import settings
from app.shared.limiter import limiter
from app.shared.middleware import RequestTracingMiddleware, request_id_var
from app.domains.identity.router import router as identity_router
from app.domains.intake.router import router as intake_router
from app.domains.matters.router import router as matters_router
from app.domains.assessment.router import router as assessment_router
from app.domains.matching.router import router as matching_router
from app.domains.admin.router import router as admin_router
from app.domains.legal_tools.router import router as legal_tools_router
from app.domains.notifications.router import router as notifications_router
from app.domains.consultations.router import router as consultations_router
from app.domains.system.router import router as system_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger(__name__)

# FIX N: Removed in-process asyncio.sleep(21600) cleanup loop.
# Session cleanup is now a proper HTTP cron endpoint: POST /api/v1/system/cron/cleanup-sessions
# Call it from Render, GitHub Actions cron, or any external scheduler every 6 hours.


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    from app.shared.database import get_db
    from app.domains.assessment.service import get_provider
    from app.domains.notifications.subscriber import init_subscriber

    init_subscriber()

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
        get_db().table("profiles").select("id").limit(1).execute()
        log.info("✅ Supabase connection verified")
    except Exception as exc:
        log.warning("⚠️  Supabase check failed: %s", exc)

    provider = get_provider()
    log.info("✅ Assessment provider: %s", provider.name)

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

# Register rate limiter instance and handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))


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


app.add_middleware(RequestTracingMiddleware)

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
app.include_router(system_router, prefix=PREFIX)


# ── System endpoints ──────────────────────────────────────────────


@app.get("/health", tags=["system"])
async def health():
    response = {"status": "ok", "version": "1.0.0"}
    if not settings.is_production:
        response["env"] = settings.APP_ENV
    return response
