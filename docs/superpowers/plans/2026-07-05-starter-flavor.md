# Cairnly Starter Flavor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Cairnly Starter flavor (spec: `docs/superpowers/specs/2026-07-05-starter-flavor-design.md`): landing at `/starter`, its own survey, its own inactive n8n chain, zero interference with the live pro platform.

**Architecture:** Additive everywhere. New survey row + new question UUIDs in Supabase; parallel `/starter` routes reusing shared auth/assessment/report/chat machinery; flavor threaded through Stripe metadata into access codes; `forward-to-n8n` branches on `survey_id` to a new webhook secret; starter WF1–WF4 duplicated from live exports, remapped, created inactive.

**Tech Stack:** React + TS + Vite, react-i18next, Supabase (MCP migrations, edge functions on Deno), Stripe, n8n public API.

**Constants used throughout:**
- `STARTER_SURVEY_ID = '00000000-0000-0000-0000-000000000002'`
- `STARTER_SURVEY_TYPE = 'Starter - First Serious Job - 2026 v1 EN'`
- Question UUID scheme: `a1a1a1a1-000S-4000-a000-0000000000NN` (S = section 1–7, NN = question number, hex-safe). Section UUIDs: `a1a1a1a1-0000-4000-a000-00000000000S`.

---

### Task 1: Database migration — starter survey, sections, questions

**Files:**
- Create: `supabase/migrations/20260705120000_create_starter_survey.sql`

- [ ] **Step 1: Write the migration.** Idempotent (`ON CONFLICT (id) DO NOTHING` on every insert). Content:
  - `surveys`: `(id '…0002', title 'Starter - First Serious Job - 2026 v1 EN')`
  - 7 `survey_sections` + 40 `questions` per the content table below (full SQL in the migration file; labels/descriptions verbatim from this table; no em-dashes anywhere in user-facing text).

**Survey content (source of truth):**

**Section 1 — Getting to know you** ("The basics, so your results actually fit your life.")
| # | Type | Label | Config/choices |
|---|------|-------|----------------|
| 1 | short_text | Your name | desc: First and last name |
| 2 | number | Your age | |
| 3 | dropdown | What region are you based? | Same 10 region choices as pro survey; desc: If you are about to move, pick the region you are moving to. |
| 4 | multiple_choice | What's your current situation? | Studying full-time / Just graduated, looking for my first serious job / Working my first job, wondering if it's the right one / Working a job I want out of / Taking a gap or in-between period; allow_other |
| 5 | dropdown | Highest education completed or in progress | High school / Vocational or trade school / Associate degree / Bachelor's degree / Master's degree / PhD / Self-taught or online courses / Other |
| 6 | short_text | What did (or do) you study? | desc: Field of study or main subject. Write "none" if not applicable. |
| 7 | multiple_choice (multi, min 1) | What work experience do you have so far? | Side jobs (retail, hospitality, delivery, tutoring...) / One or more internships / Volunteering / Student association or committee work / Freelance gigs or my own hustle / Helping in a family business / None yet, and that's okay |
| 8 | long_text | Tell us about the work you've done so far | max 800; desc: Jobs, internships, projects. What you actually did, what you liked, what you hated. A supermarket job counts. If you picked "none yet", tell us what you've been doing instead. |

