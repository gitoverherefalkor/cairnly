# Cairnly Localization Plan — Dutch Beta

**This is the executable spec for the Dutch localization rollout.** Strategy reasoning is in chat history; this file is the contract between sessions.

## How to use this plan
- An agent invoked via `/finish-localization` should:
  1. Read the **Status** section to find the next incomplete phase.
  2. Read the phase **Inputs** before touching code.
  3. Execute **Steps** in order.
  4. **STOP at every ⛔ gate** and ask the user. Never proceed past a gate without explicit confirmation.
  5. Run the **Verification** checklist at the end of each phase.
  6. Update the Status checkboxes before ending the session.
- Phases are sequential. Do not start Phase N+1 until Phase N's Verification passes.

---

## Status (update as you go)

## 🇳🇱 Dutch went LIVE 2026-05-28 ⏰

`supportedLngs: ['en', 'nl']`, switcher `disabled: false` for nl. Dutch users now see the full Dutch UI shell. AI-generated chat content reverts to English until Phase 4 wires WF5's output-language injection — beta acceptable.

### Done ✅
- [x] `react-i18next` configured with 7 namespaces
- [x] `profiles.preferred_language` column exists
- [x] `useLanguage.ts` syncs profile ↔ i18next on login
- [x] `useAuth.tsx:100` writes `preferred_language` to signup `user_metadata`
- [x] `LanguageSwitcher.tsx` component exists (Dutch enabled 2026-05-28)
- [x] Dutch JSONs translated and key-sync'd with English (all 7 namespaces)
- [x] Stripe checkout passes `locale: nl` + `currency: eur`
- [x] Partial component i18n: `Dashboard.tsx` (15 t() calls), `SurveyForm.tsx` (17), `QuickReplies.tsx` (4)
- [x] **Phase 0 — Foundation** (2026-05-28): migrations applied (`add_language_to_report_sections`, `add_translations_jsonb`); types regenerated; `scripts/i18n-glossary.json` + `scripts/i18n-sync.ts` created; `npm run i18n:sync` wired; dry-run confirms all 7 namespaces in sync.

### Pending ❌
- [x] **Phase 1 — Frontend completion (app surface only)** (2026-05-28): pricing utils, Pricing.tsx refactor, date locale fixes (DashboardV4:543, Profile:277), LanguageSwitcher hidden on /chat, i18n:sync ran (15 new Dutch translations). Switcher still disabled — Dutch unlocks when Phase 1.5 + 3 + 4 land. Profile language picker descoped (would force 40+ string Profile.tsx refactor).
- [x] **Phase 2 — Pipeline plumbing** (2026-05-28): all 8 edge functions deployed and language-aware. forward-to-n8n, forward-resume-to-n8n, chat-proxy, deliver-section, wrap-up-extract, generate-share-quotes, generate-cover-letter, generate-custom-resume all inject preferred_language. Boilerplate.ts has Dutch entries reviewed and approved. aiResumeParser prompt extended for Dutch CV conventions.
- [x] **Phase 1.5 — Landing components** (2026-05-28): 15 of 16 components language-aware. Hero, Pillars, HowItWorks, Methodology, CoachCards, ComparisonTable, CostMath, PricingSection, WhoFor, ForkDivider, FinalCTA, WhyWeBuiltThis, FAQ, LandingNav, LandingFooter, NoPurchaseBanner, WorkflowDiagramSimple all done. Dutch from Sjoerd's manual translation (`cairnly-homepage-copy-nl.md`) + FAQ written by hand. landing.json + common.json both extended (nav/trust/footer/workflowSimple namespaces added). **Deferred**: WorkflowDiagramV2 (27 short technical labels inside Methodology diagram) — visible but not high-priority, can ship after flip. Build passes. Switcher still disabled pending final flip-live gate.
- [ ] Phase 3 — Emails + static survey content (in progress)
  - [x] **Survey content** (2026-05-29): 60 questions + 7 sections translated to Dutch via `scripts/translate-survey.ts` (display-only; answer VALUES stay English so n8n + profiles.region are unaffected). `useSurvey.ts` + `QuestionRenderer.tsx` wired (choiceLabels EN→NL map). Casual-tone rule added to glossary. DB populated, build + deploy green. Follow-up: Skills/Achievements languages sub-card (languages_presets/proficiency_levels) not yet localized.
  - [ ] **Emails** — in progress (per-language COPY tables, lang from preferred_language)
    - [x] `send-confirmation-email` (signup confirm + password reset) — deployed 2026-05-29
    - [x] `send-reminder-email` (4 templates) — deployed 2026-05-29 (lang from cron payload or batched profiles lookup)
    - [x] `analysis-completed` (report-ready) — deployed 2026-05-29
    - [x] `payment-success` (access-code receipt + referral-unlock) — deployed 2026-05-29. Buyer's receipt language threaded through Stripe checkout metadata: `CheckoutForm.tsx` sends `preferredLanguage: i18n.language` → `create-checkout` writes `metadata.preferred_language` → `payment-success` reads it (fallback: country=Netherlands→nl, else en). Referral-unlock email goes to a *different* person (the referrer), so it uses THAT user's `profiles.preferred_language`, not the buyer's metadata. Tool names (Find Open Roles etc.) kept English in both langs to match the still-English dashboard toolkit; only prose + CTAs localized. Existing en em-dash in the unlock line replaced with a colon. All 3 files committed; both edge functions redeployed + smoke-tested (boot + validation paths green, no errors in logs).
    - [~] `journal-subscribe` / `journal-confirm` / `journal-unsubscribe` — **DESCOPED 2026-05-29 (per user): Journal stays English-only.** Standalone low-frequency English newsletter; subscriber is email-only (no profile/language). Localizing would require frontend to pass UI language on subscribe + a product decision on whether the Journal itself goes bilingual. Not doing it.
  - [ ] **Legal copy** — privacy / ToS / consent / cookie. **Awaiting NL copy from Sjoerd (2026-05-29):** he's writing the Dutch legal text himself; once delivered, implement in the landing/legal namespace.
