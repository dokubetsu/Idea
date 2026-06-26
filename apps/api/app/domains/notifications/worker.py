import logging
from datetime import datetime, timezone
from typing import Optional

from app.domains.notifications.templates import get_template
from app.domains.notifications.channels import get_channel
from app.domains.notifications.service import get_recipient_info

log = logging.getLogger(__name__)


async def trigger_deliveries(db, notification_id: str, html_body: Optional[str] = None):
    """
    Background worker that processes pending deliveries for a specific notification.

    html_body: pre-rendered HTML string from service.py (avoids re-rendering the template).
               If None, falls back to re-rendering from the template at delivery time.
    """
    try:
        # 1. Fetch notification
        notif_resp = (
            db.table("notifications").select("*").eq("id", notification_id).execute()
        )
        if not notif_resp.data:
            log.error("Notification %s not found for delivery", notification_id)
            return
        notification = notif_resp.data[0]

        # 2. Fetch pending deliveries
        deliv_resp = (
            db.table("notification_deliveries")
            .select("*")
            .eq("notification_id", notification_id)
            .eq("status", "pending")
            .execute()
        )
        deliveries = deliv_resp.data or []
        if not deliveries:
            return

        # 3. Resolve template and recipient info
        template = get_template(notification["type"], notification["data"])
        recipient = get_recipient_info(db, notification["user_id"])

        try:
            subject = template.render_subject()
            body = template.render_body()
            # Use pre-rendered HTML if provided; otherwise render now
            if html_body is None:
                html_body = template.render_html_body()
        except Exception as te:
            log.error(
                "Failed to render template for notification %s: %s", notification_id, te
            )
            subject = "LeAd Update"
            body = "You have a new update on your case."
            html_body = None

        # Attach HTML body so EmailChannel can pick it up
        notification["_html_body"] = html_body

        # 4. Dispatch to channels
        for deliv in deliveries:
            channel_name = deliv["channel"]
            try:
                channel = get_channel(channel_name)
                channel.send(notification, recipient, subject, body)

                db.table("notification_deliveries").update(
                    {
                        "status": "sent",
                        "delivered_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", deliv["id"]).execute()

            except Exception as e:
                log.exception(
                    "Failed to deliver notification %s via %s: %s",
                    notification_id,
                    channel_name,
                    e,
                )
                db.table("notification_deliveries").update(
                    {
                        "status": "failed",
                        "error_msg": str(e),
                    }
                ).eq("id", deliv["id"]).execute()

    except Exception as exc:
        log.exception(
            "Error running trigger_deliveries for notification %s: %s",
            notification_id,
            exc,
        )
