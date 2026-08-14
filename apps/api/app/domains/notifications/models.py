from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

NotificationStatus = Literal["unread", "read", "dismissed"]
DeliveryChannel = Literal["email", "sms", "in_app"]
DeliveryStatus = Literal["pending", "sent", "failed"]


class ActionModel(BaseModel):
    label: str
    url: str


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    data: dict[str, Any] = Field(default_factory=dict)
    action: ActionModel | None = None
    idempotency_key: str | None = None


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    data: dict[str, Any]
    action: ActionModel | None = None
    status: NotificationStatus
    created_at: datetime
    idempotency_key: str | None = None


class NotificationDeliveryOut(BaseModel):
    id: str
    notification_id: str
    channel: DeliveryChannel
    status: DeliveryStatus
    error_msg: str | None = None
    delivered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
