from __future__ import annotations

from datetime import date, datetime

from app.domains.docket.services.helpers import (
    _get_matter_for_participant,
    _now,
    _stage_to_client_text,
    _status_to_stage,
    _today,
)
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole


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
            "wip": wip,
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
