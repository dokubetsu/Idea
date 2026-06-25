from app.domains.notifications.templates.base import BaseNotificationTemplate


class HearingScheduledTemplate(BaseNotificationTemplate):
    def render_subject(self) -> str:
        title = self.data.get("matter_title", "Case")
        return f"Hearing Scheduled — {title}"

    def render_body(self) -> str:
        title        = self.data.get("matter_title", "your case")
        hearing_date = self.data.get("hearing_date", "TBD")
        courtroom    = self.data.get("courtroom", "TBD")
        return (
            f"A hearing has been scheduled for your case '{title}' on {hearing_date}. "
            f"Courtroom: {courtroom}. Please confirm attendance with your advocate."
        )

    def _html_content(self) -> str:
        title        = self.data.get("matter_title", "your case")
        hearing_date = self.data.get("hearing_date", "TBD")
        courtroom    = self.data.get("courtroom", "TBD")
        purpose      = self.data.get("purpose", "")
        return f"""
<p style="margin:0 0 16px;color:#D1D5DB;">
  A new court hearing has been scheduled for your case. Please mark your calendar.
</p>
<table cellpadding="0" cellspacing="0" width="100%"
       style="background:rgba(201,168,76,0.07);border-radius:10px;border:1px solid rgba(201,168,76,0.18);
              margin-bottom:20px;">
  <tr>
    <td style="padding:16px 20px 8px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Case</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">{title}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 20px 8px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">📅 Date &amp; Time</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#C9A84C;">{hearing_date}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 20px {('8px' if purpose else '16px')};">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">🏛 Courtroom</p>
      <p style="margin:0;font-size:14px;color:#E5E7EB;">{courtroom}</p>
    </td>
  </tr>
  {f'''<tr>
    <td style="padding:0 20px 16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Purpose</p>
      <p style="margin:0;font-size:14px;color:#E5E7EB;">{purpose}</p>
    </td>
  </tr>''' if purpose else ''}
</table>
<p style="margin:0;color:#9CA3AF;font-size:13px;">
  Contact your advocate on LeAd if you have any questions about this hearing.
</p>"""
