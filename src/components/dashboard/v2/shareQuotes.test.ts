import { describe, it, expect } from 'vitest';
import { pickShareSentences, pickSectionShareQuotes } from './dashboardV2Shared';

// Bodies mirror the real shape of report_sections.content: <h5> subsection
// headers with prose underneath. The strings are paraphrased from live reports.

const CAREER_BODY = `
<h5>Overview</h5>
<p>A Technical Writer turns complex software features and developer tools into clear guides, tutorials, and documentation that helps people actually use the product.</p>
<h5>What you'll actually do</h5>
<p>You would own the docs site end to end, from information architecture through to the individual tutorial.</p>
<h5>Why this role fits you</h5>
<p>Autonomy is your top value, and this role gives you total control: you choose clients, set terms, and define scope. That is not a perk, it is the structure.</p>
<h5>The practical stuff</h5>
<p>Salary bands sit between 60k and 85k depending on seniority and location.</p>
`;

const STRENGTHS_BODY = `
<h5>Identifying Your Core Strengths</h5>
<p>You hold a genuinely broad capability set across product, operations and design.</p>
<h5>Key Insight</h5>
<p>Your deepest strength isn't creativity or leadership, it's structured empathy under pressure. That's different from being a strong general manager.</p>
<h5>Leveraging Strengths in Your Career</h5>
<p>Look for roles where the ambiguity is highest in the first ninety days.</p>
`;

describe('pickShareSentences', () => {
  it('rejects sentences that open with a back-reference', () => {
    const out = pickShareSentences(
      '<p>That is not a perk, it is the structure of the whole arrangement.</p>' +
        '<p>You choose the clients, the terms, and the scope of every engagement.</p>',
    );
    expect(out).toEqual(['You choose the clients, the terms, and the scope of every engagement.']);
  });

  it('strips leading markdown separators rather than printing them', () => {
    const out = pickShareSentences(
      '<p>--- A Director at a mid-size architecture firm leads the studio and its design vision.</p>',
    );
    expect(out[0]).toBe(
      'A Director at a mid-size architecture firm leads the studio and its design vision.',
    );
  });

  it('drops subheaders at every heading level, not just h5', () => {
    const out = pickShareSentences(
      '<h3>Identifying Your Core Strengths</h3><p>You build things that outlast you and the teams around you.</p>',
    );
    expect(out[0]).toBe('You build things that outlast you and the teams around you.');
  });

  it('drops a bare header line when the body has no HTML headings', () => {
    const out = pickShareSentences(
      'Je kernkwaliteiten in kaart\n\nJe denkt in grote lijnen en in langetermijnimpact.',
    );
    expect(out[0]).toBe('Je denkt in grote lijnen en in langetermijnimpact.');
  });

  it('completes a dangling negation with the sentence that pays it off', () => {
    const out = pickShareSentences(
      "<p>Your competitive edge is not your financial expertise. It is your ability to make numbers land with people who fear them.</p>",
    );
    expect(out[0]).toBe(
      'Your competitive edge is not your financial expertise. It is your ability to make numbers land with people who fear them.',
    );
    // The completing sentence must not also surface on its own.
    expect(out).toHaveLength(1);
  });

  it('leaves a negation alone when the sentence already carries both halves', () => {
    const out = pickShareSentences(
      '<p>You are drawn to construction, not maintenance. Every one of your happiest roles involved building something new.</p>',
    );
    expect(out[0]).toBe('You are drawn to construction, not maintenance.');
  });

  it('skips a sentence cut mid-quotation', () => {
    const out = pickShareSentences(
      '<p>Brian, you rated that role 8/10, calling it "the best 3 year project of my career. You have chased that feeling since.</p>',
    );
    expect(out.every((s) => !s.includes('the best 3 year project'))).toBe(true);
  });

  it('skips prose that cites raw survey question ids', () => {
    const out = pickShareSentences(
      "<p>A large corporate also protects the flexible schedule [2g] and family time [1n] you called essential.</p>" +
        '<p>That protection is the whole point of the structure here for you.</p>',
    );
    expect(out).toEqual([]);
  });

  it('closes up the space HTML stripping leaves before punctuation', () => {
    const out = pickShareSentences(
      '<p>You build things that do not exist yet<strong>:</strong> not just creatively, but commercially.</p>',
    );
    expect(out[0]).toBe(
      'You build things that do not exist yet: not just creatively, but commercially.',
    );
  });
});

describe('pickSectionShareQuotes', () => {
  it('quotes the "Why this role fits you" subsection, not the overview boilerplate', () => {
    const out = pickSectionShareQuotes('top_career_1', CAREER_BODY, 'Technical Writer', 1);
    expect(out[0]).toBe(
      'Autonomy is your top value, and this role gives you total control: you choose clients, set terms, and define scope.',
    );
  });

  it('quotes the "Key Insight" subsection for personality sections', () => {
    const out = pickSectionShareQuotes('strengths', STRENGTHS_BODY, 'Strengths and How to Grow Them', 1);
    expect(out[0]).toBe(
      "Your deepest strength isn't creativity or leadership, it's structured empathy under pressure.",
    );
  });

  it('tops up from the rest of the body once the anchor is exhausted', () => {
    const out = pickSectionShareQuotes('strengths', STRENGTHS_BODY, 'Strengths and How to Grow Them', 4);
    expect(out[0]).toContain('structured empathy under pressure');
    expect(out).toContain('You hold a genuinely broad capability set across product, operations and design.');
  });

  it('falls back to the whole body when the anchor heading is absent', () => {
    const body = '<h5>Iets anders</h5><p>Je bouwt dingen die je eigen loopbaan overleven.</p>';
    const out = pickSectionShareQuotes('strengths', body, null, 1);
    expect(out[0]).toBe('Je bouwt dingen die je eigen loopbaan overleven.');
  });

  it('returns nothing rather than a fragment when a section has no usable prose', () => {
    expect(pickSectionShareQuotes('strengths', '<h5>Key Insight</h5><p>Short.</p>', null, 1)).toEqual([]);
  });
});
