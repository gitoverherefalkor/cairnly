# Intake Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent-led intake chat overlay on the landing page that warms visitors up before `/payment`, captures email, and pre-fills the survey.

**Architecture:** New anonymous edge function `intake-chat` (direct Anthropic calls, server-side phase machine) + `intake_sessions` table + a portal overlay mounted in `Index.tsx`, wired into `useGetStarted` and `IntentChips` via an optional context. Pre-fill rides the existing `resume_parsed_data` mechanism via a new merged `intake_prefill_data` source.

**Tech Stack:** React/TS, Supabase edge functions (Deno), Anthropic API (`claude-sonnet-5`, no temperature), Resend, i18next (`landing` ns, EN+NL), vitest.

---

### Task 1: Migration — `intake_sessions` table

**Files:**
- Create: `supabase/migrations/20260713120000_create_intake_sessions.sql`

- [x] **Step 1: Write migration** (columns: id, created_at, updated_at, intent, language, source `cta|pill|resume`, status `active|pitched|email_captured`, messages jsonb `[]`, extraction jsonb, pitch text, email, resume_token uuid unique, user_turns int, total_tokens int). `enable row level security`, **no policies** (service-role only). Index on `email`, unique on `resume_token`.
- [x] **Step 2: Apply via Supabase MCP `apply_migration`** (version-controlled file → allowed). Verify with `information_schema.columns`.
- [x] **Step 3: Commit.**

### Task 2: Edge function `intake-chat`

**Files:**
- Create: `supabase/functions/intake-chat/index.ts`
- Create: `supabase/functions/intake-chat/prompts.ts` (system prompts + openers EN/NL + email copy EN/NL)
- Modify: `supabase/config.toml` (add `[functions.intake-chat]\nverify_jwt = false`)

**Protocol (all POST, JSON `{ action, ... }`):**
- `start` `{intent, language, source}` → creates row, returns `{sessionId, greeting}` (greeting = deterministic per-intent opener, stored in transcript as first assistant message).
- `message` `{sessionId, text}` → caps: text ≤ 600 chars, user_turns < 14, status != closed. Appends user msg. Phase from `user_turns`: turns 1–5 = Q&A prompt ("you are on question N of 5; acknowledge in one short sentence, then ask exactly one question"); turn 5 completion triggers **pitch phase**: pitch generation (max_tokens 700) + separate extraction call (forced tool_use, schema: name, goals, years_experience, study_subject, headline_hook) → status `pitched`, returns `{reply, stage: 'pitched', prefill}`; turns 6–8 post-pitch = brief answers steering to checkout; ≥ cap → fixed polite close. All calls: `claude-sonnet-5`, NO temperature, `x-api-key` + `anthropic-version: 2023-06-01`, AbortSignal.timeout(30000), parse `resp.content?.[0]?.text`.
- `email` `{sessionId, email}` → EMAIL_RE validation, store, status `email_captured`, send Resend magic-link email (email-chrome `renderEmail` + `bodyRow/h1/paragraph/ctaRow`, from `"Cairnly <no-reply@cairnly.io>"`, link `${origin}/?intake=${resume_token}`, COPY en/nl includes pitch text).
- `resume` `{token}` → UUID_RE validate, lookup by resume_token, return `{sessionId, messages, status, intent, language, prefill}`.

**Guardrails:** `checkRateLimit(req, 15, corsHeaders)`; system prompt scope lock (only Cairnly career intake; deflect off-topic/injection: "I'm only here to talk about your career path"); price fact €39 beta (€69 after) allowed; language lock EN/NL; style: no em-dashes, no "it's not X, it's Y" structure, warm but not sycophantic, ≤ 3 sentences per Q&A turn.

