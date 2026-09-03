# Handoff: scrollable product demo (chat replay)

**Written 2026-09-02, after the plan was agreed with Sjoerd in chat. Updated
later the same day after the walkthrough was completed and several chat
features shipped. This document is self-contained — execute from here, no need
for the original conversation.**

## Status (2026-09-03, afternoon): Phase 4 (the job search) is built

`/demo/jobs` renders the persona's job search through the REAL `JobsResults`
and `JobsSavedKanban` from one frozen search run per persona, linked from the
demo dashboard (Jobs tile unlocked + nudge). Persona and language are
decoupled now: `?persona=emma|marcel` on any demo page overrides the language
pick, and every link between the demo pages carries `?p=` and `?persona=`
along (`src/demo/links.ts`). Details, the fixture additions, the additive
component props and the one open point (Marcel's thin result) are in
`docs/handoff/demo-toolkit-plan.md`, status block at the top.

## Status (2026-09-03): Emma re-recording prepared

Sjoerd asked for a fresh Emma walkthrough (chat only, same report), with the
comparison explanation on career 3 (its radar plots all three matches, so the
"three careers, five axes" note finally sits next to a three-career radar)
and less polished typed turns. The script is
`docs/report/demo-emma-chat-script.md`; it ends with the re-freeze steps
(export, re-anchor the seven curation ids, update the movePill/radar
annotation bodies, render the PDF, test, commit).

`demo-reset-chat.mjs --full` now rewinds the REPORT too (Keeps, wrap-up rows,
section feedback, status back to pending_review); it was run for Emma on
2026-09-03, so her account is pristine and waiting. The committed fixture
and PDF still serve /demo until the re-export lands.

Same day, on the demo pages: the honest label reads "Demo account. Real
analysis and responses."; a trust bar (GDPR, strong data security, one-click
delete; no payment line) sits above the nav and folds away on scroll
(`DemoTrustBanner`); the chat replay's footer now stacks above the sidebar's
fixed panel (z-45 vs z-40) so the panel no longer floats over the footer.

## Status (2026-09-02, late evening): Phase 3 (dashboard) is built

`/demo/dashboard` renders the persona's finished dashboard through the REAL
`DashboardV4` from the same fixture the chat replay uses. Same language rule
(nl → Marloes, else Emma), same `?p=` partner audience, linked from the
chat replay's footer ("See her dashboard") and back ("Back to the
conversation").

| Piece | Where |
|---|---|
| Page | `src/pages/DemoDashboard.tsx`; route in `src/App.tsx`; SEO entry in `scripts/seo-routes.mjs`; strings under `dashboardDemo.*` + `footer.dashboard*` in both demo locale files |
| Switched-off controls | `src/components/demo/DemoToolDialog.tsx`: every control that would run a paid tool or needs a session (job search, résumé tailor, cover letters, share-card generation, invite flow, profile/sign-out) opens this dialog: what the button does for a real user + the CTA (checkout, or the pilot call for partners). The referral toolkit renders fully locked, as for a new account |
| PDF | the dashboard's "Download report PDF" opens the pre-rendered demo PDF (a real render of this report) instead of paying for a Chromium render |
| Fixture additions | `demo-export-fixture.mjs` now also writes `savedResponses` (the saved_chat_responses rows the "Saved answers from the chat" panel shows), `persona.country` and `persona.reportCompletedAt`. Both fixtures were re-exported (message ids unchanged; the DB rows are stable) |
| Additive component changes | `DashboardV4` gained `nav` (replaces the signed-in app nav) and `savedResponses` (injected rows); `V4SavedResponses` gained `responses` (implies read-only: query disabled, no remove button). Nothing else in the dashboard tree fetches: `StepCard`'s three count queries are user-gated and stay idle without a session |

Verified in the browser: no Supabase request leaves the page, both personas
render (welcome block, three matches with the comparison radar, career map,
personality radar, full report accordions, saved answers, wrap-up summary),
the locked "Find roles" opens the dialog, Escape closes it.

## Status (2026-09-02, evening): Phase 2 (Emma, EN) is built

`/demo` now follows the site language: Dutch visitors get Marloes, English
visitors get Emma. What phase 2 added:

