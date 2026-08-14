import asyncio
import json
import logging
from typing import Dict, Set
import redis.asyncio as aioredis
from app.config import settings

log = logging.getLogger(__name__)


class SSEBroadcaster:
    def __init__(self):
        # Maps user_id -> Set[asyncio.Queue]
        self._queues: Dict[str, Set[asyncio.Queue]] = {}
        self._redis_client = None
        self._redis_pubsub = None
        self._listener_task = None
        self._background_tasks: Set[asyncio.Task] = set()
        self._use_redis = settings.REDIS_URL and not settings.REDIS_URL.startswith(
            "memory://"
        )

    def _track_task(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        return task

    def init_redis(self):
        if self._use_redis and self._redis_client is None:
            try:
                self._redis_client = aioredis.from_url(settings.REDIS_URL)
                self._redis_pubsub = self._redis_client.pubsub()
                self._listener_task = self._track_task(self._listen_redis())
                log.info("SSEBroadcaster: initialized Redis Pub/Sub")
            except Exception:
                log.exception("SSEBroadcaster: failed to initialize Redis")
                self._use_redis = False

    async def _listen_redis(self):
        log.info("SSEBroadcaster: starting Redis listen loop")
        while True:
            try:
                if self._redis_pubsub:
                    async for message in self._redis_pubsub.listen():
                        if message and message["type"] == "message":
                            channel = message["channel"]
                            if isinstance(channel, bytes):
                                channel = channel.decode()
                            # channel format: user:{user_id}
                            parts = channel.split(":")
                            if len(parts) >= 2:
                                user_id = parts[1]
                                data = message["data"]
                                if isinstance(data, bytes):
                                    data = data.decode()
                                notification = json.loads(data)

                                # Put into local queues
                                queues = self._queues.get(user_id)
                                if queues:
                                    for q in list(queues):
                                        q.put_nowait(notification)
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("SSEBroadcaster: error in Redis listen loop: %s", e)
                await asyncio.sleep(2)

    def subscribe(self, user_id: str) -> asyncio.Queue:
        # Lazy init redis on first subscription since we need a running event loop
        self.init_redis()

        queue: asyncio.Queue = asyncio.Queue()
        if user_id not in self._queues:
            self._queues[user_id] = set()
            if self._use_redis and self._redis_pubsub:
                self._track_task(self._redis_pubsub.subscribe(f"user:{user_id}"))
        self._queues[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue):
        if user_id in self._queues:
            self._queues[user_id].discard(queue)
            if not self._queues[user_id]:
                del self._queues[user_id]
                if self._use_redis and self._redis_pubsub:
                    self._track_task(
                        self._redis_pubsub.unsubscribe(f"user:{user_id}")
                    )

    def broadcast(self, user_id: str, notification: dict):
        if self._use_redis and self._redis_client:
            # Publish to Redis channel with strong reference tracking
            self._track_task(
                self._redis_client.publish(f"user:{user_id}", json.dumps(notification))
            )
        else:
            # Memory only broadcast
            if user_id in self._queues:
                for queue in list(self._queues[user_id]):
                    queue.put_nowait(notification)


sse_broadcaster = SSEBroadcaster()

