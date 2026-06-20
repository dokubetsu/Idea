from app.domains.notifications.templates.base import BaseNotificationTemplate
from app.domains.notifications.templates.generic import GenericTemplate
from app.domains.notifications.templates.matter_assigned import MatterAssignedTemplate
from app.domains.notifications.templates.hearing_scheduled import HearingScheduledTemplate
from app.domains.notifications.templates.milestone_completed import MilestoneCompletedTemplate
from app.domains.notifications.templates.comment_added import CommentAddedTemplate

_TEMPLATES = {
    "matter_assigned": MatterAssignedTemplate,
    "hearing_scheduled": HearingScheduledTemplate,
    "milestone_completed": MilestoneCompletedTemplate,
    "comment_added": CommentAddedTemplate,
}

def get_template(event_type: str, data: dict) -> BaseNotificationTemplate:
    template_cls = _TEMPLATES.get(event_type, GenericTemplate)
    return template_cls(data)
