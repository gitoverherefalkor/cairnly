# Intake chat v2: grounded questions, excitement-first pitch

**Date:** 2026-07-15
**Status:** Draft, awaiting Sjoerd's review (especially the prompt texts below)
**Supersedes parts of:** `2026-07-13-intake-chat-design.md` (beat plan + pitch prompt sections)

## Why

First external tester feedback (Gertig, 2026-07-15) on the pre-payment intake chat:

1. Questions felt "rogue" because the chat never asks what the visitor actually does.
2. Her "what to leave behind" answers (data-heavy, finance work) were read back as her
   current strengths ("strong at work that lives in data and finance"). She works in
   marketing. Root cause is twofold: the good-at-it beat-3 brief primes the model to
   treat avoid-picks as the current job ("the drains hiding inside a job they are good
   at"), and the pitch prompt demands grounding in "what they told you" while the model
   knows nothing about their background, so it fills the vacuum by inferring.
3. The horizon question crams 1-2 years and 5-10 years into one question with mixed
   chips.
4. Product owner direction: the chat exists to get visitors excited to try Cairnly,
   not to diagnose them on five answers. The pitch should connect their stated reasons
   and wants to 2-3 concrete items from the package, then send them off honestly.
5. The pitch must not read the visitor's answers back to them (annoying), and must
   make clear this short intake is not representative of the in-dashboard coaching
   chat.

## Decisions (made with Sjoerd, 2026-07-15)

- **Grounding:** one new free-text opening question ("what kind of work have you been
  doing?") that **replaces** the career-stage chips beat. No LinkedIn/CV upload
  pre-payment (may be revisited later as its own experiment).
- **Horizon:** near-term only (next 1-2 years). The 5-10 year view is left to the
  survey. Long-term extraction field stays but only fills when volunteered.
- **Pitch:** acknowledge → connect (2-3 package items) → honest send-off. No verdicts,
  no inference, no answer playback.
- **UI:** during Q&A keep the collapsed-thread behavior (last exchange + "Earlier
  messages" expander). Once pitched, show only the pitch bubble, no expander.

## 1. Beat plan changes (`supabase/functions/intake-chat/prompts.ts`)

### 1a. New beat 1: grounding (replaces career-stage chips)

```ts
{
  label: { en: 'Your work today', nl: 'Jouw werk nu' },
  goal: 'What kind of work they actually do, or did most recently: field, role, a sentence of context (e.g. "marketing manager at a startup", "ten years in nursing, now on a break"). This answer grounds every later question and the final pitch. Ask one simple, warm question; a sentence from them is plenty. Do not ask for a CV, an employment history, or their career stage; if leading/solo/on-a-break is unclear, leave it unclear.',
  chips: null,
}
```

- Free text, no chips. The career-stage chip list (7 form-like options) is removed
  from the chat.
- `career_situation` stays in the extraction tool; its existing rule ("ONLY if
  clearly stated; else null") now does the work. Many grounding answers reveal the
  stage naturally ("I lead a small marketing team"); when they don't, the survey asks
  it after payment as usual.
- `extra_context` extraction description gains: "Start from what work they do or did
  (their own words)."

### 1b. Rewritten canned openers (`OPENER_REPLIES`, EN)

Each still acknowledges the pill's sentiment, then asks the new grounding question:

- **default:** "That question deserves a real answer, and it starts with the path so
  far. What kind of work have you been doing? A sentence is plenty."
- **good-at-it:** "That tension is more common than people admit, and worth taking
  seriously. To ground this: what kind of work do you do? A sentence is plenty."
- **ai-worried:** "Fair worry, and it deserves a straight answer rather than
  reassurance. To ground this: what kind of work do you do, day to day?"
- **life-changed:** "That gap between the life and the job is worth taking seriously.
  To start: what work have you been doing, or were you doing before things shifted?"
- **understand-myself:** "Good starting point, knowing who's choosing comes before
  choosing. First: what kind of work have you been doing? A sentence is plenty."

NL versions translated at implementation, same structure.

### 1c. Good-at-it beat 3 brief: de-prime the avoid-question

The goal text loses "the drains hiding inside a job they are good at" and "Being good
at something and being drained by it often travel together". New goal:

```
Which aspects of work they would want LESS of, or to avoid outright, in a next
chapter. IMPORTANT: these are preferences about the FUTURE. They may or may not
describe their current job; never assume that what they want to avoid is what they
currently do. Their actual work came from the first question and nowhere else. Make
explicit that this question is about AVOIDANCE, not aspiration: wrap the phrase that
signals this in double asterisks for emphasis, e.g. "what would you want **less of
this time around**," so the interface renders it bold. Use that exact bolded phrase
(or a close natural variant) in your question.
```

### 1d. Horizon beat → "Your next step" (near-term only)

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
    nl: { /* same, translated */ },
  },
}
```

- Chips are index-aligned 1:1 with `CANON.shortTermGoals`, which simplifies
  `chipMappingTable()` (the explicit horizon pairs block goes away).
- `long_term_goals` stays in the extraction schema; description becomes "Only if they
  volunteered a long-view ambition unprompted; usually empty."

### 1e. Q&A system prompt: one added rule

Appended to the instruction block in `qaSystem()`:

```
Never assume facts about their current work beyond what they have stated in this
conversation. What they want to avoid or leave behind says NOTHING about what they
currently do.
```

(The existing "NEVER restate, paraphrase or summarize what they just said" rule
already covers answer playback during Q&A.)

## 2. Pitch rewrite (`pitchSystem()`)

The "name the core tension you heard" requirement (the diagnosis engine) is removed.
Full replacement of the requirements block; FACTS/STYLE/GUARDRAILS stay, with one
FACTS addition (section 3). Draft:

```
Now write THE PITCH: a short, personal bridge from what this visitor wants to what
the Cairnly assessment would do for them. Requirements:
- 80 to 130 words total, second person, in {language}.
- NEVER read their answers back to them. No "you said", "you told me", "you
  mentioned" recitals, and no summarizing their answers. They know what they wrote.
  You may weave at most a few of their own words into a sentence where natural.
- NEVER present an interpretation, diagnosis or verdict about who they are, what
  they are good at, or what their current job involves. Never infer their job,
  field, strengths or history from what they want to avoid or leave behind. Their
  actual work is whatever they stated in the conversation, nothing more.
- Structure and formatting (use this exact shape):
  (a) One warm opening sentence acknowledging the reason they came, without
      repeating their answers.
  (b) Two or three markdown bullet lines (each starts with "- "). Each bullet
      connects ONE want or worry they expressed to ONE specific item from the
      PACKAGE list below, named in bold as the bullet's lead phrase, followed by
      one concrete sentence on what that item would settle for them. Each bullet
      must draw on a DIFFERENT part of the conversation. Example:
      "- **AI-impact ratings on every suggested role:** a clear read on which
      paths stay durable as AI reshapes the work you named."
  (c) A send-off of at most two sentences: to really address this, Cairnly needs
      the fuller picture the full assessment builds, and everything shared here is
      already filled in if they continue. This conversation was only the doorway;
      the coaching chat inside the dashboard goes much deeper. An invitation,
      never a question, no pressure.
- PACKAGE (the only capabilities you may name; use these words):
  - Complete personality and career assessment
  - AI analysis tailored to your goals
  - Up to 12 suggested careers in 4 categories, each scored for personal match
  - Localized salary ranges for every role
  - AI-impact ratings on every suggested role
  - A practical, step-by-step switching plan for each role
  - Dream-job feasibility assessment
  - Live job openings, a CV strength optimizer and cover letter help once a path
    is chosen
- THE DREAM JOB IS A SIGNAL, NOT THE DESTINATION. If they named one, at most ONE
  bullet may touch it, only via the dream-job feasibility assessment: it gets
  pressure-tested honestly (fit, feasibility, money), and the answer may be an
  adjacent or different path. Never imply they are getting that job.
- Name at most the two or three package items your bullets use. The card next to
  this message already lists everything else.
```

Guidance per route (goes into the per-intent brief or stays implicit via the
conversation; NOT a hard mapping): good-at-it leans on match scoring + personality
read; ai-worried on AI-impact ratings; life-changed on the switching plan + salary
realism; default (chose at 16) on the 12 careers / outside-the-box breadth;
understand-myself on the personality assessment + goal-tailored analysis.

## 3. Shared facts addition (`CAIRNLY_FACTS`)

New bullet, so both the pitch and post-pitch follow-ups can say it:

```
- This intake conversation is a short doorway, deliberately lighter than the product
  itself. The coaching chat inside the dashboard digs far deeper, with the full
  assessment results in hand. Never present this intake as representative of the
  coaching experience.
```

## 4. UI change (`src/components/landing/intake/IntakeChatSection.tsx`)

- When `chat.stage === 'pitched'`: `visibleMessages` becomes only the last assistant
  message (the pitch), and both expander buttons ("Earlier messages", "Collapse") are
  not rendered. The pitch + deliverables card stand alone as the closing screen.
- During Q&A (`stage === 'chat'`): behavior unchanged (last exchange visible,
  expander available).

## 5. Locale updates (`public/locales/{en,nl}/landing.json`)

- `intake.beats.1` → "Your work today" / "Jouw werk nu" (note: server-provided
  `beatLabels` is the live source; the static keys are updated for consistency).
- `intake.beats.5` → "Your next step" / "Je volgende stap".

## Out of scope

- Pre-payment LinkedIn/CV upload (possible later experiment).
- Changes to the deliverables card, email flow, extraction schema shape (fields keep
  their names), n8n workflows, or the survey.

## Error handling

Unchanged: same phase machine, same fallbacks. The beat count per route is
unchanged (default 5; ai-worried and life-changed 4), so `totalBeats`, the stepper,
persisted sessions and the resume flow all keep working. In-flight sessions persisted
in localStorage keep their stored `beatLabels`, so mid-conversation deploys degrade
gracefully (old labels, new prompts server-side).

## Testing

- `npm run build` + manual browser run of all five pills and the free-text route,
  EN and NL: verify the opener asks the grounding question, the avoid-question is
  never read back as current work, the pitch names 2-3 package items and contains
  no "you said" playback, and the post-pitch view shows only the pitch bubble.
- Adversarial manual case (the Gertig scenario): open with good-at-it, answer
  "marketing" as current work, pick data/finance as avoids, confirm the pitch never
  claims data/finance strength.
- Verify prefill: complete a run, check localStorage prefill for short-term goals
  mapping and absent career stage when not stated.