- [ ] Phase 4 — n8n workflows (WF1–WF6 + WF_cover_letter + WF_custom_resume + Finding Selected Roles)
- [ ] Phase 5 — German validation (sanity check that architecture scales)

**REMOVED from plan (2026-05-28, per user)**: ~~Phase 5 — enriched_jobs lazy translation~~. Decision: skip. Career data stays in source language (English) in `enriched_jobs.translations`. n8n output already handles user-facing translation at generation time via the output-language instruction.

### Phase 1.5 — Landing components (deferred scope, NEW)
**Background**: Phase 1 audit revealed the landing page contains ~150-180 hardcoded strings across 15 components (`ComparisonTable`, `HowItWorks`, `Methodology`, `FAQ`, `CoachCards`, `LandingNav`, `Hero`, `Pillars`, `Methodology`, `WhoFor`, `WhyWeBuiltThis`, `PricingSection`, `FinalCTA`, `NoPurchaseBanner`, `CostMath`, `ForkDivider`, `LandingFooter`, `WorkflowDiagram*`). Original Phase 1 estimate (~50-70 strings, 1-2 sessions) was based on a less-developed landing page. Realistic time: 4-6 hours single-session OR ~2 hours with parallel subagents.

**Approach** (recommended): spawn 3-4 parallel subagents, each handling 3-4 landing components. Shared brief on namespace structure (extend `landing.json`), `<Trans>` component usage for inline JSX (`<strong>`, `<em>`, `<br>`), and key naming conventions. Main agent consolidates after, runs i18n:sync once.

**UX consideration**: when Phase 1 ships (app+chat Dutch, landing English), Dutch-switching users on the landing page see English. Options: (a) accept and rely on .nl domain → app deep link, (b) block Dutch on landing routes until Phase 1.5, (c) banner explaining mixed state. Decide at Phase 1 flip gate.

---

## Locked-in decisions
1. **Reports**: mixed strategy — native generation for narrative, translate-at-end for structured.
2. **Scope**: NL only for beta. Belgium added later without schema change.
3. **Language switcher**: locked on `/chat` route; available on dashboard/profile/landing.
4. **Legal copy**: AI-translated first, user-reviewed before flipping Dutch toggle.
5. **Dutch JSONs**: trust + light review (spot-check ~10 strings in Phase 1 verification).
6. **n8n autonomy** (critical):
   - **ADDING new nodes** → agent does freely, no approval needed.
   - **EDITING parameters of existing nodes** → ⛔ STOP, show before/after diff, get explicit per-node approval.
   - Always export workflow JSON to `n8n_aa/` BEFORE any change for rollback.

