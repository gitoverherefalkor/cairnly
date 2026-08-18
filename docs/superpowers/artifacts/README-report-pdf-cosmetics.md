# Report PDF — cosmetic polish (updated 2026-08-14)

The server-side report PDF pipeline is **built, merged and working end to end**,
and as of 2026-08-14 the output is presentable. This doc records the render
recipe, what was fixed, and the traps that cost real time.

Build plan + execution notes: `docs/superpowers/plans/2026-08-13-report-pdf-pipeline.md`

## Check the deploy BEFORE judging any render

This is the first thing to do, every time. Two independent fingerprints:

```bash
curl -s https://www.cairnly.io/api/render-report      # {"renderVersion":"r8-…"}
```

and every render response echoes both back:

```json
{ "pdfBase64": "…", "renderVersion": "r8-header-template", "printBuild": "p9-…" }
```

- `RENDER_VERSION` lives in `api/render-report.js` — bump on every change to it.
- `PRINT_BUILD` lives in `src/components/report-pdf/printBuild.ts` — bump on
  every change to the print page or its components. **This is the one that
  matters for cosmetic work**, which never touches the serverless function.

Why: on 2026-08-13 three consecutive renders came back byte-for-byte identical
across two real code changes, because the readiness check only proved the
endpoint responded — and the old code responds identically. An hour went into
debugging a fix that had never deployed. On 2026-08-14 the probe caught stale
builds on **four** separate render attempts within one session. Vercel takes
roughly 60–120s; poll, don't assume.

## How to render a fresh PDF

1. `RENDER_SHARED_SECRET` is in `.env.local` (gitignored). Read it from there;
   never print it.
2. Mint a single-use render token via the Supabase MCP:

```sql
insert into public.report_render_tokens (report_id, user_id, expires_at)
values ('<REPORT_UUID>', '<OWNER_USER_UUID>', now() + interval '20 minutes')
returning token;
```

3. Call the renderer (note **www**, the apex 307-redirects):

```bash
S=$(grep '^RENDER_SHARED_SECRET=' .env.local | cut -d= -f2 | tr -d '\n\r')
curl -s --max-time 90 -X POST "https://www.cairnly.io/api/render-report" \
  -H "Content-Type: application/json" -H "x-render-secret: $S" \
  -d '{"printUrl":"https://www.cairnly.io/report/print?rt=<TOKEN>"}' \
  -o /tmp/r.json
python3 -c "import json,base64;d=json.load(open('/tmp/r.json'));open('/tmp/out.pdf','wb').write(base64.b64decode(d['pdfBase64']))"
```

**Iterating on layout?** Run the dev server and open
`http://localhost:8080/report/print?rt=<TOKEN>` — same DOM, instant HMR, no
deploy. Only pagination and page furniture differ.

Tokens are single-use, and a browser reload burns one. For a browser session,
un-consume it instead of minting a new one each time:

```sql
update public.report_render_tokens
set used_at = null, expires_at = now() + interval '8 hours'
where token = '<TOKEN>';
```

## Status of the original issue list

| # | Issue | Status |
|---|---|---|
| 1 | Cover doesn't fill the page | **Fixed.** `5790b32` was correct all along; it had simply never deployed. |
| 2 | Charts spill a third, mostly-empty page | **Fixed.** Split into two deliberate sheets, each with a heading and caption. |
| 3 | Body text too small | **Fixed.** 10.5px → 13.3px (9pt was the real problem; now 10pt). |
| 4 | Cover is sparse | **Fixed.** Contour field, drawn cairn, date moved to the head. |
| 5 | No page numbers | **Fixed.** See the `displayHeaderFooter` note below. |
| 6 | Dutch reports unverified | **Partly.** Frame strings are in and the branch was verified by forcing `lang='nl'` locally. Not verifiable against real data: **every report in the DB is `en`** (28 reports, 486 sections, zero `nl`). |

The real headline fix was not on that list: the narrative read as an
undifferentiated slab because **Tailwind's preflight reset zeroes the margin on
every `p`, `h1-h6`, `ul` and `ol`**, and nothing restored it for a long-form
document. See the note at the top of `printStyles.ts`.

