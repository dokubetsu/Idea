import pytest
import asyncio
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app
from app.shared.events import emit, EventType, _subscribers
from app.domains.notifications.subscriber import init_subscriber
from app.domains.notifications.service import create_notification, get_notifications, mark_as_read, mark_all_as_read
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster

@pytest.fixture
def test_user():
    return CurrentUser(id="test-user-id", role=UserRole.USER, full_name="Test Petitioner")

@pytest.fixture(autouse=True)
def cleanup_subscribers():
    original = list(_subscribers)
    yield
    _subscribers.clear()
    _subscribers.extend(original)

@pytest.fixture
def patch_notifications_db(mock_db, monkeypatch):
    # Setup tables in mock_db
    mock_db.table("notifications")
    mock_db.table("notification_deliveries")
    mock_db.table("matters")
    mock_db.table("profiles")
    mock_db.table("events")


    # Patch execute and insert methods to mimic database return behavior
    for table_name in ["notifications", "notification_deliveries", "matters", "profiles", "events"]:
        table = mock_db.table(table_name)

        def make_execute(tbl):
            orig_execute = tbl.execute
            def mock_execute(*args, **kwargs):
                res = orig_execute(*args, **kwargs)
                is_single = any(q[0] == "single" for q in tbl.queries)
                if is_single and isinstance(res.data, list):
                    if res.data:
                        res.data = res.data[0]
                    else:
                        res.data = None
                return res
            return mock_execute
        monkeypatch.setattr(table, "execute", make_execute(table))

        def make_insert(tbl):
            orig_insert = tbl.insert
            def mock_insert(data, *args, **kwargs):
                # Ensure we populate mock fields
                if isinstance(data, dict):
                    if "id" not in data:
                        data["id"] = f"mock-{tbl.name}-id"
                    if "created_at" not in data:
                        data["created_at"] = "2026-06-13T12:00:00Z"
                    if "updated_at" not in data:
                        data["updated_at"] = "2026-06-13T12:00:00Z"
                elif isinstance(data, list):
                    for idx, row in enumerate(data):
                        if "id" not in row:
                            row["id"] = f"mock-{tbl.name}-{idx}-id"
                        if "created_at" not in row:
                            row["created_at"] = "2026-06-13T12:00:00Z"
                        if "updated_at" not in row:
                            row["updated_at"] = "2026-06-13T12:00:00Z"
                orig_insert(data, *args, **kwargs)
                return tbl
            return mock_insert
        monkeypatch.setattr(table, "insert", make_insert(table))

        # Patch order method
        def make_order(tbl):
            def mock_order(column, *args, **kwargs):
                tbl.queries.append(("order", column, args, kwargs))
                return tbl
            return mock_order
        monkeypatch.setattr(table, "order", make_order(table), raising=False)

        # Patch range method
        def make_range(tbl):
            def mock_range(start, end, *args, **kwargs):
                tbl.queries.append(("range", start, end))
                return tbl
            return mock_range
        monkeypatch.setattr(table, "range", make_range(table), raising=False)

@pytest.mark.asyncio
async def test_create_notification_success(mock_db, patch_notifications_db, test_user, monkeypatch):
    # Setup mock profile
    mock_db.table("profiles").data = [{"id": "test-user-id", "full_name": "Test Petitioner"}]
    
    # Mock auth.admin fetch
    class MockUserObj:
        email = "test@example.com"
    class MockAuthUser:
        user = MockUserObj()
    monkeypatch.setattr(mock_db.auth.admin, "get_user_by_id", lambda uid: MockAuthUser(), raising=False)

    # Create notification
    notif = create_notification(
        mock_db,
        user_id="test-user-id",
        type_name="matter_assigned",
        data={"matter_title": "Cheque Case", "lawyer_name": "Ad. Patil"},
        action={"label": "View Case", "url": "/user/matters/1"}
    )

    assert notif["id"] == "mock-notifications-id"
    assert notif["user_id"] == "test-user-id"
    assert notif["type"] == "matter_assigned"
    assert notif["status"] == "UNREAD"

    # Check that delivery rows were created
    deliveries = mock_db.table("notification_deliveries").data
    assert len(deliveries) > 0
    assert deliveries[0]["notification_id"] == "mock-notifications-id"

@pytest.mark.asyncio
async def test_get_and_mark_read(mock_db, patch_notifications_db, test_user):
    mock_db.table("notifications").data = [
        {
            "id": "notif-1",
            "user_id": "test-user-id",
            "type": "milestone_completed",
            "data": {},
            "status": "UNREAD",
            "created_at": "2026-06-13T12:00:00Z"
        }
    ]

    notifs = get_notifications(mock_db, "test-user-id", status="UNREAD")
    assert len(notifs) == 1
    assert notifs[0]["id"] == "notif-1"

    # Mark as read
    updated = mark_as_read(mock_db, "notif-1", "test-user-id")
    assert updated["status"] == "READ"

