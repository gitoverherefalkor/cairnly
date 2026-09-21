// Plain text in, Gmail HTML out. The last step before a draft leaves for n8n.
//
// Everything upstream of this file writes plain text: the skeletons Sjoerd
// approved, the model that adapts them, the code link that gets appended. That
// is on purpose, because a mail you can read in a diff is a mail you can
// review. But a plain-text draft can only carry a bare URL, and a demo link
// with six utm parameters in the middle of a sentence is not something you
// want to send a stranger. So the text becomes HTML here, and only here.
//
// The Gmail node in WF11 is set to emailType "html" to match. Flip that back
// and the drafts arrive as visible markup, so the two move together.
//
// One piece of markup is understood: [tekst](url), the same shape the reply
// prompt already uses for [CODELINK]. Everything else is escaped, and a bare
// URL still becomes a link with itself as the label, which is exactly what
// Gmail did for us when the drafts were plain text.

/** `&` first, or the other replacements get escaped a second time. */
export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Matches a markdown link, or a bare URL that is not part of one. Runs over
 * already-escaped text, so the `&` inside a query string arrives here as
 * `&amp;` and goes straight into the href, which is how an ampersand is
 * spelled in HTML anyway.
 */
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+)/g;

/** A sentence ends after a URL more often than a URL ends in punctuation. */
function trimTrailingPunctuation(url: string): { url: string; tail: string } {
  const m = url.match(/[.,;:!?)\]]+$/);
  if (!m) return { url, tail: '' };
  return { url: url.slice(0, -m[0].length), tail: m[0] };
}

function anchor(href: string, label: string): string {
  return `<a href="${href}">${label}</a>`;
}

/** Turn every link in one already-escaped line into an anchor. */
export function linkify(escaped: string): string {
  return escaped.replace(LINK, (whole, mdLabel, mdUrl, bare) => {
    if (mdUrl) return anchor(mdUrl, mdLabel);
    if (!bare) return whole;
    const { url, tail } = trimTrailingPunctuation(bare);
    if (!url) return whole;
    return anchor(url, url) + tail;
  });
}

/**
 * The draft body as Gmail should render it. Line for line, blank line for
 * blank line, because the skeleton's shape is the mail's shape.
 */
export function textToHtml(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const html = lines.map((line) => linkify(escapeHtml(line))).join('<br>');
  return `<div dir="ltr">${html}</div>`;
}

/**
 * The same body without the markup, for anywhere a human reads the text rather
 * than a mail client: logs, a fallback, a test that cares about the words.
 */
export function toPlainText(body: string): string {
  return body.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2');
}
