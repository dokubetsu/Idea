import logging
from app.shared import database
from app.shared.events import subscribe, EventType, emit
from app.domains.notifications.service import create_notification

log = logging.getLogger(__name__)


async def handle_domain_event(
    event_type: str | EventType,
    actor_id: str | None,
    matter_id: str | None,
    payload: dict,
) -> None:
    event_str = (
        event_type.value if isinstance(event_type, EventType) else str(event_type)
    )
    if not matter_id and event_str != "lawyer.suspended":
        return

    if isinstance(event_type, str):
        try:
            event_type = EventType(event_type)
        except ValueError:
            pass

    db = database.get_service_role_db()

    if event_str == "lawyer.suspended":
        lawyer_id = payload.get("lawyer_id")
        if not lawyer_id:
            return
        try:
            matters_resp = (
                db.table("matters")
                .select("id, title, user_id")
                .eq("lawyer_id", lawyer_id)
                .not_.in_("status", ["resolved", "archived"])
                .execute()
            )
            affected_matters = matters_resp.data or []
        except Exception as e:
            log.error(
                "Failed to query matters for suspended lawyer %s: %s", lawyer_id, e
            )
            return

        for m in affected_matters:
            m_id = m["id"]
            m_title = m["title"]
            c_id = m["user_id"]
            try:
                db.table("matters").update(
                    {"lawyer_id": None, "status": "matching"}
                ).eq("id", m_id).execute()

                await emit(
                    EventType.MATTER_STATUS_CHANGED,
                    actor_id=actor_id,
                    matter_id=m_id,
                    payload={
                        "old_status": "active",
                        "new_status": "matching",
                        "reason": "Lawyer suspended",
                    },
                )

                if c_id:
                    create_notification(
                        db,
                        user_id=c_id,
                        type_name="lawyer_suspended",
                        data={
                            "subject": "Case Update: Advocate Suspended",
                            "body": f"The advocate assigned to your case '{m_title}' has been suspended. Your case has been moved back to the matching pool.",
                            "matter_title": m_title,
                            "matter_id": m_id,
                        },
                        action={"label": "View Case", "url": f"/user/matters/{m_id}"},
                    )
            except Exception as e:
                log.error("Failed to reassign/notify for matter %s: %s", m_id, e)
        return

    # NOTE: The subscriber runs in a background asyncio task where the request-scoped
    # ContextVar has been cleared by middleware. Using get_service_role_db() explicitly
    # here is correct — we need full access to look up matters and create notifications.
    try:
        m_row = (
            db.table("matters")
            .select("title, user_id, lawyer_id, client_email")
            .eq("id", matter_id)
            .execute()
            .data
        )
        if not m_row:
            return
        matter = m_row[0]
    except Exception as e:
        log.error("Subscriber failed to fetch matter %s: %s", matter_id, e)
        return

    client_id = matter.get("user_id")
    lawyer_id = matter.get("lawyer_id")
    matter_title = matter.get("title", "Case")

    # Map events to notifications
    if event_type == EventType.LAWYER_ASSIGNED:
        if client_id:
            lawyer_name = "an advocate"
            if lawyer_id:
                try:
                    prof_resp = (
                        db.table("profiles")
                        .select("full_name")
                        .eq("id", lawyer_id)
                        .single()
                        .execute()
                    )
                    if prof_resp.data:
                        lawyer_name = prof_resp.data["full_name"]
                except Exception:
                    pass
            create_notification(
                db,
                user_id=client_id,
                type_name="matter_assigned",
                data={
                    "matter_title": matter_title,
                    "lawyer_name": lawyer_name,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/user/matters/{matter_id}"},
            )

    elif event_type in (EventType.HEARING_SCHEDULED, EventType.HEARING_UPDATED):
        hearing_date = payload.get("hearing_date") or "TBD"
        courtroom = payload.get("courtroom") or "TBD"

        if hearing_date == "TBD" or courtroom == "TBD":
            hearing_id = payload.get("hearing_id")
            if hearing_id:
                try:
                    hearing_resp = (
                        db.table("hearings")
                        .select("hearing_date, courtroom")
                        .eq("id", hearing_id)
                        .single()
                        .execute()
                    )
                    if hearing_resp.data:
                        hearing_date = (
                            hearing_resp.data.get("hearing_date") or hearing_date
                        )
                        courtroom = hearing_resp.data.get("courtroom") or courtroom
                except Exception:
                    pass

        if client_id:
            create_notification(
                db,
                user_id=client_id,
                type_name="hearing_scheduled",
                data={
                    "matter_title": matter_title,
                    "hearing_date": hearing_date,
                    "courtroom": courtroom,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/user/matters/{matter_id}"},
            )
        if lawyer_id:
            create_notification(
                db,
                user_id=lawyer_id,
                type_name="hearing_scheduled",
                data={
                    "matter_title": matter_title,
                    "hearing_date": hearing_date,
                    "courtroom": courtroom,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/lawyer/matters/{matter_id}"},
            )

    elif event_type == EventType.MILESTONE_UPDATED:
        if payload.get("status") == "completed":
            milestone_title = payload.get("title", "a milestone")
            if client_id:
                create_notification(
                    db,
                    user_id=client_id,
                    type_name="milestone_completed",
                    data={
                        "matter_title": matter_title,
                        "milestone_title": milestone_title,
                        "matter_id": matter_id,
                    },
                    action={"label": "View Case", "url": f"/user/matters/{matter_id}"},
                )

    elif event_type in (EventType.LAWYER_ACCEPTED, EventType.LAWYER_DECLINED):
        decision_type = (
            "lawyer_accepted"
            if event_type == EventType.LAWYER_ACCEPTED
            else "lawyer_declined"
        )
        if client_id:
            create_notification(
                db,
                user_id=client_id,
                type_name=decision_type,
                data={
                    "matter_title": matter_title,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/user/matters/{matter_id}"},
            )

    elif event_type == EventType.UPDATE_POSTED:
        author_name = payload.get("author_name", "Someone")

        # If lawyer posted, notify user
        if actor_id == lawyer_id and client_id:
            create_notification(
                db,
                user_id=client_id,
                type_name="comment_added",
                data={
                    "matter_title": matter_title,
                    "author_name": author_name,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/user/matters/{matter_id}"},
            )
        # If user posted, notify lawyer
        elif actor_id == client_id and lawyer_id:
            create_notification(
                db,
                user_id=lawyer_id,
                type_name="comment_added",
                data={
                    "matter_title": matter_title,
                    "author_name": author_name,
                    "matter_id": matter_id,
                },
                action={"label": "View Case", "url": f"/lawyer/matters/{matter_id}"},
            )


def init_subscriber():
    subscribe(handle_domain_event)
