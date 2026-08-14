from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from app.domains.docket.services.helpers import (
    _format_inr,
    _now,
    _stage_to_client_text,
    _status_to_stage,
    _today,
)
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser

logger = logging.getLogger(__name__)


# ── Lawyer Dashboard ─────────────────────────────────────────────


def get_lawyer_dashboard(user: CurrentUser) -> dict:
    """Aggregate dashboard data for a lawyer."""
    db = get_db()
    today = _today()
    week_end = today + timedelta(days=7)

    # Fetch all active matters for this lawyer
    matters_result = (
        db.table("matters")
        .select(
            "id,title,user_id,status,category,priority,case_number,court_name,next_hearing_at,matter_health,updated_at"
        )
        .eq("lawyer_id", user.id)
        .is_("deleted_at", "null")
        .in_("status", ["active", "matching", "intake", "assessment", "draft"])
        .execute()
    )
    matters = matters_result.data or []

    active_count = len([m for m in matters if m["status"] == "active"])

    # Today's hearings
    hearings_result = (
        db.table("hearings")
        .select("id,matter_id,hearing_date,courtroom,judge,purpose,status")
        .gte("hearing_date", today.isoformat())
        .lte("hearing_date", (today + timedelta(days=1)).isoformat())
        .in_("status", ["scheduled", "adjourned"])
        .execute()
    )
    today_hearings = hearings_result.data or []

    # This week's hearings count
    week_hearings_result = (
        db.table("hearings")
        .select("id", count="exact")
        .gte("hearing_date", today.isoformat())
        .lte("hearing_date", week_end.isoformat())
        .in_("status", ["scheduled"])
        .execute()
    )
    week_hearings_count = week_hearings_result.count or 0

    # Unbilled WIP
    time_entries_result = (
        db.table("time_entries")
        .select("amount_inr")
        .eq("lawyer_id", user.id)
        .eq("status", "unbilled")
        .execute()
    )
    unbilled_wip = sum(
        float(e.get("amount_inr") or 0) for e in (time_entries_result.data or [])
    )

    # Tasks due this week (filings due)
    tasks_result = (
        db.table("case_tasks")
        .select("id", count="exact")
        .lte("due_date", week_end.isoformat())
        .eq("is_completed", False)
        .execute()
    )
    filings_due = tasks_result.count or 0

    # Attention items
    attention_items = _build_attention_items(db, matters, user.id)

    # Enrich case cards with client names
    case_cards = _build_case_cards(db, matters)

    # Today's hearings enriched with case names
    hearing_rows = _build_hearing_rows(today_hearings, matters)

    # Build greeting
    first_name = user.full_name.split(" ")[0] if user.full_name else "Advocate"
    hour = _now().hour
    greeting_prefix = (
        "Good morning"
        if hour < 12
        else "Good afternoon" if hour < 17 else "Good evening"
    )

    summary_parts = []
    if today_hearings:
        summary_parts.append(
            f"{len(today_hearings)} court appearance{'s' if len(today_hearings) > 1 else ''} today"
        )
    if filings_due:
        summary_parts.append(
            f"{filings_due} filing{'s' if filings_due > 1 else ''} due this week"
        )
    summary_line = (
        " · ".join(summary_parts) if summary_parts else "No urgent items today"
    )

    # Format WIP for display
    wip_display = _format_inr(unbilled_wip)

    return {
        "greeting": f"{greeting_prefix}, {first_name}",
        "date_display": today.strftime("%A, %d %B %Y"),
        "summary_line": summary_line,
        "kpis": [
            {"value": str(active_count), "caption": "Active matters", "trend": None},
            {
                "value": str(week_hearings_count),
                "caption": "Hearings this week",
                "trend": None,
            },
            {"value": str(filings_due), "caption": "Filings due", "trend": None},
            {"value": wip_display, "caption": "Unbilled WIP", "trend": None},
        ],
        "today_hearings": hearing_rows,
        "attention_items": attention_items,
        "cases": case_cards,
    }


