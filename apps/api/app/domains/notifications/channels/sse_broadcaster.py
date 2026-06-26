import asyncio
from typing import Dict, Set


class SSEBroadcaster:
    def __init__(self):
        # Maps user_id -> Set[asyncio.Queue]
        self._queues: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, user_id: str) -> asyncio.Queue:
        queue = asyncio.Queue()
        if user_id not in self._queues:
            self._queues[user_id] = set()
        self._queues[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue):
        if user_id in self._queues:
            self._queues[user_id].discard(queue)
            if not self._queues[user_id]:
                del self._queues[user_id]

    def broadcast(self, user_id: str, notification: dict):
        if user_id in self._queues:
            for queue in self._queues[user_id]:
                queue.put_nowait(notification)


sse_broadcaster = SSEBroadcaster()
