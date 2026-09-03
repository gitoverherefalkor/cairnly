# Hero Demo Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero's carousel + intake chat with two persona cards and a stacked, self-playing demo stage; move the intake chat above Pricing; make How it works a clickable tour of the demo.

**Architecture:** A page-level `HeroPersonaProvider` holds the active demo persona (language default, hover, toggle) and exposes `demoHref(route)`. New components under `src/components/landing/demo/` render the cards, the stacked stage and the fixture-fed mini replay. `Hero.tsx` composes them; `IntakeSection.tsx` re-homes pills + chat; `HowItWorks.tsx` wraps its stills in demo links.

**Tech Stack:** React 18 + TypeScript, react-router `Link`, react-i18next, Tailwind + `landing.css`, vitest. Demo data via `src/demo/loadFixture.ts` (`chooseFixture`, `personaForLanguage`) and `src/demo/links.ts` (`demoLink`).

Spec: `docs/superpowers/specs/2026-09-03-hero-demo-picker-design.md`.

---

### Task 1: Hero replay excerpt data + test

**Files:**
- Create: `src/demo/heroReplay.ts`
- Create: `src/demo/heroReplay.test.ts`

- [ ] Write `heroReplay.test.ts`: for each persona in `HERO_REPLAY`, load the fixture json (static import of `./fixtures/emma.en.json` and `./fixtures/marcel.nl.json`), assert every id exists, that the list starts with a `user` message and alternates sender. Test `excerptText()` strips `###`, `---`, `**`, cuts at the first blank line and at 220 chars on a word boundary with `…`.
- [ ] Run `npx vitest run src/demo/heroReplay.test.ts` → fails (module missing).
- [ ] Write `heroReplay.ts`: `HERO_REPLAY: Record<DemoPersonaId, string[]>` with the ids picked on 2026-09-03 (Emma: fb789360…, 147e5928…, 7df25995…, 3c731878…, f402c2e4…, 0586dfa8…; Marcel: 9d835698…, 4185cb2e…, c2332dbd…, 6ab8b532…, 8f02d60d…, d8863a4c…) and `excerptText(content: string, max = 220): string`.
- [ ] Run the test → passes. Commit `demo: hero replay excerpt ids + excerpt helper`.

### Task 2: HeroPersonaContext

**Files:**
- Create: `src/components/landing/demo/HeroPersonaContext.tsx`
- Modify: `src/pages/Index.tsx` (wrap page in `HeroPersonaProvider`)

- [ ] Context value `{ persona: DemoPersonaId, picked: boolean, setPersona(id), demoHref(route) }`. Initial persona = `personaForLanguage(i18n.language)`; an effect re-derives it on language change while `picked` is false. `demoHref(route)` = `demoLink(route, '?persona=' + persona)`. Export `useHeroPersona()` (throws outside provider) and `useHeroPersonaOptional()`.
- [ ] Add a case to `src/demo/links.test.ts`: `demoLink('/demo/jobs', '?persona=marcel')` → `/demo/jobs?persona=marcel` (documents the contract the context relies on).
- [ ] Wrap `Index.tsx` content in `<HeroPersonaProvider>` inside `IntentProvider`. Commit.

### Task 3: DemoPersonaCards + copy

**Files:**
- Create: `src/components/landing/demo/DemoPersonaCards.tsx`
- Modify: `public/locales/en/landing.json`, `public/locales/nl/landing.json` (add `heroDemo.*`, `hero.eyebrowDemo`, `hero.neitherLine`, `hero.neitherCta`)

- [ ] Add locale keys (spec §Copy). Order of cards: language-default persona first (`personaForLanguage`).
- [ ] Component: two `<Link to={demoHref(DEMO_ROUTE)}>` cards; `onMouseEnter` → `setPersona(id)`; `onClick` → `trackCtaClick('hero_demo_' + id)`. Card = name/role line, italic intent, "what you see" bullets, trait tags, language tag, gold button (`lp-btn-gold`). Active persona gets a gold ring.
- [ ] Typecheck (`npx tsc --noEmit`). Commit.

### Task 4: MiniReplay

**Files:**
- Create: `src/components/landing/demo/MiniReplay.tsx`

- [ ] Module-level cache `Map<string, Promise<DemoFixture>>` keyed `persona:lang`, filled via `chooseFixture(lang, persona).load(lang)`.
- [ ] Component props `{ persona: DemoPersonaId }`. Builds `bubbles = HERO_REPLAY[persona].map(id → {sender, text: excerptText(content)})`. State `shown` (count). Timeline: coach bubble = 900ms typing indicator then show; user bubble = 600ms then show; 1200ms pause between; after last, 3s hold, reset to 0. `useEffect` keyed on persona + lang resets. `matchMedia('(prefers-reduced-motion: reduce)')` → show all, no loop.
- [ ] Layout: flex row; left 30% dark sidebar listing `ALL_SECTIONS` titles 1–5 (static, `aria-hidden`); right chat column, bubbles cream (`#FDFBF2`, dark text) for bot, teal (`#27A1A1`, white) for user; typing indicator = three dots. Chat column `overflow-hidden`, bubbles bottom-anchored so the newest is always visible (flex-col justify-end).
- [ ] Commit.

