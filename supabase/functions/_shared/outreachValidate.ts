// The check a mail must pass before it may leave without Sjoerd reading it.
//
// Auto-approve (spec guard rail 1) trusts only text that is shaped like the
// skeleton it came from. This is that shape, as rules a machine can check:
// the right person greeted, the tracked demo link intact, a sane length, the
// house style (no dashes, no "niet X, maar Y"), the signature line, and no
// template residue. A concept that fails is never auto-approved; the caller
// falls back to the plain skeleton, which always passes (tested).
//
// The same result is stored on the concept (`validatie`) and shown in /ops,
// so a failing concept that waits for Sjoerd says what is wrong with it.

export type ConceptSoort = 'initial' | 'chase' | 'checkin' | 'reply';

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/** Word ceilings per kind, the coach quote in a chase not counted (as its prompt promises). */
export const MAX_WORDS: Record<ConceptSoort, number> = {
  initial: 330,
  chase: 170,
  checkin: 90,
  reply: 160,
};

/**
 * Words and phrases that make a Dutch mail read as generated. Cheap net before
 * the critic (outreachCritic.ts). Sjoerd's own templates contain none of them
 * (tested), so a hit is always model text.
 */
export const AI_TELLS = [
  'prominent',
  'naadloos',
  'naadloze',
  'cruciaal',
  'cruciale',
  'essentieel',
  'essentiële',
  'uniek',
  'unieke',
  'indrukwekkend',
  'indrukwekkende',
  'inspirerend',
  'inspirerende',
  'waardevol',
  'waardevolle',
  'landschap',
  'holistisch',
  'holistische',
  'toonaangevend',
  'toonaangevende',
  'baanbrekend',
  'revolutionair',
  'optimaal',
  'optimale',
  'bovendien',
  'tevens',
  'kortom',
  'speelt een belangrijke rol',
  'in een wereld waar',
  'niet alleen',
];
const AI_TELL_RE = new RegExp(`\\b(${AI_TELLS.map((w) => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'iu');

/** The first AI tell in a text, or null. */
export function aiTell(text: string): string | null {
  const m = AI_TELL_RE.exec(text);
  return m ? m[1].toLowerCase() : null;
}

const DASH = /[—–]/;
const NOT_BUT = /\bniet\b[^.?!\n]{1,60},\s*maar\b/i;
const SIGNATURE = /Groet,\nSjoerd\s*$/;
const QUOTE_LINE = /^Een loopbaancoach met 25 jaar ervaring schreef me dit over Cairnly:.*$/m;

const wordCount = (s: string) =>
  s
    .replace(QUOTE_LINE, '')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .split(/\s+/)
    .filter(Boolean).length;

/** "Beste Mark," → "mark"; "Beste team van X," → null (must then match exactly). */
function greetedName(line: string): string | null {
  const m = /^(?:Beste|Hoi)\s+([^\s,]+),$/.exec(line.trim());
  if (!m || m[1] === 'team') return null;
  return m[1].toLowerCase();
}

export function validateOutgoing(
  body: string,
  opts: {
    soort: ConceptSoort;
    /** What salutation() gives for this prospect; null skips the check (replies, check-ins). */
    expectedSalutation: string | null;
    /** Must appear verbatim when given. */
    demoLink?: string | null;
    maxWords: number;
  },
): ValidationResult {
  const problems: string[] = [];
  const text = body.replace(/\r\n?/g, '\n').trim();
  const firstLine = text.split('\n')[0] ?? '';

  if (opts.expectedSalutation) {
    const expected = opts.expectedSalutation.trim();
    const want = greetedName(expected);
    const got = greetedName(firstLine);
    const fine = firstLine.trim() === expected || (want !== null && got === want);
    if (!fine) problems.push(`salutation is "${firstLine}", expected "${expected}"`);
  } else if (!/^(Beste|Hoi|Dag)\s.+,$/.test(firstLine.trim())) {
    problems.push(`salutation "${firstLine}" is not a greeting`);
  }

  if (opts.demoLink && !text.includes(opts.demoLink)) problems.push('demo link missing or altered');

  const n = wordCount(text);
  if (n > opts.maxWords) problems.push(`${n} words, limit ${opts.maxWords}`);

  if (DASH.test(text)) problems.push('contains a dash (— or –)');
  if (NOT_BUT.test(text)) problems.push('contains a "niet X, maar Y" construction');
  if (!SIGNATURE.test(text)) problems.push('signature "Groet,\\nSjoerd" missing at the end');
  // In a reply, [CODELINK] is expected: approving the reply creates the code
  // and fills it in. Anywhere else it is residue.
  if (/[{}]/.test(text) || (opts.soort !== 'reply' && text.includes('[CODELINK]'))) {
    problems.push('template placeholder left in the text');
  }
  const tell = aiTell(text);
  if (tell) problems.push(`reads as generated: "${tell}"`);

  return { ok: problems.length === 0, problems };
}
