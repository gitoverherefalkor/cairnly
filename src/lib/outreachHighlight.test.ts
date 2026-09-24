import { describe, expect, it } from 'vitest';
import {
  contentWords,
  diffAgainstSkeleton,
  questions,
  sharedSpans,
  unansweredQuestions,
} from './outreachHighlight';

const marked = (spans: { text: string; mark: string }[], mark: string) =>
  spans.filter((s) => s.mark === mark).map((s) => s.text.trim());

describe('diffAgainstSkeleton', () => {
  const skeleton = 'Beste team van Track2,\n\nKorte opvolging op mijn mail van vorige week.\n\nGroet,\nSjoerd';

  it('marks nothing when the body is the skeleton', () => {
    const spans = diffAgainstSkeleton(skeleton, skeleton);
    expect(marked(spans, 'new')).toEqual([]);
    expect(spans.map((s) => s.text).join('')).toBe(skeleton);
  });

  it('marks only what the model or Sjoerd changed', () => {
    const body = skeleton.replace('Beste team van Track2,', 'Beste Mark,').replace('vorige week.', 'vorige week over Almere.');
    const spans = diffAgainstSkeleton(body, skeleton);
    expect(marked(spans, 'new')).toEqual(['Mark,', 'week over Almere.']);
    expect(spans.map((s) => s.text).join('')).toBe(body);
  });
});

describe('shared words and questions', () => {
  const theirs = 'Wat kost het per kandidaat? En kan ik eerst een voorbeeld zien? Kijk ook op https://x.nl/a?b=1';
  const reply = 'Beste Ingrid, je betaalt per kandidaat, geen abonnement. Groet, Sjoerd';

  it('finds their questions and ignores a ? inside a link', () => {
    expect(questions(theirs)).toEqual(['Wat kost het per kandidaat?', 'En kan ik eerst een voorbeeld zien?']);
  });

  it('flags the question the reply does not touch', () => {
    expect(unansweredQuestions(theirs, reply)).toEqual(['En kan ik eerst een voorbeeld zien?']);
  });

  it('marks shared content words but never stopwords or links', () => {
    const spans = sharedSpans(theirs, contentWords(reply));
    expect(marked(spans, 'shared')).toContain('kandidaat?');
    expect(marked(spans, 'shared')).not.toContain('per');
    expect(marked(spans, 'shared').join(' ')).not.toContain('https');
  });

  it('matches simple plurals', () => {
    expect([...contentWords('adviseurs')]).toEqual([...contentWords('adviseur')]);
    expect([...contentWords('coaches')]).toEqual([...contentWords('coach')]);
  });
});
