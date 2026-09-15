# Hero Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero's deck of demo stills with one faux-browser window that plays a scripted recording of the frozen demo (Marcel NL / Emma EN), ending on a real "Start your session now" button.

**Architecture:** Three layers. (1) App-side hooks that are invisible to visitors: a `data-demo-chrome` attribute on demo scaffolding, a `window.__CAIRNLY_DEMO_CAPTURE__` flag read through one helper, and a capture-only scripted reveal in `DemoReplay`. (2) A puppeteer-core recording script that drives the demo pages scene by scene, screenshots at max speed, and hands ffmpeg a concat list with real frame durations. (3) A new `DemoVideoStage` hero component that plays the language's video and overlays the end card.

**Tech Stack:** React 18 + TypeScript + Tailwind, react-i18next, vitest, puppeteer-core (already installed) + the local Google Chrome, ffmpeg (Homebrew). Spec: `docs/superpowers/specs/2026-09-14-hero-demo-video-design.md`.

**Read before starting:** the spec above, and the memory note about headless Chrome (`project_headless_chrome_documents_revocation.md`): the recording script must NEVER be run from a Claude session inside the desktop app. Tasks 1–8 are code only and are safe anywhere. Task 9 (the recording) is for Sjoerd in a normal Terminal.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/demo/capture.ts` (new) | `isDemoCapture()` + the `window` typings for the flag and the reveal hook |
| `src/demo/capture.test.ts` (new) | unit test for the helper |
| `src/components/demo/DemoTrustBanner.tsx`, `DemoWelcome.tsx`, `DemoHighlightsCard.tsx`, `DemoFooter.tsx`, `DemoAnnotation.tsx`, `DemoPageNav.tsx` | get `data-demo-chrome=""` on their root / label element |
| `src/components/CookieConsentBanner.tsx`, `src/components/LanguageSuggestionBanner.tsx` | same attribute on the root |
| `src/pages/Demo.tsx` | attribute on intro card, moments bar, progress bar, nav label, footer wrapper; capture-only right margin |
| `src/pages/DemoDashboard.tsx` | attribute on the intro block + footer wrapper; capture-only: no jobs redirect, no tool dialog |
| `src/pages/DemoSurvey.tsx` | attribute on the intro header + footer wrapper |
| `src/components/demo/DemoReplay.tsx` | capture-only scripted reveal (`revealCount`, `window.__cairnlyDemoReveal`, real QuickReplies under the cut) |
| `public/locales/en/landing.json`, `public/locales/nl/landing.json` | `heroDemo.endCard.*` keys |
| `src/lib/demoHero.generated.ts` (new, script-written) | `DEMO_HERO_VERSION` |
| `src/components/landing/demo/heroVideo.ts` (new) | pure helpers: which files for which language, versioned URLs |
| `src/components/landing/demo/heroVideo.test.ts` (new) | unit test |
| `src/components/landing/demo/DemoVideoStage.tsx` (new) | the hero window: video, poster, end card, analytics |
| `src/components/landing/Hero.tsx` | swaps deck + persona cards for `DemoVideoStage` |
| `scripts/demo-record-hero.mjs` (new) | the recording |
| `.gitignore`, `package.json` | `.demo-capture/` ignored; `demo:record` script |

`DemoStage.tsx`, `DemoPersonaCards.tsx`, `HeroPersonaContext.tsx` and `src/pages/Index.tsx` do not change: `/partners` keeps the stills deck, and the provider still feeds `useDemoHref()` for How it works and the video stage's links.

---

### Task 1: The capture helper

**Files:**
- Create: `src/demo/capture.ts`
- Create: `src/demo/capture.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/demo/capture.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { isDemoCapture } from './capture';

