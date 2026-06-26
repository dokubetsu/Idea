import logging
from app.shared import database
from app.shared.events import subscribe, EventType
from app.domains.notifications.service import create_notification

log = logging.getLogger(__name__)


async def handle_domain_event(
    event_type: str | EventType,
    actor_id: str | None,
    matter_id: str | None,
    payload: dict,
) -> None:
    if not matter_id:
        return

    if isinstance(event_type, str):
        try:
            event_type = EventType(event_type)
        except ValueError:
            pass

    db = database.get_db()
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
        hearing_date = payload.get("hearing_date", "TBD")
        courtroom = payload.get("courtroom", "TBD")

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
