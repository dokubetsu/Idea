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
        headers = dict(scope.get("headers", []))
        req_id_bytes = headers.get(b"x-request-id", b"")
        req_id = req_id_bytes.decode("utf-8") if req_id_bytes else str(uuid.uuid4())
        request_id_var.set(req_id)

        start_time = time.time()
        path = scope.get("path", "")
        method = scope.get("method", "WS")

        log.info("[%s] Request started: %s %s", req_id, method, path)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # Add X-Request-ID header to response
                headers_list = list(message.get("headers", []))
                headers_list.append((b"x-request-id", req_id.encode("utf-8")))
                message["headers"] = headers_list

                # Log completion on response start
                duration = (time.time() - start_time) * 1000
                status_code = message.get("status", 200)
                log.info(
                    "[%s] Request completed: %s %s - Status: %s - Duration: %.2fms",
                    req_id, method, path, status_code, duration
                )
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            log.error(
                "[%s] Request failed: %s %s - Error: %s - Duration: %.2fms",
                req_id, method, path, str(e), duration, exc_info=True
            )
            raise