**Section 2 — How you operate** ("No right answers here. We're mapping how you naturally work, not grading you.")
| 9 | multiple_choice | In a group, where do you usually find yourself? | Energizing the room and connecting people / Contributing when I have something real to add / Observing first, acting once I get the picture / It depends completely on the group |
| 10 | multiple_choice | When you face a big decision, what do you actually do? | Research everything until I'm sure / Go with my gut and adjust later / Talk it through with people I trust / Put it off until I'm forced to choose |
| 11 | multiple_choice | Structure or freedom? | Give me clear instructions and a plan / Give me the goal and freedom in how I get there / A mix, depending on the task |
| 12 | multiple_choice | How do you handle deadline pressure? | I thrive on it, my best work happens under pressure / I perform fine but prefer calm / I get stressed and it shows / I avoid it by starting early |
| 13 | multiple_choice (multi, max 2) | How do you learn best? | By doing and trying things / Videos and tutorials / Reading and taking notes / Someone explaining it to me one-on-one / Trial and error until it clicks |
| 14 | multiple_choice | How do you deal with feedback or criticism? | I actively look for it and use it / I appreciate it but need a moment first / I find it hard and can take it personally / Depends entirely on who it comes from |
| 15 | multiple_choice | In a team project, which role do you naturally take? | The organizer who keeps everyone on track / The ideas person / The one who quietly gets the work done / The peacemaker who keeps the vibe good / The critical one who spots the problems; allow_other |

**Section 3 — What drives you** ("What actually matters to you in work. Be honest, not aspirational.")
| 16 | ranking | Rank what matters most in your (next) job | **Learning & Growth** (getting better fast, real skills) / **Financial independence** (my own money, my own life) / **Job security** (stability I can count on) / **Doing something that matters** (impact on people or the world) / **Freedom & flexibility** (control over my time and place) / **Belonging & good colleagues** (people I actually like) / **Status & recognition** (being seen as good at what I do) / **Enjoying the day-to-day** (liking the actual work) |
| 17 | long_text | A year into your first serious job, what would make you say "this was a win"? | max 600 |
| 18 | multiple_choice | Where's your head at with the job market right now? | Honestly anxious, it feels stacked against my generation / Frustrated, I do everything right and get nowhere / Neutral, it is what it is / Optimistic, I'll find my way / I haven't really thought about it |
| 19 | multiple_choice | And AI? How do you feel about it and work? | Worried it will eat the jobs I'm aiming for / Confused about what it means for me / Curious, I want to use it to get ahead / I already use it daily / Indifferent |
| 20 | long_text | What's your biggest worry about starting your career? | max 600; desc: Be honest. This is what lets us give you straight answers instead of generic advice. |

**Section 4 — Interests & strengths** ("You have more evidence about yourself than you think. School, hobbies, side jobs: it all counts.")
| 21 | short_text | Which subjects did you actually enjoy in school or your studies? | desc: The ones you'd pick again, not the ones you were told were useful. |
| 22 | long_text | What do friends or classmates come to you for? | max 600; desc: The thing people naturally ask your help with. Fixing stuff, advice, planning, explaining, calming people down... |
| 23 | long_text | What's the thing you're most proud of making, doing, or organizing? | max 600; desc: A school project, a shift you ran, something you built or posted online, an event, a personal record. Anything counts. |
| 24 | interests_hobbies | List personal interests or hobbies that matter to you | desc: Provide **up to 3** (e.g. gaming, football, thrifting, cooking, editing videos, sneakers, reading...) |
| 25 | multiple_choice | How are you with technology? | I can make tech do things most people can't (coding, editing, automating) / I learn any new tool fast / I'm fine with everyday apps and tools / I prefer to keep tech simple |
| 26 | multiple_choice (multi, min 2, max 4) | Which of these sound most like you? | Making or building things / Analyzing and figuring things out / Helping or teaching people / Selling or convincing / Organizing and planning / Creating content or design / Working with my hands / Working with numbers / Caring for people or animals / Being outdoors and on the move |

**Section 5 — Where you work best** ("Picture your best working day. We're building the setting.")
| 27 | multiple_choice | Your ideal team setup? | A buzzing environment with lots of people / A small, tight-knit team / Mostly independent with regular check-ins / A mix |
| 28 | multiple_choice | Desk, remote, or on your feet? | At a desk in an office / Remote, from wherever / Hands-on, on my feet or on location / A mix |
| 29 | multiple_choice | What pace suits you? | Fast and varied, new things every day / Steady with clear routines / Waves: intense sprints, then calm |
| 30 | multiple_choice | How much guidance do you want from a manager at the start? | A lot, teach me the ropes properly / Regular check-ins but room to try things / Minimal, let me figure it out |
| 31 | multiple_choice (multi, max 3) | Any dealbreakers? | Rigid 9-to-5 with zero flexibility / Constant overtime pressure / Cut-throat competition between colleagues / Boring, repetitive work / No path to grow / A long commute / Formal dress codes and stiff culture; allow_other |

