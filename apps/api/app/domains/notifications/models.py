from __future__ import annotations
from datetime import datetime
from typing import Literal, Dict, Any, Optional
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
    data: Dict[str, Any] = Field(default_factory=dict)
    action: Optional[ActionModel] = None
    idempotency_key: Optional[str] = None


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    data: Dict[str, Any]
    action: Optional[ActionModel] = None
    status: NotificationStatus
    created_at: datetime
    idempotency_key: Optional[str] = None


class NotificationDeliveryOut(BaseModel):
    id: str
    notification_id: str
    channel: DeliveryChannel
    status: DeliveryStatus
    error_msg: Optional[str] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
