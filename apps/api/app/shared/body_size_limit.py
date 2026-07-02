import logging
from starlette.types import ASGIApp, Scope, Receive, Send, Message

log = logging.getLogger("app.body_size_limit")


class SizeLimitError(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_content_length: int = 1024 * 1024):
        self.app = app
        self.max_content_length = max_content_length

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        content_length_bytes = headers.get(b"content-length")
        path = scope.get("path", "")

        # Enforce 64KB limit for webhooks and cron triggers, 1MB for all others
        limit = (
            64 * 1024
            if "webhook" in path or "/cron/" in path
            else self.max_content_length
        )

        if content_length_bytes:
            try:
                content_length = int(content_length_bytes)
                if content_length > limit:
                    await self._send_413(send)
                    return
            except ValueError:
                await self._send_400(send)
                return

        # Enforce limit dynamically during stream read
        total_size = 0

        async def receive_with_limit() -> Message:
            nonlocal total_size
            message = await receive()
            if message["type"] == "http.request":
                body = message.get("body", b"")
                total_size += len(body)
                if total_size > limit:
                    raise SizeLimitError()
            return message

        try:
            await self.app(scope, receive_with_limit, send)
        except SizeLimitError:
            log.warning(
                "Request body size exceeded limit of %d bytes on path: %s", limit, path
            )
            await self._send_413(send)
        except Exception:
            raise

    async def _send_413(self, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b'{"detail": "Payload too large"}',
                "more_body": False,
            }
        )

    async def _send_400(self, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 400,
                "headers": [
                    (b"content-type", b"application/json"),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b'{"detail": "Invalid Content-Length header"}',
                "more_body": False,
            }
        )
