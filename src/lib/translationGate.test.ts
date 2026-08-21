// Tests for the deterministic translation gate that guards every write to
// report_sections.content_i18n. The module lives with the edge functions
// (it runs in Deno) but is pure TS, so it is unit-tested here under vitest.
import { describe, it, expect } from 'vitest';
import {
  tagSequence,
  commentTokens,
  digitRuns,
  structureMarkers,
  sniffLanguage,
  runGate,
  canonicalLooksEnglish,
} from '../../supabase/functions/_shared/translationGate';

// A realistic English canonical body, shaped like a real top_career section
// (HTML h5 skeleton, bullets, ✓/⚠ markers, bold spans, salary figures).
const CANONICAL = `<h5>Overview</h5>
You build and run your own consulting practice, advising enterprise clients on strategy and transformation while owning every part of the business.

<h5>Why this role fits you</h5>
Accomplishment and recognition top your values list, and nothing delivers that more directly than a firm with your name attached to the outcome. This role takes the exact ingredients that made your last position a 9/10 for you.

<h5>What works for you</h5>
✓ **Zero routine.** Sprint-based cycles match your preference from the 9/10 years.
✓ **Team leadership retained.** You'd still lead multidisciplinary squads.

<h5>The Reality Check</h5>
⚠ **High failure tolerance needed.** Many ventures die; this tests your risk comfort.

<h5>The practical stuff</h5>
**Money:** €90,000 - €135,000 (plus possible equity/bonus)

<h5>Future-proof skills</h5>
- Direct AI-augmented delivery and price your time around judgment.
- Build a delegation system so junior consultants can execute without oversight.`;

// A faithful Dutch translation of the same body (structure preserved,
// separators localised the way the glossary mandates).
const GOOD_DUTCH = `<h5>Overzicht</h5>
Je bouwt en runt je eigen adviespraktijk, waarbij je grote klanten adviseert over strategie en transformatie terwijl je elk deel van het bedrijf zelf in handen hebt.

<h5>Waarom deze rol bij je past</h5>
Prestatie en erkenning staan bovenaan je waardenlijst, en niets levert dat directer op dan een bureau met jouw naam aan het resultaat verbonden. Deze rol bevat precies de ingrediënten die je vorige functie een 9/10 maakten.

<h5>Wat voor jou werkt</h5>
✓ **Geen routine.** Sprintcycli passen bij je voorkeur uit de 9/10-jaren.
✓ **Teamleiderschap behouden.** Je blijft multidisciplinaire teams leiden.

<h5>De realiteitscheck</h5>
⚠ **Hoge tolerantie voor mislukking nodig.** Veel ventures stranden; dit test je risicobereidheid.

<h5>De praktische kant</h5>
**Geld:** €90.000 - €135.000 (plus mogelijke aandelen/bonus)

<h5>Toekomstbestendige vaardigheden</h5>
- Stuur AI-ondersteunde delivery aan en prijs je tijd op basis van oordeelsvermogen.
- Bouw een delegatiesysteem zodat junior consultants zonder toezicht kunnen uitvoeren.`;

describe('tagSequence', () => {
  it('captures tags in order, case-insensitively', () => {
    expect(tagSequence('<H5>Hi</h5><strong>x</strong>')).toBe('<h5,</h5,<strong,</strong');
  });
  it('ignores HTML comments', () => {
    expect(tagSequence('<!--move:Ready now--><h5>x</h5>')).toBe('<h5,</h5');
  });
  it('matches between canonical and faithful translation', () => {
    expect(tagSequence(GOOD_DUTCH)).toBe(tagSequence(CANONICAL));
  });
});

describe('commentTokens', () => {
  it('collects and sorts tokens as a multiset', () => {
    expect(commentTokens('<!--b--><!--a--><!--a-->')).toEqual(['<!--a-->', '<!--a-->', '<!--b-->']);
  });
});

describe('digitRuns', () => {
  it('normalises separators so localisation passes', () => {
    expect(digitRuns('€75,000 to €170,000')).toEqual(digitRuns('€75.000 tot €170.000'));
  });
  it('catches a changed number', () => {
    expect(digitRuns('a 9/10 fit')).not.toEqual(digitRuns('an 8/10 fit'));
  });
  it('catches a dropped number', () => {
    expect(digitRuns('€90,000 - €135,000')).not.toEqual(digitRuns('€90.000'));
  });
});

