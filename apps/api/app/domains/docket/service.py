"""Docket domain — service layer with role-filtered serializers."""

from __future__ import annotations
import logging
import os
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from app.shared.database import get_db, get_service_role_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import NotFound, Forbidden, BadRequest

logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Access control helpers ───────────────────────────────────────


def _get_matter_for_participant(matter_id: str, user: CurrentUser) -> dict:
    """Fetch matter and verify user is a participant."""
    db = get_db()
    result = (
        db.table("matters")
        .select("*")
        .eq("id", matter_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise NotFound("Matter")
    matter = result.data[0]
    if user.role == UserRole.ADMIN:
        return matter
    if user.role == UserRole.LAWYER and matter.get("lawyer_id") == user.id:
        return matter
    if user.role == UserRole.USER and matter.get("user_id") == user.id:
        return matter
    raise Forbidden("You are not a participant in this matter")


def _ensure_lawyer_on_matter(matter_id: str, user: CurrentUser) -> dict:
    """Verify user is the lawyer on this matter (or admin)."""
    matter = _get_matter_for_participant(matter_id, user)
    if user.role == UserRole.ADMIN:
        return matter
    if user.role != UserRole.LAWYER or matter.get("lawyer_id") != user.id:
        raise Forbidden("Only the assigned lawyer can perform this action")
    return matter


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


# ── Case Overview ────────────────────────────────────────────────


def get_case_overview(matter_id: str, user: CurrentUser) -> dict:
    """Get role-filtered case overview data."""
    matter = _get_matter_for_participant(matter_id, user)

    db = get_db()
    today = _today()

    # Base data common to both roles
    overview: dict = {"matter_id": matter_id}

    if user.role in (UserRole.LAWYER, UserRole.ADMIN):
        overview.update(_lawyer_overview(db, matter, user, today))
    else:
        overview.update(_client_overview(db, matter, user, today))

    return overview


def _lawyer_overview(db, matter: dict, user: CurrentUser, today: date) -> dict:
    """Full lawyer overview with all privileged data."""
    matter_id = matter["id"]

    # Case facts
    client_name = "Unknown"
    client_contact = None
    if matter.get("user_id"):
        cp = (
            db.table("profiles")
            .select("full_name,phone,city")
            .eq("id", matter["user_id"])
            .execute()
        )
        if cp.data:
            client_name = cp.data[0]["full_name"]
            client_contact = {
                "phone": cp.data[0].get("phone"),
                "city": cp.data[0].get("city"),
            }

    # Unbilled WIP for this matter
    te_result = (
        db.table("time_entries")
        .select("amount_inr")
        .eq("matter_id", matter_id)
        .eq("status", "unbilled")
        .execute()
    )
    wip = sum(float(e.get("amount_inr") or 0) for e in (te_result.data or []))

    # Next hearing
    next_hearing = None
    nh_result = (
        db.table("hearings")
        .select("*")
        .eq("matter_id", matter_id)
        .gte("hearing_date", today.isoformat())
        .in_("status", ["scheduled", "adjourned"])
        .order("hearing_date")
        .limit(1)
        .execute()
    )
    if nh_result.data:
        h = nh_result.data[0]
        hearing_date = h.get("hearing_date", "")
        days_until = None
        try:
            hd = date.fromisoformat(hearing_date[:10]) if hearing_date else None
            days_until = (hd - today).days if hd else None
        except (ValueError, TypeError):
            pass
        next_hearing = {
            "id": h["id"],
            "hearing_date": hearing_date,
            "days_until": days_until,
            "courtroom": h.get("courtroom"),
            "judge": h.get("judge"),
            "purpose": h.get("purpose"),
        }

    # Deadline alert
    deadline_alert = None
    if (
        next_hearing
        and next_hearing.get("days_until") is not None
        and next_hearing["days_until"] <= 7
    ):
        deadline_alert = f"Hearing in {next_hearing['days_until']} day{'s' if next_hearing['days_until'] != 1 else ''}"

    # Overdue tasks for alert
    overdue_tasks = (
        db.table("case_tasks")
        .select("title,due_date")
        .eq("matter_id", matter_id)
        .eq("is_completed", False)
        .lt("due_date", today.isoformat())
        .limit(3)
        .execute()
    )
    if overdue_tasks.data:
        first_overdue = overdue_tasks.data[0]["title"]
        if deadline_alert:
            deadline_alert += f" · {first_overdue} overdue"
        else:
            deadline_alert = f"{first_overdue} overdue"

    # Recent client uploads
    uploads_result = (
        db.table("documents")
        .select("id,name,created_at")
        .eq("matter_id", matter_id)
        .eq("uploaded_by", matter.get("user_id", ""))
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    # Tasks pending on client
    client_tasks = (
        db.table("case_tasks")
        .select("id,title,due_date")
        .eq("matter_id", matter_id)
        .eq("assigned_to", matter.get("user_id", ""))
        .eq("is_completed", False)
        .execute()
    )

    # Recent activity (timeline)
    activity_result = (
        db.table("timeline_events")
        .select("id,lawyer_description,occurred_at")
        .eq("matter_id", matter_id)
        .order("occurred_at", desc=True)
        .limit(5)
        .execute()
    )

    # Tasks for lawyer
    my_tasks = (
        db.table("case_tasks")
        .select("id,title,due_date,is_completed")
        .eq("matter_id", matter_id)
        .eq("assigned_to", user.id)
        .eq("is_completed", False)
        .order("due_date")
        .limit(5)
        .execute()
    )

    # Internal notes
    notes_result = (
        db.table("internal_notes")
        .select("id,content,created_at")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )

    return {
        "role": "lawyer",
        "case_facts": {
            "case_number": matter.get("case_number"),
            "court": matter.get("court_name"),
            "category": matter.get("category"),
            "filed_date": matter.get("created_at"),
            "wip": _format_inr(wip),
            "plaintiff": {"name": client_name, "contact": client_contact},
        },
        "deadline_alert": deadline_alert,
        "next_hearing": next_hearing,
        "client_uploads": uploads_result.data or [],
        "client_pending_tasks": client_tasks.data or [],
        "recent_activity": [
            {
                "id": a["id"],
                "description": a["lawyer_description"],
                "occurred_at": a["occurred_at"],
            }
            for a in (activity_result.data or [])
        ],
        "my_tasks": my_tasks.data or [],
        "internal_notes": notes_result.data or [],
    }


def _client_overview(db, matter: dict, user: CurrentUser, today: date) -> dict:
    """Filtered client overview — no privileged data."""
    matter_id = matter["id"]

    # Stage
    stage = _status_to_stage(matter["status"])

    # Determine status text based on lawyer assignment
    if not matter.get("lawyer_id"):
        status_text = "Your case has been filed. We're looking for the right lawyer to represent you."
    else:
        status_text = _stage_to_client_text(stage)

    # Lawyer info
    lawyer_info = None
    if matter.get("lawyer_id"):
        lp = (
            db.table("profiles")
            .select("full_name,avatar_url")
            .eq("id", matter["lawyer_id"])
            .execute()
        )
        if lp.data:
            lawyer_info = {
                "name": lp.data[0]["full_name"],
                "avatar": lp.data[0].get("avatar_url"),
            }

    # Case facts (client-facing subset)
    case_facts = {
        "case_number": matter.get("case_number"),
        "court": matter.get("court_name"),
        "category": matter.get("category"),
        "filed_date": matter.get("created_at"),
        "stage": stage,
        "lawyer_name": lawyer_info["name"] if lawyer_info else None,
    }

    # Next hearing (informational)
    next_hearing = None
    nh_result = (
        db.table("hearings")
        .select("hearing_date,purpose")
        .eq("matter_id", matter_id)
        .gte("hearing_date", today.isoformat())
        .order("hearing_date")
        .limit(1)
        .execute()
    )
    if nh_result.data:
        next_hearing = {
            "date": nh_result.data[0]["hearing_date"],
            "description": nh_result.data[0].get("purpose", "Court hearing scheduled"),
            "attend": False,
        }

    # Pending tasks
    tasks_result = (
        db.table("case_tasks")
        .select("id,title,due_date")
        .eq("matter_id", matter_id)
        .eq("assigned_to", user.id)
        .eq("is_completed", False)
        .order("due_date")
        .limit(3)
        .execute()
    )
    pending_tasks = []
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

    # Timeline (client descriptions only)
    timeline_result = (
        db.table("timeline_events")
        .select("id,client_description,occurred_at")
        .eq("matter_id", matter_id)
        .not_.is_("client_description", "null")
        .order("occurred_at", desc=True)
        .limit(6)
        .execute()
    )

    # Documents (client-visible)
    docs_result = (
        db.table("documents")
        .select("id,name,created_at")
        .eq("matter_id", matter_id)
        .neq("visibility", "lawyer_only")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Quick stats
    hearings_count = (
        db.table("hearings")
        .select("id", count="exact")
        .eq("matter_id", matter_id)
        .execute()
    )
    docs_count = (
        db.table("documents")
        .select("id", count="exact")
        .eq("matter_id", matter_id)
        .neq("visibility", "lawyer_only")
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

    return {
        "role": "client",
        "stage": stage,
        "status_text": status_text,
        "case_facts": case_facts,
        "lawyer": lawyer_info,
        "next_hearing": next_hearing,
        "pending_tasks": pending_tasks,
        "recent_updates": [
            {
                "id": e["id"],
                "description": e["client_description"],
                "occurred_at": e["occurred_at"],
            }
            for e in (timeline_result.data or [])
        ],
        "documents": docs_result.data or [],
        "stats": {
            "hearings_count": hearings_count.count or 0,
            "documents_count": docs_count.count or 0,
            "months_running": months_running,
        },
    }


# ── Billing ──────────────────────────────────────────────────────


def get_billing(matter_id: str, user: CurrentUser) -> dict:
    """Get role-filtered billing data."""
    matter = _get_matter_for_participant(matter_id, user)
    db = get_db()

    if user.role in (UserRole.LAWYER, UserRole.ADMIN):
        return _lawyer_billing(db, matter_id)
    else:
        return _client_billing(db, matter_id)


def _lawyer_billing(db, matter_id: str) -> dict:
    """Full billing data for the lawyer."""
    # Unbilled time entries
    te_result = (
        db.table("time_entries")
        .select("*")
        .eq("matter_id", matter_id)
        .eq("status", "unbilled")
        .order("entry_date", desc=True)
        .execute()
    )
    unbilled_entries = te_result.data or []
    unbilled_wip = sum(float(e.get("amount_inr") or 0) for e in unbilled_entries)

    # All invoices
    inv_result = (
        db.table("invoices")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    invoices = inv_result.data or []

    billed_ar = sum(
        float(i.get("total_inr") or 0)
        for i in invoices
        if i.get("status") in ("sent", "overdue")
    )
    paid_to_date = sum(
        float(i.get("total_inr") or 0) for i in invoices if i.get("status") == "paid"
    )
    has_overdue = any(i.get("status") == "overdue" for i in invoices)

    # Fee arrangement
    fa_result = (
        db.table("fee_arrangements").select("*").eq("matter_id", matter_id).execute()
    )
    fee_arrangement = fa_result.data[0] if fa_result.data else None

    # Trust/retainer balance
    trust_balance = 0.0
    if fee_arrangement and fee_arrangement.get("type") == "retainer":
        retainer_amount = float(fee_arrangement.get("retainer_amount") or 0)
        retainer_used = float(fee_arrangement.get("retainer_used") or 0)
        trust_balance = retainer_amount - retainer_used

    # Disbursements
    disb_result = (
        db.table("disbursements")
        .select("*")
        .eq("matter_id", matter_id)
        .order("incurred_on", desc=True)
        .execute()
    )

    return {
        "role": "lawyer",
        "unbilled_wip": unbilled_wip,
        "billed_ar": billed_ar,
        "paid_to_date": paid_to_date,
        "trust_balance": trust_balance,
        "has_overdue": has_overdue,
        "fee_arrangement": fee_arrangement,
        "unbilled_entries": unbilled_entries,
        "invoices": invoices,
        "disbursements": disb_result.data or [],
    }


def _client_billing(db, matter_id: str) -> dict:
    """Filtered billing data for the client — no time entry details."""
    # Invoices (client view: simplified)
    inv_result = (
        db.table("invoices")
        .select(
            "id,invoice_number,period_start,period_end,total_inr,status,due_date,paid_at,work_summary"
        )
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    invoices = inv_result.data or []

    # Amount due (overdue or sent)
    amount_due = 0.0
    amount_due_invoice = None
    days_overdue = None
    for inv in invoices:
        if inv.get("status") in ("sent", "overdue"):
            amount_due += float(inv.get("total_inr") or 0)
            if not amount_due_invoice:
                amount_due_invoice = inv.get("invoice_number")
                if inv.get("due_date"):
                    try:
                        due = date.fromisoformat(inv["due_date"])
                        overdue_days = (_today() - due).days
                        days_overdue = overdue_days if overdue_days > 0 else None
                    except (ValueError, TypeError):
                        pass

    paid_to_date = sum(
        float(i.get("total_inr") or 0) for i in invoices if i.get("status") == "paid"
    )

    # Fee arrangement (client can see description + type)
    fa_result = (
        db.table("fee_arrangements")
        .select("type,description,engagement_doc_path,retainer_amount,retainer_used")
        .eq("matter_id", matter_id)
        .execute()
    )
    fa = fa_result.data[0] if fa_result.data else None

    return {
        "role": "client",
        "amount_due": amount_due,
        "amount_due_invoice": amount_due_invoice,
        "days_overdue": days_overdue,
        "retainer_amount": (
            float(fa["retainer_amount"]) if fa and fa.get("retainer_amount") else None
        ),
        "retainer_used": (
            float(fa["retainer_used"]) if fa and fa.get("retainer_used") else None
        ),
        "paid_to_date": paid_to_date,
        "fee_description": fa.get("description") if fa else None,
        "engagement_doc_path": fa.get("engagement_doc_path") if fa else None,
        "invoices": invoices,
    }


# ── CRUD: Time Entries ───────────────────────────────────────────


def create_time_entry(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "lawyer_id": user.id,
        "activity": data["activity"],
        "hours": data["hours"],
        "entry_date": (data.get("entry_date") or _today()).isoformat(),
    }
    if data.get("rate_per_hour") is not None:
        payload["rate_per_hour"] = data["rate_per_hour"]
    else:
        # Try to get rate from fee arrangement
        fa = (
            db.table("fee_arrangements")
            .select("rate_per_hour")
            .eq("matter_id", matter_id)
            .execute()
        )
        if fa.data and fa.data[0].get("rate_per_hour"):
            payload["rate_per_hour"] = float(fa.data[0]["rate_per_hour"])

    result = db.table("time_entries").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create time entry")
    return result.data[0]


def list_time_entries(matter_id: str, user: CurrentUser) -> list:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("time_entries")
        .select("*")
        .eq("matter_id", matter_id)
        .order("entry_date", desc=True)
        .execute()
    )
    return result.data or []


def update_time_entry(
    matter_id: str, entry_id: str, user: CurrentUser, data: dict
) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "entry_date" in update_data and isinstance(update_data["entry_date"], date):
        update_data["entry_date"] = update_data["entry_date"].isoformat()
    result = (
        db.table("time_entries")
        .update(update_data)
        .eq("id", entry_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Time entry")
    return result.data[0]


def delete_time_entry(matter_id: str, entry_id: str, user: CurrentUser) -> None:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    db.table("time_entries").delete().eq("id", entry_id).eq(
        "matter_id", matter_id
    ).execute()


# ── CRUD: Invoices ───────────────────────────────────────────────


def create_invoice(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Generate invoice number: INV-{year}-{sequence}
    year = _today().year
    existing = (
        db.table("invoices")
        .select("invoice_number")
        .like("invoice_number", f"INV-{year}-%")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    sequence = 1
    if existing.data:
        try:
            last_num = existing.data[0]["invoice_number"]
            sequence = int(last_num.split("-")[-1]) + 1
        except (ValueError, IndexError):
            sequence = 1

    invoice_number = f"INV-{year}-{sequence:03d}"

    # Calculate totals from time entries and disbursements
    subtotal = 0.0
    time_entry_ids = data.get("time_entry_ids", [])
    disbursement_ids = data.get("disbursement_ids", [])

    if time_entry_ids:
        te_result = (
            db.table("time_entries")
            .select("amount_inr")
            .in_("id", time_entry_ids)
            .execute()
        )
        subtotal += sum(float(e.get("amount_inr") or 0) for e in (te_result.data or []))

    if disbursement_ids:
        disb_result = (
            db.table("disbursements")
            .select("amount_inr")
            .in_("id", disbursement_ids)
            .execute()
        )
        subtotal += sum(
            float(d.get("amount_inr") or 0) for d in (disb_result.data or [])
        )

    gst_percent = 18.00
    gst_amount = round(subtotal * gst_percent / 100, 2)
    total = round(subtotal + gst_amount, 2)

    invoice_payload = {
        "matter_id": matter_id,
        "invoice_number": invoice_number,
        "period_start": (
            data.get("period_start").isoformat() if data.get("period_start") else None
        ),
        "period_end": (
            data.get("period_end").isoformat() if data.get("period_end") else None
        ),
        "subtotal_inr": subtotal,
        "gst_percent": gst_percent,
        "gst_amount_inr": gst_amount,
        "total_inr": total,
        "work_summary": data.get("work_summary"),
        "due_date": data.get("due_date").isoformat() if data.get("due_date") else None,
    }

    result = db.table("invoices").insert(invoice_payload).execute()
    if not result.data:
        raise BadRequest("Failed to create invoice")
    invoice = result.data[0]

    # Mark time entries as billed
    if time_entry_ids:
        db.table("time_entries").update(
            {"status": "billed", "invoice_id": invoice["id"]}
        ).in_("id", time_entry_ids).execute()

    # Link disbursements
    if disbursement_ids:
        db.table("disbursements").update({"invoice_id": invoice["id"]}).in_(
            "id", disbursement_ids
        ).execute()

    return invoice


def list_invoices(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("invoices")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def update_invoice(
    matter_id: str, invoice_id: str, user: CurrentUser, data: dict
) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "due_date" in update_data and isinstance(update_data["due_date"], date):
        update_data["due_date"] = update_data["due_date"].isoformat()
    if "paid_at" in update_data and isinstance(update_data["paid_at"], datetime):
        update_data["paid_at"] = update_data["paid_at"].isoformat()
    result = (
        db.table("invoices")
        .update(update_data)
        .eq("id", invoice_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Invoice")
    return result.data[0]


# ── CRUD: Internal Notes ─────────────────────────────────────────


def create_note(matter_id: str, user: CurrentUser, content: str) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("internal_notes")
        .insert(
            {
                "matter_id": matter_id,
                "author_id": user.id,
                "content": content,
            }
        )
        .execute()
    )
    if not result.data:
        raise BadRequest("Failed to create note")
    return result.data[0]


def list_notes(matter_id: str, user: CurrentUser) -> list:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    result = (
        db.table("internal_notes")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# ── CRUD: Tasks ──────────────────────────────────────────────────


def create_task(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "title": data["title"],
        "description": data.get("description"),
        "assigned_to": data.get("assigned_to"),
        "due_date": data["due_date"].isoformat() if data.get("due_date") else None,
    }
    result = db.table("case_tasks").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create task")
    return result.data[0]


def list_tasks(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("case_tasks")
        .select("*")
        .eq("matter_id", matter_id)
        .order("is_completed")
        .order("due_date")
        .execute()
    )
    return result.data or []


def update_task(matter_id: str, task_id: str, user: CurrentUser, data: dict) -> dict:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    if "due_date" in update_data and isinstance(update_data["due_date"], date):
        update_data["due_date"] = update_data["due_date"].isoformat()
    if update_data.get("is_completed"):
        update_data["completed_at"] = _now().isoformat()
    elif "is_completed" in update_data and not update_data["is_completed"]:
        update_data["completed_at"] = None
    result = (
        db.table("case_tasks")
        .update(update_data)
        .eq("id", task_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Task")
    return result.data[0]


# ── CRUD: Timeline Events ────────────────────────────────────────


def create_timeline_event(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "event_type": data["event_type"],
        "lawyer_description": data["lawyer_description"],
        "client_description": data.get("client_description"),
        "occurred_at": (data.get("occurred_at") or _now()).isoformat(),
        "metadata": data.get("metadata", {}),
    }
    result = db.table("timeline_events").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create timeline event")
    return result.data[0]


def list_timeline_events(matter_id: str, user: CurrentUser) -> list:
    matter = _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("timeline_events")
        .select("*")
        .eq("matter_id", matter_id)
        .order("occurred_at", desc=True)
        .execute()
    )
    events = result.data or []

    # Role-filter the description field
    if user.role == UserRole.USER:
        return [
            {**e, "description": e["client_description"]}
            for e in events
            if e.get("client_description")
        ]
    else:
        return [{**e, "description": e["lawyer_description"]} for e in events]


# ── CRUD: Fee Arrangements ───────────────────────────────────────


def get_fee_arrangement(matter_id: str, user: CurrentUser) -> Optional[dict]:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("fee_arrangements").select("*").eq("matter_id", matter_id).execute()
    )
    return result.data[0] if result.data else None


def create_fee_arrangement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "type": data["type"],
        "rate_per_hour": data.get("rate_per_hour"),
        "fixed_amount": data.get("fixed_amount"),
        "retainer_amount": data.get("retainer_amount"),
        "description": data.get("description"),
        "engagement_doc_path": data.get("engagement_doc_path"),
    }
    result = db.table("fee_arrangements").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create fee arrangement")
    return result.data[0]


def update_fee_arrangement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    update_data = {k: v for k, v in data.items() if v is not None}
    result = (
        db.table("fee_arrangements")
        .update(update_data)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Fee arrangement")
    return result.data[0]


# ── CRUD: Disbursements ──────────────────────────────────────────


def create_disbursement(matter_id: str, user: CurrentUser, data: dict) -> dict:
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()
    payload = {
        "matter_id": matter_id,
        "description": data["description"],
        "amount_inr": data["amount_inr"],
        "incurred_on": (data.get("incurred_on") or _today()).isoformat(),
        "invoice_id": data.get("invoice_id"),
    }
    result = db.table("disbursements").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create disbursement")
    return result.data[0]


def list_disbursements(matter_id: str, user: CurrentUser) -> list:
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("disbursements")
        .select("*")
        .eq("matter_id", matter_id)
        .order("incurred_on", desc=True)
        .execute()
    )
    return result.data or []


# ── AI Chat Stub ─────────────────────────────────────────────────


async def ask_case_ai(case_id: str, prompt: str, session: CurrentUser) -> dict:
    """
    AI chat stub scoped to a single case.

    Contract:
    - Validates session against case participants before returning
    - case_id must be a matter where session.id is lawyer_id or user_id
    - Returns mock response for v1; swap this function body for real LLM call

    Real implementation will:
    1. Fetch case context (facts, documents, hearings) scoped to case_id
    2. Send to LLM with system prompt restricting to case data only
    3. Refuse cross-case data retrieval regardless of prompt content
    """
    # Validate session is a participant on this case
    matter = _get_matter_for_participant(case_id, session)

    # Additional enforcement: only lawyers can use AI chat in v1
    if session.role not in (UserRole.LAWYER, UserRole.ADMIN):
        raise Forbidden("AI chat is available to lawyers only")

    # Stub responses based on prompt keywords
    prompt_lower = prompt.lower()
    if "summarize" in prompt_lower or "summary" in prompt_lower:
        response = (
            "Based on the case documents, the defendant's written statement raises three key arguments: "
            "(1) denial of ownership transfer, (2) claim of adverse possession since 2018, and "
            "(3) challenge to the plaintiff's locus standi. The weakest argument appears to be the "
            "adverse possession claim given the documented rent receipts."
        )
    elif "precedent" in prompt_lower or "citation" in prompt_lower:
        response = (
            "Relevant precedents for this matter:\n"
            "1. *Suraj Lamp & Industries v. State of Haryana* (2012) 1 SCC 656 — on property transfer requirements\n"
            "2. *S.P. Chengalvaraya Naidu v. Jagannath* (1994) 1 SCC 1 — on fraud and concealment\n"
            "3. *Hemaji Waghaji Jat v. Bhikhabhai* (2009) 16 SCC 517 — on adverse possession elements"
        )
    elif "draft" in prompt_lower or "reply" in prompt_lower:
        response = (
            "Draft paragraph for reply:\n\n"
            '"It is respectfully submitted that the contentions raised in paragraphs 4-7 of the Written Statement '
            "are wholly untenable and contrary to the documentary evidence on record. The Defendant's claim of "
            "adverse possession is belied by the rent receipts (Exhibit P-3 to P-14) which establish the "
            "Plaintiff's continuous acknowledgement as owner...\""
        )
    else:
        response = (
            f"I can help you with this case. Based on the available documents for matter {matter.get('title', '')}, "
            "I can summarize filings, find relevant precedents, or help draft reply paragraphs. "
            "What would you like me to focus on?"
        )

    return {
        "response": response,
        "sources": [],  # Will contain document references in real implementation
        "case_id": case_id,
    }


# ── Helpers ──────────────────────────────────────────────────────


def _format_inr(amount: float) -> str:
    """Format amount in Indian ₹ lakhs format."""
    if amount >= 100000:
        lakhs = amount / 100000
        return f"₹{lakhs:,.2f}L"
    return f"₹{amount:,.0f}"


# ── Nudge Client ────────────────────────────────────────────────


def nudge_client(matter_id: str, task_id: str, user: CurrentUser) -> dict:
    """Send a nudge to the client about a pending task."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Verify task exists and is incomplete
    task_result = (
        db.table("case_tasks")
        .select("id,title,assigned_to")
        .eq("id", task_id)
        .eq("matter_id", matter_id)
        .eq("is_completed", False)
        .execute()
    )
    if not task_result.data:
        raise NotFound("Task")

    task = task_result.data[0]

    # Create a timeline event recording the nudge
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "nudge",
            "lawyer_description": f"Sent reminder to client about: {task['title']}",
            "client_description": f"Your lawyer sent a reminder: {task['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"task_id": task_id},
        }
    ).execute()

    return {"nudged": True, "task_id": task_id, "title": task["title"]}


# ── Hearings ────────────────────────────────────────────────────


def schedule_hearing(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Schedule a hearing for a matter."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    payload = {
        "matter_id": matter_id,
        "hearing_date": data["hearing_date"],
        "courtroom": data.get("courtroom"),
        "judge": data.get("judge"),
        "purpose": data.get("purpose"),
        "status": "scheduled",
    }

    result = db.table("hearings").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to schedule hearing")

    hearing = result.data[0]

    # Update next_hearing_at on the matter
    db.table("matters").update({"next_hearing_at": data["hearing_date"]}).eq(
        "id", matter_id
    ).execute()

    # Record timeline event
    hearing_date_fmt = data["hearing_date"][:10]
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "hearing_scheduled",
            "lawyer_description": f"Hearing scheduled for {hearing_date_fmt}",
            "client_description": f"A court hearing has been scheduled for {hearing_date_fmt}",
            "occurred_at": _now().isoformat(),
            "metadata": {"hearing_id": hearing["id"]},
        }
    ).execute()

    return hearing


# ── Documents (Review) ────────────────────────────────────────────


def list_documents(matter_id: str, user: CurrentUser) -> list:
    """List documents for a matter, role-filtered."""
    matter = _get_matter_for_participant(matter_id, user)
    db = get_db()

    query = db.table("documents").select("*").eq("matter_id", matter_id)

    # Clients don't see lawyer_only docs
    if user.role == UserRole.USER:
        query = query.neq("visibility", "lawyer_only")

    result = query.order("created_at", desc=True).execute()
    documents = result.data or []

    client_id = matter.get("user_id")
    for doc in documents:
        doc["uploaded_by_client"] = doc.get("uploaded_by") == client_id

    return documents


def review_document(matter_id: str, doc_id: str, user: CurrentUser, data: dict) -> dict:
    """Approve or reject a document, notifying the client."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Update metadata with review status and note
    doc_result = (
        db.table("documents")
        .select("id,name,metadata")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    doc = doc_result.data[0]
    meta = doc.get("metadata") or {}
    meta["review_status"] = data["status"]
    meta["reviewed_at"] = _now().isoformat()
    meta["reviewed_by"] = user.id
    if data.get("lawyer_note"):
        meta["lawyer_note"] = data["lawyer_note"]

    result = db.table("documents").update({"metadata": meta}).eq("id", doc_id).execute()
    if not result.data:
        raise BadRequest("Failed to update document")

    # Create timeline event to notify client
    action = "approved" if data["status"] == "approved" else "rejected"
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": f"document_{action}",
            "lawyer_description": f"Document '{doc['name']}' {action}",
            "client_description": f"Your document '{doc['name']}' has been {action} by your lawyer."
            + (f" Note: {data['lawyer_note']}" if data.get("lawyer_note") else ""),
            "occurred_at": _now().isoformat(),
            "metadata": {"document_id": doc_id},
        }
    ).execute()

    return result.data[0]


def update_document_note(
    matter_id: str, doc_id: str, user: CurrentUser, note: str
) -> dict:
    """Add or update a lawyer's note on a document."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    doc_result = (
        db.table("documents")
        .select("id,metadata")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    meta = doc_result.data[0].get("metadata") or {}
    meta["lawyer_note"] = note
    meta["note_updated_at"] = _now().isoformat()

    result = db.table("documents").update({"metadata": meta}).eq("id", doc_id).execute()
    if not result.data:
        raise BadRequest("Failed to update note")
    return result.data[0]


# ── Document Requests ──────────────────────────────────────────────


def create_document_request(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Lawyer asks the client to upload a specific document."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    payload = {
        "matter_id": matter_id,
        "requested_by": user.id,
        "title": data["title"],
        "description": data.get("description"),
        "label": data.get("label", "other"),
        "status": "pending",
    }
    result = db.table("document_requests").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create document request")
    request = result.data[0]

    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "document_requested",
            "lawyer_description": f"Requested document: {data['title']}",
            "client_description": f"Your lawyer requested a document: {data['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"request_id": request["id"]},
        }
    ).execute()

    return request


def list_document_requests(matter_id: str, user: CurrentUser) -> list:
    """List document requests for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("document_requests")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def cancel_document_request(matter_id: str, request_id: str, user: CurrentUser) -> dict:
    """Lawyer cancels a pending document request."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    req_result = (
        db.table("document_requests")
        .select("id,status")
        .eq("id", request_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not req_result.data:
        raise NotFound("Document request")
    if req_result.data[0]["status"] == "fulfilled":
        raise BadRequest(
            "This request has already been fulfilled and can't be cancelled"
        )

    result = (
        db.table("document_requests")
        .update({"status": "cancelled"})
        .eq("id", request_id)
        .execute()
    )
    if not result.data:
        raise BadRequest("Failed to cancel document request")
    return result.data[0]


def fulfill_document_request(
    matter_id: str,
    request_id: str,
    user: CurrentUser,
    filename: str,
    content_type: str,
    file_bytes: bytes,
) -> dict:
    """Client uploads a file to fulfill a lawyer's document request."""
    matter = _get_matter_for_participant(matter_id, user)
    if user.role == UserRole.LAWYER:
        raise Forbidden("Only the client on this matter can fulfill a document request")

    db = get_db()

    req_result = (
        db.table("document_requests")
        .select("*")
        .eq("id", request_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not req_result.data:
        raise NotFound("Document request")
    request = req_result.data[0]
    if request["status"] == "fulfilled":
        raise BadRequest("This document request has already been fulfilled")

    safe_filename = os.path.basename(filename or "document")
    storage_path = f"{matter_id}/{uuid.uuid4().hex[:8]}-{safe_filename}"

    try:
        db.storage.from_("matter_documents").upload(
            storage_path,
            file_bytes,
            {"content-type": content_type or "application/octet-stream"},
        )
    except Exception:
        logger.exception(
            "[Docket] Failed to upload document for request %s", request_id
        )
        raise BadRequest("Failed to upload file. Please try again.")

    doc_result = (
        db.table("documents")
        .insert(
            {
                "matter_id": matter_id,
                "uploaded_by": user.id,
                "name": safe_filename,
                "storage_path": storage_path,
                "file_type": content_type,
                "file_size": len(file_bytes),
                "classification": request["label"],
                "visibility": "client_visible",
                "metadata": {"request_id": request_id, "review_status": "under_review"},
            }
        )
        .execute()
    )
    if not doc_result.data:
        raise BadRequest("Failed to record uploaded document")
    document = doc_result.data[0]

    db.table("document_requests").update(
        {
            "status": "fulfilled",
            "document_id": document["id"],
            "fulfilled_at": _now().isoformat(),
        }
    ).eq("id", request_id).execute()

    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "document_uploaded",
            "lawyer_description": f"Client uploaded '{safe_filename}' for request: {request['title']}",
            "client_description": f"You uploaded '{safe_filename}' for your lawyer's request: {request['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"document_id": document["id"], "request_id": request_id},
        }
    ).execute()

    return document


def get_document_download_url(matter_id: str, doc_id: str, user: CurrentUser) -> dict:
    """Generate a short-lived signed download URL for a document."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    doc_result = (
        db.table("documents")
        .select("id,storage_path,visibility")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    doc = doc_result.data[0]
    if user.role == UserRole.USER and doc.get("visibility") == "lawyer_only":
        raise Forbidden("This document is not shared with you")

    try:
        res = db.storage.from_("matter_documents").create_signed_url(
            doc["storage_path"], 60
        )
        return {"url": res["signedUrl"]}
    except Exception:
        logger.exception("[Docket] Failed to create signed URL for document %s", doc_id)
        raise BadRequest("Failed to generate download link. Please try again later.")


# ── Hearings (List/Update) ───────────────────────────────────────


def list_hearings(matter_id: str, user: CurrentUser) -> list:
    """List all hearings for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("hearings")
        .select("*")
        .eq("matter_id", matter_id)
        .order("hearing_date", desc=True)
        .execute()
    )
    return result.data or []


def update_hearing(
    matter_id: str, hearing_id: str, user: CurrentUser, data: dict
) -> dict:
    """Update hearing details (add notes, change status, record outcome)."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Handle outcome as metadata
    metadata_update = {}
    if "outcome" in data:
        metadata_update["outcome"] = data.pop("outcome")
    if "next_date" in data:
        metadata_update["next_date"] = data.pop("next_date")

    update_payload = {k: v for k, v in data.items()}
    if metadata_update:
        # Merge into existing hearing notes
        existing = db.table("hearings").select("notes").eq("id", hearing_id).execute()
        if existing.data:
            current_notes = existing.data[0].get("notes") or ""
            if metadata_update.get("outcome"):
                outcome_text = f"\n[Outcome: {metadata_update['outcome']}]"
                update_payload["notes"] = (current_notes + outcome_text).strip()

    result = (
        db.table("hearings")
        .update(update_payload)
        .eq("id", hearing_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not result.data:
        raise NotFound("Hearing")

    # If adjourned with a new date, schedule the next hearing
    if data.get("status") == "adjourned" and metadata_update.get("next_date"):
        new_date = metadata_update["next_date"]
        hearing = result.data[0]
        db.table("hearings").insert(
            {
                "matter_id": matter_id,
                "hearing_date": new_date,
                "courtroom": hearing.get("courtroom"),
                "judge": hearing.get("judge"),
                "purpose": "Adjourned from "
                + (hearing.get("hearing_date") or "previous")[:10],
                "status": "scheduled",
            }
        ).execute()
        db.table("matters").update({"next_hearing_at": new_date}).eq(
            "id", matter_id
        ).execute()

    # Record timeline event
    if data.get("status") == "completed":
        db.table("timeline_events").insert(
            {
                "matter_id": matter_id,
                "event_type": "hearing_completed",
                "lawyer_description": f"Hearing completed"
                + (
                    f" — {metadata_update.get('outcome', '')}"
                    if metadata_update.get("outcome")
                    else ""
                ),
                "client_description": "A hearing was completed in your case.",
                "occurred_at": _now().isoformat(),
                "metadata": {"hearing_id": hearing_id},
            }
        ).execute()

    return result.data[0]


# ── Messages ────────────────────────────────────────────────────


def list_messages(matter_id: str, user: CurrentUser) -> list:
    """List chat messages for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    result = (
        db.table("case_messages")
        .select(
            "id,matter_id,sender_id,content,message_type,attachment_path,read_at,created_at"
        )
        .eq("matter_id", matter_id)
        .order("created_at")
        .execute()
    )
    messages = result.data or []

    # Mark unread messages (sent by the other participant) as read
    unread_ids = [
        m["id"]
        for m in messages
        if m.get("sender_id") != user.id and not m.get("read_at")
    ]
    if unread_ids:
        db.table("case_messages").update({"read_at": _now().isoformat()}).in_(
            "id", unread_ids
        ).execute()
        for m in messages:
            if m["id"] in unread_ids:
                m["read_at"] = _now().isoformat()

    return messages


def send_message(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Send a chat message in a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    payload = {
        "matter_id": matter_id,
        "sender_id": user.id,
        "content": data["content"],
        "message_type": data.get("message_type", "text"),
        "attachment_path": data.get("attachment_path"),
    }

    result = db.table("case_messages").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to send message")
    return result.data[0]


# ── Helpers ──────────────────────────────────────────────────────


def _status_to_stage(status: str) -> str:
    """Map matter_status enum to 5-stage client progress."""
    mapping = {
        "draft": "filed",
        "intake": "filed",
        "assessment": "filed",
        "matching": "filed",
        "active": "evidence",  # Default active to evidence; refined by hearings/milestones
        "resolved": "judgment",
        "archived": "judgment",
    }
    return mapping.get(status, "filed")


def _stage_to_client_text(stage: str) -> str:
    """Plain-language status for client."""
    texts = {
        "filed": "Your case has been filed and we're waiting for the court to schedule a hearing.",
        "reply": "The other side has been asked to respond. We're waiting for their reply.",
        "evidence": "Both sides are presenting their evidence and documents to the court.",
        "arguments": "The lawyers are making their arguments before the judge.",
        "judgment": "The court has heard all arguments and will deliver its decision.",
    }
    return texts.get(stage, "Your case is being handled by your lawyer.")
