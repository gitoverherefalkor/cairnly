# Report PDF — cosmetic polish handoff (2026-08-13)

The server-side report PDF pipeline is **built, merged and working end to end**.
This doc is for the follow-up session that makes the output *presentable*.

Build plan + execution notes: `docs/superpowers/plans/2026-08-13-report-pdf-pipeline.md`

## Look at the current output first

A real 16-page render is on disk (gitignored, local only):

```
docs/superpowers/artifacts/sample-report-2026-08-13.pdf
```

Read it with the Read tool's `pages` param (e.g. `pages: "1-3"`). It is a real
customer's report used for QA — do not redistribute it.

## How to render a fresh PDF yourself

You need three things, all already in place:

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

Tokens are single-use. Mint a fresh one per render.

You can also inspect layout **without** Chromium by opening
`https://www.cairnly.io/report/print?rt=<TOKEN>` in the browser tool — same DOM,
much faster iteration. Only pagination and page furniture differ.

## ⚠️ The trap that wasted an hour

**Verify the deploy is actually new before judging a fix.** Three consecutive
renders came back byte-for-byte identical (836719 bytes) across two real code
changes, because the "is it deployed" check only confirmed the endpoint
responded — and the old code responds identically.

Make the check version-sensitive. Cheapest way: have `api/render-report.js`
return a version string on GET, bump it with each change, and poll that before
re-rendering. Do this first; it makes every later iteration trustworthy.

## Known cosmetic issues, roughly by severity

1. **Cover does not fill the page.** White gutter down the right and along the
   bottom; content scaled to ~89% on both axes. An unverified fix is already
   committed (`5790b32`: dropped `format: 'A4'`, which conflicts with
   `preferCSSPageSize: true` and makes Chromium scale-to-fit). **Confirm whether
   that fix actually deployed before doing anything else** — it may already be
   solved.
2. **Charts spill onto a third, mostly-empty page.** The charts `PrintSheet` is
   no longer height-constrained, so it flows. Either split it into two
   deliberate sheets or shrink the charts to fit one.
3. **Body text is small.** 10.5px in `PrintSection.tsx` is tight for A4.
4. **Cover is sparse.** Large empty middle band; the three-slot
   `space-between` layout leaves a lot of air.
5. **No page numbers.** Would need `displayHeaderFooter` — see the constraint
   below.
6. **Dutch reports unverified.** `report_sections.language` flows through but
   nothing branches on it.

## Constraints — do not undo these

- **The narrative must FLOW.** Do not reintroduce fixed-height sheets per
  section. Measured: fixed sheets clipped 7 of 12 pages, worst by 1797px,
  because single career sections exceed an A4 page.
- **Readiness must not depend on `requestAnimationFrame` alone.** rAF never
  fires when `visibilityState` is `hidden`, which is a headless page's normal
  state. The 400ms timer fallback in `ReportPrint.tsx` is load-bearing.
- **`displayHeaderFooter` interacts with the cover.** It is currently enabled
  only when a partner footer exists. If you add page numbers, re-check the
  cover's full bleed.
- **Partner logos must be `data:` URIs.** The CSP blocks storage URLs in
  `img-src`, and it fails *silently* — broken image, successful PDF.
- **Internal sections stay excluded.** `init_summary` and `*_feedback` must
  never render (`isInternalSection` in `ReportPrintDocument.tsx`).

## Files you will touch

| File | What lives there |
|---|---|
| `src/components/report-pdf/printStyles.ts` | `@page` rules, pagination model |
| `src/components/report-pdf/ReportPrintDocument.tsx` | cover, charts sheet, section order |
| `src/components/report-pdf/PrintSection.tsx` | per-section typography + pills |
| `src/components/report-pdf/PrintPage.tsx` | the one-page sheet wrapper |
| `api/render-report.js` | Chromium options |

Deploy is push-to-`main` (Vercel auto-deploys; edge functions via GitHub Action).
