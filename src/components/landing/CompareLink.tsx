import React from 'react';
import { ArrowRight } from 'lucide-react';

/** The side-by-side section's anchor (see ComparisonTable). */
export const COMPARISON_ANCHOR = '#comparison';

interface CompareLinkProps {
  /** Link text. Supplied by the caller so each placement can phrase it for its own moment. */
  label: string;
  className?: string;
}

/**
 * Quiet route down to the side-by-side comparison.
 *
 * Deliberately a text link and not a button: the hero already carries the
 * intent pills, the intake chat and a checkout CTA, and the chat is the
 * element that actually converts. This exists for the visitor who arrived
 * hoping a free test would do the job, so it has to be findable at the moment
 * that thought fires (right under a price) without competing for the click.
 */
const CompareLink: React.FC<CompareLinkProps> = ({ label, className }) => (
  <a
    href={COMPARISON_ANCHOR}
    className={`lp-compare-link${className ? ` ${className}` : ''}`}
    onClick={(e) => {
      const target = document.querySelector(COMPARISON_ANCHOR);
      // No section on this page: leave the plain anchor jump alone.
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }}
  >
    {label}
    <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
  </a>
);

export default CompareLink;