**Section 6 — Practical reality** ("Ambition meets logistics. This keeps the advice realistic.")
| 32 | multiple_choice | Would you move for the right job? | Yes, anywhere / Within my country / Only near where I live now / I want to stay where I am |
| 33 | multiple_choice | Salary versus learning: where are you? | Max salary now, I need the money / A fair balance / I'd take less pay for real growth / Income barely matters to me yet |
| 34 | multiple_choice | Would you take a "foot in the door" job that isn't the dream but leads toward it? | Absolutely, in is in / Yes, if the path from A to B is clear / Reluctantly / No, I'm aiming straight at what I want |
| 35 | multiple_choice | Open to more studying or certifications? | Yes, even a full degree if it's worth it / Short courses and certificates, sure / Only learning on the job / I'm done with studying |
| 36 | dropdown | When do you want (or need) to be working? | As soon as possible / Within 3 months / Within a year / I'm still studying, planning ahead |

**Section 7 — Looking ahead** ("Last stretch. Say it in your own words.")
| 37 | long_text | What does a "serious job" actually mean to you? | max 600 |
| 38 | long_text | Where do you hope to be in two years? | max 600; desc: Loose is fine. A vibe, a salary, a title, a lifestyle. |
| 39 | multiple_choice (multi, min 1) | What do you want to get out of Cairnly? | Concrete career directions that fit me / An honest take on my strengths / A realistic plan to actually get hired / Understanding what AI means for my options / Clarity, because my head is a mess |
| 40 | long_text (not required) | Anything else we should know? | max 600 |

- [ ] **Step 2: Apply via MCP** `apply_migration` (name `create_starter_survey`) — version-controlled file, allowed per policy. Never `db push`.
- [ ] **Step 3: Verify:** `SELECT count(*) FROM questions q JOIN survey_sections s ON q.section_id=s.id WHERE s.survey_id='00000000-0000-0000-0000-000000000002'` → 40; pro survey count unchanged (61).
- [ ] **Step 4: Commit** `feat(starter): starter survey schema + 40 questions`.

### Task 2: Frontend wiring — survey mapping, region save, skip CV upload

**Files:**
- Modify: `src/components/assessment/constants.ts` (add mapping + export `STARTER_SURVEY_ID`)
- Modify: `src/components/survey/hooks/useSurveySubmission.ts` (region question IDs; support both `11111111-1111-1111-1111-111111111114` and `a1a1a1a1-0001-4000-a000-000000000003`)
- Modify: `src/pages/Assessment.tsx` (skip `PreSurveyUpload` when `getSurveyIdFromAccessCode(accessCodeData) === STARTER_SURVEY_ID`)

- [ ] Add mapping entry; keep pro fallback behavior identical.
- [ ] Region: replace single hardcoded ID with a two-element lookup array; first match wins.
- [ ] Assessment: `const isStarter = getSurveyIdFromAccessCode(accessCodeData) === STARTER_SURVEY_ID;` gate line 81 with `!isStarter &&`.
- [ ] `npm run build`; commit `feat(starter): route starter access codes to starter survey, skip CV step`.

### Task 3: Starter landing page at /starter

**Files:**
- Create: `src/pages/starter/StarterIndex.tsx`, `src/components/starter/*` (Hero, LimboSection, HowItWorks, WhatYouGet, StarterPricing, StarterFAQ, FinalCTA)
- Create: `public/locales/en/starter.json` + `public/locales/nl/starter.json` (copy of EN for now)
- Modify: `src/i18n.ts` (add `starter` namespace), `src/App.tsx` (lazy route `/starter`)