## Architecture (one-liner)
English-as-source-of-truth + AI propagation. Six layers: i18next UI strings; JSONB translations in DB; mixed-strategy AI reports; parameterized chat (one workflow, SOP addendums per language); language-aware edge functions; minimal tooling (one sync script + glossary).

---

## Phase 0 — Foundation
**Est. 1 session.** Scales to all future languages, done once.

### Inputs
- Read: `src/i18n.ts`, `package.json`, `supabase/migrations/` listing

### Steps
1. Create migration `supabase/migrations/<timestamp>_add_language_to_report_sections.sql`:
   ```sql
   ALTER TABLE public.report_sections ADD COLUMN language TEXT DEFAULT 'en';
   CREATE INDEX IF NOT EXISTS idx_report_sections_language ON public.report_sections(language);
   ```
2. Create migration `supabase/migrations/<timestamp>_add_translations_jsonb.sql`:
   ```sql
   ALTER TABLE public.questions ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;
   ALTER TABLE public.survey_sections ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;
   ALTER TABLE public.enriched_jobs ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;
   ```
3. Apply migrations (supabase MCP `apply_migration` — allowed without asking per CLAUDE.md since migrations are version-controlled).
4. Regenerate types: supabase MCP `generate_typescript_types` → updates `src/integrations/supabase/types.ts`.
5. Create `scripts/i18n-glossary.json`:
   ```json
   {
     "do_not_translate": ["Cairnly", "Atlas Assessments", "outside-the-box", "runner-up", "career card"],
     "preferred": {
       "en->nl": { "career": "loopbaan", "personality": "persoonlijkheid", "assessment": "assessment" }
     },
     "rules": {
       "nl": [
         "Use je-form (informal), never u",
         "Dutch number formatting: €39,00 not €39.00; €1.500 not €1,500",
         "Keep Markdown structure intact",
         "Date format: dd-mm-yyyy",
         "No em-dashes (—) — use commas, periods, colons, parentheses instead"
       ]
     }
   }
   ```
6. Create `scripts/i18n-sync.ts` (~100 lines): reads `public/locales/en/*.json`, diffs against target locale, calls Claude with glossary in system prompt, writes target locale files. Supports `--dry-run` flag. Use `@anthropic-ai/sdk`.
7. Add `package.json` script: `"i18n:sync": "tsx scripts/i18n-sync.ts"`.

### ⛔ Gate
Show user: (a) the two migration files, (b) the glossary, (c) the sync script. Confirm before proceeding to Phase 1.

### ✅ Verification
- Migrations applied; no errors.
- `npm run i18n:sync nl -- --dry-run` reports "all keys in sync" (Dutch JSONs already complete).
- Types file regenerated; no TypeScript errors.
- `report_sections`, `questions`, `survey_sections`, `enriched_jobs` all show the new columns in supabase MCP `list_tables`.

---

## Phase 1 — Frontend completion
**Est. 1–2 sessions.**

### Inputs
- Read: `src/components/Pricing.tsx`, `src/pages/Index.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Profile.tsx`, `src/components/LanguageSwitcher.tsx`, `src/i18n.ts`, `src/components/ReportSections.tsx`, all `public/locales/en/*.json`

### Steps
1. Create `src/lib/format.ts` with:
   ```ts
   export const formatDate = (date: Date | string, lang: string) =>
     new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-US', { dateStyle: 'medium' }).format(new Date(date));
   export const formatCurrency = (amount: number, lang: string) =>
     new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-US', { style: 'currency', currency: lang === 'nl' ? 'EUR' : 'USD' }).format(amount);
   ```
2. Create `src/lib/pricing.ts`:
   ```ts
   export const PRICING = {
     eur: { core: 39, premium: 79 },
     usd: { core: 39, premium: 79 },
   };
   export const getPricing = (lang: string) => PRICING[lang === 'nl' ? 'eur' : 'usd'];
   ```