describe('isDemoCapture', () => {
  afterEach(() => {
    delete window.__CAIRNLY_DEMO_CAPTURE__;
  });

  it('is off unless the recording script set the flag', () => {
    expect(isDemoCapture()).toBe(false);
    window.__CAIRNLY_DEMO_CAPTURE__ = true;
    expect(isDemoCapture()).toBe(true);
  });

  it('ignores truthy non-boolean values', () => {
    (window as unknown as { __CAIRNLY_DEMO_CAPTURE__: unknown }).__CAIRNLY_DEMO_CAPTURE__ = 'yes';
    expect(isDemoCapture()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/demo/capture.test.ts`
Expected: FAIL, cannot find module `./capture`.

- [ ] **Step 3: Implement**

```ts
// src/demo/capture.ts
/**
 * The recording script (scripts/demo-record-hero.mjs) sets
 * `window.__CAIRNLY_DEMO_CAPTURE__ = true` before the page loads. A few
 * demo surfaces read it to behave like a camera-ready product: no tool
 * dialogs, no jobs redirect, no empty margin-note column, and a transcript
 * that reveals itself on the script's command. The site never sets it.
 */
declare global {
  interface Window {
    __CAIRNLY_DEMO_CAPTURE__?: boolean;
    /** Capture-only: show the first `count` messages of the replay. */
    __cairnlyDemoReveal?: (count: number) => void;
  }
}

export function isDemoCapture(): boolean {
  return typeof window !== 'undefined' && window.__CAIRNLY_DEMO_CAPTURE__ === true;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npx vitest run src/demo/capture.test.ts`
Expected: 2 passed. (The vitest environment is jsdom if `window` exists in other tests under `src/demo`; if the run says `window is not defined`, add `// @vitest-environment jsdom` as the first line of the test file.)

- [ ] **Step 5: Commit**

```bash
git add src/demo/capture.ts src/demo/capture.test.ts
git commit -m "demo: capture flag helper for the hero recording"
```

---

### Task 2: `data-demo-chrome` on every piece of demo scaffolding

Nothing here changes behaviour; the attribute is only a hook for the recording script's `[data-demo-chrome]{display:none!important}` stylesheet.

**Files:**
- Modify: `src/components/demo/DemoTrustBanner.tsx` (root `<div>` at the `return (`)
- Modify: `src/components/demo/DemoWelcome.tsx` (root `<div className="mb-6">`)
- Modify: `src/components/demo/DemoHighlightsCard.tsx` (root `<div className="flex justify-start mb-4">`)
- Modify: `src/components/demo/DemoFooter.tsx` (root `<section`)
- Modify: `src/components/demo/DemoAnnotation.tsx` (the `<aside data-demo-annotation="">`)
- Modify: `src/components/demo/DemoPageNav.tsx` (the `<span className="hidden sm:flex …">{label}</span>` and the back `<Link to={backTo}`)
- Modify: `src/components/CookieConsentBanner.tsx` (root `<div className="fixed bottom-0 …">`)
- Modify: `src/components/LanguageSuggestionBanner.tsx` (root `<div` at line ~104)
- Modify: `src/pages/Demo.tsx`
- Modify: `src/pages/DemoDashboard.tsx`
- Modify: `src/pages/DemoSurvey.tsx`

- [ ] **Step 1: Add the attribute to the six demo components and two banners**

In each file, add `data-demo-chrome=""` as the first attribute of the element named above. Example for `DemoAnnotation.tsx`:

```tsx
    <aside
      ref={ref}
      data-demo-annotation=""
      data-demo-chrome=""
```

For `DemoPageNav.tsx`, both the label span and the back link:

```tsx
              <span data-demo-chrome="" className="hidden sm:flex items-center gap-3 text-sm font-medium text-atlas-navy truncate">
```
```tsx
              <Link
                to={backTo}
                data-demo-chrome=""
```

- [ ] **Step 2: `Demo.tsx` — five spots**

1. The nav label span (`{t('nav.label')}` around line 225): add `data-demo-chrome=""` to that `<span className="hidden sm:flex …">`.
2. Wrap the moments bar:
```tsx
        <div data-demo-chrome="">
          <DemoMomentsBar
            items={annotations}
            reachedIds={reachedIds}
            onSelect={flash}
            title={t('legend.title')}
            honestLabel={t('nav.honest')}
          />
        </div>
```
3. The progress bar `<div className="h-[3px] bg-gray-100">` → `<div data-demo-chrome="" className="h-[3px] bg-gray-100">`.
4. The cream intro `<section className="rounded-[20px] border px-5 py-5 sm:px-7 sm:py-7 mb-8"` → add `data-demo-chrome=""`.
5. The footer wrapper `<div className="relative z-[45]">` → `<div data-demo-chrome="" className="relative z-[45]">`.

- [ ] **Step 3: `DemoDashboard.tsx` — two spots**

1. The intro block under the dashboard, `<div className="relative" style={{ background: '#0F2530' }}>` → add `data-demo-chrome=""`.
2. The footer wrapper `<div className="relative z-10">` (just before `<LandingFooter />`) → add `data-demo-chrome=""`.

- [ ] **Step 4: `DemoSurvey.tsx` — two spots**

1. `<header className="mb-9 sm:mb-11 max-w-[62ch]">` → add `data-demo-chrome=""`. (The "rest of the survey" closing `<section>` STAYS visible: it is the payoff of scene 1.)
2. The footer wrapper `<div className="relative z-10">` before `<LandingFooter />` → add `data-demo-chrome=""`.

- [ ] **Step 5: Verify nothing moved**

Run: `npm run build`
Expected: build succeeds. Then with the dev server (`npm run dev`, port 8081) open `/demo`, `/demo/dashboard`, `/demo/survey` and check they look exactly as before. In the browser console: `document.querySelectorAll('[data-demo-chrome]').length` should be ≥ 6 on `/demo`.

- [ ] **Step 6: Commit**

```bash
git add src/components/demo src/components/CookieConsentBanner.tsx src/components/LanguageSuggestionBanner.tsx src/pages/Demo.tsx src/pages/DemoDashboard.tsx src/pages/DemoSurvey.tsx
git commit -m "demo: mark demo scaffolding with data-demo-chrome for the hero recording"
```

---

### Task 3: Capture-only behaviour on the chat and dashboard demo pages

**Files:**
- Modify: `src/pages/Demo.tsx` (the `md:mx-80` line, ~261)
- Modify: `src/pages/DemoDashboard.tsx` (`handleNavigate`, the `DemoToolDialog` render)

- [ ] **Step 1: `Demo.tsx` — drop the empty right column under capture**

Add the import:
```ts
import { isDemoCapture } from '@/demo/capture';
```
Replace
```tsx
          className={`flex-1 flex flex-col min-w-0 transition-all ${
            sidebarCollapsed ? 'md:mx-20' : 'md:mx-80'
          }`}
```
with
```tsx
          // The 320px right margin exists for the margin notes. The recording
          // hides them, so under capture the transcript keeps only the
          // sidebar's margin on the left and a narrow one on the right.
          className={`flex-1 flex flex-col min-w-0 transition-all ${
            sidebarCollapsed ? 'md:mx-20' : isDemoCapture() ? 'md:ml-80 md:mr-20' : 'md:mx-80'
          }`}
```

- [ ] **Step 2: `DemoDashboard.tsx` — no redirect, no dialog under capture**

Add the import:
```ts
import { isDemoCapture } from '@/demo/capture';
```
`handleNavigate` becomes:
```ts
  const handleNavigate = (route: string) => {
    // The recording ends on the "Find this role" press; the jobs page must
    // never render in frame, and no dialog may open over the dashboard.
    if (isDemoCapture()) return;
    if (route.startsWith('/jobs')) {
      trackCtaClick('demo_dashboard_to_jobs');
      navigate(jobsHref);
    } else if (route.startsWith('/custom-resume')) setTool('resume');
    else setTool('generic');
  };
```
The dialog render becomes:
```tsx
          <DemoToolDialog tool={isDemoCapture() ? null : tool} onClose={() => setTool(null)} audience={audience} firstName={choice.firstName} />
```

- [ ] **Step 3: Check both states in the browser**

With the dev server: `/demo/dashboard?persona=emma` → press "Find this role" on the top card → lands on `/demo/jobs` (unchanged). Then in the console `window.__CAIRNLY_DEMO_CAPTURE__ = true`, reload is NOT needed for the handler (it reads at click time) → press "Find this role" again → nothing happens. On `/demo?persona=emma` at a window ≥ 1360 px wide: set the flag, reload → the transcript column is wider on the right (no 320 px gap).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Demo.tsx src/pages/DemoDashboard.tsx
git commit -m "demo: capture-only margin, no jobs redirect and no dialogs while recording"
```

---

### Task 4: Scripted reveal in `DemoReplay`

Visitors keep the fully revealed transcript. Under capture the replay renders only the first `revealCount` messages, exposes `window.__cairnlyDemoReveal(n)`, renders the real `QuickReplies` row under the last visible coach message, and makes that message's option chips reveal the next two turns.

**Files:**
- Modify: `src/components/demo/DemoReplay.tsx`

- [ ] **Step 1: Imports and state**

Change the first import line to:
```ts
import React, { useCallback, useEffect, useMemo, useState } from 'react';
```
Add:
```ts
import { QuickReplies } from '@/components/chat/QuickReplies';
import { isDemoCapture } from '@/demo/capture';
```
Inside the component, right after `const [inserted, setInserted] = …`:
```ts
  // Capture-only (scripts/demo-record-hero.mjs): the transcript is cut at
  // `revealCount` messages and grows when the script, a quick-reply pill or
  // an option chip asks for the next turns. `null` = everything, which is
  // what every visitor gets.
  const capture = isDemoCapture();
  const [revealCount, setRevealCount] = useState<number | null>(null);
  useEffect(() => {
    if (!capture) return;
    window.__cairnlyDemoReveal = (count: number) => setRevealCount(Math.max(0, count));
    return () => {
      delete window.__cairnlyDemoReveal;
    };
  }, [capture]);
  const revealMore = useCallback((n: number) => setRevealCount((c) => (c ?? messages.length) + n), [messages.length]);
  const visibleMessages = useMemo(
    () => (revealCount === null ? messages : messages.slice(0, revealCount)),
    [messages, revealCount],
  );
```

- [ ] **Step 2: Render from `visibleMessages`**

In `rendered`, replace `for (const m of messages)` with `for (const m of visibleMessages)`, and add `visibleMessages` to its dependency array in place of `messages`. Leave `userTurns`, `firstBotId` and the handlers on the full `messages` (jump targets must exist even when not yet revealed; a jump to a hidden turn simply does nothing).

- [ ] **Step 3: The cut message gets live controls**

Inside the `rendered.map((msg, idx, arr) => {` body, after `const sectionIndex = …`, add:
```ts
        // Under capture the last visible coach message behaves like the live
        // chat's latest message: interactive option chips and the real
        // quick-reply row underneath.
        const isCut = capture && revealCount !== null && idx === arr.length - 1 && isBot;
```
Change the `ChatMessage` props:
```tsx
              isLatestBotMessage={isCut}
              onChipSend={isBot ? (isCut ? () => revealMore(2) : handleChipSend) : undefined}
```
(everything else on `ChatMessage` stays as is). Immediately after the closing `/>` of `<ChatMessage`, before the bottom annotations, add:
```tsx
            {isCut && (
              <QuickReplies onSend={() => revealMore(2)} onFocusInput={() => revealMore(2)} visible />
            )}
```

- [ ] **Step 4: Verify in the browser (the only test surface for this)**

Dev server, `/demo?persona=emma`. Console:
```js
window.__CAIRNLY_DEMO_CAPTURE__ = true; location.reload();
```
After reload, in the console: `window.__cairnlyDemoReveal(6)` → the transcript ends at the Strengths delivery (message index 5 is the coach's Strengths message; indexes 0–5 = 6 messages) with the four quick-reply pills under it. Click "I'd like to explore this section a bit more" → Emma's bubble and the coach's 3-option card appear. Click option 1 → her pick and the answer appear. Reload WITHOUT the flag → full transcript, no pills, chips are not clickable (as before).

Repeat once for `/demo?persona=marcel&lang=nl` with `__cairnlyDemoReveal(6)`: the Dutch pill is "Hier wil ik wat dieper op ingaan".

Run: `npx vitest run` → all green (the replay has no unit tests; the fixture tests must still pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/demo/DemoReplay.tsx
git commit -m "demo: capture-only scripted reveal with real quick replies in the replay"
```

---

### Task 5: End-card copy

**Files:**
- Modify: `public/locales/en/landing.json`
- Modify: `public/locales/nl/landing.json`

- [ ] **Step 1: Add the keys under `heroDemo`**

Run this from the repo root (keeps the files' formatting; the `i18n:sync` script is not needed for a same-shape addition):
```bash
node -e '
const fs=require("fs");
const add={
  en:{title:"That was three minutes of a two-hour session.",body:"Your own report starts with the survey. Cancel any time before you submit it.",cta:"Start your session now",replay:"Replay",fullDemo:"Watch the full demo"},
  nl:{title:"Dat waren drie minuten uit een sessie van twee uur.",body:"Je eigen rapport begint bij de vragenlijst. Stoppen kan tot je hem verstuurt.",cta:"Start nu je sessie",replay:"Opnieuw",fullDemo:"Bekijk de hele demo"}
};
for (const l of ["en","nl"]) {
  const p=`public/locales/${l}/landing.json`;
  const d=JSON.parse(fs.readFileSync(p,"utf8"));
  d.heroDemo.endCard=add[l];
  fs.writeFileSync(p, JSON.stringify(d,null,2)+"\n");
}'
```

- [ ] **Step 2: Check the diff is only the addition**

Run: `git diff --stat public/locales` → two files, a handful of added lines each. If the diff shows whole-file reformatting (the files were not 2-space JSON), revert with `git checkout public/locales` and add the five keys by hand inside the `"heroDemo": {` object instead.

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/landing.json public/locales/nl/landing.json
git commit -m "landing: hero video end-card copy (EN/NL)"
```

---

### Task 6: Video source helpers + the generated version file

**Files:**
- Create: `src/lib/demoHero.generated.ts`
- Create: `src/components/landing/demo/heroVideo.ts`
- Create: `src/components/landing/demo/heroVideo.test.ts`

- [ ] **Step 1: Seed the generated file (the script overwrites it)**

```ts
// src/lib/demoHero.generated.ts
// Written by scripts/demo-record-hero.mjs; do not edit by hand. Appended as
// ?v= to the hero video URLs so Safari fetches the new recording instead of
// the cached one. "0" = no recording committed yet.
export const DEMO_HERO_VERSION = "0";
```

- [ ] **Step 2: Write the failing test**

```ts
// src/components/landing/demo/heroVideo.test.ts
import { describe, expect, it } from 'vitest';
import { heroVideoClip, heroVideoSources } from './heroVideo';

describe('hero video sources', () => {
  it('Dutch gets Marcel, everything else gets Emma', () => {
    expect(heroVideoClip('nl')).toEqual({ persona: 'marcel', lang: 'nl' });
    expect(heroVideoClip('nl-NL')).toEqual({ persona: 'marcel', lang: 'nl' });
    expect(heroVideoClip('en')).toEqual({ persona: 'emma', lang: 'en' });
    expect(heroVideoClip('de')).toEqual({ persona: 'emma', lang: 'en' });
    expect(heroVideoClip(undefined)).toEqual({ persona: 'emma', lang: 'en' });
  });

  it('builds versioned urls for webm, mp4 and the poster', () => {
    expect(heroVideoSources('nl', '202609141200')).toEqual({
      webm: '/videos/demo-hero-marcel-nl.webm?v=202609141200',
      mp4: '/videos/demo-hero-marcel-nl.mp4?v=202609141200',
      poster: '/images/live/landing/demo/hero-poster-marcel-nl.jpg?v=202609141200',
    });
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run src/components/landing/demo/heroVideo.test.ts`
Expected: FAIL, cannot find module `./heroVideo`.

- [ ] **Step 4: Implement**

```ts
// src/components/landing/demo/heroVideo.ts
import { personaForLanguage, type DemoPersonaId } from '@/demo/loadFixture';

export type HeroClipLang = 'en' | 'nl';
export interface HeroClip {
  persona: DemoPersonaId;
  lang: HeroClipLang;
}

/**
 * Which recording the hero plays: the persona whose session was held in the
 * visitor's language (nl → Marcel, else Emma), same rule as the demo pages.
 */
export function heroVideoClip(language: string | undefined): HeroClip {
  const persona = personaForLanguage(language);
  return { persona, lang: persona === 'marcel' ? 'nl' : 'en' };
}

export interface HeroVideoSources {
  webm: string;
  mp4: string;
  poster: string;
}

/** File names written by scripts/demo-record-hero.mjs, versioned for Safari. */
export function heroVideoSources(language: string | undefined, version: string): HeroVideoSources {
  const { persona, lang } = heroVideoClip(language);
  const v = `?v=${version}`;
  return {
    webm: `/videos/demo-hero-${persona}-${lang}.webm${v}`,
    mp4: `/videos/demo-hero-${persona}-${lang}.mp4${v}`,
    poster: `/images/live/landing/demo/hero-poster-${persona}-${lang}.jpg${v}`,
  };
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `npx vitest run src/components/landing/demo/heroVideo.test.ts`
Expected: 2 passed. (`personaForLanguage` in `src/demo/loadFixture.ts` returns `'marcel'` for any language starting with `nl`; if the `nl-NL` case fails, that function needs `lang.toLowerCase().startsWith('nl')`, which is a one-line fix there.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/demoHero.generated.ts src/components/landing/demo/heroVideo.ts src/components/landing/demo/heroVideo.test.ts
git commit -m "landing: hero video source helpers and version constant"
```

---

### Task 7: `DemoVideoStage` and the hero swap

**Files:**
- Create: `src/components/landing/demo/DemoVideoStage.tsx`
- Modify: `src/components/landing/Hero.tsx`

- [ ] **Step 1: The stage component**

```tsx
// src/components/landing/demo/DemoVideoStage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Lock, Play, RotateCcw } from 'lucide-react';
import { DEMO_ROUTE } from '@/demo/constants';
import { DEMO_HERO_VERSION } from '@/lib/demoHero.generated';
import { trackCtaClick } from '@/lib/analytics';
import { heroVideoClip, heroVideoSources } from './heroVideo';
import { useDemoHref } from './HeroPersonaContext';

/** Aspect of the recording (scripts/demo-record-hero.mjs records 1440×900). */
const VIDEO_W = 1440;
const VIDEO_H = 900;

type Phase = 'idle' | 'playing' | 'ended' | 'unavailable';

/**
 * The hero's demo window: one faux-browser frame playing the recording of
 * the persona whose session was held in the visitor's language. Plays once,
 * muted; when it ends the end card fades in over the black last frame with
 * the real "Start your session" button. Reduced motion, an off-screen
 * window and a missing file all fall back to the poster with the card.
 */
const DemoVideoStage: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const demoHref = useDemoHref();
  const clip = heroVideoClip(i18n.language);
  const src = heroVideoSources(i18n.language, DEMO_HERO_VERSION);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reduced, setReduced] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Autoplay when the window scrolls into view, pause when it leaves.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced || phase === 'unavailable') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (phase !== 'ended') el.play().catch(() => setPhase('unavailable'));
        } else if (!el.paused) el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, phase]);

  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    trackCtaClick('hero_video_replay');
    el.currentTime = 0;
    setPhase('playing');
    el.play().catch(() => setPhase('unavailable'));
  };

  const showCard = phase === 'ended' || phase === 'unavailable' || reduced;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="min-w-0 truncate text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-white/55">
          {t('heroDemo.stageLabel', { name: t(`heroDemo.cards.${clip.persona}.name`) })}
        </span>
        <Link
          to={demoHref(DEMO_ROUTE)}
          onClick={() => trackCtaClick('hero_video_open_demo')}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/70 hover:text-white"
        >
          {t('heroDemo.endCard.fullDemo')}
          <ArrowUpRight size={12} strokeWidth={2.6} />
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#15262F] flex flex-col">
        {/* Chrome bar, same as the deck's windows */}
        <div className="flex items-center gap-3 px-3.5 h-9 shrink-0 bg-[#1B2E38] border-b border-black/30">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
            <Lock size={11} className="shrink-0 text-white/40" />
            <span className="truncate">
              app.cairnly.io/<span className="text-white/85">demo</span>
            </span>
          </div>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}>
          <video
            ref={videoRef}
            className="block w-full h-full object-cover"
            width={VIDEO_W}
            height={VIDEO_H}
            muted
            playsInline
            preload="metadata"
            poster={src.poster}
            onPlay={() => {
              setPhase('playing');
              if (!playedRef.current) {
                playedRef.current = true;
                trackCtaClick('hero_video_play');
              }
            }}
            onEnded={() => {
              setPhase('ended');
              trackCtaClick('hero_video_ended');
            }}
            onError={() => setPhase('unavailable')}
            aria-label={t('hero.screenshotAlt')}
          >
            <source src={src.webm} type="video/webm" />
            <source src={src.mp4} type="video/mp4" />
          </video>

          {/* Clicking the playing video opens the demo, like the deck's front window did. */}
          {!showCard && (
            <Link
              to={demoHref(DEMO_ROUTE)}
              onClick={() => trackCtaClick('hero_video_open_demo')}
              aria-label={t('heroDemo.clickHint')}
              className="group absolute inset-0"
            >
              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#D4A024] text-[#122E3B] px-2.5 py-1 text-[11px] font-bold opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t('heroDemo.clickHint')}
                <ArrowUpRight size={12} strokeWidth={2.6} />
              </span>
            </Link>
          )}

          {/* End card */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 transition-opacity duration-700 ${
              showCard ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ background: 'rgba(15,37,48,0.88)' }}
            aria-hidden={!showCard}
          >
            <p className="font-heading font-bold text-white text-[clamp(18px,2.2vw,28px)] leading-tight max-w-[26ch]">
              {t('heroDemo.endCard.title')}
            </p>
            <p className="mt-2 text-white/70 text-[14px] md:text-[15px] font-medium max-w-[42ch]">
              {t('heroDemo.endCard.body')}
            </p>
            <Link
              to="/payment"
              onClick={() => trackCtaClick('hero_video_cta')}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#D4A024] text-[#122E3B] px-6 py-3 text-[15px] font-bold hover:bg-[#E0B03A] transition-colors"
            >
              {t('heroDemo.endCard.cta')}
              <ArrowRight size={16} strokeWidth={2.6} />
            </Link>
            <div className="mt-4 flex items-center gap-5 text-[13px] font-semibold text-white/70">
              {phase !== 'unavailable' && (
                <button type="button" onClick={replay} className="inline-flex items-center gap-1.5 hover:text-white">
                  {reduced && phase !== 'ended' ? <Play size={14} /> : <RotateCcw size={14} />}
                  {t('heroDemo.endCard.replay')}
                </button>
              )}
              <Link
                to={demoHref(DEMO_ROUTE)}
                onClick={() => trackCtaClick('hero_video_open_demo')}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                {t('heroDemo.endCard.fullDemo')}
                <ArrowUpRight size={14} strokeWidth={2.6} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoVideoStage;
```

Note on `/payment`: that is the route the demo nav's own CTA uses for customers (`onNavCta` in `Demo.tsx`). If `hero.ctaPrimary` in `Hero.tsx`'s git history pointed somewhere else, keep `/payment`; it is the current start of a session.

- [ ] **Step 2: Swap it into `Hero.tsx`**

Replace the imports
```ts
import DemoPersonaCards from './demo/DemoPersonaCards';
import DemoStage from './demo/DemoStage';
```
with
```ts
import DemoVideoStage from './demo/DemoVideoStage';
```
Replace the whole "Content band" grid (from `{/* Content band. …` through the closing `</div>` after the `PriceCountdown` block) with:
```tsx
        {/* Content band: the recording of the demo, full width, then the
            price deadline and reassurance under it. The persona cards left
            the hero on 2026-09-14; both personas stay reachable through the
            demo itself. */}
        <div className="grid gap-y-8">
          <Reveal as="div" className="w-full max-w-[1100px] mx-auto">
            <DemoVideoStage />
          </Reveal>

          <Reveal as="div" className="mt-2 md:mt-4 flex flex-col items-center gap-3">
            <PriceCountdown tone="gold" leadWithPrice href="#pricing" />
            <CompareLink label={t('hero.compareLink')} />
            <p className="text-sm text-white/45 font-medium text-center">
              {t('hero.reassurance')}{' '}
              <a
                href={`#${INTAKE_SECTION_ANCHOR}`}
                onClick={scrollToIntake}
                className="inline-flex items-center gap-1 text-white/85 font-semibold underline decoration-[#D4A024]/60 underline-offset-4 hover:text-white hover:decoration-[#D4A024]"
              >
                {t('hero.neitherCta')}
                <ArrowRight size={13} strokeWidth={2.4} />
              </a>
            </p>
          </Reveal>
        </div>
```
Update the component's doc comment to say the proof is the recording, not the cards + deck. `hero.neitherLine` becomes unused in the hero; leave the key.

- [ ] **Step 3: Verify**

Run: `npm run build` → succeeds. `npx vitest run` → green. Dev server, `/`:
- No video files exist yet, so the window shows the poster area (black) with the end card over it, "Start your session now" links to `/payment`, "Watch the full demo" goes to `/demo?persona=emma`. Switch the language to NL → `/demo?persona=marcel` and Dutch copy.
- `/partners` still shows the stills deck + Marcel's card, untouched.
- Phone width (375): the window stays 16:10, the card's text does not overflow.
- Lighthouse/console: no errors other than the two 404s for the missing video (expected until Task 9 lands).

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/demo/DemoVideoStage.tsx src/components/landing/Hero.tsx
git commit -m "landing: hero plays the demo recording, persona cards and stills deck leave the hero"
```

---

### Task 8: The recording script

**Files:**
- Create: `scripts/demo-record-hero.mjs`
- Modify: `.gitignore` (add `.demo-capture/`)
- Modify: `package.json` (`"demo:record": "node scripts/demo-record-hero.mjs"` in `scripts`)

- [ ] **Step 1: `.gitignore` and `package.json`**

Append to `.gitignore` under the scratchpad block:
```
# Frames of the hero recording (scripts/demo-record-hero.mjs)
.demo-capture/
```
Add to `package.json` `scripts`, after `"sitemap"`:
```json
    "demo:record": "node scripts/demo-record-hero.mjs",
```

- [ ] **Step 2: The script**

```js
// Records the demo for the homepage hero: survey → coach chat → dashboard,
// one clip per (persona, language) the site is published in.
//
//   npm run demo:record                        # marcel-nl + emma-en, full quality
//   node scripts/demo-record-hero.mjs emma-en  # one clip
//   DRAFT=1 node scripts/demo-record-hero.mjs  # 1x, 10 fps, mp4 only: a quick timing check
//   SLOW=1.5 BASE=https://cairnly.io node scripts/demo-record-hero.mjs
//
// Writes public/videos/demo-hero-<persona>-<lang>.{mp4,webm}, the poster and
// one still per scene under public/images/live/landing/demo/, and
// src/lib/demoHero.generated.ts (cache-busting version). Repeatable: after a
// redesign or a demo re-freeze, run it again and picture and product match.
//
// Frames are screenshots with timestamps, stitched by ffmpeg's concat
// demuxer with real durations (Chrome's own recorder does not scale on 2x).
// Demo scaffolding is hidden via [data-demo-chrome]; the pages read
// window.__CAIRNLY_DEMO_CAPTURE__ (src/demo/capture.ts) to skip dialogs, the
// jobs redirect and the margin-note column, and to reveal the transcript on
// command. The cursor, the fades and the "analysing" interstitial are drawn
// by this script; nothing here is product code.
//
// ⚠️ Run from a normal Terminal, never from a Claude session inside the
// desktop app: a Chrome child of that app makes macOS revoke Documents access.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.BASE ?? 'http://localhost:8081').replace(/\/$/, '');
const DRAFT = process.env.DRAFT === '1';
const SLOW = Number(process.env.SLOW ?? '2');
const W = 1440;
const H = 900;
const SCALE = DRAFT ? 1 : 2;
const FPS = DRAFT ? 10 : 30;
const MIN_FRAME_MS = DRAFT ? 90 : 0; // draft: don't burn CPU on 30 fps

const CLIPS = [
  { persona: 'marcel', lang: 'nl' },
  { persona: 'emma', lang: 'en' },
];
// Per-language anchors, copied from public/locales/<lang>/{survey,chat,dashboard}.json
// (reportProcessing.steps, quickReplies.explore.message, careerPills.move,
// v4.hero.why, v4.hero.findRole) and the survey fixture's schedule choices.
// Every string is matched case-insensitively against element text, so a
// copy tweak fails loudly here instead of silently recording the wrong thing.
const COPY = {
  en: {
    scheduleChoice: 'Flexible hours',
    nonNegotiable: 'This is non-negotiable for me',
    processing: ['Reading your responses', 'Building your personality profile', 'Preparing your AI career coach'],
    strengthsNav: 'Your Strengths',
    explore: "I'd like to explore this section a bit more",
    runnerUpHeading: 'runner-up',
    moveSuffix: 'explore why',
    whyFits: 'Why this fits',
    findRole: 'Find this role',
  },
  nl: {
    scheduleChoice: 'Flexibele werktijden',
    nonNegotiable: 'Dit is voor mij niet onderhandelbaar',
    processing: ['Je antwoorden worden gelezen', 'Je persoonlijkheidsprofiel wordt opgebouwd', 'Je AI-carrièrecoach wordt voorbereid'],
    strengthsNav: 'Sterke punten',
    explore: 'Hier wil ik wat dieper op ingaan',
    runnerUpHeading: 'runner-up',
    moveSuffix: 'ontdek waarom',
    whyFits: 'Waarom dit past',
    findRole: 'Zoek deze rol',
  },
};
// Index of the coach's Strengths delivery + 1 = how many messages are
// visible when the chat scene opens (both fixtures: 0 ready, 1 approach,
// 2 user, 3 coach, 4 continue, 5 strengths).
const STRENGTHS_REVEAL = 6;

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const clips = wanted.length ? CLIPS.filter((c) => wanted.includes(`${c.persona}-${c.lang}`)) : CLIPS;
if (!clips.length) {
  console.error(`no clip matched. known: ${CLIPS.map((c) => `${c.persona}-${c.lang}`).join(', ')}`);
  process.exit(1);
}

const root = process.cwd();
const videosDir = resolve(root, 'public/videos');
const imagesDir = resolve(root, 'public/images/live/landing/demo');
mkdirSync(videosDir, { recursive: true });
mkdirSync(imagesDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = (ms) => sleep(ms * SLOW);

// ---------------------------------------------------------------------------
// Overlays drawn into the page: cursor, fades, processing interstitial.
// All live under one fixed root with pointer-events:none, so they never
// intercept the clicks the script sends to the page.
async function installOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('__rec')) return;
    const root = document.createElement('div');
    root.id = '__rec';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Inter,system-ui,sans-serif';
    root.innerHTML =
      '<div id="__fade" style="position:absolute;inset:0;background:#000;opacity:0;transition:opacity 250ms ease"></div>' +
      '<div id="__cur" style="position:absolute;left:-40px;top:-40px;width:26px;height:26px;transition:transform 60ms ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">' +
      '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 9-6.5 1.2L16 20l-3 1.2-3.5-6.8L5 19z" fill="#fff" stroke="#122E3B" stroke-width="1.6" stroke-linejoin="round"/></svg></div>';
    document.body.appendChild(root);
    window.__recCursor = { x: -40, y: -40 };
  });
}
const cursorTo = async (page, x, y, ms = 420) => {
  await page.evaluate(
    async ({ x, y, ms }) => {
      const cur = document.getElementById('__cur');
      const from = { ...window.__recCursor };
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / ms);
          const e = 1 - Math.pow(1 - p, 3);
          const cx = from.x + (x - from.x) * e;
          const cy = from.y + (y - from.y) * e;
          cur.style.left = cx + 'px';
          cur.style.top = cy + 'px';
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      window.__recCursor = { x, y };
    },
    { x, y, ms: ms * SLOW },
  );
};
const cursorPress = async (page) => {
  await page.evaluate(() => {
    const cur = document.getElementById('__cur');
    cur.style.transform = 'scale(.82)';
    setTimeout(() => (cur.style.transform = ''), 120);
  });
};
const fade = async (page, to) => {
  await page.evaluate((o) => (document.getElementById('__fade').style.opacity = String(o)), to);
  await sleep(300);
};

// Finds the smallest visible element whose text contains `needle`
// (case-insensitive), optionally only among `tags`. Returns its centre.
async function locate(page, needle, { tags = 'button, a, label, span, p, h1, h2, h3, h4, strong, div', index = 0 } = {}) {
  const box = await page.evaluate(
    ({ needle, tags, index }) => {
      const n = needle.toLowerCase();
      const hits = [...document.querySelectorAll(tags)]
        .filter((el) => (el.textContent || '').toLowerCase().includes(n))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      const el = hits[index];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom };
    },
    { needle, tags, index },
  );
  if (!box) throw new Error(`not found on page: "${needle}"`);
  return box;
}
// Scroll so the element sits `pad` px under the top, smoothly.
async function scrollToText(page, needle, pad = 120, opts = {}) {
  const box = await locate(page, needle, opts);
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), box.top - pad);
  await pause(700);
}
// Move the cursor to the text, press, and click it. Re-clicks while the
// expected state stays away (the screenshot loop slows the page; a click
// can land mid-animation and be lost).
async function clickText(page, needle, { reached = null, tries = 3, ...opts } = {}) {
  for (let i = 0; i < tries; i++) {
    const box = await locate(page, needle, opts);
    await cursorTo(page, box.x, box.y);
    await cursorPress(page);
    await page.mouse.click(box.x, box.y);
    if (!reached) return;
    for (let t = 0; t < 12; t++) {
      await sleep(250);
      if (await reached()) return;
    }
  }
  throw new Error(`state not reached after clicking "${needle}"`);
}
const textPresent = (page, needle) => async () =>
  page.evaluate((n) => document.body.innerText.toLowerCase().includes(n.toLowerCase()), needle);

// The real /report-processing page needs a live report; this is its look
// for a second and a half: dark canvas, cairn mark, steps ticking through.
async function processingInterstitial(page, steps) {
  await page.evaluate((steps) => {
    const el = document.createElement('div');
    el.id = '__proc';
    el.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'background:radial-gradient(circle at 30% 20%, rgba(39,161,161,.18), transparent 55%),#0F2530;color:#fff;opacity:0;transition:opacity 250ms ease';
    el.innerHTML =
      '<img src="/logos/cairnly-logo.png" alt="" style="height:56px;filter:brightness(0) invert(1);opacity:.9">' +
      '<div id="__procstep" style="font-size:20px;font-weight:600;letter-spacing:-.01em;min-height:28px"></div>' +
      '<div style="width:260px;height:4px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden"><div id="__procbar" style="height:100%;width:0;background:#D4A024;transition:width 500ms ease"></div></div>';
    document.getElementById('__rec').appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = '1'));
    window.__procSteps = steps;
  }, steps);
  for (let i = 0; i < steps.length; i++) {
    await page.evaluate(
      ({ i, n }) => {
        document.getElementById('__procstep').textContent = window.__procSteps[i];
        document.getElementById('__procbar').style.width = `${Math.round(((i + 1) / n) * 100)}%`;
      },
      { i, n: steps.length },
    );
    await pause(500);
  }
  await pause(300);
}

// ---------------------------------------------------------------------------
async function record({ persona, lang }) {
  const copy = COPY[lang];
  const name = `${persona}-${lang}`;
  const tmp = resolve(root, '.demo-capture', name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  console.log(`\n▶ ${name}${DRAFT ? ' (draft)' : ''}`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  await page.evaluateOnNewDocument((lang) => {
    window.__CAIRNLY_DEMO_CAPTURE__ = true;
    localStorage.setItem('cairnly_language', lang);
    localStorage.setItem('cairnly-cookie-consent', JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }));
    localStorage.setItem('cairnly_language_suggestion_dismissed', new Date().toISOString());
    const style = document.createElement('style');
    style.textContent = '[data-demo-chrome]{display:none!important} html{scroll-behavior:smooth}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }, lang);

  // --- frame loop ------------------------------------------------------------
  const frames = [];
  let recording = false;
  let n = 0;
  const loop = (async () => {
    while (true) {
      if (!recording) {
        await sleep(20);
        if (recording === null) break;
        continue;
      }
      const p = resolve(tmp, `f${String(n++).padStart(5, '0')}.jpg`);
      const t = performance.now();
      try {
        await page.screenshot({ path: p, type: 'jpeg', quality: 88 });
        frames.push({ p, t });
      } catch {
        break;
      }
      if (MIN_FRAME_MS) await sleep(MIN_FRAME_MS);
    }
  })();
  const stills = [];
  const still = async (label) => {
    const p = resolve(tmp, `still-${label}.jpg`);
    await page.screenshot({ path: p, type: 'jpeg', quality: 90 });
    stills.push({ p, label });
  };
  const goto = async (path) => {
    await page.goto(`${BASE}${path}?persona=${persona}&lang=${lang}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await installOverlay(page);
  };
  const q = `?persona=${persona}&lang=${lang}`;

  // 1. Survey ------------------------------------------------------------------
  await goto('/demo/survey');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  recording = true;
  await pause(900);
  await scrollToText(page, copy.scheduleChoice, 200, { tags: 'label, button, div, span' });
  await clickText(page, copy.scheduleChoice, { tags: 'label, button, div, span' });
  await pause(700);
  await clickText(page, copy.nonNegotiable, { tags: 'label' });
  await pause(900);
  await still('01-survey');
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await pause(1200);

  // 1b. Processing interstitial, then straight into the chat under it ---------
  await processingInterstitial(page, copy.processing);
  await fade(page, 1);
  recording = false; // the page swap must not be in the film
  await goto(`/demo`);
  await page.evaluate((n) => window.__cairnlyDemoReveal?.(n), STRENGTHS_REVEAL);
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
  recording = true;
  await fade(page, 0);

  // 2. Chat: strengths + explore pill ----------------------------------------
  await clickText(page, copy.strengthsNav, { tags: 'button' });
  await pause(1600);
  await scrollToText(page, copy.explore, 620, { tags: 'button' });
  await pause(400);
  await clickText(page, copy.explore, { tags: 'button', reached: textPresent(page, copy.explore) });
  await pause(1400);
  await page.evaluate(() => window.scrollBy({ top: 360, behavior: 'smooth' }));
  await pause(900);
  await still('02-explore');
  // Option 1 of the coach's follow-up card: the numbered "1" row.
  const opt1 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('button')].filter((b) => /^\s*1\s/.test(b.innerText) && b.innerText.length > 20);
    const b = rows[rows.length - 1];
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!opt1) throw new Error('follow-up option 1 not found');
  await cursorTo(page, opt1.x, opt1.y);
  await cursorPress(page);
  await page.mouse.click(opt1.x, opt1.y);
  await pause(1500);
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await pause(1600);

  // 3. Chat: runner-ups, open the first, Move pill ------------------------------
  await page.evaluate(() => window.__cairnlyDemoReveal?.(10000)); // everything
  await sleep(1500);
  await scrollToText(page, copy.runnerUpHeading, 110, { tags: 'strong, h3, span, p' });
  await pause(1500);
  await still('03-runner-ups');
  // The first collapsed card header: the first element with data-card-collapsed.
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-card-collapsed]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(r.width / 2, 260), y: r.top + Math.min(r.height / 2, 28) };
  });
  if (!card) throw new Error('no collapsed runner-up card');
  await cursorTo(page, card.x, card.y);
  await cursorPress(page);
  await page.mouse.click(card.x, card.y);
  await pause(1400);
  await scrollToText(page, copy.moveSuffix, 560, { tags: 'button' });
  await pause(600);
  await clickText(page, copy.moveSuffix, { tags: 'button' });
  await pause(2200); // the replay scrolls to the feasibility question and rings it
  await still('04-move');
  await pause(1200);

  // 4. wrap: fade -----------------------------------------------------------------
  await fade(page, 1);
  recording = false;

  // 5. Dashboard ---------------------------------------------------------------------
  await goto('/demo/dashboard');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
  await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
  recording = true;
  await fade(page, 0);
  await pause(800);
  // Hover the compare radar on the top card: the card flips to its back.
  const radar = await locate(page, copy.whyFits, { tags: 'button' });
  const flipTarget = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg[aria-label], svg')].find((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 180 && r.height > 180 && r.top > 0 && r.top < window.innerHeight;
    });
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!flipTarget) throw new Error('compare radar not found on the top card');
  await cursorTo(page, flipTarget.x, flipTarget.y, 600);
  await page.mouse.move(flipTarget.x, flipTarget.y);
  await pause(2600); // flip + read
  await still('05-flip');
  // Leave the card so it flips back, then "Why this fits".
  await cursorTo(page, 40, radar.y, 500);
  await page.mouse.move(40, radar.y);
  await pause(1100);
  await clickText(page, copy.whyFits, { tags: 'button' });
  await pause(2200);
  await still('06-why');
  await pause(600);

  // 6. Find this role → fade out --------------------------------------------------
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(900);
  await clickText(page, copy.findRole, { tags: 'button' });
  await pause(500);
  await fade(page, 1);
  await pause(400);
  recording = null;
  await loop;
  await browser.close();

  // --- ffmpeg ---------------------------------------------------------------------
  if (frames.length < 10) throw new Error('too few frames');
  const t0 = frames[0].t;
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const start = (frames[i].t - t0) / 1000;
    const next = i + 1 < frames.length ? (frames[i + 1].t - t0) / 1000 : start + 0.4;
    lines.push(`file '${frames[i].p}'`, `duration ${Math.max(next - start, 0.01).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].p}'`);
  const list = resolve(tmp, 'frames.txt');
  writeFileSync(list, lines.join('\n') + '\n');

  const mp4 = resolve(videosDir, `demo-hero-${name}.mp4`);
  const webm = resolve(videosDir, `demo-hero-${name}.webm`);
  const common = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-fps_mode', 'cfr', '-r', String(FPS), '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`];
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', DRAFT ? '30' : '23', '-preset', DRAFT ? 'veryfast' : 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (!DRAFT) execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', webm], { stdio: 'inherit' });
  // Poster = the first frame (the survey), so the page never flashes black.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', frames[0].p, '-vf', `scale=${W}:${H}`, '-q:v', '4', resolve(imagesDir, `hero-poster-${name}.jpg`)], { stdio: 'inherit' });
  for (const { p, label } of stills) copyFileSync(p, resolve(imagesDir, `hero-still-${label}-${name}.jpg`));
  rmSync(tmp, { recursive: true, force: true });

  const duration = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  const avg = (frames.length / ((frames[frames.length - 1].t - t0) / 1000)).toFixed(1);
  console.log(`  ${mp4}: ${Number(duration).toFixed(1)} s, ${frames.length} frames (~${avg} fps captured)${DRAFT ? '' : `, ${webm}`}`);
}

for (const clip of clips) await record(clip);

if (!DRAFT) {
  const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  writeFileSync(
    resolve(root, 'src/lib/demoHero.generated.ts'),
    `// Written by scripts/demo-record-hero.mjs; do not edit by hand. Appended as\n// ?v= to the hero video URLs so Safari fetches the new recording instead of\n// the cached one. "0" = no recording committed yet.\nexport const DEMO_HERO_VERSION = "${version}";\n`,
  );
  console.log(`\nversion ${version} written to src/lib/demoHero.generated.ts`);
}
```

- [ ] **Step 3: Lint-level check only (do NOT run the script from the desktop app)**

Run: `node --check scripts/demo-record-hero.mjs`
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add scripts/demo-record-hero.mjs .gitignore package.json
git commit -m "scripts: demo-record-hero records the hero video from the frozen demo"
```

