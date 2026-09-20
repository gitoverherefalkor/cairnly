# TODO: consider the entrepreneurship question for the Starter flavor

**Not now — parked for a later pass.**

The Pro survey is getting a new entrepreneurial-appetite question plus an enriched
"Additional Context" description. See the full design:
`docs/superpowers/specs/2026-07-08-entrepreneurship-question-design.md`

When we next revisit the Starter flavor, decide whether it should get a parallel
version:

- A "How interested are you in starting your own business?" multiple-choice
  (single-select, with an `Other` open field), sized/worded for first-serious-job
  starters (appetite is likely more aspirational than actionable at this stage).
- The same "Additional Context" description enrichment (household finances,
  family/caregiving, health/accessibility).

If added, it needs its own code in the Starter WF1 (WF1S) dict and wiring into the
Starter scoring/selection workflows, exactly like the Pro plan. Keep the option
values identical to Pro so logic is reusable.

Owner decision pending: worth it for Starter, or skip for this audience?