3. Extract hardcoded strings in `src/components/Pricing.tsx` to `landing` namespace. Replace `€39` / `€79` literals with `formatCurrency(getPricing(i18n.language).core, i18n.language)`.
4. Extract hardcoded strings in `src/pages/Index.tsx` to `landing` namespace.
5. Replace `'en-US'` literal in `src/pages/Dashboard.tsx:259` with `formatDate(date, i18n.language)`.
6. Replace `'en-US'` literal in `src/components/ReportSections.tsx:108` with same.
7. Scan remaining components for hardcoded English-looking strings:
   ```bash
   grep -rn '"[A-Z][a-z][a-z ]*"' src/components src/pages | grep -v "import\|className\|//\|t(" 
   ```
   Extract any user-facing strings found. Focus on: `ChatContainer.tsx` (error toasts), `QuickReplies.tsx` (any remaining), `SurveyForm.tsx` (any remaining), top-level page components.
8. Add language picker to `src/pages/Profile.tsx` (reuse `useLanguage()`).
9. Hide `LanguageSwitcher` on `/chat` route: in `LanguageSwitcher.tsx`, add `useLocation()` check and return null if `pathname.startsWith('/chat')`.
10. Run `npm run i18n:sync nl` to translate any new keys added in steps 3–8. Human-review the diff.
11. Edit `src/i18n.ts`: change `supportedLngs: ['en']` → `supportedLngs: ['en', 'nl']`. Remove the force-English logic (lines 26–29).
12. Edit `src/components/LanguageSwitcher.tsx`: flip Dutch entry from `disabled: true` → `disabled: false`. Remove the "force English" override (line 26).

### ⛔ Gate
Before flipping the switcher (Steps 11–12), show user the list of newly-translated keys from Step 10.

### ✅ Verification
- `npm run dev`. Switch to Dutch via switcher.
- Walk through: landing, pricing, FAQ, signup, login, dashboard, profile.
- Browser console: zero "missing key" warnings.
- Spot-check 10 random Dutch strings — flag any that read awkwardly.
- Dates show Dutch format (`28 mei 2026`); prices use comma decimals (`€39,00`).
- Switcher hidden on `/chat`; visible everywhere else.

---

## Phase 2 — Pipeline plumbing
**Est. 2 sessions. THIS IS THE KEYSTONE — nothing downstream works without it.**

### Inputs
- Read: `supabase/functions/forward-to-n8n/index.ts`, `supabase/functions/forward-resume-to-n8n/index.ts`, `supabase/functions/deliver-section/index.ts`, `supabase/functions/deliver-section/boilerplate.ts`, `src/hooks/useN8nWebhook.ts`, `supabase/functions/wrap-up-extract/index.ts`, `supabase/functions/generate-share-quotes/index.ts`, `supabase/functions/clean-transcript/index.ts`, `supabase/functions/parse-resume-ai/index.ts`

### Steps
1. **`supabase/functions/forward-to-n8n/index.ts`**: after `userId` resolves, query `profiles.preferred_language`. Inject into outgoing `n8nData.preferred_language` (default `'en'` if null). ~5 lines.
2. **`supabase/functions/forward-resume-to-n8n/index.ts`**: same plumbing.
3. **`src/hooks/useN8nWebhook.ts`**: include `preferred_language` (from `i18n.language` or profile) in chat metadata payload sent to WF5.
4. **`supabase/functions/deliver-section/boilerplate.ts`**: convert `Record<SectionType, Boilerplate>` to `Record<Language, Record<SectionType, Boilerplate>>`. Generate Dutch entries via Claude with the i18n glossary loaded; human-review the 10 entries before checking in.
5. **`supabase/functions/deliver-section/index.ts`**: join on `reports.user_id` to fetch `preferred_language`. Pick boilerplate map by language with English fallback.
6. **AI prompt edge functions** — add `language` parameter (from request body or profile lookup) and append `"Write your final output in {{ language_name }}. Maintain Markdown. Brand terms (Cairnly, outside-the-box, runner-up) stay in English."` to system prompt:
   - `supabase/functions/wrap-up-extract/index.ts`
   - `supabase/functions/generate-share-quotes/index.ts`
   - `supabase/functions/clean-transcript/index.ts` (audit existing lang ref first — may already be partial)
7. **`supabase/functions/parse-resume-ai/index.ts`**: extend prompt to handle Dutch CV conventions — `dd-mm-yyyy` dates, `"Heden"` = `"Present"`, Dutch section headers (`Werkervaring`, `Opleiding`).
8. **`supabase/functions/generate-cover-letter/index.ts`** & **`supabase/functions/generate-custom-resume/index.ts`**: audit — if they route through `forward-to-n8n`, Step 1 handles them. If they call AI directly, apply Step 6 pattern.
9. Deploy modified edge functions via supabase MCP `deploy_edge_function` (per CLAUDE.md, NEW edge function deploys OK; re-deploys of existing functions need approval — so ⛔ gate here).

