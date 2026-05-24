// Cairnly transactional email chrome — shared HTML scaffold used by all
// outgoing emails. Cream-paper body, dark navy banner (cairn-trail photo +
// logo + gold rule baked in), gold accents, tan hairlines, teal CTAs.
//
// Tables-for-layout + inline styles for 90%+ client compatibility. Web fonts
// load via <link>; clients that strip web fonts (Gmail, Outlook desktop)
// fall back to a system sans (Segoe UI / Helvetica Neue / Arial), never serif.
//
// Usage:
//   import { renderEmail, paragraph, callout, cta, bullet, escapeHtml }
//     from "../_shared/email-chrome.ts";
//
//   const html = renderEmail({
//     title:     "Your Cairnly Access Code",
//     preheader: "Your purchase was successful.",
//     bodyHtml:  h1("Welcome to Cairnly!") + paragraph("..."),
//     footer:    "generic", // or "reminder"
//   });

export const EMAIL_BANNER_URL = "https://cairnly.io/email-banner.jpg";

// ─── Inline helpers for body content ──────────────────────────────────────

export function h1(text: string): string {
  return `<h1 class="h1-mob" style="margin:0 0 22px 0;font-family:'Poppins','Inter','Segoe UI','Helvetica Neue',Arial,sans-serif;color:#122E3B;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-0.5px;">${text}</h1>`;
}

export function paragraph(
  text: string,
  opts: { size?: number; color?: string; mb?: number; align?: string; weight?: number } = {},
): string {
  const size = opts.size ?? 16;
  const color = opts.color ?? "#3D4A53";
  const mb = opts.mb ?? 18;
  const align = opts.align ?? "left";
  const weight = opts.weight ?? 500;
  return `<p style="margin:0 0 ${mb}px 0;color:${color};font-size:${size}px;line-height:1.65;text-align:${align};font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:${weight};">${text}</p>`;
}

export function fineprint(text: string): string {
  return `<p style="margin:24px 0 0 0;color:#6B7480;font-size:13px;line-height:1.6;font-family:'Inter','Segoe UI',Arial,sans-serif;">${text}</p>`;
}

export function callout(eyebrowText: string, bodyHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;background-color:#E0D6BD;border-left:3px solid #EFBE48;border-radius:0 12px 12px 0;">
  <tr><td style="padding:20px 24px;font-family:'Inter','Segoe UI',Arial,sans-serif;">
    ${eyebrowText ? `<p style="margin:0 0 12px 0;color:#122E3B;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;font-weight:700;font-family:'Poppins','Inter',Arial,sans-serif;">${eyebrowText}</p>` : ""}
    ${bodyHtml}
  </td></tr>
</table>`;
}

/** Single-line checklist row with a gold check. */
export function bullet(text: string): string {
  return `<tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;"><span style="color:#D4A024;margin-right:10px;font-weight:700;">&#10003;</span>${text}</td></tr>`;
}

/** Teal pill CTA. */
export function cta(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 4px auto;">
  <tr><td style="border-radius:12px;background-color:#27A1A1;box-shadow:0 10px 30px -8px rgba(39,161,161,0.55);mso-padding-alt:18px 38px;">
    <a href="${href}" style="display:inline-block;padding:17px 40px;font-family:'Poppins','Inter','Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.4px;border-radius:12px;">${text}</a>
  </td></tr>
</table>`;
}

/** CTA wrapped in a full-width <tr><td> ready to drop between body and footer. */
export function ctaRow(text: string, href: string): string {
  return `<tr><td align="center" style="padding:8px 40px 32px;background-color:#ECE4D2;" class="px-mob">${cta(text, href)}</td></tr>`;
}

/** Wrap arbitrary body HTML in the standard cream-paper body cell. */
export function bodyRow(inner: string): string {
  return `<tr><td style="padding:44px 48px 24px;font-family:'Inter','Segoe UI',Arial,sans-serif;background-color:#ECE4D2;" class="px-mob">${inner}</td></tr>`;
}

/** HTML-escape user-supplied strings before injecting into the body. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Outer chrome ─────────────────────────────────────────────────────────

const SHARED_HEAD = (title: string, preheader: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 480px) {
    .px-mob { padding-left: 24px !important; padding-right: 24px !important; }
    .h1-mob { font-size: 24px !important; line-height: 1.22 !important; }
    .code-mob { font-size: 20px !important; letter-spacing: 4px !important; }
  }
  a { color: #1F8282; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#213F4F;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`;

const SHARED_BANNER = (width: number) => `<tr><td style="background-color:#27A1A1;height:3px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
<tr><td style="line-height:0;font-size:0;background-color:#122E3B;">
  <img src="${EMAIL_BANNER_URL}" alt="Cairnly - career path clarity." width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">
</td></tr>`;

const FOOTER_GENERIC = `<tr><td style="padding:0 48px 36px;background-color:#ECE4D2;font-family:'Inter','Segoe UI',Arial,sans-serif;" class="px-mob">
  <div style="height:1px;line-height:1px;font-size:0;background-color:#C9B690;margin:8px 0 22px;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="vertical-align:middle;">
        <p style="margin:0;color:#1F8282;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;font-weight:700;font-family:'Poppins','Inter',Arial,sans-serif;">Cairnly</p>
      </td>
      <td style="vertical-align:middle;text-align:right;color:#6B7480;font-size:11px;letter-spacing:0.2px;">
        &copy; 2026 Cairnly. All rights reserved.
      </td>
    </tr>
  </table>
</td></tr>`;

const FOOTER_REMINDER = `<tr><td style="padding:0 48px 36px;background-color:#ECE4D2;font-family:'Inter','Segoe UI',Arial,sans-serif;" class="px-mob">
  <div style="height:1px;line-height:1px;font-size:0;background-color:#C9B690;margin:8px 0 22px;">&nbsp;</div>
  <p style="margin:0 0 10px;color:#6B7480;font-size:12px;line-height:1.6;">
    You're receiving this because you have a Cairnly account.<br>
    To stop these reminders, visit <a href="https://cairnly.io/profile" style="color:#1F8282;text-decoration:underline;">your Profile Settings</a>.
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
    <tr>
      <td style="vertical-align:middle;">
        <p style="margin:0;color:#1F8282;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;font-weight:700;font-family:'Poppins','Inter',Arial,sans-serif;">Cairnly</p>
      </td>
      <td style="vertical-align:middle;text-align:right;color:#6B7480;font-size:11px;letter-spacing:0.2px;">
        &copy; 2026 Cairnly. All rights reserved.
      </td>
    </tr>
  </table>
</td></tr>`;

/**
 * Compose a Cairnly transactional email.
 *
 * `bodyHtml` should be one or more `<tr>...</tr>` rows (use the `bodyRow()`
 * and `ctaRow()` helpers, or write your own `<tr><td>...</td></tr>`).
 */
export function renderEmail(args: {
  title: string;
  preheader: string;
  bodyHtml: string;
  width?: number; // default 600; support email uses 640
  footer?: "generic" | "reminder";
}): string {
  const { title, preheader, bodyHtml } = args;
  const width = args.width ?? 600;
  const footer = (args.footer ?? "generic") === "reminder" ? FOOTER_REMINDER : FOOTER_GENERIC;

  return `${SHARED_HEAD(title, preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#213F4F;">
<tr><td align="center" style="padding:36px 12px;">
<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;width:100%;background-color:#ECE4D2;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px -28px rgba(0,0,0,0.55);">
${SHARED_BANNER(width)}
${bodyHtml}
${footer}
</table>
</td></tr></table>
</body>
</html>`;
}
