# Cairnly Starter — Design Spec

**Date:** 2026-07-05
**Status:** Draft — built autonomously under /goal; review gates flagged inline with ⚠️
**Audience:** Gen Z / young adults trying to land their first or second serious job. Little to no office or professional experience. Caught in the "limbo" of a tight entry-level market plus AI reshaping junior work before anyone has figured out what that means.
**URL:** `cairnly.io/starter` (English only for v1)
**Hard constraint:** Zero interference with the live professional platform. Everything is additive: new rows, new routes, new workflows. No existing question rows, workflows, or webhook secrets are modified.

---

## 1. What we're building

A second flavor of Cairnly that shares the platform's machinery (auth, payment, report processing, chat, dashboard) but has its own:

1. **Landing page** at `/starter` — positioning for first-job seekers, not career changers.
2. **Survey** — a new survey row in the database with its own sections and questions, written for people whose evidence is education, side jobs, internships, projects, and hobbies rather than a career history.
3. **n8n workflow chain** — duplicated from the live WF1–WF4 chain, adapted to the starter question IDs and audience, created **inactive** for review (same pattern as the Dutch localization rollout).
4. **Payment path** — `/starter/payment` mints access codes with a starter `survey_type`, so the assessment automatically loads the starter survey.

Everything downstream of `report_sections` (report processing screen, chat, dashboard) is generic on `report_id` + `section_type` and is reused unchanged.

## 2. Why this shape (approaches considered)

- **A. Flavor column on the existing survey/questions** — rejected. Couples starter logic into the live question set; memory and history say question rows are load-bearing for n8n. Highest interference risk.
- **B. Separate app / subdomain** — rejected for v1. Doubles deploy surface, splits auth and Stripe config, heavy for an experiment.
- **C. New survey row + new question UUIDs + parallel route subtree + duplicated inactive workflows (chosen)** — the architecture already supports it: `access_codes.survey_type` → `SURVEY_TYPE_MAPPING` → `survey_id` → questions load dynamically. This is the same isolation pattern used when WF1–WF7 were duplicated for NL. Zero shared mutable state with the pro flavor.

## 3. Architecture

### 3.1 Data (Supabase) — all additive

- New `surveys` row: id `00000000-0000-0000-0000-000000000002`, title `Starter - First Serious Job - 2026 v1 EN`.
- New `survey_sections` rows (7 sections) and `questions` rows (~40 questions) with **brand-new deterministic UUIDs** — scheme `a1a1a1a1-000S-0000-0000-0000000000NN` (S = section number, NN = question number). No overlap with the live `11111111…`/`22222222…` IDs, so the pro n8n chain can never receive or misread starter answers.
- No schema changes. `reports.survey_id` already discriminates starter vs pro reports.
- Delivered as a version-controlled migration in `supabase/migrations/`, applied individually via MCP (per the migration-history policy — no `db push`).

### 3.2 Frontend — parallel route subtree

- `/starter` → `StarterIndex` (new landing page, lazy-loaded). Reuses `LandingNav`, `LandingFooter`, existing CSS classes and palette; sections purpose-built for the audience (hero, "the limbo is real" empathy section, how it works, what you get, pricing, FAQ, CTA). Copy in a new `starter` i18n namespace (`public/locales/en/starter.json`; `nl` file created as a copy so the HTTP backend never 404s, but flavor is EN-only for now).
- `/starter/payment` → reuses `CheckoutForm` with a `flavor="starter"` prop.
- Auth, `/assessment`, `/report-processing`, `/chat`, `/dashboard` are **shared routes** — the access code's `survey_type` does the steering, so no starter forks of those pages.
- `SURVEY_TYPE_MAPPING` in `src/components/assessment/constants.ts` gains one entry: `'Starter - First Serious Job - 2026 v1 EN' → …0002`.
- Resume upload pre-fill step is **skipped** for the starter survey (the resume mapper is hardwired to pro question IDs, and the audience mostly has no CV worth parsing). Gate on survey id in the assessment flow.

### 3.3 Payment / entitlement

- `CheckoutForm` passes `flavor: 'starter'` → `create-checkout` adds it to Stripe session metadata → `payment-success` reads metadata and mints the access code with the starter `survey_type` instead of the hardcoded pro one. Absent/unknown metadata falls back to the pro survey type, so existing sessions and webhook replays are untouched.
- ⚠️ **Review gate: pricing.** v1 keeps the same €39/$39 price. If starters should get a lower price point, that's a product decision to make before launch (touches `pricing.ts`, checkout, and landing copy).

### 3.4 Edge function routing (forward-to-n8n)

