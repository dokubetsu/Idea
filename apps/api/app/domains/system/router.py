from fastapi import APIRouter, HTTPException, Security, Depends
from pydantic import BaseModel
from typing import Dict, Any
from app.shared.database import get_db
from app.config import settings
from datetime import datetime, timezone, timedelta
import logging

log = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["System"])

# Protect cron endpoints using a secret header
def verify_cron_secret(cron_secret: str):
    if not cron_secret or cron_secret != getattr(settings, "CRON_SECRET", "super_secret_cron_key"):
        raise HTTPException(status_code=401, detail="Invalid cron secret")
    return True

@router.post("/cron/hearing-reminders", status_code=200)
async def process_hearing_reminders(secret: str):
    """
    Cron job endpoint to process and send upcoming court hearing reminders.
    Finds hearings occurring in the next 24 hours that haven't had a reminder sent yet.
    """
    verify_cron_secret(secret)
    db = get_db()
    
    # Calculate target time window (next 24 hours)
    now = datetime.now(timezone.utc)
    target_time = now + timedelta(hours=24)
    
    # Fetch upcoming scheduled hearings that need reminders
    response = db.table("hearings")\
        .select("id, matter_id, hearing_date, courtroom, judge, purpose")\
        .eq("status", "scheduled")\
        .eq("reminder_sent", False)\
        .gte("hearing_date", now.isoformat())\
        .lte("hearing_date", target_time.isoformat())\
        .execute()
        
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
        if matter.get("user_id"): recipients.append(matter["user_id"])
        if matter.get("lawyer_id"): recipients.append(matter["lawyer_id"])
        
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
                    "message": f"Reminder: Upcoming hearing for {matter['title']} tomorrow."
                },
                "action": {
                    "label": "View Details",
                    "url": f"/matters/{matter_id}"
                }
            }).execute()
            
        # Mark reminder as sent
        db.table("hearings").update({"reminder_sent": True}).eq("id", h["id"]).execute()
        sent_count += 1
        
    log.info(f"Hearing Reminders Cron: Processed {sent_count} reminders.")
    return {"status": "success", "reminders_sent": sent_count}


@router.post("/cron/weekly-summaries", status_code=200)
async def process_weekly_summaries(secret: str):
    """
    Cron job endpoint to generate and send weekly AI summaries to clients.
    Finds active matters, gathers events from the last 7 days, and uses AI to summarize.
    """
    verify_cron_secret(secret)
    db = get_db()
    
    # 1. Fetch active matters
    matters_res = db.table("matters").select("id, title, user_id").eq("status", "active").execute()
    matters = matters_res.data or []
    
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    
    # 2. Lazy load AI provider
    from app.domains.assessment.service import get_provider
    from app.shared.ai.prompt import generate_prompt
    ai_provider = get_provider()
    
    sent_count = 0
    
    for m in matters:
        if not m.get("user_id"): continue
        
        # Gather updates in past week
        updates_res = db.table("matter_updates")\
            .select("content, is_internal, created_at, profiles(full_name)")\
            .eq("matter_id", m["id"])\
            .eq("is_internal", False)\
            .gte("created_at", one_week_ago.isoformat())\
            .execute()
            
        updates = updates_res.data or []
        if not updates:
            continue
            
        # Format events
        events_text = "\\n".join([f"- {u['profiles']['full_name']} ({u['created_at'][:10]}): {u['content']}" for u in updates if u.get('profiles')])
        
        # Generate summary
        prompt = f"Summarize the following case updates for the client in 2-3 friendly sentences. Emphasize progress.\\n\\n{events_text}"
        try:
            summary_response = await ai_provider.generate_completion(prompt, max_tokens=150)
            summary_text = summary_response.text
        except Exception as e:
            log.error(f"Failed to generate summary for {m['id']}: {e}")
            summary_text = f"You had {len(updates)} updates this week. Please check your matter dashboard for details."
            
        # Send Notification
        db.table("notifications").insert({
            "user_id": m["user_id"],
            "type": "weekly_summary",
            "data": {
                "matter_id": m["id"],
                "matter_title": m["title"],
                "summary": summary_text
            },
            "action": {
                "label": "View Matter",
                "url": f"/matters/{m['id']}"
            }
        }).execute()
        
        sent_count += 1
        
    log.info(f"Weekly Summaries Cron: Processed {sent_count} summaries.")
    return {"status": "success", "summaries_sent": sent_count}