## Constraints — do not undo these

- **The narrative must FLOW.** Do not reintroduce fixed-height sheets per
  section. Measured: fixed sheets clipped 7 of 12 pages, worst by 1797px,
  because single career sections exceed an A4 page.
- **Readiness must not depend on `requestAnimationFrame` alone.** rAF never
  fires when `visibilityState` is `hidden`, which is a headless page's normal
  state. The 400ms timer fallback in `ReportPrint.tsx` is load-bearing.
- **Never pass `format` to `page.pdf()` alongside `preferCSSPageSize`.** Two
  conflicting page sizes make Chromium scale-to-fit, which shrinks the
  full-bleed cover to ~89% and leaves white gutters right and bottom. The
  stylesheet's `@page { size: A4 }` is the single source of truth.
- **Partner logos must be `data:` URIs.** The CSP blocks storage URLs in
  `img-src`, and it fails *silently* — broken image, successful PDF.
- **`maxWidth: 'none'` on any image meant to overflow its box.** Tailwind
  preflight sets `img { max-width: 100% }`, which silently clamped the cover's
  deliberately 262mm-wide photograph to the 210mm page and left a strip of bare
  backdrop under it. Same class of bug as preflight zeroing the margins.
- **Readiness now waits on `img.decode()` for every image, and must keep doing
  so.** This is what makes images safe at all: before it, a photo that had not
  finished decoding simply missed the snapshot. Two consequences. Any image
  added to this page needs `loading="eager"` — a lazily-loaded image outside the
  viewport never starts loading, so it would hang the wait and every render
  would die at the 30s timeout. And a decode failure is swallowed on purpose,
  because one broken photo must not cost the whole PDF.
- **Internal sections stay excluded.** `init_summary` and `*_feedback` must
  never render (`isInternalSection` in `ReportPrintDocument.tsx`).
- **No font glyphs outside the Latin set.** Headless Chromium on Lambda ships
  almost no system fonts, and neither Poppins nor Inter carries `⚠ ✓ ← →`, so
  there is no fallback face to borrow them from and they render as tofu boxes.
  The deployed PDF had 27 of them. Every such mark is now drawn as inline SVG.
  If you add a symbol to any component that reaches the PDF, draw it.

### The cover is exported in its own pass

Chromium draws the header and footer templates on EVERY page including the
first, and nothing in a template can test the page number. The cover is
therefore exported separately with the furniture off, the body with it on, and
the two are merged with `pdf-lib`. Both passes reuse the same already-rendered
page, so the second export costs no reload and no second readiness wait.

Measured: Chromium PRESERVES document page numbers across a `pageRanges`
export, so the cover is unnumbered and the body starts at 2.

Do not "simplify" this back to one pass — the running header printed straight
across the cover's white band.

### `displayHeaderFooter` — corrected

The previous version of this doc said `displayHeaderFooter` "reserves its own
margin band and stops honouring `@page :first { margin: 0 }`", shrinking the
cover. **That was a misdiagnosis** — the gutters came from `format: 'A4'`, and
the two changes were tested together. With `format` gone, the cover bleeds to
all four edges with the footer enabled. Measured, not assumed.

What *is* true: **Chromium draws the footer on page 1 too**, over the cover
art, and nothing in the template can suppress it — the template has no way to
test the page number, and `@page :first { margin: 0 }` does not stop the draw.
The cover therefore no longer draws a brand line of its own — the repeating
footer already carries one over page 1, and having both printed it twice.

## Files

