from typing import Dict, Any


class BaseNotificationTemplate:
    def __init__(self, data: Dict[str, Any]):
        self.data = data

    def render_subject(self) -> str:
        raise NotImplementedError()

    def render_body(self) -> str:
        raise NotImplementedError()

    def render_html_body(self) -> str:
        """
        Renders a branded HTML email.
        Subclasses override _html_content() to inject custom body markup.
        The outer layout (header, footer, wrapper) is shared.
        """
        subject   = self.render_subject()
        content   = self._html_content()
        action    = self.data.get("action") or {}
        action_url   = action.get("url", "") if isinstance(action, dict) else ""
        action_label = action.get("label", "View Case") if isinstance(action, dict) else "View Case"
        base_url  = "http://localhost:3001"  # overridden by env in prod
        full_url  = f"{base_url}{action_url}" if action_url else base_url

        cta_block = (
            f"""<tr><td align="center" style="padding:0 32px 28px;">
              <a href="{full_url}" style="display:inline-block;padding:12px 28px;background:#C9A84C;
                 color:#0D1B2A;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;
                 letter-spacing:0.3px;">{action_label} →</a>
            </td></tr>"""
            if action_url else ""
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
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#112236;border-radius:16px;border:1px solid rgba(201,168,76,0.2);
                    overflow:hidden;max-width:560px;width:100%;">

        <!-- ─── Header ─── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f2035,#0D1B2A);
                     padding:24px 32px;border-bottom:1px solid rgba(201,168,76,0.2);">
            <span style="font-size:20px;font-weight:700;color:#C9A84C;letter-spacing:0.5px;">⚖ LeAd</span>
            <span style="font-size:12px;color:#6B7280;margin-left:8px;">Legal Advisor</span>
          </td>
        </tr>

        <!-- ─── Body ─── -->
        <tr>
          <td style="padding:32px 32px 24px;color:#D1D5DB;font-size:15px;line-height:1.7;">
            <h2 style="color:#FFFFFF;font-size:17px;margin:0 0 18px;font-weight:600;
                       border-left:3px solid #C9A84C;padding-left:12px;">{subject}</h2>
            {content}
          </td>
        </tr>

        <!-- ─── CTA button ─── -->
        {cta_block}

        <!-- ─── Footer ─── -->
        <tr>
          <td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:#4B5563;line-height:1.6;">
              You're receiving this because you have an active case on LeAd.<br/>
              <a href="{base_url}/user/notifications"
                 style="color:#C9A84C;text-decoration:none;">Manage notification preferences</a>
              &nbsp;·&nbsp; © LeAd Legal Advisor
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    def _html_content(self) -> str:
        """Override in subclasses to provide custom HTML body content."""
        body = self.render_body()
        lines = "".join(
            f"<p style='margin:0 0 10px;'>{line}</p>"
            for line in body.split("\n") if line.strip()
        )
        return lines
