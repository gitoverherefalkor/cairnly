// Saved responses in the printed report.
//
// A saved response is a coach chat message the user kept, stored verbatim in
// the chat_highlights section by wrap-up-save. Coach messages usually end with
// a follow-up question ("What stands out most? Your answer will help sharpen
// how this section reads in your report."). That reads oddly in a finished
// report, so the print drops that closing question paragraph. The dashboard
// keeps the message as saved.
//
// Headings must match `wrapUpLabels` in supabase/functions/wrap-up-save.

const SAVED_HEADING = /^#{3,5}\s*(?:Saved Responses|Bewaarde antwoorden)\s*$/im;
const NEXT_HEADING = /^#{3,5}\s+/m;
const RESPONSE_LABEL = /^\*\*(?:Saved response|Bewaard antwoord)\s+\d+\*\*\s*$/i;

/** True for a closing paragraph that only asks the user something. */
function isFollowUp(paragraph: string): boolean {
  const p = paragraph.trim();
  return (
    /\?["”']?$/.test(p) ||
    /\b(?:your answer|uw antwoord|je antwoord)\b[^.?!]*[.!]$/i.test(p)
  );
}

/** Drop the trailing follow-up question from one saved message, keeping at
 *  least one paragraph. */
function trimMessage(message: string): string {
  const paragraphs = message.trim().split(/\n\s*\n/);
  while (paragraphs.length > 1 && isFollowUp(paragraphs[paragraphs.length - 1])) {
    paragraphs.pop();
  }
  return paragraphs.join('\n\n');
}

export function stripSavedFollowUps(content: string): string {
  const head = content.search(SAVED_HEADING);
  if (head === -1) return content;
  const headingEnd = content.indexOf('\n', head);
  if (headingEnd === -1) return content;
  const rest = content.slice(headingEnd + 1);
  const nextIdx = rest.search(NEXT_HEADING);
  const block = nextIdx === -1 ? rest : rest.slice(0, nextIdx);
  const after = nextIdx === -1 ? '' : rest.slice(nextIdx);

  // Split the block into [label, message, label, message, ...].
  const lines = block.split('\n');
  const out: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) out.push(trimMessage(current.join('\n')));
    current = [];
  };
  for (const line of lines) {
    if (RESPONSE_LABEL.test(line.trim())) {
      flush();
      out.push(line.trim());
    } else {
      current.push(line);
    }
  }
  flush();

  const rebuilt = out.filter((s) => s.length > 0).join('\n\n');
  return `${content.slice(0, headingEnd + 1)}\n${rebuilt}${after ? `\n\n${after}` : '\n'}`;
}