@pytest.mark.asyncio
async def test_event_subscriber_integration(mock_db, patch_notifications_db, test_user, monkeypatch):
    # Register subscriber
    init_subscriber()
    
    # Setup mock data for matters
    mock_db.table("matters").data = [{
        "id": "mock-matter-id",
        "title": "Cheque Bounce Matter",
        "user_id": "test-user-id",
        "lawyer_id": "test-lawyer-id"
    }]
    mock_db.table("profiles").data = [{"id": "test-user-id", "full_name": "Test Petitioner"}]

    # Mock auth.admin fetch
    class MockUserObj:
        email = "test@example.com"
    class MockAuthUser:
        user = MockUserObj()
    monkeypatch.setattr(mock_db.auth.admin, "get_user_by_id", lambda uid: MockAuthUser(), raising=False)

    # Trigger hearing.scheduled event
    await emit(
        EventType.HEARING_SCHEDULED,
        actor_id="test-lawyer-id",
        matter_id="mock-matter-id",
        payload={"hearing_date": "2026-07-01T10:00:00Z", "courtroom": "Room 5"}
    )

    # Allow async tasks to run
    await asyncio.sleep(0.1)

    # Verify that notifications table has new records
    notifications = mock_db.table("notifications").data
    assert len(notifications) > 0
    # Should have notifications for both client and lawyer
    assert any(n["user_id"] == "test-user-id" for n in notifications)
    assert any(n["user_id"] == "test-lawyer-id" for n in notifications)

@pytest.mark.asyncio
async def test_sse_broadcaster(test_user):
    queue = sse_broadcaster.subscribe("test-user-id")
    
    notif_data = {"id": "n-123", "type": "comment_added", "user_id": "test-user-id"}
    sse_broadcaster.broadcast("test-user-id", notif_data)
    
    received = await queue.get()
    assert received["id"] == "n-123"
    
    sse_broadcaster.unsubscribe("test-user-id", queue)


# ── NEW: Channel mock-fallback tests ──────────────────────────────────────────

def test_email_channel_mock_fallback(caplog, monkeypatch):
    """When RESEND_API_KEY is absent, EmailChannel logs to console without raising."""
    from app.domains.notifications.channels.email import EmailChannel
    from app import config as cfg_module

    # Ensure no API key set
    monkeypatch.setattr(cfg_module.settings, "RESEND_API_KEY", "")

    channel = EmailChannel()
    import logging
    with caplog.at_level(logging.INFO):
        channel.send(
            notification={"id": "n-1", "type": "matter_assigned"},
            recipient_info={"email": "client@example.com"},
            rendered_subject="Test Subject",
            rendered_body="Test body text.",
        )

    # Should have logged the mock outbox message
    assert any("MOCK EMAIL OUTBOX" in r.message for r in caplog.records)


def test_sms_channel_mock_fallback(caplog, monkeypatch):
    """When TWILIO_ACCOUNT_SID is absent, SMSChannel logs to console without raising."""
    from app.domains.notifications.channels.sms import SMSChannel
    from app import config as cfg_module

    monkeypatch.setattr(cfg_module.settings, "TWILIO_ACCOUNT_SID", "")
    monkeypatch.setattr(cfg_module.settings, "TWILIO_AUTH_TOKEN", "")

    channel = SMSChannel()
    import logging
    with caplog.at_level(logging.INFO):
        channel.send(
            notification={"id": "n-2", "type": "hearing_scheduled"},
            recipient_info={"phone": "+919999999999"},
            rendered_subject="Hearing Alert",
            rendered_body="Your hearing is on 1 July.",
        )

    assert any("MOCK SMS OUTBOX" in r.message for r in caplog.records)


def test_get_effective_channels_applies_preferences(mock_db, monkeypatch):
    """Disabled EMAIL preference for a type removes EMAIL from effective channels."""
    from app.domains.notifications.preferences import get_effective_channels

    # Simulate a preference row: EMAIL disabled for matter_assigned
    mock_db.table("notification_preferences").data = [
        {"channel": "EMAIL", "enabled": False},
    ]

    channels = get_effective_channels(mock_db, "test-user-id", "matter_assigned")

    # IN_APP must always be present; EMAIL must be absent
    assert "IN_APP" in channels
    assert "EMAIL" not in channels


def test_get_effective_channels_defaults_when_no_prefs(mock_db, monkeypatch):
    """When no preference rows exist, all default channels are returned."""
    from app.domains.notifications.preferences import get_effective_channels, DEFAULT_CHANNELS

    # Return empty preferences
    mock_db.table("notification_preferences").data = []

    channels = get_effective_channels(mock_db, "test-user-id", "matter_assigned")
    defaults = DEFAULT_CHANNELS["matter_assigned"]

    # All default channels should be present
    for ch in defaults:
        assert ch in channels

