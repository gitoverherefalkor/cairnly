# Starting prompt — two sample reports for the website

Copy everything below into a new session.

---

Build two sample career reports for the cairnly.io website, to show visitors
what they get before they buy. Read `docs/report/REPORT-OUTLINE.md` first — the
report structure is LOCKED, this is not a redesign.

## Read this before anything else

**Do NOT use the existing Mirko report (`b96479dc-…`). It is a real paying
customer.** His report names his employers, his projects and his salary
expectations. Renaming him is not enough — the content is identifiable. Anything
on the public site must be a FABRICATED persona generated the same way the Dutch
demo was.

The Dutch demo (Marloes de Vries, report `ff7a062b-…`) IS fabricated and is
yours to reuse. See the bottom of `REPORT-OUTLINE.md`.

## The positioning problem — solve this first, it shapes everything

Cairnly's pitch is that it is NOT a static PDF report. Putting a downloadable
26-page PDF on the homepage as the hero sample argues the opposite, and the
category is full of "get your AI career report PDF" products to be confused
with.

The report already contains its own rebuttal, on two pages:

- **Discussion Highlights** — "what came out of talking it through with your
  coach". A static generator cannot produce this page.
- **The closing page** — the job-search, resume and cover-letter tools, and the
  refund ladder.

Recommended approach, in preference order:

1. **A live, scrollable sample page** rendered from the existing print route.
   It is already HTML. A page you can scroll says "living document" in a way a
   download cannot, and the PDF sits underneath it as "and you can take it with
   you." This also removes the token problem below.
2. Annotated excerpts (5-6 pages) with callouts pointing at the conversation
   page and the toolkit page, plus a full PDF behind an email capture.
3. Two bare PDF downloads. Simplest, weakest, and the one that invites the
   static-PDF read.

Whatever is chosen, the surrounding copy should make the PDF a *feature of* the
product rather than the product. Something in the spirit of "your report keeps
changing as you talk to your coach; download it whenever you want a copy."

## Technical: samples need a stable URL

`/report/print?rt=<token>` uses a SINGLE-USE token with an expiry. That is fine
for a customer download and useless for a website link. Options:

- Add a demo branch to the print route (`?demo=marloes-en`) that reads a
  committed fixture and NEVER calls Supabase. Gives a permanent public URL and
  enables option 1 above. The branch must be incapable of reaching real data.
- Or render the PDFs once and commit them under `public/samples/`.

`?sample=1` already exists and puts "Voorbeeldrapport" / "Sample report" on the
cover in place of the normal kicker. **Use it on anything public.**

## The two personas

**1. English Marloes — nearly free.** Her canonical `content` is already
English (the language contract makes every generator write English; the Dutch
lives in `content_i18n`). Rendering with the owner's `preferred_language='en'`
gives the English report with no new content. Verify rather than assume, but
this should be a render, not a generation.

**2. A fabricated high-flyer — needs a full pipeline run.** Senior, ambitious,
strong CV, high salary band, weighing autonomy against seniority. The contrast
with Marloes is the point: a visitor should see themselves in one of them.

Generate exactly as Marloes was:

- Copy `scripts/demo-marcel-payload.mjs (was demo-marloes-payload.mjs)`. Its choice-resolution approach is the
  important part: multiple-choice answers are written as short SUBSTRINGS and
  resolved against the live `questions.config.choices` at build time, failing
  loudly on a miss or an ambiguity. Do not hand-transcribe option strings — they
  are markdown-laden and the first run of that script caught a real collision
  ("Uncomfortable" is a substring of "Very uncomfortable").
- Seed profile + auth user + report row, then POST the `forward-to-n8n` body
  shape straight to the WF1 webhook. WF1→WF4 takes ~11 minutes.
- Give the high-flyer `preferred_language='en'` so no translation is needed.

## Known gaps you will hit

- **No `exec_summary`** — WF7 fires at chat wrap-up, which a pipeline-only run
  never reaches. **No `chat_highlights`** — comes from the chat. Both were
  hand-authored for the Dutch demo; see `REPORT-OUTLINE.md` for the exact shapes
  (`<h5>` blocks for the summary, `- **bold lead.** prose` bullets for the
  highlights). For the website samples these two pages matter MORE than usual,
  because Discussion Highlights is the page that proves the product is
  conversational. Do not ship a sample without it.
- **`N8N_SHARED_SECRET` is not in `.env.local`.** It gates `translate-section`.
  Not needed if both website samples are English, which is the recommendation.
- The all-or-nothing language rule means ONE untranslated section flips a whole
  document to English. Harmless here, surprising if you forget it.

## Rules that will bite you

- Bump `PRINT_BUILD` on every print change and confirm it is live before judging
  a render. The response echoes `renderVersion`, `printBuild` and
  `linksRepaired`. This caught stale builds nine times in one session.
- The narrative FLOWS — never fixed-height sheets.
- No font glyphs outside Latin; they are tofu in headless Chromium.
- Every image needs `loading="eager"` or readiness hangs.
- Font weight never above 700.
- `LAYOUT_VERSION` in `render-report-pdf` is the PDF cache key. Bump it whenever
  the printed layout changes.
