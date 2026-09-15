# Hero demo video — design

Date: 2026-09-14. Status: draft for Sjoerd's review.

## Goal

Replace the hero's stacked deck of demo stills with one faux-browser window
that plays a scripted recording of the frozen demo: the visitor watches a
user's hand move through survey → coach chat → dashboard and is left on a
"Start your session now" button. Two recordings: **Marcel in Dutch** for the
Dutch site, **Emma in English** for everything else (the same rule
`chooseFixture` already applies to the demo pages). Repeatable: after a
redesign or a demo re-freeze, run the script again and product and video match.

Modelled on OutsideInput's `scripts/record-demo.mjs` (screenshot loop +
ffmpeg concat demuxer with real frame durations). What changes: desktop
viewport instead of a phone, no fake camera or microphone, a drawn cursor,
Cairnly's scene list, and two persona/language runs.

Out of scope (Sjoerd, 2026-09-14): the jobs page, résumé editing and cover
letters. They get their own website section in another session and do not
appear in this video. Also out of scope: any change to the demo pages'
visitor-facing behaviour.

## The video

**Format.** 1440×900 viewport at deviceScaleFactor 2, exported at 1440×900
(16:10), 30 fps CFR, h264 mp4 (Safari) + vp9 webm, muted, autoplay, loop
handled by the hero (see below). Target length 30–40 s per persona. Files:

```
public/videos/demo-hero-marcel-nl.mp4 / .webm
public/videos/demo-hero-emma-en.mp4   / .webm
public/images/live/landing/demo/hero-poster-<persona>-<lang>.jpg   (first frame)
public/images/live/landing/demo/hero-still-<nn>-<persona>-<lang>.jpg (one per scene, for reuse)
src/lib/demoHero.generated.ts   → export const DEMO_HERO_VERSION = "YYYYMMDDHHMM"
```

The version constant is appended as `?v=` to every video URL; Safari caches
media aggressively and otherwise keeps showing the previous recording.

**Pace.** Every pause is multiplied by `SLOW` (default 2). Animations run at
their normal speed; only the holds are longer, so a visitor can read.

**Cursor.** Headless Chromium paints no pointer. The script injects a small
SVG arrow (fixed, `z-index` above everything, `pointer-events:none`) and
moves it with an eased tween before every click, then dips it 1 px on click.
Everything the visitor should notice is a visible click.

**Scenes** (times before `SLOW`, rounded):