---

### Task 9: Record, review, ship (Sjoerd, in a normal Terminal)

**Files produced:** `public/videos/demo-hero-{marcel-nl,emma-en}.{mp4,webm}`, `public/images/live/landing/demo/hero-poster-*.jpg`, `hero-still-*.jpg`, `src/lib/demoHero.generated.ts`.

- [ ] **Step 1: Dev server up**

In Terminal tab 1:
```bash
npm run dev
```
Expected: Vite on http://localhost:8081 (if it picks another port, pass `BASE=http://localhost:<port>` below).

- [ ] **Step 2: Draft run**

In Terminal tab 2:
```bash
DRAFT=1 npm run demo:record
```
Expected: two `▶` blocks, each ending with a line like `demo-hero-emma-en.mp4: 34.2 s, 340 frames`. If it throws `not found on page: "…"` the copy in `COPY` does not match the page: open that page in the browser at the same language and copy the exact text into the script.

Open both mp4s (QuickTime). Check: every click lands, pacing readable, nothing from the demo chrome in frame, the transcript column has no empty right margin, the option card and the Move jump both show. Adjust `SLOW` or individual `pause` values if needed and re-run the draft.

- [ ] **Step 3: Full run**

```bash
npm run demo:record
```
Takes several minutes (the vp9 encode is slow). Expected: four video files + two posters + stills, and a `version … written` line.

- [ ] **Step 4: Verify on the site**

Dev server still running; open `/` (EN) and `/?lang=nl`: the window autoplays the right clip, the end card appears when it ends, "Replay" works, "Start your session now" goes to `/payment`. Safari and Chrome. Phone width once. `/partners` unchanged.

- [ ] **Step 5: Commit and push (goes live)**

```bash
git add public/videos public/images/live/landing/demo src/lib/demoHero.generated.ts
git commit -m "landing: hero demo recordings (Marcel NL, Emma EN)"
git push
```

File-size sanity before pushing: `du -sh public/videos` should be well under 20 MB in total; if an mp4 is over 6 MB raise `-crf` to 26 in the script and re-run.
