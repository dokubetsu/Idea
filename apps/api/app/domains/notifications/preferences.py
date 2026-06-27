"""
Notification delivery preferences CRUD.

Each user can opt-out of specific (type, channel) combinations.
When no preference row exists, the default TYPE_CHANNELS map is used (opt-in by default).
"""

import logging
from typing import Dict, List

from app.domains.notifications.models import DeliveryChannel

log = logging.getLogger(__name__)

# Default channels per notification type (used when no preference row exists)
DEFAULT_CHANNELS: Dict[str, List[DeliveryChannel]] = {
    "matter_assigned": ["in_app", "email", "sms"],
    "hearing_scheduled": ["in_app", "email", "sms"],
    "milestone_completed": ["in_app", "email"],
    "comment_added": ["in_app", "email"],
    "generic": ["in_app", "email"],
}


def get_preferences(db, user_id: str) -> List[dict]:
    """Return all preference rows for a user."""
    resp = (
        db.table("notification_preferences")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data or []


def upsert_preference(
    db, user_id: str, type_name: str, channel: str, enabled: bool
) -> dict:
    """Create or update a single preference row."""
    resp = (
        db.table("notification_preferences")
        .upsert(
            {
                "user_id": user_id,
                "type": type_name,
                "channel": channel,
                "enabled": enabled,
            },
            on_conflict="user_id,type,channel",
        )
        .execute()
    )
    if not resp.data:
        raise RuntimeError("Failed to upsert notification preference")
    return resp.data[0]


def bulk_upsert_preferences(db, user_id: str, updates: List[Dict]) -> List[dict]:
    """
    Bulk-update preferences.
    Each entry: {"type": str, "channel": str, "enabled": bool}
    """
    rows = [
        {
            "user_id": user_id,
            "type": u["type"],
            "channel": u["channel"],
            "enabled": u["enabled"],
        }
        for u in updates
    ]
    resp = (
        db.table("notification_preferences")
        .upsert(rows, on_conflict="user_id,type,channel")
        .execute()
    )
    return resp.data or []


def get_effective_channels(db, user_id: str, type_name: str) -> List[DeliveryChannel]:
    """
    Resolve the list of channels to use for a delivery, applying user preferences.

    Logic:
    - Start with the DEFAULT_CHANNELS for this type.
    - For each channel, check if a preference row exists.
      - If it exists and enabled=False  → remove the channel.
      - If it exists and enabled=True   → keep it.
      - If no row exists                → use the default (keep it).
    - IN_APP is always included (cannot be opted out of).
    """
    defaults = list(DEFAULT_CHANNELS.get(type_name, ["in_app", "email"]))

    # Fetch only rows for this user + type to keep the query tight
    resp = (
        db.table("notification_preferences")
        .select("channel,enabled")
        .eq("user_id", user_id)
        .eq("type", type_name)
        .execute()
    )
    prefs: Dict[str, bool] = {
        row["channel"]: row["enabled"] for row in (resp.data or [])
    }

    effective: List[DeliveryChannel] = []
    for ch in defaults:
        if ch == "in_app":
            effective.append(ch)  # always on
        elif prefs.get(ch, True):  # default True when no row
            effective.append(ch)

    return effective
