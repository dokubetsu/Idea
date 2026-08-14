import hmac
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.shared import database as shared_database

log = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["System"])


def get_service_role_db():
    """Indirection so tests can patch app.shared.database.get_service_role_db."""
    return shared_database.get_service_role_db()


def verify_cron_secret(secret: str | None) -> None:
    """
    Validate the X-Cron-Secret header.
    CRON_SECRET is a required setting with no default — see config.py.
    Secrets are passed as headers, not query params, to keep them out of access logs.
    Uses hmac.compare_digest to prevent timing-attack side-channel leakage.
    """
    if not secret or not hmac.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/cron/hearing-reminders", status_code=200)
async def process_hearing_reminders(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Cron job endpoint to process and send upcoming court hearing reminders.
    Finds hearings occurring in the next 24 hours that haven't had a reminder sent yet.

    Must be called with the header:  X-Cron-Secret: <CRON_SECRET>
    """
    verify_cron_secret(x_cron_secret)
    db = get_service_role_db()

    # Calculate target time window (next 24 hours)
    now = datetime.now(UTC)
    target_time = now + timedelta(hours=24)

    # Fetch upcoming scheduled hearings that need reminders
    response = (
        db.table("hearings")
        .select("id, matter_id, hearing_date, courtroom, judge, purpose")
        .eq("status", "scheduled")
        .eq("reminder_sent", False)
        .gte("hearing_date", now.isoformat())
        .lte("hearing_date", target_time.isoformat())
        .execute()
    )

    hearings = response.data or []
    sent_count = 0

    for h in hearings:
        matter_id = h["matter_id"]
        # Fetch matter to get user/lawyer to notify
        matter_res = (
            db.table("matters")
            .select("user_id, lawyer_id, title")
            .eq("id", matter_id)
            .execute()
        )
        if not matter_res.data:
            continue

        matter = matter_res.data[0]
        recipients = []
        if matter.get("user_id"):
            recipients.append(matter["user_id"])
        if matter.get("lawyer_id"):
            recipients.append(matter["lawyer_id"])

        # Route through create_notification() so that user preferences,
        # delivery channels, and idempotency logic are applied.
        from app.domains.notifications.service import create_notification

        for recipient_id in recipients:
            create_notification(
                db,
                user_id=recipient_id,
                type_name="hearing_scheduled",
                data={
                    "matter_id": matter_id,
                    "matter_title": matter["title"],
                    "hearing_date": h["hearing_date"],
                    "courtroom": h.get("courtroom", ""),
                    "purpose": h.get("purpose", ""),
                    "message": f"Reminder: Upcoming hearing for {matter['title']} tomorrow.",
                },
                action={
                    "label": "View Details",
                    "url": f"/matters/{matter_id}",
                },
            )

        # Mark reminder as sent
        db.table("hearings").update({"reminder_sent": True}).eq("id", h["id"]).execute()
        sent_count += 1

    log.info("Hearing Reminders Cron: Processed %d reminders.", sent_count)
    return {"status": "success", "reminders_sent": sent_count}


@router.post("/cron/weekly-summaries", status_code=200)
async def process_weekly_summaries(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Cron job endpoint to generate and send weekly AI summaries to clients.
    Finds active matters, gathers events from the last 7 days, and uses AI to summarize.

    Must be called with the header:  X-Cron-Secret: <CRON_SECRET>
    """
    verify_cron_secret(x_cron_secret)
    db = get_service_role_db()

    # 1. Fetch active matters
    matters_res = (
        db.table("matters")
        .select("id, title, user_id")
        .eq("status", "active")
        .execute()
    )
    matters = matters_res.data or []

    now = datetime.now(UTC)
    one_week_ago = now - timedelta(days=7)

    # 2. Resolve the active AI provider via the registry (same path used by run_assessment).
    #    get_ai_provider() returns a real BaseAiProvider — supports .generate(system, user) -> str
    from app.shared.ai.registry import get_ai_provider

    # System/cron budget is isolated from end-user daily limits
    ai_provider = await get_ai_provider(user_id="system:weekly_summaries")

    async def process_matter(m):
        if not m.get("user_id"):
            return False

        # Gather non-internal updates in the past week
        updates_res = (
            db.table("matter_updates")
            .select("content, is_internal, created_at, profiles(full_name)")
            .eq("matter_id", m["id"])
            .eq("is_internal", False)
            .gte("created_at", one_week_ago.isoformat())
            .execute()
        )

        updates = updates_res.data or []
        if not updates:
            return False

        from app.shared.ai.prompt import PromptBuilder

        # Build prompts via PromptBuilder with base64 encoding to prevent prompt injection
        context = {"title": m["title"], "updates": updates}
        try:
            system_prompt, user_prompt = PromptBuilder.build(
                "weekly_summary", context, version="v1"
            )
        except Exception as e:
            log.error("Failed to build weekly summary prompt: %s", e)
            return False

        try:
            # BaseAiProvider.generate(system_prompt, user_prompt) -> str
            summary_text = await ai_provider.generate(
                system_prompt, user_prompt, temperature=0.3
            )
        except Exception as e:
            log.error("Failed to generate weekly summary for matter %s: %s", m["id"], e)
            summary_text = (
                f"You had {len(updates)} update(s) this week on your case. "
                "Please check your matter dashboard for details."
            )

        # Route through create_notification() so that user preferences,
        # delivery channels, and idempotency logic are applied.
        from app.domains.notifications.service import create_notification

        create_notification(
            db,
            user_id=m["user_id"],
            type_name="weekly_summary",
            data={
                "matter_id": m["id"],
                "matter_title": m["title"],
                "summary": summary_text,
            },
            action={
                "label": "View Matter",
                "url": f"/matters/{m['id']}",
            },
        )
        return True

    import asyncio

    tasks = [process_matter(m) for m in matters]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    sent_count = sum(1 for r in results if r is True)

    log.info("Weekly Summaries Cron: Processed %d summaries.", sent_count)
    return {"status": "success", "summaries_sent": sent_count}


@router.post("/cron/cleanup-sessions", status_code=200)
async def cleanup_intake_sessions(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    FIX N: Replace in-process asyncio.sleep(21600) cleanup loop with a proper
    HTTP cron endpoint. Call this from Render's cron job, GitHub Actions
    scheduler, or any external cron every 6 hours.

    Schedule example (Render):  0 */6 * * *
    Must be called with:  X-Cron-Secret: <CRON_SECRET>

    Deletes uncommitted intake sessions whose `expires_at` has passed.
    """
    verify_cron_secret(x_cron_secret)
    db = get_service_role_db()

    now = datetime.now(UTC).isoformat()
    result = (
        db.table("intake_sessions")
        .delete()
        .eq("is_committed", False)
        .lt("expires_at", now)
        .execute()
    )
    deleted = len(result.data) if result.data else 0
    log.info("Session Cleanup Cron: Deleted %d expired sessions.", deleted)
    return {"status": "success", "sessions_deleted": deleted}


@router.post("/cron/retry-stale-deliveries", status_code=200)
async def retry_stale_deliveries(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Finds notification deliveries that are still "pending" after 5 minutes,
    and retries triggering their delivery.
    """
    verify_cron_secret(x_cron_secret)
    db = get_service_role_db()

    # Find deliveries stuck in 'pending' status created > 5 minutes ago
    five_minutes_ago = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()

    response = (
        db.table("notification_deliveries")
        .select("id, notification_id")
        .eq("status", "pending")
        .lt("created_at", five_minutes_ago)
        .execute()
    )

    stale_deliveries = response.data or []
    if not stale_deliveries:
        return {"status": "success", "retried_count": 0}

    # Group by notification_id to avoid redundant fetches
    notification_ids = set(d["notification_id"] for d in stale_deliveries)

    import asyncio

    from app.domains.notifications.worker import trigger_deliveries

    tasks = [
        trigger_deliveries(db, notification_id) for notification_id in notification_ids
    ]
    await asyncio.gather(*tasks, return_exceptions=True)

    return {
        "status": "success",
        "retried_count": len(stale_deliveries),
        "notifications_count": len(notification_ids),
    }


@router.post("/cron/mark-invoices-overdue", status_code=200)
async def mark_invoices_overdue_cron(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Flip invoices with status=sent and due_date < today to overdue.
    Schedule daily, e.g. 0 1 * * *
    """
    verify_cron_secret(x_cron_secret)
    db = get_service_role_db()
    today = datetime.now(UTC).date().isoformat()
    try:
        res = db.rpc("mark_invoices_overdue", {"p_as_of": today}).execute()
        raw = res.data
        if isinstance(raw, int):
            count = raw
        elif isinstance(raw, list) and raw:
            count = int(
                raw[0] if not isinstance(raw[0], dict) else raw[0].get("count", 0)
            )
        elif isinstance(raw, dict):
            count = int(raw.get("count", 0))
        else:
            count = int(raw or 0)
    except Exception as e:
        log.warning("mark_invoices_overdue RPC failed (%s); using fallback", e)
        # Fallback: multi-step update
        result = (
            db.table("invoices")
            .update({"status": "overdue"})
            .eq("status", "sent")
            .lt("due_date", today)
            .execute()
        )
        count = len(result.data) if result.data else 0

    log.info("Invoice overdue cron: marked %s invoice(s)", count)
    return {"status": "success", "invoices_marked_overdue": count}


@router.get("/features")
async def get_features():
    return {
        "consultations": settings.FEATURE_CONSULTATIONS,
        "billing": settings.FEATURE_BILLING,
        "hearings": settings.FEATURE_HEARINGS,
        "milestones": settings.FEATURE_MILESTONES,
        "ai_summaries": settings.FEATURE_AI_SUMMARIES,
        "practice": settings.FEATURE_PRACTICE,
    }
