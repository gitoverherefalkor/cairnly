import DOMPurify from 'dompurify';

/**
 * Renders the agent's light markdown for chat bubbles: `**bold**` emphasis
 * (same convention as the survey's choice labels) plus `- ` bullet lists,
 * which the pitch uses for its "threads." Sanitized to a small tag set; the
 * bubble styles ul/li/p via arbitrary child selectors.
 */
export function formatRichText(text: string): { __html: string } {
  const bold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const out: string[] = [];
  let inList = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${bold(bullet[1])}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (line.trim()) out.push(`<p>${bold(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return { __html: DOMPurify.sanitize(out.join(''), { ALLOWED_TAGS: ['strong', 'br', 'ul', 'li', 'p'] }) };
}

/** Tailwind child-selector styling for the sanitized rich-text HTML above. */
export const RICH_TEXT_CLASSES =
  '[&_p]:m-0 [&_p:not(:first-child)]:mt-3 ' +
  '[&_ul]:my-2.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 ' +
  "[&_li]:relative [&_li]:pl-4 [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.6em] [&_li]:before:h-1.5 [&_li]:before:w-1.5 [&_li]:before:rounded-full [&_li]:before:bg-[#27A1A1]";
