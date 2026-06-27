"""
Email notification channel.

When RESEND_API_KEY is set → sends a real HTML email via the Resend REST API.
When blank              → logs a formatted preview to the console (mock mode).

No extra SDK needed — uses httpx which is already a project dependency.
"""

import logging
import httpx

from app.config import settings
from app.domains.notifications.channels.base import BaseNotificationChannel

log = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


class EmailChannel(BaseNotificationChannel):
    def send(
        self,
        notification: dict,
        recipient_info: dict,
        rendered_subject: str,
        rendered_body: str,
    ) -> None:
        email = recipient_info.get("email")
        if not email:
            raise ValueError("Recipient has no email address configured")

        # ── Real delivery ─────────────────────────────────────────────────
        if settings.RESEND_API_KEY:
            html_body = notification.get("_html_body") or _text_to_html(
                rendered_body, rendered_subject
            )
            self._send_via_resend(email, rendered_subject, html_body)
        else:
            # ── Mock / dev fallback ───────────────────────────────────────
            log.info(
                "\n"
                "========================================================================\n"
                "📧 [MOCK EMAIL OUTBOX] No RESEND_API_KEY set — logging only\n"
                "To:      %s\n"
                "Subject: %s\n"
                "Body:    %s\n"
                "========================================================================",
                email,
                rendered_subject,
                rendered_body,
            )

    # ─────────────────────────────────────────────────────────────────────
    def _send_via_resend(self, to: str, subject: str, html: str) -> None:
        payload = {
            "from": settings.RESEND_FROM_ADDRESS,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        }
        try:
            resp = httpx.post(_RESEND_URL, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            log.info("📧 Email sent via Resend → id=%s to=%s", data.get("id"), to)
        except httpx.HTTPStatusError as exc:
            log.error(
                "Resend delivery failed: status=%s body=%s",
                exc.response.status_code,
                exc.response.text,
            )
            raise
        except Exception as exc:
            log.error("Resend delivery error: %s", exc)
            raise


# ── Minimal text-to-HTML fallback ─────────────────────────────────────────────
def _text_to_html(body: str, subject: str) -> str:
    """Wraps plain-text body in the branded LeAd email layout."""
    lines = "".join(
        f"<p style='margin:0 0 12px'>{line}</p>"
        for line in body.split("\n")
        if line.strip()
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0D1B2A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B2A;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#112236;border-radius:16px;border:1px solid rgba(201,168,76,0.15);overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#112236,#0D1B2A);padding:28px 32px;border-bottom:1px solid rgba(201,168,76,0.2);">
            <span style="font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:0.5px;">⚖ LeAd</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#D1D5DB;font-size:15px;line-height:1.7;">
            <h2 style="color:#FFFFFF;font-size:18px;margin:0 0 20px;font-weight:600;">{subject}</h2>
            {lines}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:#6B7280;">
              © LeAd Legal Platform &nbsp;·&nbsp;
              <a href="{settings.APP_URL}/user/notifications" style="color:#C9A84C;text-decoration:none;">Manage notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