def _build_attention_items(db, matters: list, lawyer_id: str) -> list:
    """Build attention items: limitation warnings, overdue tasks, etc."""
    items = []
    today = _today()

    # Check for matters with next_hearing_at soon (limitation-like urgency)
    for m in matters:
        nha = m.get("next_hearing_at")
        if nha:
            try:
                hearing_date = date.fromisoformat(str(nha))
                days_until = (hearing_date - today).days
                if days_until <= 7 and days_until >= 1:
                    # Exclude today (days_until == 0) — those already show in "Today in Court"
                    severity = "danger" if days_until <= 3 else "warning"
                    items.append(
                        {
                            "id": m["id"],
                            "matter_id": m["id"],
                            "type": (
                                "limitation_warning"
                                if days_until <= 3
                                else "upcoming_hearing"
                            ),
                            "severity": severity,
                            "message": f"Hearing in {days_until} day{'s' if days_until != 1 else ''} — {m['title']}",
                        }
                    )
            except (ValueError, TypeError):
                pass

    # Overdue tasks
    tasks_result = (
        db.table("case_tasks")
        .select("id,matter_id,title,due_date")
        .eq("is_completed", False)
        .lt("due_date", today.isoformat())
        .limit(5)
        .execute()
    )
    for t in tasks_result.data or []:
        items.append(
            {
                "id": t["id"],
                "matter_id": t["matter_id"],
                "type": "overdue",
                "severity": "warning",
                "message": f"Overdue: {t['title']}",
            }
        )

    return items[:10]  # Cap at 10


def _build_case_cards(db, matters: list) -> list:
    """Build case card data with client names."""
    if not matters:
        return []

    # Collect unique user_ids to fetch client names
    user_ids = list(set(m["user_id"] for m in matters if m.get("user_id")))
    client_names = {}
    if user_ids:
        profiles_result = (
            db.table("profiles")
            .select("id,full_name,avatar_url")
            .in_("id", user_ids)
            .execute()
        )
        for p in profiles_result.data or []:
            client_names[p["id"]] = {
                "name": p["full_name"],
                "avatar": p.get("avatar_url"),
            }

    today = _today()
    cards = []
    for m in matters:
        client_info = client_names.get(
            m.get("user_id"), {"name": "Unassigned", "avatar": None}
        )

        # Compute next hearing countdown
        countdown = None
        nha = m.get("next_hearing_at")
        if nha:
            try:
                hd = date.fromisoformat(str(nha))
                days = (hd - today).days
                if days == 0:
                    countdown = "Today"
                elif days == 1:
                    countdown = "Tomorrow"
                elif days > 0:
                    countdown = f"In {days} days"
                else:
                    countdown = f"{abs(days)} days ago"
            except (ValueError, TypeError):
                pass

        # Urgency check
        is_urgent = False
        if nha:
            try:
                hd = date.fromisoformat(str(nha))
                is_urgent = 0 <= (hd - today).days <= 3
            except (ValueError, TypeError):
                pass

        cards.append(
            {
                "id": m["id"],
                "client_name": client_info["name"],
                "case_name": m["title"],
                "case_number": m.get("case_number"),
                "stage": m["status"],
                "next_hearing_at": m.get("next_hearing_at"),
                "next_hearing_countdown": countdown,
                "is_urgent": is_urgent,
                "client_avatar": client_info["avatar"],
                "matter_health": m.get("matter_health"),
                "category": m["category"],
            }
        )

    return cards


def _build_hearing_rows(today_hearings: list, matters: list) -> list:
    """Map hearing data to display rows with case names."""
    matter_map = {m["id"]: m for m in matters}
    rows = []
    for h in today_hearings:
        matter = matter_map.get(h["matter_id"], {})
        hearing_dt = h.get("hearing_date", "")
        time_str = ""
        if hearing_dt:
            try:
                dt = datetime.fromisoformat(hearing_dt)
                time_str = dt.strftime("%I:%M %p")
            except (ValueError, TypeError):
                time_str = hearing_dt

        rows.append(
            {
                "id": h["id"],
                "matter_id": h["matter_id"],
                "time": time_str,
                "court": h.get("courtroom"),
                "case_name": matter.get("title", "Unknown"),
                "judge": h.get("judge"),
                "purpose": h.get("purpose"),
            }
        )
    return rows


# ── Client Dashboard ─────────────────────────────────────────────


