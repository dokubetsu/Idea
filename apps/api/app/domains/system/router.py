from fastapi import APIRouter, HTTPException, Header
from app.shared.database import get_db
from app.config import settings
from datetime import datetime, timezone, timedelta
import logging

log = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["System"])


def verify_cron_secret(secret: str | None) -> None:
    """
    Validate the X-Cron-Secret header.
    CRON_SECRET is a required setting with no default — see config.py.
    Secrets are passed as headers, not query params, to keep them out of access logs.
    """
    if not secret or secret != settings.CRON_SECRET:
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
    db = get_db()

    # Calculate target time window (next 24 hours)
    now = datetime.now(timezone.utc)
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
        matter_res = db.table("matters").select("user_id, lawyer_id, title").eq("id", matter_id).execute()
        if not matter_res.data:
            continue

        matter = matter_res.data[0]
        recipients = []
        if matter.get("user_id"):
            recipients.append(matter["user_id"])
        if matter.get("lawyer_id"):
            recipients.append(matter["lawyer_id"])

        # Create notification for each recipient
        for recipient_id in recipients:
            db.table("notifications").insert({
                "user_id": recipient_id,
                "type": "hearing_scheduled",
                "data": {
                    "matter_id": matter_id,
                    "matter_title": matter["title"],
                    "hearing_date": h["hearing_date"],
                    "courtroom": h.get("courtroom", ""),
                    "purpose": h.get("purpose", ""),
                    "message": f"Reminder: Upcoming hearing for {matter['title']} tomorrow.",
                },
                "action": {
                    "label": "View Details",
                    "url": f"/matters/{matter_id}",
                },
            }).execute()

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
    db = get_db()

    # 1. Fetch active matters
    matters_res = db.table("matters").select("id, title, user_id").eq("status", "active").execute()
    matters = matters_res.data or []

    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)

    # 2. Resolve the active AI provider via the registry (same path used by run_assessment).
    #    get_ai_provider() returns a real BaseAiProvider — supports .generate(system, user) -> str
    from app.shared.ai.registry import get_ai_provider
    ai_provider = await get_ai_provider()

    sent_count = 0

    for m in matters:
        if not m.get("user_id"):
            continue

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
            continue

        # Format events into a readable block
        events_text = "\n".join(
            f"- {u['profiles']['full_name']} ({u['created_at'][:10]}): {u['content']}"
            for u in updates
            if u.get("profiles")
        )

        # Build prompts and call the provider via the standard BaseAiProvider interface
        system_prompt = (
            "You are a helpful legal case assistant. "
            "Write a brief, friendly 2-3 sentence summary of the case updates provided. "
            "Address the client directly. Emphasize progress and what happens next."
        )
        user_prompt = (
            f"Case: {m['title']}\n\nUpdates from the past week:\n{events_text}\n\n"
            "Summarize these updates for the client in 2-3 friendly sentences."
        )

        try:
            # BaseAiProvider.generate(system_prompt, user_prompt) -> str
            summary_text = await ai_provider.generate(system_prompt, user_prompt, temperature=0.3)
        except Exception as e:
            log.error("Failed to generate weekly summary for matter %s: %s", m["id"], e)
            summary_text = (
                f"You had {len(updates)} update(s) this week on your case. "
                "Please check your matter dashboard for details."
            )

        # Send in-app notification
        db.table("notifications").insert({
            "user_id": m["user_id"],
            "type": "weekly_summary",
            "data": {
                "matter_id": m["id"],
                "matter_title": m["title"],
                "summary": summary_text,
            },
            "action": {
                "label": "View Matter",
                "url": f"/matters/{m['id']}",
            },
        }).execute()

        sent_count += 1

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
    db = get_db()

    now = datetime.now(timezone.utc).isoformat()
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


@router.get("/features")
async def get_features():
    return {
        "consultations": settings.FEATURE_CONSULTATIONS,
        "billing": settings.FEATURE_BILLING,
        "hearings": settings.FEATURE_HEARINGS,
        "milestones": settings.FEATURE_MILESTONES,
        "ai_summaries": settings.FEATURE_AI_SUMMARIES,
    }
