# TODO: consider the entrepreneurship question for the Encore flavor

**Not now — parked for a later pass.**

The Pro survey is getting a new entrepreneurial-appetite question plus an enriched
"Additional Context" description. See the full design:
`docs/superpowers/specs/2026-07-08-entrepreneurship-question-design.md`

When we next revisit the Encore (post-career) flavor, decide whether it should get a
parallel version. This audience may be an especially good fit: "encore" careers and
self-employment / consulting / passion-businesses often overlap, so appetite here
could be higher-signal than for Pro.

- A "How interested are you in starting your own business?" multiple-choice
  (single-select, with an `Other` open field), possibly reworded for the Encore
  context (e.g. framing around a lower-stakes or passion venture).
- The same "Additional Context" description enrichment (household finances,
  family/caregiving, health/accessibility).

If added, it needs its own code in the Encore WF1 (WF1P) dict and wiring into the
Encore scoring/selection workflows, exactly like the Pro plan. Keep the option
values identical to Pro so logic is reusable.

Owner decision pending: worth it for Encore, or skip for this audience?
