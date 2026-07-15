# Intake Chat v2 (Grounding + Show-Don't-Tell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing-page intake chat per `docs/superpowers/specs/2026-07-15-intake-chat-v2-grounding-design.md`: grounding first question, stat-backed openers, de-primed avoid beat, near-term horizon, no-playback bridge pitch, beat-synced product screenshots, pitch-stands-alone UI.

**Architecture:** Prompt/beat changes live entirely in the edge function's `prompts.ts` (server drives beats mechanically: beat = user turn count). Frontend changes: chat panel post-pitch view, carousel pinning driven by a new pure mapping module (`intakeSlides.ts`, unit-tested), and a pitched-state screenshot component. Screenshot assets are renamed/cropped/compressed from `public/Platform screens/` into `public/images/live/landing/intake/`.

**Tech Stack:** React + TypeScript + Tailwind (frontend), Deno edge function (Supabase), vitest (tests), sips (image processing, macOS).

**Branch:** all work on branch `intake-v2-grounding` off `main`. NOT live until merged (Vercel deploys `main`; edge functions auto-deploy on push to `main` via GitHub Action).

---

### Task 0: Branch

- [ ] **Step 0.1: Create the branch**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
git checkout -b intake-v2-grounding
```

---

### Task 1: Screenshot assets

Six captures live in `public/Platform screens/` (Dutch default filenames containing
a U+00AD soft hyphen — use globs, don't retype names). All are 1600×1000 except the
Alain dashboard (1600×1140, dream-job list at the bottom edge must be cropped off).
PNGs are 1.2–1.8 MB; convert to JPEG quality 82 to match the existing carousel
assets (`public/images/live/landing/carousel/*.jpg`, 1600×1000, ~200 KB).

**Files:**
- Create: `public/images/live/landing/intake/` (6 jpg files)
- Move: `public/Platform screens/` → `_archive/platform-screens-2026-07/` (originals kept, out of the deployed `public/`)

- [ ] **Step 1.1: Create target dir and convert each capture**

Match files by their timestamp substrings (avoids the soft-hyphen filename issue):

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
mkdir -p public/images/live/landing/intake
cd "public/Platform screens"

# Jul 15 21.36 — dashboard (Alain). Crop TOP 1000px first (drops dream-job list), then convert.
sips *21.36*.png --cropOffset 0 0 --cropToHeightWidth 1000 1600 -s format jpeg -s formatOptions 82 \
  --out ../images/live/landing/intake/dashboard-top-matches.jpg

# Jul 7 16.37 — coach: "How AI will impact this role"
sips *16.37*.png -s format jpeg -s formatOptions 82 --out ../images/live/landing/intake/coach-ai-impact.jpg

# Jul 7 16.29 — coach: Key Insight
sips *16.29*.png -s format jpeg -s formatOptions 82 --out ../images/live/landing/intake/coach-key-insight.jpg

# Jul 8 12.01 — career detail: salary ranges + steps for pursuing
sips *12.01*.png -s format jpeg -s formatOptions 82 --out ../images/live/landing/intake/career-salary-steps.jpg

# Jul 8 14.33 — jobs: "Hiding roles you said you'd avoid"
sips *14.33*.png -s format jpeg -s formatOptions 82 --out ../images/live/landing/intake/jobs-hiding-avoids.jpg

# Jul 9 10.20 — radar comparison + Move: Upskill
sips *10.20*.png -s format jpeg -s formatOptions 82 --out ../images/live/landing/intake/career-compare-radar.jpg
```

Note: `--cropOffset 0 0` anchors the crop at the top-left. If the installed sips
rejects `--cropOffset` (pre-macOS 12), fall back to:
`sips *21.36*.png -s format jpeg -s formatOptions 82 --out /tmp/dash-full.jpg` then
crop with Preview manually, or use
`python3 -c "from PIL import Image; im=Image.open(sorted(__import__('glob').glob('*21.36*.png'))[0]); im.crop((0,0,1600,1000)).convert('RGB').save('../images/live/landing/intake/dashboard-top-matches.jpg', quality=82)"`
(PIL is available via `python3 -m pip install pillow` if needed).

- [ ] **Step 1.2: Verify results**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
sips -g pixelWidth -g pixelHeight public/images/live/landing/intake/*.jpg | grep -A2 dashboard
ls -la public/images/live/landing/intake/
```
Expected: dashboard-top-matches.jpg is 1600×1000; all six files exist, each well under 500 KB.
Then Read `dashboard-top-matches.jpg` and confirm the bottom edge no longer shows the dream-job names list.

- [ ] **Step 1.3: Archive the originals out of public/**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
mkdir -p _archive
mv "public/Platform screens" "_archive/platform-screens-2026-07"
```

- [ ] **Step 1.4: Commit**

```bash
git add public/images/live/landing/intake
git commit -m "feat(intake): add persona product screenshots for beat-synced hero (from platform captures 2026-07)"
```
(The originals in `_archive/` stay untracked unless `_archive` is already tracked; don't force-add them.)

---

### Task 2: prompts.ts — beats, openers, briefs, facts, pitch, extraction

**Files:**
- Modify: `supabase/functions/intake-chat/prompts.ts`

All edits below are in that one file. Line references are to the current file.

- [ ] **Step 2.1: Replace BEATS[0] (career-stage chips → grounding free text)**

Replace the entire first element of `BEATS` (lines 203–232, the object with label
`'Where you are'` and the 7-option chips) with:

```ts
  {
    label: { en: 'Your work today', nl: 'Jouw werk nu' },
    goal: 'What kind of work they actually do, or did most recently: field, role, a sentence of context (e.g. "marketing manager at a startup", "ten years in nursing, now on a break"). This answer grounds every later question and the final pitch. Ask one simple, warm question; a sentence from them is plenty. Do not ask for a CV, an employment history, or their career stage; if leading/solo/on-a-break is unclear, leave it unclear.',
    chips: null,
  },
```

- [ ] **Step 2.2: Replace BEATS[4] (dual horizon → near-term only)**

Replace the entire fifth element of `BEATS` (label `'Your horizon'`) with (chips
index-aligned 1:1 with `CANON.shortTermGoals`):

```ts
  {
    label: { en: 'Your next step', nl: 'Je volgende stap' },
    goal: 'What they want from the next year or two: the shape of a right next step. Keep it light, this is the last question. Do not ask about 5-10 year plans or lifetime ambitions.',
    chips: {
      en: {
        options: [
          'Develop new skills or certifications',
          'Experience in a different role or industry',
          'Grow my professional network',
          'A promotion or better pay',
          'Better work-life balance',
          'Explore starting something of my own',
        ],
        multi: true,
        max: 3,
      },
      nl: {
        options: [
          'Nieuwe vaardigheden of certificaten ontwikkelen',
          'Ervaring opdoen in een andere rol of sector',
          'Mijn professionele netwerk uitbreiden',
          'Een promotie of beter salaris',
          'Een betere werk-privébalans',
          'Verkennen om iets voor mezelf te beginnen',
        ],
        multi: true,
        max: 3,
      },
    },
  },
```

- [ ] **Step 2.3: Replace OPENER_REPLIES with stat-backed versions**

Replace the whole `OPENER_REPLIES` constant (lines 72–97) with:

```ts
export const OPENER_REPLIES: Record<Lang, Partial<Record<IntentKey, string>>> = {
  en: {
    default:
      "Two thirds of workers carry career regrets, and 35% of US graduates would pick a different field today; we gathered that research for our Career Uncertainty Report. So your question deserves a real answer, and it starts with the path so far. What kind of work have you been doing? A sentence is plenty.",
    'good-at-it':
      "Almost half of professionals worldwide say they haven't yet found work that feels truly meaningful; we gathered that research for our Career Uncertainty Report. Feeling that while being good at your job is more common than people admit. To ground this: what kind of work do you do? A sentence is plenty.",
    'ai-worried':
      "You're far from alone in this: 52% of US workers worry about what AI means for their work, and the World Economic Forum expects 39% of skills to shift by 2030; the research is in our Career Uncertainty Report. Your worry deserves a straight answer rather than reassurance. To ground this: what kind of work do you do, day to day?",
    'life-changed':
      "Worldwide, work-life balance just overtook pay as the number one reason to choose a job, for the first time in 22 years of measuring; we cover it in our Career Uncertainty Report. So the gap between the life and the job is worth taking seriously. To start: what work have you been doing, or were you doing before things shifted?",
    'understand-myself':
      "Good instinct. Popular personality tests hold up poorly: 39 to 76% of people get a different MBTI type when they retake it, which is why we compared coaches and assessments in one of our reports. Knowing who's choosing comes before choosing. First: what kind of work have you been doing? A sentence is plenty.",
  },
  nl: {
    default:
      "Eén op de drie studenten heeft achteraf twijfels of spijt van de studiekeuze; dat onderzoek verzamelden we voor ons Career Uncertainty Report. Jouw vraag verdient dus een echt antwoord, en dat begint bij het pad tot nu toe. Wat voor werk heb je tot nu toe gedaan? Eén zin is genoeg.",
    'good-at-it':
      "Bijna de helft van de professionals wereldwijd zegt nog geen werk te hebben gevonden dat echt betekenisvol voelt; dat onderzoek verzamelden we voor ons Career Uncertainty Report. Dat gevoel kennen terwijl je goed bent in je werk komt vaker voor dan mensen toegeven. Om dit te plaatsen: wat voor werk doe je? Eén zin is genoeg.",
    'ai-worried':
      "Je bent hierin allesbehalve alleen: 52% van de Amerikaanse werkenden maakt zich zorgen over wat AI voor hun werk betekent, en het World Economic Forum verwacht dat 39% van de vaardigheden verschuift richting 2030; het onderzoek staat in ons Career Uncertainty Report. Je zorg verdient een eerlijk antwoord in plaats van geruststelling. Om dit te plaatsen: wat voor werk doe je, van dag tot dag?",
    'life-changed':
      "Wereldwijd is werk-privébalans net salaris voorbijgestreefd als belangrijkste reden om een baan te kiezen, voor het eerst in 22 jaar meten; we behandelen het in ons Career Uncertainty Report. De kloof tussen het leven en de baan is dus serieus te nemen. Om te beginnen: wat voor werk heb je gedaan, of deed je voordat het leven veranderde?",
    'understand-myself':
      "Goed instinct. Populaire persoonlijkheidstests houden slecht stand: 39 tot 76% van de mensen krijgt een ander MBTI-type bij een hertest; daarom vergeleken we coaches en assessments in een van onze reports. Weten wie er kiest komt vóór het kiezen. Eerst: wat voor werk heb je tot nu toe gedaan? Eén zin is genoeg.",
  },
};
```

- [ ] **Step 2.4: De-prime the good-at-it beat-3 brief**

In `BEAT3_VARIANTS['good-at-it']`, replace the current `goal` string (the one
containing "the drains hiding inside a job they are good at") with:

```ts
    goal: 'Which aspects of work they would want LESS of, or to avoid outright, in a next chapter. IMPORTANT: these are preferences about the FUTURE. They may or may not describe their current job; never assume that what they want to avoid is what they currently do. Their actual work came from the first question and nowhere else. Make explicit that this question is about AVOIDANCE, not aspiration: wrap the phrase that signals this in double asterisks for emphasis, e.g. "what would you want **less of this time around**," so the interface renders it bold. Use that exact bolded phrase (or a close natural variant) in your question.',
```

- [ ] **Step 2.5: Add the doorway fact to CAIRNLY_FACTS**

Append one bullet to the `CAIRNLY_FACTS` template string, after the line about the
intake conversation pre-filling the survey:

```
- This intake conversation is a short doorway, deliberately lighter than the product itself. The coaching chat inside the dashboard digs far deeper, with the full assessment results in hand. Never present this intake as representative of the coaching experience.
```

- [ ] **Step 2.6: Add the no-inference rule to qaSystem**

In `qaSystem()`, in the closing instruction paragraph ("Open with a very short
acknowledgment..."), append after "Do not preview future beats.":

```
Never assume facts about their current work beyond what they have stated in this conversation. What they want to avoid or leave behind says NOTHING about what they currently do.
```

- [ ] **Step 2.7: Rewrite the pitch requirements in pitchSystem**

In `pitchSystem()`, keep the function head (the `covered` computation and the
template up to and including the CRITICAL paragraph about the closed input).
Replace everything from `Now write THE PITCH:` to the end of the template string
with:

```
Now write THE PITCH: a short, personal bridge from what this visitor wants to what the Cairnly assessment would do for them. A product screenshot and a package card next to this message carry the excitement; you only bridge. Requirements:
- 70 to 110 words total, second person, in ${LANG_NAME[lang]}.
- NEVER read their answers back to them. No "you said", "you told me", "you mentioned" recitals, and no summarizing their answers. They know what they wrote. You may weave at most a few of their own words into a sentence where natural.
- NEVER present an interpretation, diagnosis or verdict about who they are, what they are good at, or what their current job involves. Never infer their job, field, strengths or history from what they want to avoid or leave behind. Their actual work is whatever they stated in the conversation, nothing more.
- Structure and formatting (use this exact shape):
  (a) One warm opening sentence acknowledging the reason they came, without repeating their answers.
  (b) Two or three markdown bullet lines (each line starts with "- "). Each bullet connects ONE want or worry they expressed to ONE specific item from the PACKAGE list below, named in bold as the bullet's lead phrase (wrapped in double asterisks), followed by one concrete sentence on what that item would settle for them. Each bullet must draw on a DIFFERENT covered topic. Example line: "- **AI-impact ratings on every suggested role:** a clear read on which paths stay durable as AI reshapes the work you named."
  (c) A send-off of at most two sentences: to really address this, Cairnly needs the fuller picture the full assessment builds, and everything shared here is already filled in if they continue. This conversation was only the doorway; the coaching chat inside the dashboard goes much deeper. An invitation, never a question, no pressure.
- PACKAGE (the only capabilities you may name; use these words):
  - Complete personality and career assessment
  - AI analysis tailored to your goals
  - Up to 12 suggested careers in 4 categories, each scored for personal match
  - Localized salary ranges for every role
  - AI-impact ratings on every suggested role
  - A practical, step-by-step switching plan for each role
  - Dream-job feasibility assessment
  - Live job openings, a CV strength optimizer and cover letter help once a path is chosen
- THE DREAM JOB IS A SIGNAL, NOT THE DESTINATION. If they named one, at most ONE bullet may touch it, and only via the dream-job feasibility assessment: it gets pressure-tested honestly (fit, feasibility, money), and the honest answer may be an adjacent or entirely different path. Never imply they are getting that job.
- Name at most the two or three package items your bullets use; the card next to this message already lists everything else. Do not use the word "report".
```

- [ ] **Step 2.8: Update the extraction schema descriptions**

In `EXTRACTION_TOOL.input_schema.properties`:

`long_term_goals.description` becomes:
```ts
        description: 'Only if they volunteered a long-view (5-10 year) ambition unprompted; usually empty (max 3).',
```

`extra_context.description` becomes:
```ts
        description:
          "First-person paragraph (60-120 words) in the visitor's language: what work they do or did (their own words), why they are looking, what is blocking them, what they dream of, their timeline. Written as if the visitor wrote it, reusing their phrasing. No em-dashes.",
```

- [ ] **Step 2.9: Update chipMappingTable for the new beats**

In `chipMappingTable()`:
1. In the `aligned` array, delete the row `[BEATS[0], CANON.careerSituation],`
   (beat 1 has no chips anymore) and add a new row at the end of the array:
   `[BEATS[4], CANON.shortTermGoals],`
2. Delete the entire `horizon` explicit-pairs block (the `const horizon: Array<[string, string, string]> = [...]` declaration and its `for` loop) — beat 5 chips are now index-aligned like the others.

- [ ] **Step 2.10: Update the header comment**

Replace the file's opening comment lines 9–13 ("The conversation starts with...
career stage, the real driver...") so the beat list reads:

```ts
// The conversation starts with the VISITOR's message (seeded from the intent
// pill, editable, or free text). The server drives up to five beats: what work
// they do (grounding; free text), the real driver, a pill-specific third beat,
// dream job, and the near-term next step. Background facts (history, education,
// years) stay with the post-payment resume upload.
```

- [ ] **Step 2.11: Type-check the edge function**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
deno check supabase/functions/intake-chat/index.ts
```
Expected: no errors. (If `deno` is not on PATH: `npx deno check ...` or verify via
Step 7's build + manual run instead.)

- [ ] **Step 2.12: Commit**

```bash
git add supabase/functions/intake-chat/prompts.ts
git commit -m "feat(intake): grounding opener replaces career-stage chips, stat-backed openers, de-primed avoid beat, near-term horizon, no-playback bridge pitch"
```

---

### Task 3: intakeSlides mapping module (TDD)

**Files:**
- Create: `src/components/landing/intake/intakeSlides.ts`
- Test: `src/components/landing/intake/intakeSlides.test.ts`

- [ ] **Step 3.1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { intakeShotFor, PITCH_SHOT_SRC, INTAKE_SHOT_SRC } from './intakeSlides';

describe('intakeShotFor', () => {
  it('pins the jobs-avoids screen on the good-at-it avoid beat', () => {
    expect(intakeShotFor('good-at-it', 3)).toBe('jobs-avoids');
  });
  it('pins the AI-impact screen on the ai-worried fluency beat', () => {
    expect(intakeShotFor('ai-worried', 2)).toBe('ai-impact');
  });
  it('pins salary/steps on the life-changed schedule beat', () => {
    expect(intakeShotFor('life-changed', 3)).toBe('salary-steps');
  });
  it('pins the key-insight screen on the understand-myself archetypes beat', () => {
    expect(intakeShotFor('understand-myself', 3)).toBe('key-insight');
  });
  it('falls back to the dashboard for unknown intents and out-of-range beats', () => {
    expect(intakeShotFor('other', 2)).toBe('dashboard');
    expect(intakeShotFor('nonsense', 1)).toBe('dashboard');
    expect(intakeShotFor('good-at-it', 99)).toBe('dashboard');
  });
  it('has an image path for every shot and every pitch intent', () => {
    Object.values(INTAKE_SHOT_SRC).forEach((src) => expect(src).toMatch(/^\/images\/live\/landing\/intake\/.+\.jpg$/));
    ['default', 'good-at-it', 'ai-worried', 'life-changed', 'understand-myself'].forEach((k) =>
      expect(PITCH_SHOT_SRC[k]).toBeTruthy(),
    );
  });
});
```

- [ ] **Step 3.2: Run to verify it fails**

```bash
npx vitest run src/components/landing/intake/intakeSlides.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3.3: Implement the module**

```ts
/**
 * Show-don't-tell mapping for the intake chat: which REAL product screenshot
 * the hero pins beside each conversation beat, per intent. Beat order mirrors
 * the server's beat plans in supabase/functions/intake-chat/prompts.ts
 * (beatsFor): keep the two in sync when a plan changes.
 */