def get_client_dashboard(user: CurrentUser) -> dict:
    """Aggregate dashboard data for a client (multi-case)."""
    db = get_db()
    today = _today()

    # Fetch ALL client's active matters (not just one)
    matters_result = (
        db.table("matters")
        .select(
            "id,title,summary,status,category,case_number,court_name,lawyer_id,next_hearing_at,created_at"
        )
        .eq("user_id", user.id)
        .is_("deleted_at", "null")
        .neq("status", "archived")
        .order("created_at", desc=True)
        .execute()
    )

    cases_data = []
    pending_tasks = []
    recent_updates = []
    total_stats = {"hearings_count": 0, "documents_count": 0, "months_running": 0}

    for matter in matters_result.data or []:
        matter_id = matter["id"]

        # Get lawyer info
        lawyer_name = None
        lawyer_avatar = None
        if matter.get("lawyer_id"):
            lp_result = (
                db.table("profiles")
                .select("full_name,avatar_url")
                .eq("id", matter["lawyer_id"])
                .execute()
            )
            if lp_result.data:
                lawyer_name = lp_result.data[0]["full_name"]
                lawyer_avatar = lp_result.data[0].get("avatar_url")

        # Map status to plain stage
        stage = _status_to_stage(matter["status"])

        # Determine status text based on lawyer assignment
        if not matter.get("lawyer_id"):
            status_text = (
                "Your case has been filed. We're looking for the right lawyer for you."
            )
        else:
            status_text = _stage_to_client_text(stage)

        # Next hearing
        next_hearing_date = None
        next_hearing_desc = None
        next_hearing_attend = False
        if matter.get("next_hearing_at"):
            next_hearing_date = matter["next_hearing_at"]
            nh_result = (
                db.table("hearings")
                .select("purpose,notes")
                .eq("matter_id", matter_id)
                .gte("hearing_date", today.isoformat())
                .order("hearing_date")
                .limit(1)
                .execute()
            )
            if nh_result.data:
                next_hearing_desc = nh_result.data[0].get("purpose")

        # Per-case stats
        hearings_count_result = (
            db.table("hearings")
            .select("id", count="exact")
            .eq("matter_id", matter_id)
            .execute()
        )
        docs_count_result = (
            db.table("documents")
            .select("id", count="exact")
            .eq("matter_id", matter_id)
            .execute()
        )

        created_at = matter.get("created_at")
        months_running = 0
        if created_at:
            try:
                created = datetime.fromisoformat(created_at)
                months_running = max(1, ((_now() - created).days) // 30)
            except (ValueError, TypeError):
                pass

        case_stats = {
            "hearings_count": hearings_count_result.count or 0,
            "documents_count": docs_count_result.count or 0,
            "months_running": months_running,
        }

        cases_data.append(
            {
                "id": matter_id,
                "title": matter["title"],
                "plain_title": matter["title"],
                "status_text": status_text,
                "stage": stage,
                "case_number": matter.get("case_number"),
                "court_name": matter.get("court_name"),
                "category": matter.get("category"),
                "lawyer_name": lawyer_name,
                "lawyer_avatar": lawyer_avatar,
                "next_hearing_date": next_hearing_date,
                "next_hearing_description": next_hearing_desc,
                "next_hearing_attend": next_hearing_attend,
                "stats": case_stats,
            }
        )

        # Aggregate stats
        total_stats["hearings_count"] += case_stats["hearings_count"]
        total_stats["documents_count"] += case_stats["documents_count"]
        total_stats["months_running"] = max(
            total_stats["months_running"], months_running
        )

    # Pending tasks across all matters for client
    if matters_result.data:
        matter_ids = [m["id"] for m in matters_result.data]
        tasks_result = (
            db.table("case_tasks")
            .select("id,title,due_date,is_completed")
            .eq("assigned_to", user.id)
            .eq("is_completed", False)
            .in_("matter_id", matter_ids)
            .order("due_date")
            .limit(5)
            .execute()
        )
        for t in tasks_result.data or []:
            is_overdue = False
            if t.get("due_date"):
                try:
                    is_overdue = date.fromisoformat(t["due_date"]) < today
                except (ValueError, TypeError):
                    pass
            pending_tasks.append(
                {
                    "id": t["id"],
                    "title": t["title"],
                    "due_date": t.get("due_date"),
                    "is_overdue": is_overdue,
                }
            )

    # Recent timeline events (client-visible) across all matters
    if matters_result.data:
        matter_ids = [m["id"] for m in matters_result.data]
        timeline_result = (
            db.table("timeline_events")
            .select("id,client_description,occurred_at")
            .in_("matter_id", matter_ids)
            .not_.is_("client_description", "null")
            .order("occurred_at", desc=True)
            .limit(5)
            .execute()
        )
        for ev in timeline_result.data or []:
            recent_updates.append(
                {
                    "id": ev["id"],
                    "description": ev["client_description"],
                    "occurred_at": ev["occurred_at"],
                }
            )

    # Build greeting
    first_name = user.full_name.split(" ")[0] if user.full_name else "there"

    # For backward compat, also set `case` to the first (most recent) case
    first_case = cases_data[0] if cases_data else None

    return {
        "greeting": f"Hello, {first_name}",
        "date_display": today.strftime("%A, %d %B %Y"),
        "case": first_case,
        "cases": cases_data,
        "pending_tasks": pending_tasks,
        "recent_updates": recent_updates,
        "stats": total_stats,
    }