- Additive branch: if `payload.survey_id === STARTER_SURVEY_ID`, POST to `N8N_STARTER_WEBHOOK_URL` (new Supabase secret). If that secret is missing, **fail explicitly** (report status `failed`) rather than falling back — starter responses must never reach the pro WF1, whose prompt slots expect pro question IDs.
- Pro submissions take the exact same code path as today.

### 3.5 n8n — duplicated starter chain (created INACTIVE)

Same recipe as the NL rollout: export live workflow → remap question IDs → adapt prompts for the audience → create as new inactive workflow → save JSON to `n8n_wfs_cairnly/`.

| New workflow | Duplicated from | Adaptation |
|---|---|---|
| Starter WF1 — Profile Insert | WF1 `0Z8WxV5tVFMJqIZt` | New webhook path; personality prompts reference education/side-jobs/projects instead of career history; starter question-ID map |
| Starter WF2 — Enrich 15 | WF2 `vVv0tsnFlBnarMdq` | Entry-level career pool; "first serious job" lens; AI-exposure framing for junior roles |
| Starter WF3 — Scoring + OOB | WF3 `zhgJuiDp60PS5ZKJ` | Scoring criteria weight learnability/entry paths over experience fit; keeps `outside_box` inserted last (frontend polling contract) |
| Starter WF4 — Narratives | WF4 `seWmQPFQqIe60TkU` | Narratives address "how to get in without experience": entry routes, first-90-days, realistic timelines |

- Starter WF4 triggers the **shared** WF7 (exec summary) — it reads `report_sections` generically. Chat (WF5) and feedback (WF6) are likewise reused as-is for v1; a starter-tone coach is a fast-follow.
- ⚠️ **Review gate: activation.** All starter workflows are left inactive. Sjoerd reviews prompts in the n8n editor and activates them himself. Until then, starter submissions fail cleanly with a retryable error.

### 3.6 What is explicitly NOT touched

Live WF1–WF9/WFX, the pro survey rows, `N8N_WEBHOOK_URL`, existing routes and pages, the NL localization, pricing values, the resume pipeline.

## 4. Starter survey (content outline)

Seven sections mirroring the pro survey's psychological structure, with the experience-dependent material replaced:

1. **About you** — name, age range, region, education level + field, current situation (studying / graduated & searching / working first job / gap year / other), work exposure so far (side jobs, internships, volunteering, none yet).
2. **How you operate** — personality and decision-style items (kept close to the pro instrument so scoring logic transfers): social energy, structure vs improvisation, pressure response, learning style, feedback handling.
3. **What drives you** — values ranking (growth, security, income, purpose, flexibility, recognition, belonging), motivation sources, and an honest "where's your head at" item about the job-market limbo and AI worry.
4. **Interests & proto-skills** — subjects and activities they gravitate to, self-rated strengths, proudest project/achievement (school, side job, hobby, online), digital/tool fluency.
5. **Where you work best** — team vs solo, office/remote/hands-on, pace, supervision preference, environment dealbreakers.
6. **Practical reality** — willingness to relocate/commute, salary vs learning trade-off, openness to adjacent "foot in the door" roles, appetite for further study or certification.
7. **Looking ahead** — what a "serious job" means to them, 2-year picture, biggest worry, what they want Cairnly to tell them straight.

⚠️ **Review gate: question wording.** The full question list ships in the migration and renders at `/assessment` behind a starter access code; review the copy there or in the migration file before any codes are sold.

## 5. Error handling

- Starter submission with workflows inactive/missing secret → `reports.status='failed'` → existing retry UI on `/report-processing` works unchanged.
- Unknown `survey_type` on an access code already falls back to the pro survey (existing behavior, unchanged).
- `forward-to-n8n` keeps its 3-attempt retry and JWT/ownership checks for both flavors.

## 6. Testing / verification

- `npm run build` green; no untracked `src/` files (P1 pitfall).
- Preview walk: `/starter` renders, CTA → payment → (test access code) → assessment loads **starter** questions; pro access code still loads pro questions.
- Migration applied via MCP; verify rows via `information_schema`/selects.
- `forward-to-n8n` branch unit-checked: pro survey_id → `N8N_WEBHOOK_URL`, starter survey_id → starter secret, starter + missing secret → explicit failure.
- n8n: starter workflows exist, inactive, exported to `n8n_wfs_cairnly/`.

## 7. Launch checklist (user actions)

1. Review starter survey copy.
2. Review + activate starter WF1–WF4 in n8n.
3. Set `N8N_STARTER_WEBHOOK_URL` Supabase secret (value = starter WF1 webhook URL).
4. Decide pricing (keep €39 or introduce starter price).
5. Smoke-test one end-to-end run with a test access code before announcing.
