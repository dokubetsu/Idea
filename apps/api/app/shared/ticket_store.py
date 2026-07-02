import time
import json
import logging
import threading
import typing
from app.config import settings

log = logging.getLogger("app.ticket_store")


class RedisTicketStore:
    client: typing.Any

    def __init__(self, redis_url: str):
        self.use_redis = False
        self._lock = threading.Lock()

        if redis_url and redis_url.startswith(("redis://", "rediss://")):
            try:
                import redis  # type: ignore[import-untyped]

                self.client = redis.from_url(redis_url, decode_responses=True)
                self.use_redis = True
                log.info(
                    "Successfully connected to Redis ticket store at %s", redis_url
                )
            except ImportError:
                log.warning(
                    "redis package not installed. Falling back to in-memory ticket store."
                )
            except Exception as e:
                log.error(
                    "Failed to connect to Redis ticket store: %s. Falling back to in-memory.",
                    e,
                )

        if not self.use_redis:
            self.tickets: dict[str, typing.Any] = {}

    def set_ticket(self, ticket_id: str, data: dict, expiry: int) -> None:
        if self.use_redis:
            try:
                self.client.setex(f"sse_ticket:{ticket_id}", expiry, json.dumps(data))
            except Exception as e:
                log.error("Failed to set ticket in Redis: %s. Storing in-memory.", e)
                # Fallback to local memory dictionary on Redis connection error
                with self._lock:
                    self.tickets[ticket_id] = {
                        **data,
                        "expires_at": time.time() + expiry,
                    }
        else:
            with self._lock:
                self.tickets[ticket_id] = {**data, "expires_at": time.time() + expiry}
                # Clean up expired tickets on write
                now = time.time()
                expired = [k for k, v in self.tickets.items() if now > v["expires_at"]]
                for k in expired:
                    self.tickets.pop(k, None)

    def pop_ticket(self, ticket_id: str) -> dict | None:
        if self.use_redis:
            try:
                val = self.client.get(f"sse_ticket:{ticket_id}")
                if val:
                    self.client.delete(f"sse_ticket:{ticket_id}")
                    return json.loads(val)
                # Check local dict in case of earlier fallback
                with self._lock:
                    ticket_data = self.tickets.pop(ticket_id, None)
                    if ticket_data and time.time() <= ticket_data["expires_at"]:
                        return ticket_data
                return None
            except Exception as e:
                log.error("Failed to pop ticket from Redis: %s", e)
                with self._lock:
                    ticket_data = self.tickets.pop(ticket_id, None)
                    if ticket_data and time.time() <= ticket_data["expires_at"]:
                        return ticket_data
                return None
        else:
            with self._lock:
                ticket_data = self.tickets.pop(ticket_id, None)
                if ticket_data:
                    if time.time() > ticket_data["expires_at"]:
                        return None
                    return ticket_data
                return None


ticket_store = RedisTicketStore(settings.REDIS_URL)
