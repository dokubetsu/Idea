class BaseNotificationChannel:
    def send(self, notification: dict, recipient_info: dict, rendered_subject: str, rendered_body: str) -> None:
        raise NotImplementedError()