| Piece | Where |
|---|---|
| Emma's account | `demo.emma@cairnly.io`, user id `b5ed7c5b-833a-470b-b14c-733976e4bdc8`, `preferred_language='en'`, country United Kingdom, no partner link. Password in `.env.local` as `DEMO_DEMO_EMMA_PASSWORD` (bottom entry wins) |
| Her survey | `scripts/demo-emma-payload.mjs` → `docs/report/demo-emma-payload.json` (same substring-resolution mechanism as Marloes's script; London fintech senior marketing manager, 38, MA, "hollowed out", AI-uncertain, flexible hours non-negotiable) |
| Account tooling | `scripts/demo-create-account.mjs <email> --first --last --lang --country` (auth user + profile fields); `demo-rerun-report.mjs` gained `--payload=<file>` for a persona's FIRST run |
| The walkthrough | `scripts/demo-chat-step.mjs <email> <command>`: drives the chat one click or turn at a time with the SAME calls the UI makes (deliver-section, chat-proxy, save-chat-response, wrap-up-extract/save, chat_messages metadata for the pill labels). Commands: status, last, ready, continue, say [--pill=][--about=], explore, chip, move, keep, explain, wrapup. Emma's replies were written live in reaction to the coach, one step per command |
| Fixture + curation | `src/demo/fixtures/emma.en.json` (report `dc17ed73-2c0c-4fa8-8fab-6f0078aea3d1`, 52 messages, 17 sections, 2 Keeps) + `emma.en.curation.json` (seven annotations, same keys as Marloes's) |
| PDF | `public/demo/cairnly-demo-emma-en.pdf` (rendered with `demo-render-pdf.mjs demo.emma@cairnly.io`; her profile has no partner link, so nothing to clear) |
| Code | `chooseFixture()` picks the persona by language (`personaForLanguage`); `demoPdfPath(persona, lang)` replaced the single PDF constant; `DemoFooter` takes the persona; the intro/footer sentences take `{{name}}`; annotation strings moved to `annotations.<persona>.<key>` in both locale files; tests run over both fixtures |

Beats in Emma's session, for the annotations and for anyone re-running it:
pushback on the development section (the "late scramble" is not her), Keep on
the "more scope, less proximity to the story" reply, a `Something else` turn
that adds a promotion decision and her partner's shift rota (neither in the
survey; the coach carries both into the career chapter), the Move pill on
Service Designer (Upskill, defended), the comparison explanation on career 2,
"Ask about this role" on Design Sprint Facilitator (the coach concedes it is a
business, not a job, and prices year one at £15-30k), a second Keep in outside
the box, the dictated dream-jobs turn, and a non-database question (UK service
design certification cost, evening formats, asking the employer to fund it).

Known blemishes in the frozen output, deliberately left as generated (the page
promises unedited AI output): the outside-the-box card for Editorial Director
says "her named dream job" (third person slip in WF3's prose), and the kept
outside-the-box reply contains a stray Chinese character ("one层 removed").
If Sjoerd wants those gone, the honest route is a fresh walkthrough, not an
edit of the fixture.

Partner visitors (`?p=…`) still get the DUTCH white-label template PDF
whichever persona is on screen: the partner audience is Dutch bureaus.

## Status (2026-09-02, end of day): Phase 1 is LIVE on `/demo`

Built and shipped to `main` in one session. What exists now:

| Piece | Where |
|---|---|
| Export script (freeze a walkthrough) | `scripts/demo-export-fixture.mjs` — newest `completed` report, falls back to newest report with chat; `--report=<uuid>` override; user turn sorts before the bot turn on a created_at tie |
| PDF script (footnote of the replay) | `scripts/demo-render-pdf.mjs` — renders the fixture's report through the live pipeline with `?sample=1`, into `public/demo/cairnly-demo-<persona>-<lang>.pdf`. Clears the demo profile's `partner_id` for the render and restores it (the profile is linked to the sample partner for `/partners`); `--keep-partner` renders the white-labelled variant |
| Fixture + curation | `src/demo/fixtures/marloes.nl.json` (report `10646823…`, 42 messages, 17 sections, 3 Keeps) + `marloes.nl.curation.json` (hidden ids, annotation anchors) |
| Pure logic + tests | `src/demo/{types,chapters,loadFixture,constants}.ts`, `src/demo/*.test.ts` (the tests load the real fixture: 10 sections detected in order, every anchor id exists, jsonb parsed) |
| Page + components | `src/pages/Demo.tsx`, `src/components/demo/{DemoReplay,DemoAnnotation,DemoChapterBar,DemoHighlightsCard,DemoFooter}.tsx` |
| Strings | `public/locales/{nl,en}/demo.json` (namespace `demo` registered in `src/i18n.ts`) |
| Route / SEO | `/demo` in `src/App.tsx` and `scripts/seo-routes.mjs` (Dutch static shell, indexable, in the sitemap) |
| Teasers | landing: button under the chat-refine cards (`CoachCards.tsx`); `/partners` hero: gold "Bekijk een echte coachsessie" → `/demo?p=partners` |

Decisions taken at build time (Sjoerd's calls that the plan left open):

- **EN before phase 2:** English visitors got Marloes with an "in Dutch" note
  until Emma existed (superseded the same evening; the note survives as
  `fallback.otherLanguage` for a language with no session of its own).
  `chooseFixture()` in `src/demo/loadFixture.ts` is the one place personas
  are registered.
- **`?p=<anything>` = partner audience:** CTAs become the Calendly pilot call +
  "back to the partner page"; the visit fires the existing `sample_view`
  beacon with the `p` slug, so outreach links can be tagged per bureau.
- **Read-aloud stays on** in the replay. The `tts` function was already
  reachable with the anon key from anywhere (rate-limited 30/min/IP), so the
  demo adds no new exposure; hiding it would also hide the Keep / In rapport
  badges that share the footer.
- **Keep is local:** the persona's kept replies show "Bewaard"; toggling only
  changes local state. Other bot replies show no Keep button.
- **"Leg deze vergelijking uit"** scrolls to (and flashes) the explanation the
  coach already posted in the session (career 3); where the persona never
  asked (career 2) it drops the stored explanation in locally.
- **Closing beat** is a demo-layer card fed with the `chat_highlights` section
  (the real WrapUpCard calls the extraction function on mount, so it cannot be
  fed statically without changing it).
- **The chapter-1 feedback card is not reconstructed** (trap 9). Skip stays.

Two small changes to chat components were needed after all (both additive):

1. `ChatMessage` gained a `forceFullReveal` prop, passed through to
   `SequentialSubsections`, whose initial state now starts fully open when
   set (growing in an effect would fire scroll-into-view on every message at
   mount and yank the page).
2. `normalizeTitle` in `ChatMessage` (and the mirror in `src/demo/chapters.ts`)
   folds hyphens to spaces. The delivered heading "HR-adviseur, …" no longer
   matched the re-translated title "HR Adviseur, …", which silently dropped
   career 2's score pills and radar. That fix applies to the live chat too.

**Re-freezing after a better walkthrough:** export → check the annotation ids
in the curation file (the tests fail loudly on a stale id) → render the PDF →
`npm test` → commit the fixture, curation and PDF together.

Round 2 (same day, after Sjoerd's first look): the real `WelcomeCard` opens
the replay (its button jumps to the first turn) with a non-clickable
illustration of the four quick-reply pills under it (`DemoWelcome`); the
annotated moments are numbered and listed in a sticky legend rail on the
left from 1360px (`DemoLegend`, jump links, lights up as you scroll past;
below 1360px the list sits in the intro card); the connector line of each
note is measured at runtime so it reaches the bubble; and two more notes:
the "via Iets anders" label (message 16) and the dictated dream-jobs turn
(message 39, speech → text → AI tidy-up before send). Five annotations now;
add one = curation anchor + `annotations.<key>.{eyebrow,title,body,legend}`
in both locale files (a test checks the strings exist).

Round 3 (same day): the real `ReportSidebar` replaced the demo-layer chapter
bar and legend rail. The page is laid out like `/chat` (fixed glass panel on
the left, `md:mx-80` / `md:mx-20` column margins, drawer + N/M pill on
mobile); the current section follows the scroll, every section is a jump
target. Two additive props on `ReportSidebar` made that possible:
`allSectionsReachable` (no progress lock; upcoming sections show an open
circle instead of the lock) and `desktopTopOffset` (re-centres the panel
below a header taller than /chat's). The annotated moments moved to
numbered chips in the sticky header (`DemoMomentsBar`); the sidebar starts
collapsed below 1360px so the transcript keeps its width.

Round 4 (same day): the career-card pills ("Vraag iets over deze rol", the
Move pill) render in their real place on every card. A click jumps to the
turn where Marloes used that pill (the Move pill → her auto-generated
feasibility question on career 1; ask-about-role → her `[Over …]` question
on the Facilitator card), so no control is dead. Two notes mark those turns
(seven moments now; legends shortened so all chips fit from 1360px). The
"Chat-generated · not scored" badge on the Facilitator card is real product
UI: that card carries `metadata.origin = chat_replacement` (only the
coach's replace-a-career flow writes that) and no `move`; the badge text
is now localised (`careerPills.chatGenerated`).

Round 5 (same day): partner visitors (`/demo?p=…`) download the white-label
TEMPLATE instead of Marloes's plain report:
`public/partners/cairnly-voorbeeldrapport-nl-template.pdf`, rendered from the
same report with `demo-render-pdf.mjs --partner-name='[partnernaam]'` (see
partners/README.md). The sidebar's multi-row sublines ("3 alternatives") are
localised via chat.json `sidebarCounts` (plural keys).

## Goal

A public, scrollable replay of a real coaching session, on the website, to
convince two audiences that the product is interactive rather than a static
report:

- **Partners** (NL) — loopbaanbureaus deciding whether to white-label Cairnly.
- **Customers** (EN + NL) — visitors who won't pay €59 for an unproven product.

Screenshots prove the product exists; the replay proves it *responds*: the
persona pushes back on her personality analysis, the coach takes it, the report
changes. That is the differentiator, and no copy or PDF can assert it as
convincingly. The PDF becomes the footnote ("download this as a PDF" at the end
of the transcript) — the ordering itself makes the argument.

## Locked decisions (agreed with Sjoerd — do not relitigate)

1. **Replay real components from a frozen fixture.** Not a login-able demo
   account (fragile, auth surface, visitors would trigger paid n8n calls), not
   a video (proves nothing, ages instantly). A public route renders the actual
   chat components from a committed JSON fixture. No input box, no n8n calls.
   The fixture freezes *content*; the *presentation* stays live, so every UI
   improvement automatically upgrades the demo.
2. **Fixture = messages + sections + persona**, not messages alone (see schema
   below — the rich cards read `report_sections`, not the message text).
3. **Annotation layer on top.** Margin notes at the moments that make the
   argument, plus a sticky chapter progress bar. Pure demo-layer, i18n strings,
   zero changes to chat components.
4. **Two personas, one route.** `/demo` follows the site language: NL shows
   Marloes (exists), EN shows a new higher-educated persona ("Emma", see
   below). Language toggle on the page.
5. **Honest labeling.** A fixed, visible label: fictional persona, real AI
   output ("Demo met fictieve persoon, echte AI-output" / "Demo with a
   fictional persona, real AI output"). Non-negotiable — without it the page
   reads as a fake testimonial.
6. **Dashboard demo is phase 3**, chat replay first (80% of the persuasion for
   30% of the work).

## Existing infrastructure to reuse

| Thing | Where | Notes |
|---|---|---|
| Chat rendering | `src/components/chat/ChatMessage.tsx` | Renders stored markdown; contains `SequentialSubsections` (top-career reveal flow) and `CollapsibleCareerBlocks` (runner-ups/OOB cards) |
| Score/AI/Move pills | `src/components/chat/CareerScoreCard.tsx` | Reads `report_sections` rows via the `sections` prop |
| Comparison radar | `src/components/chat/CareerComparisonCard.tsx` | Needs `metadata.fit_scores` + `metadata.comparison` + `content_i18n[lang].comparison` on top_career_2/3 rows. Since 2026-09-02: dashed reference lines + legend hover/tap highlights a career — exactly the interaction the radar annotation should invite |
| Chat page assembly | `src/components/chat/ChatContainer.tsx` | Too coupled to live sessions — do NOT reuse wholesale; build a thin `DemoReplay` container that maps fixture messages onto `ChatMessage` |
| Demo account tooling | `scripts/demo-set-password.mjs`, `scripts/demo-rerun-report.mjs`, `scripts/demo-reset-chat.mjs` | Password conventions, full WF1-WF4 re-run, and a full chat reset (4 state locations). All refuse non-`demo.*` emails — keep that guard in every new demo script |
| Wrap-up card | `src/components/chat/WrapUpCard.tsx` | Fully Dutch since 2026-09-02. Optional closing beat: render it statically fed with the `chat_highlights` section from the fixture, phase `review`, so the replay ends on "dit verandert je rapport" instead of stopping mid-air |
| Partner pages | `/partners`, `/partners/voorbeeldrapport` | The demo link for partners goes here |
| PDF pipeline | `report-pdf` components + render tokens | Target of the "download as PDF" footnote |

**Demo account:** `demo.marloes@cairnly.io`, user id
`70bf5083-6f44-4578-930d-1247afde1572`, `preferred_language='nl'`. Password is
in `.env.local` as `DEMO_DEMO_MARLOES_PASSWORD` (written by
`demo-set-password.mjs`; the BOTTOM entry in the file is the current one —
each run appends).

**The walkthrough is DONE.** Report `10646823-1920-4889-9dc0-f780b4215fca`,
status `completed` (walkthrough + wrap-up finished 2026-09-02): 42 chat
messages, 3 Keeps (`saved_chat_responses`), 2 quick-reply provenance labels
(`chat_messages.metadata.quick_reply`), chapter-feedback discussion via WF6 on
13 sections, `chat_highlights` + `exec_summary` written. All content is Dutch
(15 sections translated), AI-impact badge and prose vocabulary are in sync,
and top careers carry `fit_scores` + `comparison` + `move` metadata. Freeze
from THIS report — nothing is pending.

**Do not hardcode the id**, but also do not blindly take "the newest report":
running `demo-rerun-report.mjs` creates a NEW (chat-less) report that would
then be the newest. The export script must select the newest report with
status `completed` (or the newest that has chat_messages).

## Fixture

One JSON file per persona, committed to the repo (e.g.
`src/demo/fixtures/marloes.nl.json`). Content is marketing-public by design;
the personas are fictional. `.pdf` is gitignored in this repo — JSON is fine.

```jsonc
{
  "persona": { "firstName": "Marloes", "language": "nl", "exportedAt": "…", "reportId": "…" },
  "messages": [
    // from chat_messages, ordered by created_at:
    // { id, sender ('user'|'bot'), content, created_at, metadata, curated? }
    // metadata is the jsonb column (added 2026-09-02); metadata.quick_reply
    // holds the pill key ('differently'/'somethingElse') that renders the
    // small "via <pill>" tag above a typed user turn — keep it.
  ],
  "sections": [
    // from report_sections for the same report — every column the chat reads:
    // { id, section_type, order_number, title, alternate_titles,
    //   company_size_type, content, score, metadata, language, content_i18n }
    // EXCLUDE init_summary: no renderer reads it, and it is the one section
    // that is raw survey extraction rather than user-facing content.
  ],
  "savedMessageIds": [
    // message ids from saved_chat_responses for this report — drives the
    // "In rapport" (Keep) badges in the replay, one of the three planned
    // annotation moments.
  ]
}
```

Build `scripts/demo-export-fixture.mjs` (service-role, demo-guarded, same
`.env.local` parsing as the sibling scripts): finds the account's newest
report, dumps messages + sections, writes the fixture. Re-running it after a
better walkthrough re-freezes the demo — that's the intended workflow.

**Curation:** add an optional local overlay (either a `curated: false` flag
patched into the fixture by hand, or a sibling `marloes.nl.curation.json`
listing message ids to hide). Boring in-between turns get cut from the replay
without touching the database. Keep the mechanism dumb.

## The replay route

- `Route path="/demo"` in `src/App.tsx`, public (no auth guard — the guard is
  per-page in this app, so simply don't add one), in the generated sitemap,
  NOT noindexed.
- A `DemoReplay` page: picks the fixture by `i18n.language` (NL → Marloes,
  EN → Emma once she exists; EN before phase 2 can fall back to Marloes with a
  "Dutch demo" note, or hold the EN link until phase 2 — Sjoerd's call at
  build time).
- Renders the message list through `ChatMessage` with `sections` from the
  fixture. No `ChatInput`, no `QuickReplies` wired to anything, no n8n.
- **Per-message props shipped on 2026-09-02 that the thin container must
  replicate** (ChatMessages.tsx shows the pattern — a few lines each):
  - `quickReplyKey={msg.metadata?.quick_reply ?? null}` — the "via Dit zie ik
    anders" tag above typed turns.
  - `followUpAnsweredBy={next message's content when it is a user turn}` —
    makes an answered multiple-choice message keep its choice-card look
    (options disabled, picked one check-marked) instead of degrading to plain
    bullets. Without this the demo loses one of its best "the product asks,
    she chooses" beats.
  - `bookmarkedMessageIds` from the fixture's `savedMessageIds` — the
    "In rapport" badges.
- **Reveal behavior:** the sequential-reveal and collapsed-cards gating exists
  to pace a real session. For the demo, keep the *interactions* (open a career
  card, hover the radar — they make the product feel alive) but do not gate
  scrolling: render top-career messages fully revealed (`forceFullReveal` prop
  already exists on the sequential flow), leave the multi-card sections
  collapsed-but-clickable.
- Sticky chapter nav: Persoonlijkheid → Carrières → Droombanen (derived from
  which message delivers which section_type; clicking scrolls).
- Annotation layer: margin/inline callouts anchored to specific message ids
  from the fixture. Start with three: the pushback moment on the personality
  analysis, the "Opgeslagen / In rapport" moment (this answer changes the
  final report), and the comparison radar (generated for her, not a
  template). Annotations are demo-layer components + i18n strings — do not
  touch the chat components for them.
- Footer: honest-label + "Download dit rapport als PDF" + CTA (customers →
  /payment funnel; a `?p=partners` variant or referrer-based CTA can point
  partners at /partners contact — keep it simple).
- Landing page + /partners each get a teaser block linking to /demo. If the
  teaser embeds the page in an iframe, remember the X-Frame-Options lesson
  from the partner sample-PDF work: same-origin framing needed explicit
  header handling. A styled static snippet linking out is cheaper and safer.

## Traps (all hit recently — do not rediscover them)

1. **jsonb-as-string:** n8n writes some jsonb columns as JSON-encoded strings.
   Every fixture consumer must parse-if-string before use (`metadata`,
   `content_i18n`, `fit_scores`). House pattern; see memory/code comments.
2. **Two metadata shapes:** rows generated before 2026-08-31 carry
   presentation baked into data (`<strong>Alternate titles:</strong> …`,
   `<h4><strong>size</strong></h4>`); newer rows are bare values. All display
   components tolerate both — keep it that way in any new demo code.
3. **Language plumbing:** chat components localise via `i18n.language`
   (i18next) — the demo route must let the normal locale switching work; the
   fixture's `persona.language` only selects WHICH fixture, not how it
   renders. Section text resolves through `sectionTitle`/`sectionText`
   (content_i18n with English fallback) — pass rows through those, never read
   `content` directly.
4. **Comparison translation** lives at `content_i18n.nl.comparison`
   ({headline, explanation}) since 2026-09-01. Older reports lack it
   (translate-section backfills on re-run). Marloes's current report has it.
5. **Sitemap is generated** at build ("static meta injected for N routes") —
   add the route where the other public routes are registered, don't
   hand-edit output.
6. **Never exceed font-weight 700** anywhere (platform rule).
7. **Em-dashes:** none in any user-facing/marketing copy (NL or EN). House
   writing rule.
8. **Rerunning the demo account destroys the frozen source.**
   `demo-rerun-report.mjs` creates a fresh chat-less report;
   `scripts/demo-reset-chat.mjs` wipes the chat (four state locations — see
   the checklist at the top of `docs/report/demo-marloes-chat-script.md`).
   Export the fixture FIRST; after that the database is expendable.
9. **The chapter-1 feedback card is absent from this walkthrough.** A gating
   bug (open task: the modal keys on `currentSectionIndex === 4`, which was
   out of sync) meant it never appeared, so there is no chapter_1_feedback
   row and no modal moment in the transcript. If the demo wants that beat,
   render `ChapterFeedbackModal` as a static reconstructed card in the demo
   layer — do not fake a message for it.
10. **Build now runs `tsc --noEmit` first** (added 2026-09-02 after a
    dashboard crash from an unchecked identifier). New demo code must
    typecheck clean or the build fails — that is intended.

## Phases

**Phase 1 — NL demo live (one session):**
export script → fixture from Marloes's finished walkthrough (already DONE —
report `10646823…`, status completed; freeze immediately) → `/demo` replay
route + chapter nav + 3 annotations + honest label + PDF footnote → teaser
links on landing + /partners → build, tests, verify in browser, ship to main.
Acceptance: a logged-out visitor can scroll the full NL session on production,
open career cards, hover the radar, and reach the PDF + CTA.

**Phase 2 — Emma (EN): DONE 2026-09-02 (see the status block at the top).**
Original brief: new demo account `demo.emma@cairnly.io` (create via normal auth +
`demo-set-password.mjs`), `preferred_language='en'`. Persona: ~38, senior
marketing manager or strategy consultant, college-educated, stuck on
meaning/AI-uncertainty — aspirational for the paying audience. Write her
survey payload (mirror the shape of Marloes's `reports.payload`), run
`demo-rerun-report.mjs`, then a *directed* EN walkthrough: at least one
genuine pushback on the personality analysis, one "Ask about this role", one
Move-pill click, the comparison + "Explain this comparison". Export fixture,
wire into `/demo` for EN.

**Phase 3 — dashboard demo: DONE 2026-09-02 (see the status block at the top).**
Original brief: same fixture approach on a read-only dashboard view ("Bekijk ook haar
dashboard →" from the demo footer). Exclude: Jobs live search (paid external
calls) and the resume builder — link back to the CTA instead. Note: the
dashboard crashed on fit_scores reports until 2026-09-02 (`lang` out of scope
in DashboardV4's compare panel); fixed, and the compare radar there works
with Marloes's report now.

## Out of scope

- Any n8n workflow changes (none needed).
- Live "try it yourself" input on the demo — the landing page's intake chat
  already covers that; link to it rather than rebuilding it.
- Migrating or re-rendering old reports.

## Status (2026-09-03, afternoon): both personas in both languages (translation layer)

Sjoerd wants visitors to pick a persona by situation, not by language, so each
session has to exist in the other language too. Two layers, deliberately kept
apart:

- **Report sections** go through the product's own translator
  (`translate-section`, gated, writes `content_i18n`). Marcel's sections were
  already bilingual (English canonical + Dutch). Emma's Dutch side is produced
  by the n8n utility "OPS - Retranslate report (manual)" (`TRao82muo2Pifqd1`),
  whose HTTP body now names her report + `target_language: nl`; running it is
  a manual click in n8n (this session could not execute workflows). Backup of
  the previous body: `n8n_wfs_cairnly/OPS_retranslate_report_BACKUP_pre_emma_20260903.json`.
  After it ran: re-export her fixture (`demo-export-fixture.mjs demo.emma@…`).
- **Chat messages** (which the product never translates) get a demo-layer
  sidecar, `src/demo/fixtures/<persona>.<from>.messages.<to>.json`, written by
  `npx tsx scripts/demo-translate-fixture.ts <persona> --to=<lang>`. Most
  faithful method first: section deliveries whose stored text still equals
  what `renderSection()` renders today are re-rendered in the target language
  (exactly what the product would have delivered); the comparison explanation
  is the stored one in the target language; canned quick-reply turns map to
  the product's own strings; the Move-pill question uses
  `buildFeasibilityQuestion`'s template; a clicked follow-up option becomes the
  same bullet of the translated follow-up; `[Over …]` becomes `[About …]`; the
  rest (typed turns, coach replies, and the section deliveries WF6 rewrote
  after the chat, which no longer match the stored section) goes to
  `claude-opus-5` with a glossary of the report's own titles and the
  persona's typing style preserved (lowercase, no final period, small slips).
  Idempotent; `--dry` prints the plan and glossary; `--only=` / `--force`
  redo entries. `chat_highlights` (exempt from the product translator) is
  translated into the sidecar's `sections` and injected as `content_i18n`.
- **Loader**: `chooseFixture(lang, persona).load(uiLanguage)` overlays the
  sidecar when the UI language differs from the session's and a sidecar is
  registered (`PERSONAS[id].translations`), setting `fixture.translatedTo`;
  Keep rows follow their message text. The intro note switches to
  `personas.<id>.translated` ("you are reading a translation; typos kept on
  purpose"). `demoPdfLanguage()` serves the PDF in the UI language when it
  exists (`pdfLanguages`); `demo-render-pdf.mjs --lang=<lang>` renders it by
  flipping `preferred_language` for the render only.
- **Tests**: `src/demo/translations.test.ts` runs for every sidecar that
  exists: full coverage, every section delivery still resolves to its
  section (score pills, radar), the clicked follow-up option still matches a
  bullet, the Move/scoped turns keep their shapes, Keep rows and highlights
  carried along.
- Discovered on the way: WF6's feedback rewrite means several stored sections
  differ from what the chat delivered (that is the "report changes" story);
  the chat shows the delivered text, the dashboard/PDF the rewritten one, in
  both languages.

Done, both directions: Marcel → English (24 model calls; 5 sections
re-rendered, 1 comparison, 12 mapped, 1 template, 1 option, 1 scoped, 21
model) and Emma → Dutch (her sections via the OPS utility, run by Sjoerd:
16 translated, 3 exempt; 27 model calls; 8 re-rendered, 12 mapped, 1
template, 1 option, 2 scoped, 23 model). Both PDFs exist in both languages
(`cairnly-demo-<persona>-<lang>.pdf`). Sub-section headings (`#####`) and
company lines (`####`) of model-translated deliveries are aligned by position
to the report's own strings, because the chat's icons match on the exact
subheader text and companyContext localises the company line; re-rendered
deliveries are refreshed on every run so label fixes reach the sidecars.
Emma's report used three company-line shapes companyContext did not know
("Large agency / consultancy (201-1000)", "Large (201-1000) / Agency /
Consultancy", "Own company / boutique practice"); added to BOTH copies of
the table (src/lib and the edge function mirror, kept identical).

One known oddity worth knowing: Emma's delivered runner-ups still show
"Product Marketing Consultant", a card WF6 replaced after the chat, so it has
no section row and renders without score pills in both languages. That is
faithful to what she saw; leave it.

## Status (2026-09-03): Marloes became Marcel

Sjoerd wanted a name non-Dutch readers can pronounce and a second gender next
to Emma. The Dutch persona is now **Marcel de Vries** (same story: 41,
customer-service team lead, two children, the fixed Wednesday at home). The
coach only ever addressed the persona in the second person, so the rename
was a whole-word replace of the name: 15 occurrences across profile, survey
payload, chat, sections (both languages), Keeps and the coach's memory.

- **Login unchanged:** `demo.marloes@cairnly.io` (password var
  `DEMO_DEMO_MARLOES_PASSWORD`). The export/render scripts take
  `--persona=marcel` to name the persona independently of the login.
- `scripts/demo-rename-persona.mjs <email> --from= --to= [--apply]` did the
  database side (dry run first). It keeps translations past the staleness
  trigger by re-sending them with a `renamed_at` marker when only the
  canonical text mentions the name. Lesson from the first run: replace inside
  string VALUES, never on serialised JSON text, where `\n` hides a name
  behind a letter.
- **Trap found on the way:** the demo profile's `preferred_language` had
  flipped to `en` (the app writes the UI language back to the profile on
  every language change while signed in, so a login with an English UI
  re-labels the persona). Export and PDF render key off that column; both
  came out English until it was set back to `nl`. Check it before any
  re-freeze.
- Fixture `marcel.nl.json` + `marcel.nl.curation.json` (same message ids),
  PDFs `public/demo/cairnly-demo-marcel-nl.pdf` and the partner template
  re-rendered; persona id `marcel` in `loadFixture.ts`, tests and both demo
  locale files. Shared demo copy is now gender-neutral (`{{name}}`, "het
  rapport"), so a persona of either gender reads right; only the
  per-persona annotations and taglines carry pronouns.
