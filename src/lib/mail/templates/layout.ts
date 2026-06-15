export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DentaFlow</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 12px;text-align:center;">
              <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#22d3ee);color:#09090b;font-weight:700;line-height:40px;font-size:18px;">D</div>
              <p style="margin:12px 0 0;color:#fafafa;font-size:18px;font-weight:600;">DentaFlow</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;color:#d4d4d8;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #27272a;color:#71717a;font-size:12px;text-align:center;">
              Secure · Data Privacy · Built for dental clinics
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#06b6d4);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;font-size:15px;">
      ${label}
    </a>
  </p>`;
}