describe('structureMarkers', () => {
  it('counts markdown headings, bullets, checks, warns and bold spans', () => {
    const m = structureMarkers('## H\n- a\n- b\n✓ **x** ⚠ y **z**');
    expect(m.mdHeading).toBe(1);
    expect(m.bullet).toBe(2);
    expect(m.check).toBe(1);
    expect(m.warn).toBe(1);
    expect(m.boldMarkers).toBe(4);
  });
});

describe('sniffLanguage', () => {
  it('detects English prose', () => {
    expect(sniffLanguage(CANONICAL)).toBe('en');
  });
  it('detects Dutch prose', () => {
    expect(sniffLanguage(GOOD_DUTCH)).toBe('nl');
  });
  it('returns unknown for short strings (titles, fragments)', () => {
    expect(sniffLanguage('Product Manager')).toBe('unknown');
    expect(sniffLanguage('Boutique Consulting Firm Founder')).toBe('unknown');
  });
});

describe('runGate — the contract', () => {
  it('passes a faithful translation', () => {
    const r = runGate(CANONICAL, GOOD_DUTCH, 'nl');
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('rejects an empty translation', () => {
    expect(runGate(CANONICAL, '', 'nl').ok).toBe(false);
  });

  it('rejects a dropped heading tag', () => {
    const broken = GOOD_DUTCH.replace('<h5>De realiteitscheck</h5>', 'De realiteitscheck');
    const r = runGate(CANONICAL, broken, 'nl');
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('tag skeleton');
  });

  it('rejects a changed salary figure', () => {
    const broken = GOOD_DUTCH.replace('€90.000', '€95.000');
    const r = runGate(CANONICAL, broken, 'nl');
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('Numbers differ');
  });

  it('rejects output that is still English (the actual production bug)', () => {
    const r = runGate(CANONICAL, CANONICAL, 'nl');
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('expected "nl"');
  });

  it('rejects half-translated output (structure intact, language mixed)', () => {
    // First half English, second half Dutch — parallel texts, so the tag
    // skeleton and digits still line up and only the language checks can
    // catch it. This is the production failure mode that motivated the gate.
    const mixed = CANONICAL.slice(0, CANONICAL.length / 2) + GOOD_DUTCH.slice(GOOD_DUTCH.length / 2);
    const r = runGate(CANONICAL, mixed, 'nl');
    expect(r.ok).toBe(false);
  });

  it('rejects a single untranslated English paragraph inside Dutch prose', () => {
    // Swap ONE Dutch paragraph back to its English original — whole-document
    // dominance would still read "nl", only the per-paragraph sniff sees it.
    const dutchPara =
      'Prestatie en erkenning staan bovenaan je waardenlijst, en niets levert dat directer op dan een bureau met jouw naam aan het resultaat verbonden. Deze rol bevat precies de ingrediënten die je vorige functie een 9/10 maakten.';
    const englishPara =
      'Accomplishment and recognition top your values list, and nothing delivers that more directly than a firm with your name attached to the outcome. This role takes the exact ingredients that made your last position a 9/10 for you.';
    const partial = GOOD_DUTCH.replace(dutchPara, englishPara);
    expect(partial).not.toBe(GOOD_DUTCH);
    const r = runGate(CANONICAL, partial, 'nl');
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('paragraph');
  });

  it('rejects a dropped reality-check marker', () => {
    const broken = GOOD_DUTCH.replace('⚠ ', '');
    const r = runGate(CANONICAL, broken, 'nl');
    expect(r.ok).toBe(false);
  });

  it('rejects a translated comment token', () => {
    const withToken = CANONICAL + '\n<!--move:Ready now-->';
    const translatedToken = GOOD_DUTCH + '\n<!--move:Direct inzetbaar-->';
    const r = runGate(withToken, translatedToken, 'nl');
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toContain('comment tokens');
  });

  it('accepts a preserved comment token', () => {
    const withToken = CANONICAL + '\n<!--move:Ready now-->';
    const goodToken = GOOD_DUTCH + '\n<!--move:Ready now-->';
    expect(runGate(withToken, goodToken, 'nl').ok).toBe(true);
  });
});

describe('canonicalLooksEnglish — the generator regression alarm', () => {
  it('accepts English canonical', () => {
    expect(canonicalLooksEnglish(CANONICAL)).toBe(true);
  });
  it('rejects Dutch canonical (a generator writing Dutch again)', () => {
    expect(canonicalLooksEnglish(GOOD_DUTCH)).toBe(false);
  });
  it('accepts short content with no signal', () => {
    expect(canonicalLooksEnglish('Overview: n/a')).toBe(true);
  });
});
