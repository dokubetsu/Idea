import logging
import asyncio
from typing import List, Optional, Dict, Any
from app.domains.notifications.models import NotificationStatus, DeliveryChannel
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster
from app.domains.notifications.templates import get_template

log = logging.getLogger(__name__)


def get_recipient_info(db, user_id: str) -> dict:
    try:
        profile_resp = db.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = profile_resp.data if profile_resp else None
    except Exception:
        profile = None

    if not profile:
        return {}

    recipient = {
        "id":        user_id,
        "full_name": profile.get("full_name"),
        "phone":     profile.get("phone"),
        "role":      profile.get("role"),
    }

    try:
        auth_user = db.auth.admin.get_user_by_id(user_id)
        if auth_user and auth_user.user:
            recipient["email"] = auth_user.user.email
    except Exception as e:
        log.warning("Could not fetch email from auth admin for user %s: %s", user_id, e)
        recipient["email"] = f"{user_id}@nyay.ai"

    return recipient


def create_notification(
    db,
    user_id: str,
    type_name: str,
    data: Dict[str, Any],
    action: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    # 1. Insert notification record
    notif_data = {
        "user_id": user_id,
        "type":    type_name,
        "data":    data,
        "action":  action,
        "status":  "UNREAD",
    }

    resp = db.table("notifications").insert(notif_data).execute()
    if not resp.data:
        raise RuntimeError("Failed to create notification")

    notification = resp.data[0]
    notif_id     = notification["id"]

    # 2. Resolve channels using user preferences (falls back to defaults)
    from app.domains.notifications.preferences import get_effective_channels
    channels: List[DeliveryChannel] = get_effective_channels(db, user_id, type_name)

    # 3. Pre-render HTML email body and attach to notification payload so
    #    the delivery worker can pass it directly to EmailChannel without
    #    re-instantiating the template.
    try:
        template = get_template(type_name, {**data, "action": action})
        html_body = template.render_html_body()
    except Exception as e:
        log.warning("HTML template render failed for %s: %s", type_name, e)
        html_body = None

    # Stash HTML on the notification dict for the worker (not persisted to DB)
    notification["_html_body"] = html_body

    # 4. Insert delivery records (one per enabled channel)
    deliveries = [
        {"notification_id": notif_id, "channel": ch, "status": "PENDING"}
        for ch in channels
    ]
    if deliveries:
        db.table("notification_deliveries").insert(deliveries).execute()

    # 5. Trigger delivery worker in background
    from app.domains.notifications.worker import trigger_deliveries
    asyncio.create_task(trigger_deliveries(db, notif_id, html_body=html_body))

    return notification


def get_notifications(
    db,
    user_id: str,
    status: Optional[NotificationStatus] = None,
    limit: int = 20,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    query = db.table("notifications").select("*").eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    resp = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return resp.data or []


def mark_as_read(db, notification_id: str, user_id: str) -> Dict[str, Any]:
    resp = (
        db.table("notifications")
        .update({"status": "READ"})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        from app.shared.exceptions import NotFound
        raise NotFound("Notification")
    return resp.data[0]


def mark_all_as_read(db, user_id: str) -> List[Dict[str, Any]]:
    resp = (
        db.table("notifications")
        .update({"status": "READ"})
        .eq("user_id", user_id)
        .eq("status", "UNREAD")
        .execute()
    )
    return resp.data or []
