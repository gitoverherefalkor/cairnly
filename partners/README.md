# Partner outreach samples

Source specimens for pitching Cairnly to career bureaus (loopbaanbureaus). The PDFs
here are gitignored (`*.pdf`); this file records what they are and how to make
another one.

| File | What it is |
|---|---|
| `Cairnly-voorbeeldrapport-NL-Marloes_partner.pdf` | The white-label report as a bureau's client receives it. Partner is **Loopbaanbureau Voorbeeld**, logo on the cover and in every running header. This is the one published on the website. |
| `Cairnly-voorbeeldrapport-NL-template.pdf` | The same document with `[partnernaam]` where the bureau's name goes and no logo, so a prospect can see where their branding lands. |
| `radargrafiek.png` | Screen capture of the "Hoe je top drie zich verhoudt" chart, **published as-is**. The PDF viewer's page rail down the right edge is deliberate: it is what tells a prospect they are looking into a real report rather than at a marketing graphic. |

Both PDFs are print build `p21-partner-closing`, rendered 2026-08-31.

## The template on the website (since 2026-09-02)

`public/partners/cairnly-voorbeeldrapport-nl-template.pdf` is the `[partnernaam]`
template rendered from the **current** demo report (the one the `/demo` replay
is frozen from), so it matches what a partner just scrolled through. It is the
download for partner visitors of `/demo?p=…`. Refresh it in one command (it
keeps the demo profile's partner link and uses the `?pn=` override):

```
node scripts/demo-render-pdf.mjs demo.marloes@cairnly.io \
  --partner-name='[partnernaam]' \
  --out=public/partners/cairnly-voorbeeldrapport-nl-template.pdf
```

To publish a hand-made template instead, drop the file at that exact path and
commit; the demo needs no code change.

## Publishing these to /partners

This folder is the source. The website serves its own copies under `public/partners/`,
which unlike these are committed, via the one `!public/partners/*.pdf` exception to the
global `*.pdf` ignore. Refreshing the published report is a copy plus a commit:

```
cp partners/Cairnly-voorbeeldrapport-NL-Marloes_partner.pdf \
   public/partners/cairnly-voorbeeldrapport-nl.pdf
```

The hero runs a small carousel of these captures, currently
`public/partners/partner-radar-voorbeeld.png` (a straight copy of
`radargrafiek.png`). Adding another, a shot of the dashboard for instance, is
three steps:

1. drop the file in `public/partners/`;
2. add a line to `PARTNER_SLIDES` in `src/components/partners/constants.ts`;
3. add `hero.slides.<key>.alt` and `.meta` to **both** partners locale files.

Order in `PARTNER_SLIDES` is the order on screen. A slide whose file is missing is
dropped at runtime, so an entry can be committed before the screenshot exists, and
if none of them load the hero shows a dashed placeholder instead of breaking. The
frame takes its shape from the first slide that loads and contains the rest, so
mixing a 3:2 report page with a 16:9 dashboard shot will not make the hero jump
height. Arrows and dots appear only once there are two or more slides.

## How a partner report differs from a direct customer's

Keyed off the partner being present, so a direct customer's PDF is unchanged:

- **Pull quotes keep the quote, lose the share footer.** The "pick another line
  and get a ready-made card" line sells a Cairnly-branded LinkedIn asset to
  someone who came in through the bureau's door.
- **The closing page hands the reader to their advisor** instead of to the
  referral ladder. They did not buy this assessment, so "invite six friends and
  get your money back" has no meaning for them. Copy lives in `PARTNER_STRINGS`
  in `src/components/report-pdf/PrintClosing.tsx`, EN and NL.

## Rendering another one

Persona is the Dutch demo (Marcel de Vries, renamed from Marloes on 2026-09-03; the login is still demo.marloes@cairnly.io) — fabricated, safe to send out.
See `docs/report/REPORT-OUTLINE.md` for how it was built.

```
report ff7a062b-bb97-4644-9c49-0dda5b54d2c0
user   70bf5083-6f44-4578-930d-1247afde1572
```

1. Mint a single-use token into `report_render_tokens` for that pair.
2. `POST https://www.cairnly.io/api/render-report` with
   `x-render-secret: $RENDER_SHARED_SECRET` (in `.env.local`) and
   `{"printUrl": "https://www.cairnly.io/report/print?rt=<TOKEN>&sample=1"}`.
3. Decode `pdfBase64` from the response.

Query parameters that matter:

- **`?sample=1` — always, on anything that leaves the building.** Puts
  "Voorbeeldrapport" on the cover in place of the normal kicker, so a specimen
  can never be mistaken for a real client's document.
- `?pn=<name>` overrides the partner name for that one render and drops the
  logo. Use it to hand a prospect the report with their own name in it
  (`?pn=Randstad`) or to rebuild the blank template
  (`?pn=%5Bpartnernaam%5D`). Nothing is written to the `partners` table.

Check `printBuild` in the render response before judging the output — a render
on a stale Vercel build looks exactly like a fix that did not work.
