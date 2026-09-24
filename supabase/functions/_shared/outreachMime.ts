// The complete outgoing message, as Gmail's messages/send wants it: RFC 2822,
// base64url, in the `raw` field.
//
// This replaced the Gmail draft as the unit of work (2026-09-24). A draft got
// its threading and its quoted history from Gmail; a composed message has to
// carry them itself, so this file is where a reply learns to look like a
// reply:
//   - Message-ID is generated HERE, stored on the concept before sending, so
//     the sync recognises our own mail when it reads it back and a later
//     chase can reference it;
//   - In-Reply-To / References make the recipient's client thread it;
//   - a reply quotes their mail below ours, the way Gmail's web client does;
//   - only a first mail carries the full signature (see outreachSignature.ts).
// Both a text/plain and a text/html part, so a strict receiver has something
// readable and the mail is not weighed as HTML-only.
//
// Pattern ported from OutsideInput's _outreach/lib/outreachQueue.ts buildMime;
// the repos stay independent, so this is a copy, not an import.

import { escapeHtml, textToHtml, toPlainText } from './outreachHtml.ts';
import { SIGNATURE_HTML, SIGNATURE_TEXT } from './outreachSignature.ts';

export const FROM_HEADER = 'Sjoerd Geurts <sjoerd@cairnly.io>';

export interface MimeQuote {
  /** When they sent it, ISO. */
  at: string;
  name: string | null;
  email: string;
  /** What they typed, quoted history already stripped. */
  text: string;
}

export interface MimeInput {
  to: string;
  subject: string;
  /** Plain text with [label](url) links, as every generator writes it. */
  body: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** First mail only. */
  signature: boolean;
  /** Replies only. */
  quote?: MimeQuote | null;
  date?: Date;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8ToBase64(s)}?=`);
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n');
/** Header values must not smuggle in a line break. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

/** `<occ.<time>.<random>@cairnly.io>`: unique, and recognisably ours. */
export function newMessageId(now: Date = new Date()): string {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `<occ.${now.getTime().toString(36)}.${rand[0].toString(36)}${rand[1].toString(36)}@cairnly.io>`;
}

const NL_DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "Op do 24 sep 2026 om 10:52 schreef Ingrid <i@x.nl>:", Amsterdam time, as Gmail NL writes it. */
export function quoteHeader(at: string, name: string | null, email: string): string {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const who = name ? `${name} <${email}>` : `<${email}>`;
  return `Op ${NL_DAYS[dow]} ${d} ${NL_MONTHS[m - 1]} ${y} om ${get('hour')}:${get('minute')} schreef ${who}:`;
}

function htmlBody(i: MimeInput): string {
  let html = textToHtml(i.body);
  if (i.signature) html += `<br>${SIGNATURE_HTML}`;
  if (i.quote) {
    const quoted = i.quote.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => escapeHtml(l))
      .join('<br>');
    html +=
      `<br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">${escapeHtml(quoteHeader(i.quote.at, i.quote.name, i.quote.email))}<br></div>` +
      `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${quoted}</blockquote></div>`;
  }
  return html;
}

function textBody(i: MimeInput): string {
  let text = toPlainText(i.body);
  if (i.signature) text += `\n\n${SIGNATURE_TEXT}`;
  if (i.quote) {
    const quoted = i.quote.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => (l ? `> ${l}` : '>'))
      .join('\n');
    text += `\n\n${quoteHeader(i.quote.at, i.quote.name, i.quote.email)}\n${quoted}`;
  }
  return text;
}

export function buildMime(i: MimeInput): string {
  const boundary = `occ_${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  const headers = [
    `From: ${FROM_HEADER}`,
    `To: ${oneLine(i.to)}`,
    `Subject: ${encodeHeader(oneLine(i.subject))}`,
    `Date: ${(i.date ?? new Date()).toUTCString()}`,
    `Message-ID: ${oneLine(i.messageId)}`,
    ...(i.inReplyTo ? [`In-Reply-To: ${oneLine(i.inReplyTo)}`] : []),
    ...(i.references ? [`References: ${oneLine(i.references)}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const lines = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(utf8ToBase64(textBody(i))),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(utf8ToBase64(htmlBody(i))),
    `--${boundary}--`,
    '',
  ];
  return utf8ToBase64(lines.join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
