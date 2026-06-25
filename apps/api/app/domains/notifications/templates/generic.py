from app.domains.notifications.templates.base import BaseNotificationTemplate

class GenericTemplate(BaseNotificationTemplate):
    def render_subject(self) -> str:
        return self.data.get("subject", "LeAd Update")

    def render_body(self) -> str:
        return self.data.get("body", "You have a new notification from the LeAd platform.")