### ⛔ Gates
- After Steps 1–3 (the forward functions + chat metadata): show user the diff. Confirm before deploying.
- After Step 4 (boilerplate Dutch entries): show user the 10 Dutch entries for review.
- Before deploying any modified edge function (Step 9): list every function being deployed, confirm batch.

### ✅ Verification
- Create Dutch test account (or set existing test account's `preferred_language='nl'`).
- Submit survey. Check Supabase logs for `forward-to-n8n`: payload contains `preferred_language: "nl"`.
- Open chat. Verify boilerplate intros are Dutch (chat responses may still be English until WF5 updated in Phase 4 — that's expected).
- Trigger resume upload with Dutch CV. Verify parsed dates correct (`Heden` → present, `dd-mm-yyyy` parsed).
- Trigger `generate-share-quotes` (if surfacable) — verify Dutch output.

---

## Phase 3 — Emails + static survey content
**Est. 2 sessions.**

### Inputs
- Read all email-sending edge functions: `send-confirmation-email`, `send-reminder-email`, `payment-success`, `journal-subscribe`, `journal-confirm`, `journal-unsubscribe`, `analysis-completed`
- Query `questions` and `survey_sections` table contents via supabase MCP

### Steps
1. Create `supabase/functions/_shared/emails/` folder.
2. For each email function, externalize HTML to `_shared/emails/{name}.en.ts` and `_shared/emails/{name}.nl.ts`. Function reads language from `user.user_metadata.preferred_language` (signup-time emails) or `profiles.preferred_language` (later emails) and selects template.
   - `send-confirmation-email` → `confirmation.{en,nl}.ts`
   - `send-reminder-email` → `reminder.{en,nl}.ts`
   - `payment-success` → `payment-success.{en,nl}.ts`
   - `journal-subscribe` → `journal-subscribe.{en,nl}.ts`
   - `journal-confirm` → `journal-confirm.{en,nl}.ts`
   - `journal-unsubscribe` → `journal-unsubscribe.{en,nl}.ts`
   - `analysis-completed` → audit first (may be a redirect, not an email)
3. AI-translate each Dutch version using a one-off call to Claude with the i18n glossary + email-specific tone rules. Human-review.
4. **Survey translations**: write `scripts/translate-survey.ts` — reads all `questions` rows, sends label/help_text/choices to Claude with glossary, populates `translations->'nl'` JSONB. Same for `survey_sections`.
5. Update survey reading code (likely `src/components/survey/QuestionRenderer.tsx` and section header components) to coalesce: `question.translations?.[lang]?.label ?? question.label`.
6. **Legal copy** (privacy, ToS, consent, cookie banner): identify location (likely in `landing` or new `legal` namespace, or separate pages). If in JSON, run through `i18n-sync`. If in component literals or MDX, AI-translate via one-off Claude call.

### ⛔ Gates
- After each email's Dutch template: show user for review.
- After `translate-survey.ts` runs: show user 5 random translated questions for review.
- Before legal copy goes live: user signs off explicitly.

### ✅ Verification
- Sign up new Dutch user → confirmation email arrives in Dutch.
- Manually trigger reminder email for Dutch test user → arrives in Dutch.
- Re-take survey as Dutch user → questions and section headers in Dutch.
- Trigger payment success email → Dutch.
- View privacy/ToS pages in Dutch.

---

## Phase 4 — n8n workflows
**Est. 2–3 sessions. Most stop-gates.**

### n8n autonomy rule (re-stated for clarity)
- **ADDING new nodes** → agent does freely. No approval needed.
- **EDITING parameters of existing nodes** → ⛔ STOP. Show user before/after diff. Get explicit per-node approval before calling n8n API.
- Always export current workflow JSON to `n8n_aa/<workflow>_BEFORE_localization_<timestamp>.json` BEFORE any change.

### Prompt translation policy (clarified 2026-05-28, per user)
- **n8n LLM prompts STAY in English.** We do NOT translate prompt text into Dutch/German.
- Per-language behavior is achieved by ADDING an injector node that appends a single instruction to the system prompt: `"Write your final output in {{ language_name }}. Maintain Markdown structure. Brand terms (Cairnly, outside-the-box, runner-up) stay in English."`
- The LLM does the heavy lifting of translating its own output. The English prompt remains the canonical source.
- This means: only nodes whose **output reaches the user** need any change. Scoring nodes (numerical), data-fetch nodes, etc. are untouched.

### Inputs
- Read: `n8n_aa/SOP_new_Apr.txt`, all `n8n_aa/WF*.json`, MEMORY note `reference_job_search_workflow.md`

### Steps

#### 4.1 SOP addendum (no n8n calls)
- Create `n8n_aa/SOP_addendum_nl.txt` (~30 lines): Dutch-specific rules — je-form, number formatting (`€39,00`, `€1.500`), banned-word list overrides, currency rules, date format, no em-dashes.

#### 4.2 WF5 (Chat, `h7ie9zN080IM2g7N`)
- ADD: Code node at workflow start reading `language` from webhook input, loading SOP + addendum, concatenating, exposing as `$json.system_prompt`. ✅ no approval.
- ⛔ EDIT: existing LLM node's system prompt parameter → reference `{{ $json.system_prompt }}` instead of hardcoded text. **Approval needed (1 node).**

#### 4.3 WF1 (Profile Insert, `nupGvBByAGh4A9tL`)
- ADD: Code node before each LLM node, appends `"Write your final output in {{ language_name }}..."` to original prompt text, exposes as new field. ✅ no approval (2 new nodes).
- ⛔ EDIT: LLM nodes `initi summ prompt` and `instructions_perso_profile` → reference dynamic prompt field. **Approval needed (2 nodes).**
- ⛔ EDIT: Supabase insert node → also write `language` column. **Approval needed (1 node).**

#### 4.4 WF2 (Enrich 15, `vVv0tsnFlBnarMdq`)
- ADD: language param propagation node. ✅ no approval.
- Lazy translation logic deferred to Phase 5.

#### 4.5 WF3 (Scoring, `LJA5JPHvnqhA36Oh`)
- Scoring prompts stay English (produce numbers). No change to `cai_score_prompt`.
- ADD: language-instruction injector before `outside_box_prompt` LLM node. ✅ no approval.
- ⛔ EDIT: `outside_box_prompt` LLM node → reference dynamic prompt. **Approval needed (1 node).**

#### 4.6 WF4 (Content Gen, `pXlzC6vuG7TO28oQ`)
- ADD: language-instruction injector before `top_3_careers_prompt`. ✅ no approval.
- ⛔ EDIT: `top_3_careers_prompt` LLM node → reference dynamic prompt. **Approval needed (1 node).**
- ADD: new translation node after `runner_up_prompt` (translate-at-end pattern, structured JSON input/output). ✅ no approval.
- ADD: same translation node pattern after dream-jobs section. ✅ no approval.
- ⛔ EDIT: Supabase insert nodes → use translated content when language != 'en'. **Approval needed (~2 nodes).**

#### 4.7 WF6 (Feedback processing) — audit
- If LLM-based and user-facing: same pattern as WF1 (ADD injector, ⛔ EDIT LLM node).
- If pure data pipeline: ADD language passthrough only.

#### 4.8 WF_cover_letter (`M9w7xWeiPNmU7ZFb`)
- ADD: language-instruction injector before LLM node. ✅ no approval.
- ⛔ EDIT: LLM node → reference dynamic prompt. **Approval needed (1 node).**

#### 4.9 WF_custom_resume
- Same pattern as WF_cover_letter.

#### 4.10 Finding Selected Roles (`Bx0uNW4gnnXIGO8j`)
- Audit. Likely returns English job titles from external sources. ADD: language-aware result post-processing only if user-facing text emerges. Document findings in this plan.

### ⛔ Gates
- **Per-node approval** before every existing-node edit (see explicit ⛔ markers above; total ~10 nodes).
- Workflows stay **inactive** after edits. User activates manually in n8n UI.

### ✅ Verification
- End-to-end Dutch test:
  - Signup → survey → WF1 fires → `SELECT language, count(*) FROM report_sections WHERE user_id = '<test>' GROUP BY language;` shows `nl`
  - WF4 narrative sections in Dutch when read via dashboard
  - Chat replies in Dutch with je-form and €39,00 formatting
- Check n8n execution logs for each WF: `language` propagates through all nodes.

---

## ~~Phase 5 — `enriched_jobs` lazy translation~~ — REMOVED 2026-05-28

Per user decision: the `enriched_jobs.translations` JSONB column (added in Phase 0) stays in place for future use but no lazy-translation step will be built. n8n's per-call output-language instruction handles all user-facing translation at report-generation time, including career narrative — there's no need to pre-translate or cache the source `enriched_jobs` rows.

The migration column is harmless if unused; leave it for now.

---

## Phase 5 — German validation
**Est. 1 session. Sanity check, not launch.**

**Acceptance criterion: total elapsed engineering time ≤ 1 week.** If longer, the architecture has a leak — investigate before adding more languages.

### Steps
1. `npm run i18n:sync de` → human-review.
2. Create `n8n_aa/SOP_addendum_de.txt`.
3. Add German entries to all `_shared/emails/*.ts` and `deliver-section/boilerplate.ts`.
4. Edit `src/i18n.ts`: add `'de'` to `supportedLngs`.
5. Edit `src/components/LanguageSwitcher.tsx`: add German entry with `disabled: false`.

### ✅ Verification
- End-to-end German test passes the same checks as Phase 4.
- Log total elapsed time for retrospective.

---

## Risks (current)
1. **Dutch decimal/thousand separators** — handled by glossary + `format.ts`.
2. **Markdown preservation through translation** — translate-at-end uses structured JSON, not raw Markdown.
3. **Dutch CV parsing** — `parse-resume-ai` prompt extension in Phase 2.
4. **`enriched_jobs` salary fields likely US/UK-centric** — ⛔ open follow-up. Confirm `salary_europe_north_west` is reliably populated before Phase 5. If not, suppress salary specifics for NL users or add region-aware estimates.
5. **Legal/GDPR copy** — user reviews before flipping toggle (gate in Phase 3).
6. **Mid-session language switch** — disabled on `/chat` (Phase 1 Step 9).
7. **TTS Dutch quality** — `nova`/`fable` voices acceptable for beta; ElevenLabs deferred.
8. **n8n discipline** — explicit per-node approval gates in Phase 4 (~10 approvals total).
9. **WF6, WF_custom_resume, Finding Selected Roles** — added to Phase 4 scope after audit.
10. **7 email templates** (not 2 as in original strategy doc) — Phase 3 expanded.

---

## File path index

### Frontend
- `src/i18n.ts`, `src/hooks/useLanguage.ts`, `src/hooks/useAuth.tsx`, `src/hooks/useN8nWebhook.ts`
- `src/components/LanguageSwitcher.tsx`, `src/components/Pricing.tsx`, `src/components/ReportSections.tsx`
- `src/pages/Index.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Profile.tsx`
- `src/lib/pricing.ts` (new), `src/lib/format.ts` (new)
- `public/locales/{en,nl}/*.json`

### Scripts (new)
- `scripts/i18n-sync.ts`, `scripts/i18n-glossary.json`, `scripts/translate-survey.ts`

### Migrations (new)
- `supabase/migrations/<ts>_add_language_to_report_sections.sql`
- `supabase/migrations/<ts>_add_translations_jsonb.sql`

### Edge functions
- Plumbing: `forward-to-n8n`, `forward-resume-to-n8n`, `deliver-section`, `deliver-section/boilerplate.ts`
- AI prompts: `wrap-up-extract`, `generate-share-quotes`, `clean-transcript`, `parse-resume-ai`, `generate-cover-letter`, `generate-custom-resume`
- Emails: `send-confirmation-email`, `send-reminder-email`, `payment-success`, `journal-subscribe`, `journal-confirm`, `journal-unsubscribe`, `analysis-completed`
- New shared: `supabase/functions/_shared/emails/*.{en,nl}.ts`

### n8n
- `n8n_aa/SOP_new_Apr.txt` (unchanged), `n8n_aa/SOP_addendum_nl.txt` (new)
- WFs: WF1 (`nupGvBByAGh4A9tL`), WF2 (`vVv0tsnFlBnarMdq`), WF3 (`LJA5JPHvnqhA36Oh`), WF4 (`pXlzC6vuG7TO28oQ`), WF5 (`h7ie9zN080IM2g7N`), WF6 (feedback), WF_cover_letter (`M9w7xWeiPNmU7ZFb`), WF_custom_resume, Finding Selected Roles (`Bx0uNW4gnnXIGO8j`)
