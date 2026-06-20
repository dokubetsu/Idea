from app.domains.notifications.templates.base import BaseNotificationTemplate


class CommentAddedTemplate(BaseNotificationTemplate):
    def render_subject(self) -> str:
        author = self.data.get("author_name", "Someone")
        return f"New Message from {author}"

    def render_body(self) -> str:
        title   = self.data.get("matter_title", "your case")
        author  = self.data.get("author_name", "Someone")
        preview = self.data.get("preview", "")
        body = f"{author} posted a new message on your case '{title}'."
        if preview:
            body += f" \"{preview}\""
        return body

    def _html_content(self) -> str:
        title   = self.data.get("matter_title", "your case")
        author  = self.data.get("author_name", "Someone")
        preview = self.data.get("preview", "")
        preview_block = (
            f"""<tr>
              <td style="padding:0 20px 16px;">
                <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Message Preview</p>
                <p style="margin:0;font-size:14px;color:#E5E7EB;font-style:italic;">"{preview}"</p>
              </td>
            </tr>"""
            if preview else ""
        )
        return f"""
<p style="margin:0 0 16px;color:#D1D5DB;">
  You have a new message from your advocate — reply from within Nyay to keep communications organised.
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
      <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">💬 From</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#C9A84C;">{author}</p>
    </td>
  </tr>
  {preview_block}
</table>
<p style="margin:0;color:#9CA3AF;font-size:13px;">
  Reply directly on Nyay to keep all case communications in one place.
</p>"""