- [x] **Step 1: Write prompts.ts** (openers per intent × en/nl matching landing i18n voice; QA_SYSTEM, PITCH_SYSTEM, POST_PITCH_SYSTEM, extraction tool schema, email COPY).
- [x] **Step 2: Write index.ts** (service-role client Idiom A, shared cors helpers).
- [x] **Step 3: Add config.toml block.**
- [x] **Step 4: Deploy (`npm run deploy:functions` deploys all — instead deploy single: `supabase functions deploy intake-chat --project-ref pcoyafgsirrznhmdaiji --use-api`). New function → allowed without asking.**
- [x] **Step 5: curl smoke test** — start → message ×5 → expect pitched stage + prefill; email action with test address; resume action.
- [x] **Step 6: Commit.**

### Task 3: Frontend — provider + overlay UI

**Files:**
- Create: `src/components/landing/intake/IntakeChatContext.tsx` (provider + `useIntakeChat` + `useIntakeChatOptional`)
- Create: `src/components/landing/intake/IntakeChatOverlay.tsx` (portal, z-[400])
- Create: `src/components/landing/intake/intakeApi.ts` (supabase.functions.invoke wrappers)
- Modify: `src/pages/Index.tsx` (mount provider + overlay; read `?intake=` param → resume)
- Modify: `public/locales/en/landing.json`, `public/locales/nl/landing.json` (`intake.*` strings)

**State:** `{ visibility: 'closed'|'open'|'minimized', dismissed: boolean, stage: 'chat'|'email'|'done', sessionId, messages, sending }`. `sessionId` persisted to localStorage `cairnly_intake_session`. `openFromPill(intent)` respects `dismissed`; `openFromCta()` always opens. On pitched response: store `intake_prefill_data` + `cairnly_intake_contact` in localStorage.

**UI:** desktop = right-side panel (max-w-[420px], full-height, navy `#122E3B` header, cream `#FBF6E8` body); mobile = full-screen sheet (pattern: LandingNav drawer + ScreenshotSlot portal). Header: title, minimize (chevron) and close (X). Footer: input + send; persistent "skip to checkout" text link → `/payment`. Typing indicator (3 bouncing dots). Email stage: inline form under pitch. Done stage: CTA button → `/payment`. Minimized: floating pill bottom-right "Continue our chat" (gold border, navy bg).

- [x] Steps: context → api → overlay → i18n strings (EN+NL) → mount in Index → `npm run build` green → commit.

### Task 4: Trigger wiring

**Files:**
- Modify: `src/components/landing/useGetStarted.ts` (logged-out + provider present → `openFromCta()`; else navigate `/payment`)
- Modify: `src/components/landing/LandingNav.tsx:48-51` (use shared hook + `setMenuOpen(false)`)
- Modify: `src/components/landing/IntentChips.tsx` `pick()` (also `openFromPill(key)` when provider present)

- [x] Steps: edits → build → commit.

### Task 5: Pre-fill merge + checkout prefill

**Files:**
- Create: `src/components/survey/utils/mergePrefillSources.ts` (pure: `(resumeData|null, intakeData|null) → merged|null`, resume wins per-key)
- Create: `src/components/survey/utils/mergePrefillSources.test.ts` (vitest)
- Modify: `src/components/survey/hooks/useAIResumePreFill.ts` (read `intake_prefill_data`, merge as base)
- Modify: `src/components/CheckoutForm.tsx` (prefill email/firstName from `cairnly_intake_contact` when empty)

- [x] Steps: test first → util → hook integration → checkout prefill → `npm run test` + build → commit.

### Task 6: E2E verify + ship

- [x] `npm run dev` via preview browser: pill click opens seeded chat; 5 answers → pitch; email capture → magic-link email; minimize/dismiss behavior; skip link; Get Started trigger; mobile viewport; NL locale spot-check.
- [x] Verify localStorage keys written; simulate post-payment survey pre-fill (goals question filled).
- [x] Screenshot proof to Sjoerd; push branch; offer merge (NOT live until merged — edge function deploy is live already but unreferenced by prod frontend).

## Self-review notes
- Money path untouched (create-checkout/payment-success unmodified) ✓
- `job_title`/`interests` deliberately NOT in extraction schema (shape mismatch with survey array/object questions) ✓
- Sonnet-5 must not receive `temperature` ✓ · Em-dash ban in user-facing prompt output ✓
- `LandingNav` used on non-home pages → optional context prevents crashes ✓
