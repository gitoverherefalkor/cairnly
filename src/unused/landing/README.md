# Unused landing components

Nothing in this folder is imported by the app. Vite only bundles what is
reachable from an import, so these files ship in the repo but not in the
build. They are kept because they were expensive to build and may come back.

**To restore one:** move the file back to `src/components/landing/`, fix its
relative imports (`./Reveal` etc. resolve differently from here — see "Import
paths" below), and mount it in `src/pages/Index.tsx`.

Retired 2026-09-16 in the homepage copy cleanup, and 2026-09-17 when
`/partners` was pinned to one persona.

---

## What is here and why it was cut

### `WorkflowDiagramV2.tsx` — the engine diagram
The full pipeline visual that sat in the Methodology section: three stages
(PROFILE / MATCH / SELECT), fifteen labelled steps, and the DASHBOARD
deliverables column. Hand-built SVG with its own layout maths.

Cut for two reasons:
1. **It published the build sheet.** "Parse 50+ answers", "Scan 1000+ roles",
   "Re-rank on values", "Write runner-ups" — enough for anyone to reconstruct
   the shape of the product.
2. **It was hardcoded English.** The labels are string literals, not
   translations, so Dutch visitors saw an English diagram mid-page. The
   `workflow.*` keys in `landing.json` were written for it but never wired up.

The section frame around it (eyebrow, title, subtitle, trust row, closer)
stayed on the page. If this ever returns, the labels must go through i18n
first, and the step names need to be vaguer than the real pipeline.

### `WorkflowDiagramSimple.tsx` — the small pipeline visual
The compact résumé → survey → profile → match → wild cards → dashboard strip.
Only ever used inside `HowItWorks` step 2. Same English-only caveat.

### `WorkflowDiagram.tsx` — the first engine diagram
Superseded by `WorkflowDiagramV2` and already unused before this cleanup.
Kept for reference only.

### `HowItWorks.tsx` — the five-step section
Scroll-tracked five-step walkthrough with a sticky cairn progress rail, one
screenshot per step, and a "See it in the demo" pill per step. 2,300px, about
15% of the page.

Cut because the hero video now plays the same journey (survey → coach chat →
dashboard) and its end card covers the job-landing step. The section was
showing static screenshots of the screens the video had just played, each
linking to the same demo the video already links to.

The scroll-position tracking and the `CairnProgress` rail integration are the
non-obvious parts worth keeping.

### `ScreenshotSlot.tsx` — framed screenshot with zoom
The browser-chrome frame with a meta label and a click-to-zoom button. Only
used by `HowItWorks`. Reusable if any future section needs framed product
shots.

### `CostMath.tsx` — "A one-off fee. Not a monthly bill, forever."
A 371px section making a point the comparison table's own closing line makes
40px above it. Deleted as a duplicate, not because the argument is wrong.

### `PriceCountdown.tsx` — intro-price countdown
Days-and-hours countdown to `PRICE_SWITCH_AT`, with a "then €59" line. Retired
when the €39 introductory price was removed and the price became a flat €59.

Worth keeping: the deliberate choice to show days and hours but never seconds
(a ticking seconds counter reads as an infomercial to this audience), and the
self-expiring behaviour that needed no deploy on the day.

Note that it depends on `isIntroPriceActive` / `introPriceTimeLeft` /
`PRICE_SWITCH_AT` in `src/lib/pricing.ts`, which were removed in the same
change. Restoring this component means restoring those first.

### `CoachCards.tsx` — the chat-refinement section
Held the "If something doesn't fit, tell it. The plan adapts." block and the
demo CTA, on cream. Its content moved into `Methodology` on 2026-09-16: the
engine block, the chat block and the methodology cards were one argument told
across two sections with four separate eyebrow-title-subtitle stacks. The copy
keys (`chatRefine.*`) are still live — Methodology reads them.

An earlier version also carried a three-card device (a static PDF, a Cairnly
dashboard, a subscription chat). Those cards are not in this file: the outer
two repeated the comparison table's columns and were deleted, and the middle
card's point became `chatRefine.intro`.

### `DemoPersonaCards.tsx` — the Emma / Marcel picker
The two cards that let a visitor choose which persona the demo stage played,
with an idle spotlight that cycled between them every 3 seconds until someone
hovered or used the toggle. Clicking a card opened the full replay with that
persona.

The homepage dropped it on 2026-09-14 when the hero became a single recording.
`/partners` kept it until 2026-09-17, when that hero was pinned to Marcel:
both partner CTAs call `partnerDemoLink()`, which has always hardcoded
`PARTNER_DEMO_PERSONA`, so the cards asked a professional buyer to pick a
fictional candidate and then ignored the answer one scroll later. The cards'
"which one is you" framing is a consumer move; a bureau wants the candidate
that looks like its caseload. The substance (who, intent, what the session
shows) lives on in `SessionBrief` inside `PartnersHero.tsx`.

Worth keeping: the idle cycle that pauses off-screen, respects
`prefers-reduced-motion` and stops for good once the visitor picks, and the
`ns` prop that let the partner page supply its own card copy.

Note `heroPersonaOrder` in `demo/HeroPersonaContext.tsx` was written for this
component and now has no caller. It is left in place as part of that context's
API; `HERO_PERSONAS` is still used by `DemoStage`'s toggle.

### `ForkDivider.tsx` — same-path / different-path diagram
Already disabled before this cleanup (commented out in `Index.tsx` with the
note "the same-path/different-path diagram wasn't landing well").

---

## Typechecking

`tsconfig.app.json` excludes this folder. These files reference APIs that have
since been removed (`PriceCountdown` wants the intro-price helpers) and use
relative imports that no longer resolve from here, so typechecking them reports
failures for code that is deliberately out of service.

## Import paths

These files were written to live in `src/components/landing/`. Relative
imports such as `./Reveal`, `./landing.css` and `./demo/HeroPersonaContext`
do **not** resolve from `src/unused/landing/`. That is harmless while nothing
imports them, but it means you cannot simply re-mount a file from here — move
it back first.

Absolute `@/` imports (`@/lib/analytics`, `@/demo/constants`) work from either
location.
