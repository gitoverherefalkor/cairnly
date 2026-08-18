# Starting prompt — NL + partner variants of the report PDF

Copy everything below into a new session.

---

The Cairnly report PDF was redesigned and is live on `main`. The structure is
now LOCKED — treat it as the spec, not as something to improve. This session is
about two variants: **Dutch**, and **partner white-label**.

Read these first, in order:

1. `docs/report/REPORT-OUTLINE.md` — the canonical outline. Page order, section
   anatomy, type scale, the seven non-negotiables, and the known gaps in both
   variants. Do not restructure the report.
2. `docs/superpowers/artifacts/README-report-pdf-cosmetics.md` — render recipe,
   the deploy-check workflow, and the traps that cost real time.

## Before anything else: the deploy check

Two independent fingerprints. Bump and poll them, always:

- `RENDER_VERSION` in `api/render-report.js`, served on GET.
- `PRINT_BUILD` in `src/components/report-pdf/printBuild.ts` — this is the one
  that matters for anything you'll touch.

Every render response echoes both back, plus `linksRepaired`. A render on a
stale build is indistinguishable from a fix that did not work; this caught
stale builds on nine separate attempts across two sessions. Poll before you
judge anything. Vercel takes 60–120s.

## Job one: Dutch

Every string already has an `nl` entry and `resolveLang(sections)` picks the
language off `report_sections.language`. What is missing:

- **No Dutch report exists in the database** (28 reports, all `en`). The NL path
  has only ever been verified by forcing `lang = 'nl'` locally. Getting a real
  Dutch report rendered end to end is the actual deliverable.
- **Chart axis labels are still English** — `Autonomy`, `Stability`, `Schedule`,
  `Pace & pressure`, `Social load`, `SWEET SPOT`, `WALK AWAY`, `SAFE`,
  `AUGMENTED`, `AT RISK`, `AI exposure`, `match strength`, `STRONG`, `WEAKER`.
  They live in the shared `V4PersonalityRadarSVG`, `V4CareerMapSVG` and
  `V4CompareRadarSVG` dashboard components, so localising them is a DASHBOARD
  change, not a print one. Decide whether the dashboard follows the UI locale or
  the report language — those are not the same signal, and the print page must
  follow the report.
- The cover's "cairn" dictionary panel stays English on purpose. Leave it.
- Check Dutch text does not overflow the fixed-height cover bands; German-length
  compounds are the usual culprit and Dutch is close behind.

## Job two: partner white-label

Wired but never rendered against a real partner, so assume nothing works:

- Cover: partner logo in the white band, left of the Cairnly wordmark
  (`maxHeight: 10mm, maxWidth: 61mm`).
- Running header: partner mark on every page. Space is reserved whether or not a
  partner exists, so pagination does not shift when white-labelling is on.
- **`powered_by_text` currently has no home.** The cover footer became "Prepared
  for <name>" and the drawn footer is the brand line plus the page number. Needs
  a decision, not a guess.
- Logos MUST be `data:` URIs. The CSP blocks storage URLs in `img-src` and it
  fails SILENTLY — broken image, successful PDF, 200 OK. `report-print-data`
  already inlines them; verify it still does.
- Create a test partner row and render a real branded PDF. Do not ship this
  untested.

## Rules that will bite you

- The narrative FLOWS. Never reintroduce fixed-height sheets per section —
  measured, they clipped 7 of 12 pages.
- No font glyphs outside Latin. `⚠ ✓ ← →` are tofu in headless Chromium. Draw
  them.
- Every image needs `loading="eager"` or the readiness gate hangs.
- Internal links only survive because `relinkNamedDests` repairs them after the
  two-pass cover merge. If `linksRepaired` comes back 0 on a report with a
  contents page, the destination catalogue moved again.
- Font weight never exceeds 700.

## Open, unrelated to the variants

- WF3's duplicate outside-the-box heading is FIXED (2026-08-18) — the stray
  `## How AI will impact this role` line is gone from `Set Outside Box Prompt`.
  Reports generated before that date still carry it; they would need
  regenerating. WF4 was never affected: it uses `##` as its only convention.
- The cover's cairn glyph is a 321px PNG drawn at 106mm, so it is soft in print.
  Ask Design for the vector.
- `SalaryPill` is deliberately not used: `metadata.salary` exists on 2 of 28
  top-career rows and reads null even where present.
