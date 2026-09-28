import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StrengthBanner } from './StrengthSummary';
import type { StrengthReview } from './types';

// The resume-strengthen edge function stamps {status:'pending', generated_at,
// status_changed_at} when an analysis starts, and {status:'failed', error}
// when WF10 can't be reached. Neither carries an `issues` array, and the
// results screen renders the banner in both states.
describe('StrengthBanner without issues', () => {
  const now = new Date().toISOString();
  const render = (review: unknown) =>
    renderToStaticMarkup(
      <StrengthBanner review={review as StrengthReview} hasEverApplied={false} onOpen={() => {}} />,
    );

  it('shows the analyzing state for a fresh pending review', () => {
    expect(render({ status: 'pending', generated_at: now, status_changed_at: now })).toContain(
      'strengthen.analyzing',
    );
  });

  it('shows the retry state for a failed review', () => {
    expect(render({ status: 'failed', error: 'Analysis service unavailable.' })).toContain(
      'strengthen.analysisFailed',
    );
  });
});