export type IntakeShot =
  | 'dashboard'
  | 'ai-impact'
  | 'jobs-avoids'
  | 'salary-steps'
  | 'key-insight'
  | 'radar';

export const INTAKE_SHOT_SRC: Record<IntakeShot, string> = {
  dashboard: '/images/live/landing/intake/dashboard-top-matches.jpg',
  'ai-impact': '/images/live/landing/intake/coach-ai-impact.jpg',
  'jobs-avoids': '/images/live/landing/intake/jobs-hiding-avoids.jpg',
  'salary-steps': '/images/live/landing/intake/career-salary-steps.jpg',
  'key-insight': '/images/live/landing/intake/coach-key-insight.jpg',
  radar: '/images/live/landing/intake/career-compare-radar.jpg',
};

// Dream-job beat: no dedicated Dream Job Analysis capture yet; the dashboard
// (which lists the dream jobs) stands in until one is added.
const DREAM: IntakeShot = 'dashboard';

/** Per-intent beat plans (beat 1 first), mirroring beatsFor() server-side. */
const PLANS: Record<string, IntakeShot[]> = {
  default: ['dashboard', 'dashboard', 'dashboard', DREAM, 'radar'],
  'good-at-it': ['dashboard', 'dashboard', 'jobs-avoids', DREAM, 'radar'],
  'ai-worried': ['dashboard', 'ai-impact', DREAM, 'radar'],
  'life-changed': ['dashboard', 'dashboard', 'salary-steps', DREAM],
  'understand-myself': ['dashboard', 'dashboard', 'key-insight', DREAM, 'radar'],
  other: ['dashboard', 'dashboard', 'dashboard', DREAM, 'radar'],
};

