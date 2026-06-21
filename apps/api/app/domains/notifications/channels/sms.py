"""
SMS notification channel.

When TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are set → sends a real SMS via
the Twilio Messages REST API (no Twilio SDK required — uses httpx + HTTP Basic Auth).

When blank → logs a formatted preview to the console (mock mode).
"""
import logging
import httpx

from app.config import settings
from app.domains.notifications.channels.base import BaseNotificationChannel

log = logging.getLogger(__name__)


class SMSChannel(BaseNotificationChannel):
    def send(
        self,
        notification: dict,
        recipient_info: dict,
        rendered_subject: str,
        rendered_body: str,
    ) -> None:
        phone = recipient_info.get("phone")
        if not phone:
            raise ValueError("Recipient has no phone number configured")

        # ── Real delivery ─────────────────────────────────────────────────
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            # SMS body is concise: subject + first sentence of body (≤ 160 chars)
            sms_text = _build_sms_text(rendered_subject, rendered_body)
            self._send_via_twilio(phone, sms_text)
        else:
            # ── Mock / dev fallback ───────────────────────────────────────
            log.info(
                "\n"
                "========================================================================\n"
                "💬 [MOCK SMS OUTBOX] No TWILIO credentials set — logging only\n"
                "To:   %s\n"
                "Body: %s\n"
                "========================================================================",
                phone,
                rendered_body,
            )

    # ─────────────────────────────────────────────────────────────────────
    def _send_via_twilio(self, to: str, body: str) -> None:
        account_sid = settings.TWILIO_ACCOUNT_SID
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"

        try:
            resp = httpx.post(
                url,
                data={
                    "From": settings.TWILIO_FROM_NUMBER,
                    "To": to,
                    "Body": body,
                },
                auth=(account_sid, settings.TWILIO_AUTH_TOKEN),
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            log.info("💬 SMS sent via Twilio → sid=%s to=%s", data.get("sid"), to)
        except httpx.HTTPStatusError as exc:
            log.error(
                "Twilio delivery failed: status=%s body=%s",
                exc.response.status_code,
                exc.response.text,
            )
            raise
        except Exception as exc:
            log.error("Twilio delivery error: %s", exc)
            raise


# ── Helpers ───────────────────────────────────────────────────────────────────
def _build_sms_text(subject: str, body: str) -> str:
    """Build a concise SMS message (≤ 160 chars) from subject + body."""
    prefix = f"[LeAd] {subject}: "
    budget = 160 - len(prefix)
    first_sentence = body.split(".")[0].strip() if body else ""
    truncated = first_sentence[:budget] if len(first_sentence) > budget else first_sentence
    return f"{prefix}{truncated}"
