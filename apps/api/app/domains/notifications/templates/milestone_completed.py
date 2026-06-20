from app.domains.notifications.templates.base import BaseNotificationTemplate


class MilestoneCompletedTemplate(BaseNotificationTemplate):
    def render_subject(self) -> str:
        milestone = self.data.get("milestone_title", "Milestone")
        return f"Milestone Reached: {milestone}"

    def render_body(self) -> str:
        title     = self.data.get("matter_title", "your case")
        milestone = self.data.get("milestone_title", "a milestone")
        return (
            f"A key milestone has been completed for your case '{title}': {milestone}. "
            f"Log in to Nyay to see the updated progress timeline."
        )

    def _html_content(self) -> str:
        title     = self.data.get("matter_title", "your case")
        milestone = self.data.get("milestone_title", "a milestone")
        return f"""
<p style="margin:0 0 16px;color:#D1D5DB;">
  Your case has progressed — a milestone has been marked complete by your advocate.
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
    <td style="padding:0 20px 16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">✅ Milestone Completed</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#C9A84C;">{milestone}</p>
    </td>
  </tr>
</table>
<p style="margin:0;color:#9CA3AF;font-size:13px;">
  View your full case timeline to see all completed and upcoming milestones.
</p>"""
