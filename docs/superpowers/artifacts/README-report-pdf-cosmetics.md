# Report PDF — cosmetic polish (updated 2026-08-14)

The server-side report PDF pipeline is **built, merged and working end to end**,
and as of 2026-08-14 the output is presentable. This doc records the render
recipe, what was fixed, and the traps that cost real time.

Build plan + execution notes: `docs/superpowers/plans/2026-08-13-report-pdf-pipeline.md`

## Check the deploy BEFORE judging any render

This is the first thing to do, every time. Two independent fingerprints:

```bash
curl -s https://www.cairnly.io/api/render-report      # {"renderVersion":"r7-…"}
```

and every render response echoes both back:

```json
{ "pdfBase64": "…", "renderVersion": "r7-always-footer", "printBuild": "p4-footer-compare" }
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
| 3 | Body text too small | **Fixed.** 10.5px → 12px. |
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
  `img-src`, and it fails *silently* — broken image, successful PDF. For the
  same reason all cover art is inline SVG, never an image file: the readiness
  gate waits on `document.fonts.ready`, not on image decode.
- **Internal sections stay excluded.** `init_summary` and `*_feedback` must
  never render (`isInternalSection` in `ReportPrintDocument.tsx`).
- **No font glyphs outside the Latin set.** Headless Chromium on Lambda ships
  almost no system fonts, and neither Poppins nor Inter carries `⚠ ✓ ← →`, so
  there is no fallback face to borrow them from and they render as tofu boxes.
  The deployed PDF had 27 of them. Every such mark is now drawn as inline SVG.
  If you add a symbol to any component that reaches the PDF, draw it.

### `displayHeaderFooter` — corrected

The previous version of this doc said `displayHeaderFooter` "reserves its own
margin band and stops honouring `@page :first { margin: 0 }`", shrinking the
cover. **That was a misdiagnosis** — the gutters came from `format: 'A4'`, and
the two changes were tested together. With `format` gone, the cover bleeds to
all four edges with the footer enabled. Measured, not assumed.

What *is* true: **Chromium draws the footer on page 1 too**, over the cover
art, and nothing in the template can suppress it — the template has no way to
test the page number, and `@page :first { margin: 0 }` does not stop the draw.
The footer is therefore kept to a page number plus an optional partner mark.
Anything wordier prints the brand twice on the cover.

## Files

| File | What lives there |
|---|---|
| `src/components/report-pdf/printStyles.ts` | `@page` rules, pagination model, the whole narrative type system |
| `src/components/report-pdf/ReportPrintDocument.tsx` | section order, chart sheets, en/nl frame strings |
| `src/components/report-pdf/PrintCover.tsx` | cover art (all drawn, no assets) |
| `src/components/report-pdf/PrintSection.tsx` | per-section header, pills, ⚠/✓ callouts |
| `src/components/report-pdf/PrintPage.tsx` | the one-page sheet wrapper |
| `src/components/report-pdf/printBuild.ts` | SPA deploy fingerprint |
| `api/render-report.js` | Chromium options, renderer fingerprint |

Deploy is push-to-`main` (Vercel auto-deploys; edge functions via GitHub Action).

## Known remaining rough edges

- Chart **axis labels are still English** in Dutch reports (`Autonomy`,
  `Stability`, `SWEET SPOT`, `AI exposure`…). They live in the shared
  `V4*SVG` dashboard components, so localizing them is a dashboard change, not
  a print change.
- The cover carries a faint page number in Chromium's footer band. Unavoidable
  without dropping page numbers entirely; see above.
- Page count went 13 → 18 for the sample report. Four of those pages are the
  cost of readable body type and real paragraph spacing; one is the second
  chart sheet.