- [ ] Copy tone: direct, honest, zero corporate fluff. Acknowledges the limbo (few entry jobs, AI reshaping junior work) without doom. CTA "Find your way in". Reuse `LandingNav`, `LandingFooter`, existing `lp-*`/`btn-*` classes, palette, `font-weight ≤ 700`. **No em-dashes in any user-facing copy.** Pricing section reuses `PRICING` from `src/lib/pricing.ts`; CTA links to `/starter/payment`.
- [ ] `npm run build`; preview walk `/starter` (desktop + mobile widths); commit `feat(starter): landing page at /starter`.

### Task 4: Payment flavor threading

**Files:**
- Modify: `src/App.tsx` (route `/starter/payment`), `src/pages/Payment.tsx` (optional `flavor` prop or wrapper), `src/components/CheckoutForm.tsx` (add `flavor?: 'pro' | 'starter'` to invoke body)
- Modify: `supabase/functions/create-checkout/index.ts` (accept `flavor`, add to `metadata.flavor` — only literal `'starter'` accepted, else `'pro'`)
- Modify: `supabase/functions/payment-success/index.ts` line ~557: `survey_type: session.metadata?.flavor === 'starter' ? 'Starter - First Serious Job - 2026 v1 EN' : 'Office / Business Pro - 2025 v1 EN'`

- [ ] Also thread the flavor into the Stripe product line-item name shown at checkout ("Cairnly Starter" vs existing name) if the name is a literal in create-checkout; keep amounts identical for v1.
- [ ] `npm run build`; commit `feat(starter): mint starter access codes from /starter/payment`.

### Task 5: forward-to-n8n starter routing

**Files:**
- Modify: `supabase/functions/forward-to-n8n/index.ts`

- [ ] Branch on `payload.survey_id === '00000000-0000-0000-0000-000000000002'` → `Deno.env.get('N8N_STARTER_WEBHOOK_URL')`. Missing secret + starter → mark report failed, return retryable error (`survey_responses` must never hit the pro webhook). Pro path byte-identical to today.
- [ ] Extend `supabase/functions/resume-strengthen`-style unit tests if a test harness exists for the function; otherwise verify by deno check + code review.
- [ ] Commit `feat(starter): route starter submissions to dedicated n8n webhook`.

### Task 6: n8n starter chain (duplicated, INACTIVE)

**Files:**
- Create: `n8n_wfs_cairnly/WF1S - Starter Profile Insert EN_<date>.json` (+ WF2S/WF3S/WF4S)

- [ ] Present per-workflow node-diff plan in chat before any API call (per CLAUDE.md policy).
- [ ] For each of WF1 `0Z8WxV5tVFMJqIZt`, WF2 `vVv0tsnFlBnarMdq`, WF3 `zhgJuiDp60PS5ZKJ`, WF4 `seWmQPFQqIe60TkU`: GET live JSON → save pristine export → remap question IDs to starter UUIDs → adapt prompts (education/side-jobs/projects evidence, entry-level career pool, learnability-weighted scoring, "how to get in without experience" narratives) → new webhook path for WF1S → chain WF1S→WF2S→WF3S→WF4S→shared WF7 → POST as new workflows, **inactive** → save created JSON to `n8n_wfs_cairnly/`.
- [ ] WF3S keeps `outside_box` inserted last (frontend polling contract).
- [ ] Commit exports.

### Task 7: Verification + handoff

- [ ] `npm run build` green; `git status --porcelain | grep '^??'` empty under `src/`.
- [ ] Preview: `/starter` renders; pro `/` unchanged; test access code with starter survey_type loads starter questions (insert one test code via SQL, then delete it).
- [ ] Em-dash audit: `grep -nE "—" public/locales/en/starter.json supabase/migrations/20260705120000_create_starter_survey.sql` → nothing.
- [ ] Push to main (auto-deploys frontend via Vercel and edge functions via GitHub Action).
- [ ] Write handoff summary with the 5 launch-checklist user actions from the spec.
