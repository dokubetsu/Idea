import pytest
import asyncio
from httpx import AsyncClient
from app.shared.database import get_db
from app.domains.notifications.service import create_notification
from app.domains.notifications.channels.sse_broadcaster import sse_broadcaster


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notifications_flow_integration(client: AsyncClient, mock_user):
    db = get_db()

    # 1. Upsert mock_user profile in the DB so FK constraint passes
    profile_data = {
        "id": mock_user.id,
        "full_name": mock_user.full_name,
        "role": "user",
        "is_active": True,
    }
    db.table("profiles").upsert(profile_data).execute()

    # 2. Subscribe to SSE broadcaster queue
    queue = sse_broadcaster.subscribe(mock_user.id)
    notif_id = None

    try:
        # 3. Create a notification
        notif = create_notification(
            db=db,
            user_id=mock_user.id,
            type_name="hearing_scheduled",
            data={"matter_id": "test-matter-id", "message": "Test hearing alert"},
            action={"label": "View", "url": "/test"},
        )
        notif_id = notif["id"]

        # 4. Assert notification row created
        assert notif_id is not None
        assert notif["status"] == "unread"

        # 5. Check if SSE broadcaster received the event (since trigger_deliveries broadcasts it)
        # Wait a small moment for async task to process
        await asyncio.sleep(0.5)

        # Verify queue has the notification broadcasted
        assert not queue.empty()
        event = queue.get_nowait()
        assert event["id"] == notif_id

        # 6. Verify that a delivery row is created in notification_deliveries
        deliv_res = db.table("notification_deliveries").select("*").eq("notification_id", notif_id).execute()
        assert len(deliv_res.data) > 0

        # 7. Check status transitions via endpoint
        # List notifications
        list_res = await client.get("/api/v1/notifications")
        assert list_res.status_code == 200
        notifs = list_res.json()
        assert any(n["id"] == notif_id for n in notifs)

        # Mark read
        read_res = await client.patch(f"/api/v1/notifications/{notif_id}/read")
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "read"

    finally:
        # Clean up queue subscription and DB rows
        sse_broadcaster.unsubscribe(mock_user.id, queue)
        if notif_id:
            try:
                db.table("notification_deliveries").delete().eq("notification_id", notif_id).execute()
                db.table("notifications").delete().eq("id", notif_id).execute()
                db.table("profiles").delete().eq("id", mock_user.id).execute()
            except Exception:
                pass


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notification_idempotency(mock_user):
    db = get_db()

    # 1. Upsert mock_user profile in the DB so FK constraint passes
    profile_data = {
        "id": mock_user.id,
        "full_name": mock_user.full_name,
        "role": "user",
        "is_active": True,
    }
    db.table("profiles").upsert(profile_data).execute()

    idemp_key = f"idemp_test_notif_{mock_user.id}"
    notif_id1 = None
    notif_id2 = None

    try:
        # Create first notification
        notif1 = create_notification(
            db=db,
            user_id=mock_user.id,
            type_name="hearing_scheduled",
            data={"matter_id": "test-matter-id", "message": "Test hearing alert 1"},
            action={"label": "View", "url": "/test"},
            idempotency_key=idemp_key,
        )
        notif_id1 = notif1["id"]
        assert notif_id1 is not None

        # Create second notification with same idempotency key
        notif2 = create_notification(
            db=db,
            user_id=mock_user.id,
            type_name="hearing_scheduled",
            data={"matter_id": "test-matter-id", "message": "Test hearing alert 2"},
            action={"label": "View", "url": "/test"},
            idempotency_key=idemp_key,
        )
        notif_id2 = notif2["id"]

        # They must be the same notification!
        assert notif_id1 == notif_id2

        # Assert database contains exactly one row with this key
        res = db.table("notifications").select("*").eq("idempotency_key", idemp_key).execute()
        assert len(res.data) == 1

    finally:
        if notif_id1:
            try:
                db.table("notification_deliveries").delete().eq("notification_id", notif_id1).execute()
                db.table("notifications").delete().eq("id", notif_id1).execute()
            except Exception:
                pass
        try:
            db.table("profiles").delete().eq("id", mock_user.id).execute()
        except Exception:
            pass