export function intakeShotFor(intent: string, beat: number): IntakeShot {
  const plan = PLANS[intent] ?? PLANS.default;
  return plan[beat - 1] ?? 'dashboard';
}

/** Screenshot shown beside the package card once the pitch lands. */
export const PITCH_SHOT_SRC: Record<string, string> = {
  default: INTAKE_SHOT_SRC.dashboard,
  'good-at-it': INTAKE_SHOT_SRC.dashboard,
  'ai-worried': INTAKE_SHOT_SRC['ai-impact'],
  'life-changed': INTAKE_SHOT_SRC['salary-steps'],
  'understand-myself': INTAKE_SHOT_SRC['key-insight'],
};
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npx vitest run src/components/landing/intake/intakeSlides.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 3.5: Commit**

```bash
git add src/components/landing/intake/intakeSlides.ts src/components/landing/intake/intakeSlides.test.ts
git commit -m "feat(intake): beat-to-screenshot mapping module with tests"
```

---

### Task 4: HeroCarousel beat-sync

**Files:**
- Modify: `src/components/landing/HeroCarousel.tsx`

- [ ] **Step 4.1: Add intake slides and pinning logic**

1. Add imports at the top:

```ts
import { useIntakeChatOptional } from './intake/IntakeChatContext';
import { INTAKE_SHOT_SRC, intakeShotFor, type IntakeShot } from './intake/intakeSlides';
```

