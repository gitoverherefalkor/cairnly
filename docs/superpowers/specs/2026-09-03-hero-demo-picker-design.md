# Hero demo picker: design

Date: 2026-09-03. Status: approved in conversation, straight to implementation.

## Goal

The homepage hero stops selling with a screenshot carousel and an intake chat,
and starts selling with the public demo. A visitor sees two real people (Emma,
Marcel), reads in one line what each session is about, watches a fragment of
the real coaching chat play out, and clicks into the full demo. Nobody has to
answer five questions or pay before seeing what the product does.

Out of scope: the partner pages, the demo pages themselves (`/demo`,
`/demo/dashboard`, `/demo/jobs`, `/demo/survey`), n8n, video assets.

## Decisions taken

| Question | Decision |
|---|---|
| Intake chat | Moves out of the hero into its own section directly above Pricing. Not removed. |
| Intent pills | Move with the chat (they seed it). Hero copy becomes fixed; pills keep steering the intent copy in WhyWeBuiltThis and WhoFor. |
| Persona choice | Not "which one is you". Two cards, "have a look at one of these two", each with intent + traits. Click = open the demo. |
| Language | Untouched. `?persona=` overrides the language pick; the demo shows the session in the UI language (translation sidecars) with the existing translated/fallback note. Cards carry a small "session in English/Dutch" label. |
| Moving visual | Mini-replay of the real session from fixture data (no video). |
| Stills | Not in the hero as a strip. They are the back screens of a stacked stage (dashboard, jobs) and replace the June screenshots in How it works. |
| Layout | A v2: cards left (5 cols), stacked stage right (7 cols), stage bottom aligned with the second card. |
| Stage persona | Language default (nl → Marcel, else Emma). Hover on a card swaps the stage on desktop. An Emma / Marcel toggle in the stage label works everywhere (touch). |
| Survey demo | Entry from How it works step 1, plus one text link under the intake chat. Not in the hero. |

## Hero (src/components/landing/Hero.tsx, rewritten)

