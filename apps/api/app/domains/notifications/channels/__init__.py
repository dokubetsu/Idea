from app.domains.notifications.channels.base import BaseNotificationChannel
from app.domains.notifications.channels.in_app import InAppChannel
from app.domains.notifications.channels.email import EmailChannel
from app.domains.notifications.channels.sms import SMSChannel
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster

_CHANNELS = {
    "in_app": InAppChannel(),
    "email": EmailChannel(),
    "sms": SMSChannel(),
}

def get_channel(channel_name: str) -> BaseNotificationChannel:
    channel = _CHANNELS.get(channel_name)
    if not channel:
        raise ValueError(f"Unknown notification channel: {channel_name}")
    return channel