| # | Page | Beat | ~s |
|---|------|------|----|
| 1 | `/demo/survey?persona=…` | Résumé step already filled (fixture). Cursor picks a schedule answer, ticks the **non-negotiable** box. Scroll; the "the rest of the survey" card slides in. | 5 |
| 1b | overlay | **Processing interstitial**, script-drawn on the dark survey canvas: the cairn mark, the real processing-page steps ("Reading your responses" → "Building your personality profile", `reportProcessing.steps.*` in the run's language) ticking through in ~1.2 s, then a cross-fade into the chat. Stands in for the real `/report-processing` page, which needs a live report. | 1.5 |
| 2 | `/demo?persona=…`, transcript cut after the Strengths delivery | Sidebar click on **Your strengths / Sterke punten**; the section scrolls into view with the coach's question under it. The real **QuickReplies** row sits under it (capture-only, see hooks). Cursor clicks **"I'd like to explore this section a bit more" / "Hier wil ik wat dieper op ingaan"**. The user bubble appears, then the coach's follow-up with the three numbered options + "Something else". Cursor clicks option 1; the persona's own pick and the coach's answer appear. | 8 |
| 3 | same, transcript fully revealed | Smooth scroll to the **three collapsed runner-up cards** (match + AI-impact pills). Pause. Click the first; it opens. Scroll to the end of that career's text, cursor clicks the **"Move: Upskill · explore why" / "Stap: … · ontdek waarom"** pill; the replay scrolls to the persona's own "how realistic is this move" question and rings it, the coach's answer below. | 10 |
| 4 | same | Hold on the coach's answer. Fade to black. | 1 |
| 5 | `/demo/dashboard?persona=…` | Cursor enters the top-career tile → it **flips** to the compare radar (hover flip, desktop only). Pause. Click **See full breakdown**; the top-1 "why it fits" accordion opens and scrolls into view. | 8 |
| 6 | same | Cursor presses **Find open roles**. Fade to black on the press; the recording stops before the jobs page renders. | 1 |

Page changes other than 1→2 are fade-to-black (script-drawn fixed overlay,
250 ms), so no page load is ever in frame. The Move pill's label per persona
is whatever the fixture says (Upskill for Emma; Marcel's first runner-up may
carry a different level); the script matches the pill by its "explore why"
suffix, not the level.

**End card is NOT baked into the video.** The hero overlays a real,
translated button when the `<video>` fires `ended`, so it stays clickable,
in sync with pricing copy, and trackable. The video's last frame is black.

## App-side hooks (the only product code the recording touches)

1. **`data-demo-chrome` attribute** on everything that is demo scaffolding,
   not product: `DemoTrustBanner`, `DemoPageNav`, `DemoWelcome`,
   `DemoHighlightsCard`, `DemoFooter`, the demo pages' `LandingFooter`,
   `DemoAnnotation` (already has `data-demo-annotation`; gets the second
   attribute too), `CookieConsentBanner`, `LanguageSuggestionBanner`. Zero
   runtime effect; the script's init stylesheet hides them.
2. **Capture flag** `window.__CAIRNLY_DEMO_CAPTURE__ = true` (set by the
   script's `addInitScript`, never by the site). Read in three places:
   - `Demo.tsx`: at ≥ 1360 wide the transcript keeps a 320 px right margin
     for the margin notes. Under the flag (notes hidden) that margin shrinks
     to the collapsed-sidebar value so the shot has no dead column.
   - `DemoDashboard.tsx`: `handleNavigate('/jobs…')` normally routes to
     `/demo/jobs`; under the flag it does nothing (the fade already covers
     the press, and we never want the jobs page in frame).
   - `DemoToolDialog` / any `setTool`: under the flag no dialog opens.
   Every read is `typeof window !== 'undefined' && window.__CAIRNLY_DEMO_CAPTURE__`
   behind one helper `isDemoCapture()` in `src/demo/capture.ts`.
3. **Scripted reveal in the replay** (capture-only). `DemoReplay` renders
   the whole transcript for visitors. Under the capture flag it renders only
   the first `revealCount` messages (state, initial = index of the Strengths
   delivery + 1) and exposes `window.__cairnlyDemoReveal(n)` to the script.
   While cut, the real `QuickReplies` component renders under the last bot
   message (its normal props; `onSend` → reveal +2), and the follow-up
   option chips of the last bot message become interactive (`onChipSend`
   → reveal +2) instead of the replay's flash-only behaviour. So the two
   clicks in scene 2 are real component clicks with the persona's real
   turns appearing, not a mock. Visitors never see any of this.
4. **Deep-link params already exist** (`?persona=`, `?focus=`); no new ones.

Existing demo behaviour for visitors does not change. `npm run build` and
vitest stay green; the capture helper has a unit test for both states.

## Hero changes (`src/components/landing/`)

- `Hero.tsx`: the right column becomes **`DemoVideoStage`** (new); the
  `DemoPersonaCards` and `DemoStage` imports leave the hero. `DemoStage`
  itself stays in the repo: `/partners` still renders it with Marcel's
  stills. `HeroPersonaProvider` stays where other sections need
  `useDemoHref()`; the hero no longer cycles personas (the provider gets a
  `fixed` persona = the language's persona, which it already supports).
- **`DemoVideoStage`**: one faux-browser window (same chrome styling as the
  deck's front window), 16:10, `<video muted playsInline autoPlay preload="metadata">`
  with `<source webm>` + `<source mp4>`, `poster` = first-frame jpg, files
  picked by `stillLang(i18n.language)` → `marcel-nl` or `emma-en`,
  `?v=DEMO_HERO_VERSION` on every URL.
  - Plays once; on `ended` an overlay fades in over the black last frame:
    headline + **"Start your session now"** button (`heroDemo.endCard.*`,
    EN + NL) linking to the survey start, plus a smaller "Replay" text
    button and a "Watch the full demo" link to `/demo` via `useDemoHref()`.
    Clicking the window while playing opens `/demo` (as the deck's front
    window did).
  - `prefers-reduced-motion`: no autoplay, poster shown, a play button.
  - Off-screen: paused via IntersectionObserver (saves battery, and the
    loop restart is not wasted where nobody looks).
  - Video missing/404 (e.g. before the first recording is committed):
    falls back to the poster with the end-card overlay, so the hero never
    shows a broken player.
  - Analytics: `hero_video_play`, `hero_video_ended`, `hero_video_cta`,
    `hero_video_replay`, `hero_video_open_demo`, via `trackCtaClick`.
- Copy: `heroDemo.label` and the stepper strings become unused in the hero
  and are left in place for `/partners`; new keys `heroDemo.endCard.title`,
  `.cta`, `.replay`, `.fullDemo` in both locale files.

## The script — `scripts/demo-record-hero.mjs`

```
node scripts/demo-record-hero.mjs                 # both personas, full quality
node scripts/demo-record-hero.mjs marcel-nl       # one
DRAFT=1 node scripts/demo-record-hero.mjs emma-en # 1x, 10 fps, mp4 only, fast check
SLOW=1.5 BASE=https://cairnly.io node scripts/demo-record-hero.mjs
```

- `puppeteer-core` + the installed Google Chrome, like `demo-capture-stills.mjs`
  (no new dependency; Playwright is not installed here). Init script sets
  the capture flag, `i18nextLng` in localStorage for the run's language,
  cookie consent as declined, and appends `[data-demo-chrome]{display:none!important}`.
- Screenshot loop at max speed with timestamps → frames dir in the
  scratch folder `.demo-capture/` (gitignored). Concat list with real
  durations → ffmpeg mp4 + webm; poster + per-scene stills copied out;
  `demoHero.generated.ts` written; scratch removed.
- `clickUntil(selector, reached)` re-clicks while the expected state has
  not appeared (the loop slows the page; clicks land mid-animation).
- Cursor and fades are script-drawn overlays, never product code.
- Anchors are text-based per language (same approach as the stills script)
  so a copy tweak breaks loudly, not silently.

**Running it.** ⚠️ Never from a Claude session inside the desktop app:
launching Chrome as a child of the app makes macOS revoke Documents access
(memory 2026-09-05). Run from a normal Terminal against `npm run dev`, or
from a Terminal-launched Claude. `DRAFT=1` first, eyeball, then full.

## Verification

1. `DRAFT=1` run for both personas: every scene reaches its state, no
   thrown anchor, total length 30–40 s.
2. Full run; open the four files, check Safari (mp4) and Chrome (webm),
   poster matches frame 0, end card appears on `ended`, replay works,
   reduced-motion shows poster + play, phone width stays 16:10.
3. `/partners` still shows the stills deck unchanged.
4. `npm run build`, vitest, browser check of `/` in EN and NL.

## Not decided here, deliberately

- Whether the survey demo gets a pressed "Submit" button for the camera.
  Decision: no; the "rest of the survey" card is the beat.
- Music or captions: none. Muted autoplay is the only autoplay browsers allow.