Keeps: `survey-bg` section, teal bloom, cairn watermark, logo lockup left and
the H1 right (fixed copy: current `hero.titleA/Highlight/B` default variant),
the gold eyebrow rule. Eyebrow text becomes `hero.eyebrowDemo` ("01 · See a
real session" / "01 · Bekijk een echte sessie").

Content band, `lg:grid-cols-12`:

- **Left, `lg:col-span-5`**: body copy (fixed, `hero.body` + `hero.bodyEmphasis`
  default variant), then `DemoPersonaCards` (two cards), then the
  "neither of these?" line (`hero.neitherLine` + `hero.neitherCta`) which
  smooth-scrolls to `#intake-chat`.
- **Right, `lg:col-span-7`**: `DemoStage`.
- Under both columns, centred: `PriceCountdown` (gold, leadWithPrice),
  `CompareLink`, `hero.reassurance`. Unchanged components.

Mobile / `< lg` DOM order: H1, body, stage, cards, neither-line, price block.
Desktop puts the stage in the right column via grid placement (same trick the
current Hero uses with explicit `lg:row-start`).

Removed from the hero: `IntentChips`, `IntakeChatPanel`, `HeroCarousel`,
`ReportDeliverablesCard`, the `pitched` / `chatStarted` branches,
`useIntentCopy`.

### DemoPersonaCards (new, src/components/landing/demo/DemoPersonaCards.tsx)

Two cards, cream (`#FDFBF2`) on the navy hero, order Emma then Marcel in
English, Marcel then Emma in Dutch (language-default persona first). Each card:

- name · age · role (`landing:heroDemo.cards.<id>.who`)
- intent line in italics (`heroDemo.cards.<id>.intent`)
- "What you see in her/his session" + three bullets (`heroDemo.cards.<id>.seeLabel`, `.see[]`)
- three trait tags (`heroDemo.cards.<id>.traits[]`)
- language tag (`heroDemo.sessionLanguage.en` / `.nl`)
- gold button `heroDemo.cards.<id>.cta` → `demoLink(DEMO_ROUTE, '?persona=<id>')`

The whole card is a `<Link>`; `onMouseEnter` sets the hero persona (desktop
hover swap). `trackCtaClick('hero_demo_<id>')` on click. Cards do not depend
on the stage: they only read/write `useHeroPersona()`.

### DemoStage (new, src/components/landing/demo/DemoStage.tsx)

Label row above the stage: `heroDemo.stageLabel` ("Following: Emma") with an
inline segmented toggle Emma | Marcel bound to `useHeroPersona()`.

Stack of three faux-browser windows (reuse the chrome-bar markup from the
current `HeroCarousel`: traffic lights + `app.cairnly.io/<slug>`), positioned
absolutely inside an `aspect-[16/10]` box:

| index | slug | content | offset when behind |
|---|---|---|---|
| 0 | chat | `MiniReplay` | front |
| 1 | dashboard | still `/images/live/landing/demo/<persona>-dashboard.jpg` | `translate(14px,-14px)` |
| 2 | jobs | still `/images/live/landing/demo/<persona>-jobs.jpg` | `translate(28px,-28px)` |

The front window is at full size; the ones behind show only their chrome bar
and right edge (z-index order by distance from the active index, opacity
0.9/0.8). Clicking the front window navigates to that screen's demo route with
the persona (`DEMO_ROUTE`, `DEMO_DASHBOARD_ROUTE`, `DEMO_JOBS_ROUTE`); clicking
a window behind brings it to the front. Transition 400ms on transform and
z-order.

Stepper under the stage: three pills "1 · Chat", "2 · Dashboard", "3 · Jobs"
(`heroDemo.stepper[]`), active one gold like the current dots. Analytics:
`hero_stage_<slug>` on stepper/front click.

Stills: if a persona has no still for a slug, the window shows a neutral
placeholder panel (never a broken image). Emma's stills come from Sjoerd's
2026-09-03 captures; Marcel's are captured from `/demo/dashboard?persona=marcel`
and `/demo/jobs?persona=marcel` in Dutch. Files are cropped to 16:10, ≤ 1400px
wide, jpg quality 80, under `public/images/live/landing/demo/`.

Height: the stage box sizes itself to the column width (16:10). The left
column's cards get `lg:min-h` tuned so the second card's bottom meets the
stage's bottom at the common desktop widths; exact alignment is checked in
the browser, not enforced by measurement code.

### MiniReplay (new, src/components/landing/demo/MiniReplay.tsx)

Plays a fixed excerpt of the persona's real session inside the front window.

- Source: `src/demo/heroReplay.ts` exports `HERO_REPLAY: Record<DemoPersonaId,
  string[]>`, five or six message ids per persona picked from the fixtures
  (a strong moment; a Keep-worthy exchange). A vitest asserts every id exists
  in its fixture and that the list alternates sender sensibly.
- Loading: `chooseFixture(i18n.language, personaId).load(i18n.language)` (the
  same loader the demo uses, so translation sidecars apply). Fixture chunks
  are lazy; the replay renders an empty window with the typing indicator until
  loaded. Both fixtures are loaded once and cached in module scope so persona
  swaps are instant.
- Text: each message's `content` cut at the first blank line, then at 220
  characters on a word boundary with an ellipsis. Markdown headings/rules are
  stripped (`###`, `---`, `**`). Plain text only, no markdown renderer.
- Timing: coach bubble appears after a 900ms "typing" indicator; visitor bubble
  after 600ms; 1200ms read pause between bubbles; after the last bubble a 3s
  hold, then the window clears and restarts. Persona swap resets to the start.
  `prefers-reduced-motion`: all bubbles shown at once, no loop.
- Visuals: narrow dark sidebar (static list of five report section names from
  `chat` locale keys already used by ReportSidebar, non-interactive) + chat
  column with cream coach bubbles and teal visitor bubbles, mirroring the real
  chat's palette. The bubbles auto-scroll so the newest is visible.

### useHeroPersona (new, src/components/landing/demo/HeroPersonaContext.tsx)

`HeroPersonaProvider` wraps the landing page in `Index.tsx`. State:
`{ persona: DemoPersonaId, setPersona }`, initial value
`personaForLanguage(i18n.language)`; re-derives when the language changes and
the visitor has not chosen explicitly. `demoHref(route)` helper returns
`demoLink(route, '?persona=' + persona)` so every demo link on the page carries
the active persona: hero cards and stage, How it works steps, CoachCards demo
button, intake-chat survey link.

## How it works (src/components/landing/HowItWorks.tsx)

Steps 1, 3, 4, 5 get a demo entry: the `ScreenshotSlot` is wrapped in a `Link`
to `demoHref(route)` (`DEMO_SURVEY_ROUTE`, `DEMO_ROUTE`, `DEMO_DASHBOARD_ROUTE`,
`DEMO_JOBS_ROUTE`) with a small gold label over the bottom-right of the image
"See it in the demo →" (`howItWorks.demoLabel`). Analytics
`howitworks_demo_<slug>`. Step 2 keeps the workflow diagram.

Stills for steps 3, 4, 5 switch to the new Emma captures (chat with the radar
comparison, dashboard welcome, jobs results), cropped to 4:3 into
`public/images/live/landing/` alongside the existing files; the June files stay
on disk until the new ones are verified in the browser, then get deleted.

## Intake chat section (src/components/landing/intake/IntakeChatSection.tsx + Index.tsx)

New wrapper `IntakeSection` rendered in `Index.tsx` directly before
`PricingSection`. Dark (`survey-bg` or `#122E3B`) so the chat panel keeps its
current look. Contents: eyebrow `intakeSection.eyebrow`, H2
`intakeSection.title` ("Tell us what brings you here"), subtitle, then
`IntentChips`, then `IntakeChatPanel` (unchanged), then when `stage === 'pitched'`
the `ReportDeliverablesCard` beside/under it (same swap the hero did). Under the
panel a text link `intakeSection.surveyLink` → `demoHref(DEMO_SURVEY_ROUTE)`.
Section id stays `intake-chat` so `useGetStarted` and the hero's
"neither" line scroll to it. `IntakeChatProvider` stays at page level.

## Copy (public/locales/{en,nl}/landing.json)

New keys: `hero.eyebrowDemo`, `hero.neitherLine`, `hero.neitherCta`,
`heroDemo.*` (cards, stageLabel, toggleAria, stepper, sessionLanguage),
`howItWorks.demoLabel`, `intakeSection.*`. Persona taglines are written fresh
for the cards (shorter than `demo.json`'s) but stay consistent with them. The
existing test that compares locale key sets covers the new keys. No em-dashes.

Card copy (EN, to be mirrored in NL):

- Emma: "Emma · 38 · Senior marketing manager, London fintech" / "Can do the
  job with her eyes closed, and that is exactly the problem." / sees: "three
  careers side by side on one radar", "the coach pushing back on an
  assumption", "a Move pill: ready now or upskill first" / traits: strategic,
  sense-making, restless.
- Marcel: "Marcel · 41 · Customer service team lead, insurer" / "Done managing
  a team, wants to be closer to the people he helps." / sees: "from team lead
  to learning and development", "live openings for his second career", "chat
  feedback that rewrites the report" / traits: empathetic, practical, loyal.

## Analytics

`trackCtaClick` sources: `hero_demo_emma`, `hero_demo_marcel`,
`hero_stage_chat|dashboard|jobs`, `hero_persona_toggle`,
`howitworks_demo_survey|chat|dashboard|jobs`, `intake_survey_link`.

## Tests

- `src/demo/heroReplay.test.ts`: every id in `HERO_REPLAY` exists in its
  fixture; excerpt helper strips markdown and cuts on a word boundary.
- Existing locale key-set test picks up the new keys.
- Existing `links.test.ts` already covers persona carrying; add a case for
  `demoHref`.
- Browser verification (desktop + mobile, en + nl): stage plays, hover and
  toggle swap, stepper flips, every demo link carries `?persona=`, chat section
  still starts from a pill, reduced-motion renders statically.

## Files

New: `src/components/landing/demo/{HeroPersonaContext,DemoPersonaCards,DemoStage,MiniReplay}.tsx`,
`src/demo/heroReplay.ts`, `src/demo/heroReplay.test.ts`,
`src/components/landing/intake/IntakeSection.tsx`, stills under
`public/images/live/landing/demo/`.

Changed: `Hero.tsx`, `Index.tsx`, `HowItWorks.tsx`, `CoachCards.tsx`,
`landing.json` (en, nl), `sitemap`/SEO untouched.

Deleted after verification: `HeroCarousel.tsx` (its chrome-bar markup moves
into DemoStage), the June stills it and How it works no longer reference,
`intakeSlides.ts` pinning glue that only the carousel used (keep the parts the
intake chat's `PitchScreenshot` still imports).
