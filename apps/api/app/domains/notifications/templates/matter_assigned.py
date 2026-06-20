from app.domains.notifications.templates.base import BaseNotificationTemplate


class MatterAssignedTemplate(BaseNotificationTemplate):
    def render_subject(self) -> str:
        title = self.data.get("matter_title", "Case")
        return f"Advocate Assigned: {title}"

    def render_body(self) -> str:
        title       = self.data.get("matter_title", "your case")
        lawyer_name = self.data.get("lawyer_name", "a lawyer")
        return (
            f"Good news! Advocate {lawyer_name} has been assigned to your case '{title}'. "
            f"You can now track all updates, hearings, and documents directly on Nyay."
        )

    def _html_content(self) -> str:
        title       = self.data.get("matter_title", "your case")
        lawyer_name = self.data.get("lawyer_name", "a lawyer")
        return f"""
<p style="margin:0 0 16px;color:#D1D5DB;">
  Great news — your case has been assigned to an advocate who will represent you.
</p>
<table cellpadding="0" cellspacing="0" width="100%"
       style="background:rgba(201,168,76,0.07);border-radius:10px;border:1px solid rgba(201,168,76,0.18);
              margin-bottom:20px;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0 0 6px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Case</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#FFFFFF;">{title}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 20px 16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Assigned Advocate</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#C9A84C;">⚖ {lawyer_name}</p>
    </td>
  </tr>
</table>
<p style="margin:0;color:#9CA3AF;font-size:13px;">
  Log in to Nyay to view your case timeline, upcoming hearings, and send messages to your advocate.
</p>"""
