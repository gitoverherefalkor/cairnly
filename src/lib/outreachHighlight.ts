// Highlighting for the outreach cockpit: what to look at in a concept.
//
// Two jobs, both about letting Sjoerd check a mail in seconds rather than
// reading it:
//   - a first mail or chase is built on an approved skeleton, so everything
//     that differs from the skeleton (the model's personalisation, his own
//     edits) is marked and the boilerplate can be skimmed;
//   - a reply answers someone, so the words their mail and our answer share
//     are marked on both sides, and a question of theirs that our answer does
//     not touch at all is flagged.
// Pure functions, no React; tested in outreachHighlight.test.ts.

export type Mark = 'none' | 'new' | 'shared' | 'question' | 'unanswered';

export interface Span {
  text: string;
  mark: Mark;
}

/** Split into words and the whitespace between them, so joining gives the text back. */
function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

const isSpace = (t: string) => /^\s+$/.test(t);

/** Merge neighbouring spans with the same mark, so the renderer gets few elements. */
function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && last.mark === s.mark) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/**
 * Word-level diff: every word of `body` that is not part of the longest
 * common subsequence with `skeleton` is 'new'. Whitespace takes the mark of
 * the word before it only when both neighbours are new, so a highlighted
 * phrase reads as one block.
 */
export function diffAgainstSkeleton(body: string, skeleton: string): Span[] {
  const b = tokens(body);
  const bWords = b.map((t, i) => ({ t, i })).filter((x) => !isSpace(x.t));
  const sWords = tokens(skeleton).filter((t) => !isSpace(t));
  const n = bWords.length;
  const m = sWords.length;
  // LCS table, (n+1) x (m+1). A mail is a few hundred words: fine.
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = bWords[i].t === sWords[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const isNew = new Array<boolean>(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < n) {
    if (j < m && bWords[i].t === sWords[j]) {
      i++;
      j++;
    } else if (j < m && dp[i][j + 1] >= dp[i + 1][j]) {
      j++;
    } else {
      isNew[bWords[i].i] = true;
      i++;
    }
  }
  const spans: Span[] = b.map((t, k) => {
    if (!isSpace(t)) return { text: t, mark: isNew[k] ? 'new' : 'none' };
    const joined = isNew[k - 1] && isNew[k + 1];
    return { text: t, mark: joined ? 'new' : 'none' };
  });
  return merge(spans);
}

// ─── Shared words ────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    // Dutch function words
    'de het een en of maar want dus dat die dit deze daar hier er ik je jij u we wij jullie ze zij hij haar hem ' +
    'zijn is was waren wordt worden werd ben bent heb hebt heeft hebben had hadden kan kun kunt kunnen kon ' +
    'zal zou zullen zouden wil wilt willen moet moeten mag mogen gaat gaan ga doen doet deed ' +
    'in op aan met van voor naar bij uit over om tot tegen tussen onder door zonder na sinds per als dan ' +
    'niet geen wel ook nog al toch even heel zeer erg meer minder veel weinig wat wie waar wanneer hoe waarom ' +
    'mijn mij me ons onze uw jouw hun zich zelf elkaar iets niets alles iemand niemand ' +
    'graag dank bedankt groet groeten beste hoi hallo dag vriendelijke mvg ja nee oké ok ' +
    'sjoerd cairnly mail mails email ' +
    // English function words
    'the a an and or but so that this these those there here i you we they he she it is are was were be been ' +
    'have has had do does did can could will would should may might must to of in on at by for with from ' +
    'about as if then than not no yes also just very more less what who where when how why my our your their ' +
    'thanks thank regards best hi hello dear'
  ).split(/\s+/),
);

/** Lowercase, letters and digits only, a crude Dutch/English stem. '' when it is not a content word. */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (w.length <= 2 || STOPWORDS.has(w) || /^\d+$/.test(w)) return '';
  if (/[/:@]/.test(w)) return ''; // URLs and addresses
  let s = w;
  for (const suffix of ['en', 'es', 's', 'e']) {
    if (s.length > 4 && s.endsWith(suffix)) {
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  return s;
}

/** The content-word stems of a text. URLs are dropped before splitting. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.replace(/https?:\/\/\S+/g, ' ').split(/\s+/)) {
    const s = stem(t);
    if (s) out.add(s);
  }
  return out;
}

/** Mark every word of `text` whose stem is in `other`. */
export function sharedSpans(text: string, other: Set<string>): Span[] {
  return merge(
    tokens(text).map((t) => {
      if (isSpace(t) || /^https?:\/\//.test(t)) return { text: t, mark: 'none' as Mark };
      const s = stem(t);
      return { text: t, mark: s && other.has(s) ? ('shared' as Mark) : ('none' as Mark) };
    }),
  );
}

/** Their questions: sentences ending in '?', with URLs taken out first. */
export function questions(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?') && s.length > 3);
}

/** A question none of whose content words appear in our answer. */
export function unansweredQuestions(theirText: string, reply: string): string[] {
  const ours = contentWords(reply);
  return questions(theirText).filter((q) => {
    const words = contentWords(q);
    if (words.size === 0) return false;
    for (const w of words) if (ours.has(w)) return false;
    return true;
  });
}