2. After the `SLIDES` array, add the intake slides (rendered in the same
crossfade stack, never part of the resting rotation):

```ts
// Intake close-ups: pinned while the intake chat runs (beat-synced via
// intakeSlides.ts), excluded from the resting rotation below.
const INTAKE_SHOT_ORDER: IntakeShot[] = ['dashboard', 'ai-impact', 'jobs-avoids', 'salary-steps', 'key-insight', 'radar'];
const INTAKE_SLIDE_SLUG: Record<IntakeShot, string> = {
  dashboard: 'dashboard',
  'ai-impact': 'chat',
  'jobs-avoids': 'jobs',
  'salary-steps': 'dashboard',
  'key-insight': 'chat',
  radar: 'dashboard',
};
const INTAKE_BASE = SLIDES.length;
const INTAKE_SLIDES: Slide[] = INTAKE_SHOT_ORDER.map((shot) => ({
  src: INTAKE_SHOT_SRC[shot],
  slug: INTAKE_SLIDE_SLUG[shot],
  alt: 'Cairnly product screen',
}));
const ALL_SLIDES = [...SLIDES, ...INTAKE_SLIDES];
```

3. Inside the component, after `const { intent } = useIntent();` add:

```ts
  const intake = useIntakeChatOptional();
  // While the intake chat runs, pin the screen that answers the current beat.
  const pinned =
    intake?.started && intake.stage === 'chat' && intake.beat
      ? INTAKE_BASE + INTAKE_SHOT_ORDER.indexOf(intakeShotFor(intent, intake.beat))
      : null;
```

