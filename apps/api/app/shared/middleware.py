import time
import uuid
import logging
from contextvars import ContextVar
from starlette.types import ASGIApp, Scope, Receive, Send

# ContextVar to store request ID for loggers
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

log = logging.getLogger("app.request_tracing")


class RequestTracingMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        # Try to find headers
        import re

        headers = dict(scope.get("headers", []))
        req_id_bytes = headers.get(b"x-request-id", b"")
        raw_id = req_id_bytes.decode("utf-8").strip() if req_id_bytes else ""

        # Enforce validation to restrict characters to alphanumeric/hyphens/underscores, max length 120
        if raw_id and re.match(r"^[\w\-]{1,120}$", raw_id):
            req_id = raw_id
        else:
            req_id = str(uuid.uuid4())

        request_id_var.set(req_id)

        # Check for Authorization header
        auth_bytes = headers.get(b"authorization", b"")
        auth_str = auth_bytes.decode("utf-8") if auth_bytes else ""
        token = None
        if auth_str.lower().startswith("bearer "):
            token = auth_str[7:].strip()

        # Securely decode and verify token to populate user_id on state
        user_id = None
        if token:
            try:
                from app.shared.jwt import decode_token

                payload = decode_token(token)
                user_id = payload.get("sub")
            except Exception:
                pass

        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["user_id"] = user_id

        from app.shared.database import create_client, set_request_db, clear_request_db
        from app.config import settings

        import sys

        # Create request-scoped client (using anon key to respect RLS)
        if "pytest" in sys.modules:
            from app.shared.database import get_test_db

            user_client = get_test_db()
        else:
            user_client = create_client(
                settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY
            )
            if token:
                user_client.postgrest.auth(token)

        ctx_token = set_request_db(user_client)

        start_time = time.time()
        path = scope.get("path", "")
        method = scope.get("method", "WS")

        log.info("[%s] Request started: %s %s", req_id, method, path)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Add X-Request-ID header to response
                headers_list = list(message.get("headers", []))
                headers_list.append((b"x-request-id", req_id.encode("utf-8")))
                headers_list.append(
                    (
                        b"strict-transport-security",
                        b"max-age=63072000; includeSubDomains; preload",
                    )
                )
                headers_list.append(
                    (
                        b"content-security-policy",
                        b"default-src 'none'; frame-ancestors 'none'",
                    )
                )
                headers_list.append((b"x-frame-options", b"DENY"))
                headers_list.append((b"x-content-type-options", b"nosniff"))
                headers_list.append((b"x-xss-protection", b"0"))
                headers_list.append(
                    (b"referrer-policy", b"strict-origin-when-cross-origin")
                )
                message["headers"] = headers_list

                # Log completion on response start
                duration = (time.time() - start_time) * 1000
                status_code = message.get("status", 200)
                log.info(
                    "[%s] Request completed: %s %s - Status: %s - Duration: %.2fms",
                    req_id,
                    method,
                    path,
                    status_code,
                    duration,
                )
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            log.error(
                "[%s] Request failed: %s %s - Error: %s - Duration: %.2fms",
                req_id,
                method,
                path,
                str(e),
                duration,
                exc_info=True,
            )
            raise
        finally:
            clear_request_db(ctx_token)
