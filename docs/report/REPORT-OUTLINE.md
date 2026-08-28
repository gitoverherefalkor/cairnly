# The Cairnly report PDF — canonical outline

Locked 2026-08-18. This is THE structure for the platform's report PDF. The NL
and partner variants below are deltas against it, not separate designs.

Renderer: `api/render-report.js` → `/report/print?rt=<token>` → headless
Chromium. Working notes, traps and the render recipe live in
`docs/superpowers/artifacts/README-report-pdf-cosmetics.md`; this file is the
structure only.

## Page order

| # | Page | Contents |
|---|---|---|
| 1 | **Cover** | Full bleed. White 32mm band (partner logo left, Cairnly wordmark right), gold title, subtitle, photo band with the cairn glyph and the "cairn" dictionary panel, "Prepared for <full name>" + date. No header/footer — exported in its own pass. |
| 2 | **What's inside** | Contents, grouped About you / Career suggestions. Every row is a working internal link. Icons match the chat sidebar. No page numbers (Chromium cannot tell the DOM where a node landed). |
| 3 | **Chapter one opener** | Divider "About you" + pull quote + personality radar. Owns the page. |
| 4 | Executive Summary | Own page. |
| 5–7 | Approach, Strengths, Development, Values | Flow together. Deliberately NOT one per page — they run short and would leave half-empty pages. |
| 8 | **Chapter two opener** | Divider "Your career directions" + pull quote + top-three comparison radar. Owns the page. |
| 9+ | Top match 01, 02, 03 | One page break before each. |
| — | Career map | Immediately before the first grouped set. Not a chapter chart: it plots every role, so it bridges the top three to everything else. |
| — | Runner-up careers | Group header (eyebrow + chip + intro), then roles, flowing. |
| — | Outside-the-box careers | Group header, then **one role per page** — they run consistently under a page. |
| — | Your dream jobs | Group header, then roles, flowing. |
| — | Discussion Highlights | From the coach conversation. Own page. |
| last | **Closing** | Sign-off, then the toolkit + refund ladder, generated from `UNLOCK_LADDER`. |

Anything WF adds that this file does not list is appended after the career
chapter and gets its own page automatically — see `breaksPage`.

## Section anatomy

Two orders, chosen by what the intro actually describes.

**About-you sections** — the intro describes the section:

```
────────────────────────  hairline
EYEBROW (icon + gold, tracked)
Section Title
[photo chip] │ intro
             (space)
◇ Sub-heading with icon
body…
```

**Career sections** — the intro describes the SLOT, not the job, so it sits
above the role name:

```
────────────────────────  hairline
EYEBROW (icon + gold)      e.g. TOP MATCH · 02
[glyph chip] │ slot intro
Role Title
Company size / type
[match] [AI impact] [move] pills
             (space)
◇ Sub-heading with icon
body…
```

Grouped types (runner-ups, outside-the-box, dream jobs) get a group header
first — eyebrow + chip + intro, no filled banner — and their roles nest one
level down (h3 title, h4 sub-headings).

## Type scale

| Role | Font | Size |
|---|---|---|
| Body | Inter 400 | 13.3px / **10pt**, 1.58 |
| Sub-heading | Poppins 700 | 14px / 10.5pt, teal |
| Section title | Poppins 700 | 21px (nested roles 17.5px) |
| Eyebrow | Poppins 700 | 9.5px, 0.18em, gold |
| Chart caption | Inter | 9px, "dashboard" hyperlinked |

Page: A4, margins 21/19/20mm. Measure ≈ 86 characters.
**Font weight never exceeds 700**, platform-wide rule.

## Non-negotiables

1. **The narrative flows.** No fixed-height sheets per section — measured, they
   clipped 7 of 12 pages. Only the cover is a fixed sheet.
2. **No font glyphs outside Latin.** Headless Chromium on Lambda has almost no
   system fonts; `⚠ ✓ ← →` render as tofu. Draw marks as SVG.
3. **Every image needs `loading="eager"`.** Readiness awaits `img.decode()`;
   a lazily-loaded image never starts loading and hangs the render.
4. **Print assets live in `public/report/`** at ~220px with space-free names.
5. **Internal links need `relinkNamedDests`.** The two-pass cover merge drops
   Chromium's destination catalogue. `linksRepaired` in the response is the
   canary.
6. **Internal sections never render** — `init_summary`, `*_feedback`.
7. **Bump `PRINT_BUILD` on every change** and confirm it is live before judging
   a render.

## Variants

### NL
Everything is already keyed by `resolveLang(sections)` and every string has an
`nl` entry. Outstanding:
- Chart axis labels are still English (`Autonomy`, `SWEET SPOT`, `AI exposure`)
  — they live in the shared `V4*SVG` dashboard components.
- No Dutch report exists in the database yet, so the NL path has only been
  verified by forcing the language locally.
- The cover's "cairn" dictionary panel stays English on purpose: it explains an
  English brand name.

### Partner (white-label)
Wired but never rendered against a real partner:
- Cover: partner logo in the white band, left of the Cairnly wordmark.
- Every page: partner mark in the running header; the space is reserved whether
  or not a partner exists, so pagination does not shift.
- `powered_by_text` currently has no home since the cover footer became
  "Prepared for …". Needs a decision.
- Logos MUST be `data:` URIs — the CSP blocks storage URLs in `img-src`, and it
  fails silently.

## The Dutch demo report (partner outreach)

Seeded 2026-08-28 for partner outreach to Dutch bureaus. Persona is deliberately
ORDINARY — a customer-service team lead who wants 32 hours and fewer meetings —
because a bureau's client looks like her, not like a Nike brand manager. The
product's value shows best when the input is unremarkable and the output still
finds something realistic.

| Thing | Value |
|---|---|
| Report | `ff7a062b-bb97-4644-9c49-0dda5b54d2c0` |
| Profile / auth user | `70bf5083-6f44-4578-930d-1247afde1572` (`demo.marloes@cairnly.io`) |
| Partner | Loopbaanbureau Voorbeeld, logo at `partner-logos/voorbeeld/wordmark.png` |
| Survey payload | `docs/report/demo-marloes-payload.json`, built by `scripts/demo-marloes-payload.mjs` |

Generated by the REAL WF1→WF4 (English canonical), translated to Dutch by the
pipeline's own `translate-section` calls. To re-render, mint a token against the
report id and call the renderer as in the cosmetics README.

**Known gaps in this sample:** no `exec_summary` (WF7 fires at chat wrap-up, not
from WF1-4) and no `chat_highlights` (comes from the chat). One `dream_jobs` row
was dropped because it came back untranslated and the contract is all-or-nothing
— translating it needs `N8N_SHARED_SECRET`, which is not in `.env.local`.
