# Partner outreach samples

Specimen PDFs for pitching Cairnly to career bureaus (loopbaanbureaus). The PDFs
themselves are gitignored (`*.pdf`); this file records what they are and how to
make another one.

| File | What it is |
|---|---|
| `Cairnly-voorbeeldrapport-NL-Marloes.pdf` | The white-label report as a bureau's client receives it. Partner is **Loopbaanbureau Voorbeeld**, logo on the cover and in every running header. |
| `Cairnly-voorbeeldrapport-NL-template.pdf` | The same document with `[partnernaam]` where the bureau's name goes and no logo, so a prospect can see where their branding lands. |
| `Cairnly-voorbeeldrapport-NL_lbb.pdf` | **Superseded** (built 2026-08-28, print build p20). Still ends on the referral ladder and still carries the LinkedIn share footer. Delete it once nothing points at it. |

Both current files are print build `p21-partner-closing`, rendered 2026-08-31.

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

Persona is the Dutch demo (Marloes de Vries) — fabricated, safe to send out.
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