| File | What lives there |
|---|---|
| `src/components/report-pdf/printStyles.ts` | `@page` rules, pagination model, the whole narrative type system |
| `src/components/report-pdf/ReportPrintDocument.tsx` | section order, sheet layout, en/nl frame strings |
| `src/components/report-pdf/PrintCover.tsx` | cover art (all drawn, no assets) |
| `src/components/report-pdf/PrintSection.tsx` | per-section header, pills, icons, ⚠/✓ callouts |
| `src/components/report-pdf/PrintContents.tsx` | the "What's inside" page |
| `src/components/report-pdf/PrintChapterDivider.tsx` | the two chapter openers |
| `src/components/report-pdf/PrintPullQuote.tsx` | share-card quote + where its text comes from |
| `src/components/report-pdf/printIntros.ts` | section intros, chapter copy, en/nl |
| `src/components/report-pdf/printSectionMeta.ts` | section → icon + eyebrow |
| `src/components/report-pdf/PrintPage.tsx` | the one-page sheet wrapper |
| `src/components/report-pdf/printBuild.ts` | SPA deploy fingerprint |
| `src/components/report-pdf/PrintClosing.tsx` | sign-off + toolkit/refund CTAs |
| `api/render-report.js` | Chromium options, two-pass cover merge, renderer fingerprint |

**Print-sized assets live under `public/report/`.** The dashboard's originals
embed roughly 12x the pixels the PDF can show (a 3548px wordmark drawn at 25mm,
600px photos drawn at 44px). The downsized copies take ~900KB off every render;
the dashboard keeps the full-size files. Regenerate with `sips -Z`.

Deploy is push-to-`main` (Vercel auto-deploys; edge functions via GitHub Action).

## Document structure

1. Cover (full bleed)
2. What's inside — clickable, links to each section
3+. Narrative, split by two chapter dividers, each carrying a pull quote

Each chapter OPENS on its own page carrying three things: the divider, the
chapter's pull quote, and the chapter's headline chart — the personality radar
for chapter one, the top-three comparison for chapter two. The career map is not
a chapter chart; it plots every role including the runner-ups, so it stays in the
flow just ahead of the first grouped set. Every chart carries a line pointing at
the dashboard, where the same chart is interactive.

The document ends on a **closing page**: the sign-off the coach already delivers
at the end of the chat, then the toolkit and refund ladder. That list is
generated from `UNLOCK_LADDER` and `REFERRAL_DISCOUNT_PERCENT` in
`useReferralStatus`, never typed out — a printed PDF cannot be corrected after
the fact, so a hardcoded "invite 4 friends for 25% back" would become a false
promise the day the ladder changes.

Grouped types (runner-ups, outside-the-box, dream jobs) arrive as several rows
of one `section_type`. Each set gets a `PrintGroupHeader` that owns the type's
intro and its `h2`; the roles below step down to `h3` and their sub-headings to
`h4`. That is why sub-headings are styled by CLASS and never by tag — the tag
varies with nesting depth. The group header is NOT a filled banner: the first
version used a cream box that shouted louder than the roles it introduced and
competed with the chapter divider and pull quote, which are already filled
blocks. Its `h2` is styled as an eyebrow so it keeps the outline without
competing.

Every section header reads in one fixed order: hairline, eyebrow, title,
company size/type, pills, then a square chip paired with the intro, then clear
space. The chip is a photograph for About-You sections and one of the
dashboard's six `CareerSlotIcon` glyphs for career sections. Chip and intro are
ONE unit — a nested role has no intro of its own, and rendering the chip
without one left a floating square with empty space beside it.

Body copy is **10pt** (13.3px at 96dpi). It was 9pt, which is below what anyone
would set for A4. Sizes stay in px because the file is CSS, but each rule
carries its pt equivalent, because "is 13.3px big enough?" is unanswerable and
"is 10pt big enough?" is not.

**Reused from elsewhere in the app, not reinvented:**

- Sub-heading icons come from `iconForSubsection` in
  `components/chat/subsectionIcons.ts`, which already had EN and NL tables. The
  print pipeline simply never called it, which is why early PDFs had no icons.
- Section icons are the chat sidebar's `SECTION_ICONS`, re-keyed to
  `section_type`.
- Chart cards are the dashboard's `V4ChartBanner` with a `print` flag.
- The contents page mirrors `ALL_SECTIONS` grouping from `ReportSidebar`.
- Intros derive from `deliver-section/boilerplate.ts` — **by meaning, not by
  string**, and `printIntros.ts` explains why at length. Do not "fix" this into
  a verbatim import.

## Share-quote coverage (worth knowing)

The pull quotes come from the LinkedIn share feature, which has **two different
mechanisms**:

| | Career quotes | Personality quotes |
|---|---|---|
| How | LLM, `generate-share-quotes` | `pickShareSentences()` in-browser |
| Stored | `report_sections.share_quotes` | never stored |
| Source of truth | the DB column | `dashboardV2Shared.tsx` |

`ShareCardModal` is the **only** caller of `generate-share-quotes` in the repo,
so the column is null until someone opens the share modal for that report. As
of 2026-08-14 that was 1 of 28 reports for `top_career_1`. `PrintPullQuote`
therefore prefers the stored quote and derives one otherwise — which means it
**auto-upgrades**: move generation to report completion and every later PDF
starts printing the LLM line with no change here.

## Known remaining rough edges

- Chart **axis labels are still English** in Dutch reports (`Autonomy`,
  `Stability`, `SWEET SPOT`, `AI exposure`…). They live in the shared
  `V4*SVG` dashboard components, so localizing them is a dashboard change, not
  a print change.
- WF7's **exec-summary subheaders have no Dutch icon keys**. The NL entries in
  `subsectionIcons.ts` were copied verbatim from the live prompts; WF7's Dutch
  list has not been pinned the same way, so guessing keys would add lines that
  never match.
- The cover carries a faint page number in Chromium's footer band. Unavoidable
  without dropping page numbers entirely; see above.
- Page count is 21–23 for a real report, up from 13. Most of that is the cost
  of readable body type and real paragraph spacing; four pages are the new
  front matter (contents + one sheet per chart).
- **`SalaryPill` is not worth adding.** It exists in dashboardV2Shared, but
  `metadata.salary` is present on only 2 of 28 top-career rows and 6 of 82
  runner-ups, and reads null even where the key exists. The pill would render on
  a handful of reports. Same shape of gap as `move` on older reports: the code
  would be right and the data absent.
- **The share modal has no deep link.** The pull quote's "change this line"
  points at `cairnly.io/dashboard` rather than opening the modal. A `?share=1`
  param on the dashboard would fix it.
- The cover's outlined cairn glyph is a **321px PNG drawn at 106mm tall**, so it
  is soft in print. It came from the hand-off as a raster; as SVG it would be
  crisp. Everything else on the cover is fine.
- The cover is still placeholder art pending a design pass. Photography is now
  viable on it (readiness waits for image decode), which it was not before.
- `move` (the reskilling pill) is absent from older reports — Douwe's has none
  on any section, Mirko's has it on the top three, runner-ups and dream jobs.
  The pill is correct; the data predates the field. Not a print bug.

## One more deploy gotcha

Mid-deploy, a render can fail with *"Print page never signalled readiness"* —
the new HTML is being served while its JS chunk is not on the CDN yet, so the
SPA never boots. It is transient. Retry; it is not a code fault. Seen once in
about a dozen renders.

## Internal links and the two-pass merge

The contents page's links are real PDF GoTo annotations, but they only survive
because the renderer repairs them. Chromium writes same-document links as NAMED
destinations, and PDF has two places that catalogue can live:

- `/Root /Dests` — a plain dictionary (PDF 1.1). **This is what Chromium emits.**
- `/Root /Names /Dests` — a name tree (PDF 1.2+).

pdf-lib's `copyPages` copies pages and their annotations but neither catalogue,
so the two-pass cover merge left all 11 links pointing at names that no longer
resolved — present, and silently dead. `relinkNamedDests` in
`api/render-report.js` reads both forms and rewrites each link to an explicit
`[pageRef, /XYZ, …]` destination, which needs no catalogue entry.

The first attempt at this fix read only the name tree, found nothing, and
returned early having changed nothing. That is why the render response now
reports `linksRepaired` — **0 on a report that has a contents page means the
destination catalogue moved again.**

External links (`https://…`) were never affected: a URI action is
self-contained and has no page reference to remap.

## Chip assets

Some chips are COMPLETE TILES — the cream ground and tan border are painted into
the image (`chat_highlights`). Those render bare; wrapping one in `PrintChip`'s
own tile prints the border twice. Section photographs and career glyphs do get
the wrapper. All print copies live in `public/report/` at ~220px with space-free
names; the originals stay put for the dashboard.