4. Change the intent-jump effect to defer to pinning, and pin on beat change:

```ts
  // A pill click jumps the carousel to that intent's most relevant screen;
  // once the chat is running, the beat decides instead.
  useEffect(() => {
    if (pinned === null) setActive(INTENT_SLIDE[intent] ?? 0);
  }, [intent, pinned]);

  useEffect(() => {
    if (pinned !== null) setActive(pinned);
  }, [pinned]);
```

5. In the rotation interval effect, add `pinned !== null` to the guard and keep
rotation within the original six slides:

```ts
  useEffect(() => {
    if (paused || pinned !== null || reduceMotion.current) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, pinned]);
```

6. In the JSX, render the stack from `ALL_SLIDES` instead of `SLIDES` (the
`.map(...)` that produces the crossfading `<img>` elements, and the
`const slug = SLIDES[active].slug;` line becomes `ALL_SLIDES[active].slug`).
If a dots/progress indicator maps over `SLIDES`, leave it mapping over `SLIDES`
(indicators are for the resting tour only) but guard its active-index against
out-of-range (`active < SLIDES.length ? active : -1`). Check the rest of the
file (lines 110+) for any other `SLIDES[active]` references and switch them to
`ALL_SLIDES[active]`.

- [ ] **Step 4.2: Run tests + build**

