import json
import logging
import threading
import time
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
                # GETDEL is atomic (Redis 6.2+): reads and removes in one round-trip.
                # A separate GET then DELETE has a race window where two workers both
                # read the same ticket before either deletes it.
                val = self.client.getdel(f"sse_ticket:{ticket_id}")
                if val:
                    return json.loads(val)
                return None
            except Exception as e:
                log.error("Failed to pop ticket from Redis: %s", e)
                # Do NOT fall back to local dict in a multi-worker deployment.
                # Returning None fails closed rather than opening a replay window.
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