### Task 5: DemoStage

**Files:**
- Create: `src/components/landing/demo/DemoStage.tsx`

- [ ] Screens: `[{slug:'chat', route: DEMO_ROUTE}, {slug:'dashboard', route: DEMO_DASHBOARD_ROUTE, still: '/images/live/landing/demo/<persona>-dashboard.jpg'}, {slug:'jobs', route: DEMO_JOBS_ROUTE, still: '/images/live/landing/demo/<persona>-jobs.jpg'}]`. State `front` index (resets to 0 on persona change).
- [ ] Label row: `heroDemo.stageLabel` + segmented toggle Emma | Marcel (`setPersona`, `trackCtaClick('hero_persona_toggle')`).
- [ ] Stack box `relative aspect-[16/10]`; each window `absolute inset-0` faux browser (chrome bar from HeroCarousel + `app.cairnly.io/<slug>`); depth `d = (i - front + 3) % 3`: `d=0` → front, `translate(0)`, z 30; `d=1` → `translate(14px,-14px)` z 20 opacity .9; `d=2` → `translate(28px,-28px)` z 10 opacity .8. Transition 400ms. Front window body = `<MiniReplay>` for chat, `<img>` still for the others (`onError` → neutral panel). Clicking the front window = `<Link to={demoHref(route)}>` + `trackCtaClick('hero_stage_' + slug)`; clicking a back window = bring to front.
- [ ] Stepper: three pills under the box, active gold; click → front.
- [ ] Commit.

### Task 6: Hero rewrite

**Files:**
- Modify: `src/components/landing/Hero.tsx`

- [ ] Remove IntentChips / IntakeChatPanel / HeroCarousel / ReportDeliverablesCard / useIntentCopy / useIntakeChatOptional. Fixed copy via `t('hero.titleA')` etc. Eyebrow `hero.eyebrowDemo`.
- [ ] Grid: left `lg:col-span-5` (body, `DemoPersonaCards`, neither-line linking to `#intake-chat` with smooth scroll), right `lg:col-span-7` (`DemoStage`). Mobile order: body, stage, cards (use `order-*` on `< lg`). Under both: `PriceCountdown`, `CompareLink`, reassurance.
- [ ] Typecheck, commit.

### Task 7: IntakeSection above Pricing

**Files:**
- Create: `src/components/landing/intake/IntakeSection.tsx`
- Modify: `src/pages/Index.tsx`, locales (`intakeSection.*`)

- [ ] Section `id={INTAKE_SECTION_ID}` dark navy, `scroll-mt-24`; eyebrow, H2, subtitle; `IntentChips`; grid: `IntakeChatPanel` left (7), right column `ReportDeliverablesCard` when `stage === 'pitched'`, else a short "what happens with your answers" note; text link to `demoHref(DEMO_SURVEY_ROUTE)` with `trackCtaClick('intake_survey_link')`.
- [ ] Insert `<IntakeSection />` before `<PricingSection />` in `Index.tsx`. Verify `IntentChips` still works outside the hero (it only needs IntentContext + IntakeChatContext).
- [ ] Commit.

### Task 8: How it works demo links + new stills

**Files:**
- Modify: `src/components/landing/HowItWorks.tsx`, locales (`howItWorks.demoLabel`, updated `screenshotMeta` where needed)

- [ ] Add `demoHref?: string` + `demoLabel?: string` + `onDemoClick` handling to the `Step` visual: wrap the `ScreenshotSlot` in a `relative` div and overlay a gold pill `<Link>` bottom-right ("See it in the demo →"). Steps 1/3/4/5 → survey/chat/dashboard/jobs routes via `useHeroPersona().demoHref`. Step 2 unchanged.
- [ ] Switch step 3/4/5 `src` to `chat_with_coach_sep26.jpg`, `get_report_sep26.jpg`, `land_the_job_sep26.jpg`.
- [ ] `CoachCards.tsx`: demo button `to={demoHref(DEMO_ROUTE)}`.
- [ ] Commit.

### Task 9: Marcel stills

- [ ] Run the dev server, open `/demo/dashboard?persona=marcel` and `/demo/jobs?persona=marcel` in Dutch at 1400×875, screenshot, save as `public/images/live/landing/demo/marcel-dashboard.jpg` / `marcel-jobs.jpg` (jpg q80).
- [ ] Commit.

### Task 10: Cleanup + verification

- [ ] Delete `HeroCarousel.tsx`; keep `intakeSlides.ts` + test (still guards the chat's beat plan). Delete `take_assessment_jun26.png`? No: step 1 keeps it. Delete `chat_with_coach_jun26.png`, `get_report_jun26.png`, `land_the_job_jun26_v2.png` after checking no other reference (`grep -rn jun26 src`).
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint` on changed files.
- [ ] Browser: `/` in EN and NL, desktop + mobile: replay plays, hover/toggle swap, stepper flips, links carry `?persona=`, chat section starts from a pill, reduced-motion static.
- [ ] Commit, push to main (Vercel auto-deploys).