```bash
npx vitest run && npm run build
```
Expected: tests pass, build succeeds.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/landing/HeroCarousel.tsx
git commit -m "feat(intake): carousel pins the beat-matched product screen while the intake chat runs"
```

---

### Task 5: Pitch screenshot + chat panel post-pitch view

**Files:**
- Create: `src/components/landing/intake/PitchScreenshot.tsx`
- Modify: `src/components/landing/Hero.tsx:100` (pitched branch)
- Modify: `src/components/landing/intake/IntakeChatSection.tsx:99-102, 195-214`

- [ ] **Step 5.1: Create PitchScreenshot**

```tsx
import React from 'react';
import { useIntent } from '@/contexts/IntentContext';
import { PITCH_SHOT_SRC } from './intakeSlides';

/**
 * The product screenshot shown beside the package card once the intake pitch
 * lands, so the decision moment keeps a real product visual (the carousel is
 * unmounted at this stage). Matched to the visitor's intent.
 */
const PitchScreenshot: React.FC = () => {
  const { intent } = useIntent();
  const src = PITCH_SHOT_SRC[intent] ?? PITCH_SHOT_SRC.default;
  return (
    <div
      className="mx-auto mb-6 w-full max-w-[560px] overflow-hidden rounded-2xl"
      style={{ border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)' }}
    >
      <img src={src} alt="Cairnly dashboard preview" className="block w-full h-auto" loading="lazy" />
    </div>
  );
};

export default PitchScreenshot;
```

- [ ] **Step 5.2: Render it in Hero.tsx**

Add the import:

```ts
import PitchScreenshot from './intake/PitchScreenshot';
```

Change line 100 from:

```tsx
            {pitched ? <ReportDeliverablesCard /> : <HeroCarousel />}
```

to:

```tsx
            {pitched ? (
              <>
                <PitchScreenshot />
                <ReportDeliverablesCard />
              </>
            ) : (
              <HeroCarousel />
            )}
```

- [ ] **Step 5.3: Pitch stands alone in the chat panel**

In `IntakeChatSection.tsx`, replace lines 99–102:

```ts
  // Collapse everything except the latest exchange; the panel keeps a
  // stable height instead of growing an inner scrollbar.
  const hiddenMessages = showHistory ? [] : chat.messages.slice(0, -2);
  const visibleMessages = showHistory ? chat.messages : chat.messages.slice(-2);
```

with:

```ts
  // Collapse everything except the latest exchange; the panel keeps a
  // stable height instead of growing an inner scrollbar. Once the pitch has
  // landed, only the pitch bubble remains and the history stays sealed: the
  // closing screen is pitch + screenshot + package card, nothing else.
  const pitchedView = chat.stage === 'pitched';
  const hiddenMessages = pitchedView || showHistory ? [] : chat.messages.slice(0, -2);
  const visibleMessages = pitchedView
    ? chat.messages.slice(-1)
    : showHistory
      ? chat.messages
      : chat.messages.slice(-2);
```

Then gate both expander buttons on `!pitchedView`:
- The "earlier messages" button condition `hiddenMessages.length > 0` already
  yields false when pitched (hiddenMessages is `[]`), leave it.
- Change the "Collapse" button condition from
  `{showHistory && chat.messages.length > 2 && (` to
  `{!pitchedView && showHistory && chat.messages.length > 2 && (`.

- [ ] **Step 5.4: Run tests + build**

```bash
npx vitest run && npm run build
```
Expected: pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/landing/intake/PitchScreenshot.tsx src/components/landing/Hero.tsx src/components/landing/intake/IntakeChatSection.tsx
git commit -m "feat(intake): pitch closing screen - screenshot + package card, pitch bubble stands alone"
```

---

### Task 6: Locale label updates

**Files:**
- Modify: `public/locales/en/landing.json`
- Modify: `public/locales/nl/landing.json`

(Server-provided `beatLabels` is the live source for the stepper; these static
keys are updated for consistency only.)

- [ ] **Step 6.1: EN**

In `public/locales/en/landing.json`, under `intake.beats`:
- `"1": "Where you are"` → `"1": "Your work today"`
- `"5": "Your horizon"` → `"5": "Your next step"`

- [ ] **Step 6.2: NL**

In `public/locales/nl/landing.json`, under `intake.beats`:
- `"1"` → `"Jouw werk nu"`
- `"5"` → `"Je volgende stap"`

- [ ] **Step 6.3: Build + commit**

```bash
npm run build
git add public/locales/en/landing.json public/locales/nl/landing.json
git commit -m "chore(intake): stepper labels match new beat plan (work today / next step)"
```

---

### Task 7: End-to-end manual verification (dev server)

The intake chat calls the DEPLOYED edge function (see `intakeApi.ts`), which
still runs the OLD prompts until this branch merges. So this task verifies in
two passes:

- [ ] **Step 7.1: Frontend-only pass (old server prompts, new UI)**

Start the dev server (`preview_start` name "dev", port 8080). Clear state
first in the browser console: `localStorage.removeItem('cairnly_intake_session')`.
Run one conversation via any pill and verify:
- carousel stops rotating and pins per beat (beat numbers still align since
  route lengths are unchanged),
- during Q&A the thread shows only the last exchange with the expander,
- after the pitch: chat shows ONLY the pitch bubble (no expander), right column
  shows screenshot + package card.

- [ ] **Step 7.2: Full pass after merge (new prompts live)**

After merging to main (Sjoerd's go) the edge function auto-deploys. Then run
the Gertig scenario on production: pill "Good at my job, not sure it's me" →
answer "marketing manager" to the grounding question → pick "Data-heavy
analytical work" + "Finance-related work" as avoids → complete → verify the
pitch never claims data/finance strength, contains no "you said" playback,
names 2-3 package items in bold bullets, and ends with the doorway send-off.
Also run one NL conversation (check the NL opener stat) and one ai-worried
run (AI-impact screenshot pinned on beat 2).

- [ ] **Step 7.3: Prefill check**

After a completed run: in the browser console inspect
`localStorage.getItem('cairnly_intake_prefill')` (constant in `intakeApi.ts`;
confirm exact key name there) — short-term goals mapped to canonical values,
career_situation absent unless clearly stated.

---

### Task 8: Ship

- [ ] **Step 8.1: Push branch + report**

```bash
git push -u origin intake-v2-grounding
```

Then tell Sjoerd: what's on the branch, that it is NOT live yet, and offer the
merge (his usual preference: merge to main and test live). On his go:

```bash
git checkout main && git pull && git merge --no-ff intake-v2-grounding && git push
```

Merging deploys BOTH the frontend (Vercel) and the new intake-chat prompts
(edge-function GitHub Action). Then run Step 7.2.

---

## Self-review notes (done at planning time)

- Spec coverage: 1a→2.1, 1b→2.3, 1c→2.4, 1d→2.2, 1e→2.6, §2→2.7, §3→2.5,
  §4a→5.3, §4b→Tasks 1/3/4 + 5.1-5.2, §5→Task 6, extraction→2.8-2.9,
  testing→Task 7. Career-stage chip mapping removal→2.9.
- Beat counts per route unchanged (5/5/4/4/5), so `totalBeats`, stepper,
  persisted sessions, and the resume flow are untouched — no index.ts changes.
- The `INTAKE_SHOT_ORDER` array in Task 4 must match the `IntakeShot` union in
  Task 3 (it does: 6 entries, same spelling).
- Old sessions restored from localStorage keep their stored `beatLabels`;
  beat-synced pinning still works because route lengths are unchanged.
