// The cover-letter LLM sometimes ends `closing` with the sign-off and the
// name glued onto the last sentence ("... oppakken. Groet, Noor Bakker").
// Every renderer already prints the name as a separate signature line, so
// left alone the letter shows the name twice and the sign-off runs into the
// sentence. This splits it into the sentence(s) and a sign-off line, and
// drops the trailing name (the signature line covers it).

const SIGN_OFFS = [
  // English
  'kind regards', 'best regards', 'warm regards', 'warmest regards', 'regards',
  'yours sincerely', 'sincerely', 'yours faithfully', 'best wishes', 'best',
  'many thanks', 'thank you', 'with thanks', 'cheers',
  // Dutch
  'met vriendelijke groet', 'met vriendelijke groeten', 'vriendelijke groet',
  'vriendelijke groeten', 'hartelijke groet', 'hartelijke groeten',
  'met hartelijke groet', 'groet', 'groeten', 'hoogachtend', 'met dank',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function splitClosing(
  closing: string | null | undefined,
  name: string | null | undefined,
): { text: string; signOff: string | null } {
  let text = (closing ?? '').trim();
  if (!text) return { text: '', signOff: null };

  // 1. Drop a trailing copy of the candidate's name.
  const fullName = (name ?? '').trim();
  if (fullName) {
    const nameRe = new RegExp(`[\\s,]*${escapeRegExp(fullName)}\\s*$`, 'i');
    text = text.replace(nameRe, '').trim();
  }

  // 2. Pull a trailing sign-off ("Groet," / "Kind regards") onto its own line.
  //    Only when it starts a new sentence or line, so "regards" inside a
  //    sentence is left alone. Longest phrases first ("met vriendelijke groet"
  //    before "groet").
  const phrases = [...SIGN_OFFS].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const signRe = new RegExp(`(^|[.!?]\\s+|\\n+)(${phrases.join('|')})\\s*,?\\s*$`, 'i');
  const m = text.match(signRe);
  if (m && m.index !== undefined) {
    const before = text.slice(0, m.index + m[1].length).trim();
    return { text: before, signOff: `${m[2]},` };
  }
  return { text, signOff: null };
}
