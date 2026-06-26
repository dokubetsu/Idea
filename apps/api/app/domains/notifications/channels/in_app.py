from app.domains.notifications.channels.base import BaseNotificationChannel
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster


class InAppChannel(BaseNotificationChannel):
    def send(
        self,
        notification: dict,
        recipient_info: dict,
        rendered_subject: str,
        rendered_body: str,
    ) -> None:
        user_id = recipient_info.get("id") or notification.get("user_id")
        if not user_id:
            raise ValueError("Recipient has no user_id configured")

        # Broadcast the notification to the active SSE queues for this user
        sse_broadcaster.broadcast(user_id, notification)
