# Cairnly Pensioner Flavor: Build Handoff

**Date:** 2026-07-06
**For:** a fresh Claude Code session (this doc is self-contained; read it fully before touching anything)
**Goal:** build a third Cairnly flavor for pensioners / pre-retirees, using the exact same architecture as the Starter flavor shipped on 2026-07-05. Different questions, different prompting, different marketing, same structure and pipeline shape.

---

## 0. DECISIONS UPDATE (Sjoerd, 2026-07-06, later same day) — these override anything below

1. **Flavor name: "Encore"** — already partially wired in code: `EntryFlavor 'encore'` in `DashboardEntryState.tsx`, `ENCORE_SURVEY_ID`/`ENCORE_SURVEY_TYPE` imported in `Dashboard.tsx` (check `src/components/assessment/constants.ts` for the exact values another session added). Check current git state before creating anything; a parallel session has started this build.
2. **Intake style confirmed by Sjoerd: static structured survey, "calm and clear."** No conversational/chat intake for this flavor. Forms are the right UX for this audience; keep the one-question-at-a-time flow with the bigger-type accessibility treatment from section 2.3.
3. Resume upload (skip vs flavor-aware mapper) and final question count remain OPEN decisions — see section 3. (An earlier version of this section attributed "no resume upload" and "~25 questions" decisions to this flavor by mistake; those remarks were about Starter.)

---

## 1. The product idea (from Sjoerd, 2026-07-06)

The other side of the age spectrum from Starter, and an equally sharp niche:

- **Audience:** people at or approaching retirement asking "what would fit me in this stage of my life." Not necessarily full-time work: encore careers, part-time, advisory/board roles, volunteering with substance, passion projects, phased retirement.
- **High net worth:** price sensitivity is LOW. This audience can pay more than EUR 39; pricing is an open decision but do not assume the starter/pro price point is right. Money is not the constraint; meaning, structure, identity, and relevance are.
- **Less tech savvy:** UX must be more forgiving. Sjoerd explicitly mentioned bigger fonts (half joking, fully right). Think: larger base type on flavor routes, generous hit targets, less simultaneous UI, very clear next-step affordances. Do NOT redesign the design system; scale it.
- **English only for v1** (same as Starter).
- **Same main goal:** an honest assessment → personality + direction report → coach chat. Preserve the honesty-first brand: no "60 is the new 40" fluff, no condescension, no denial about ageism or energy realities.

### What is fundamentally different about this group (mirror of the Starter analysis)
1. **Identity loss, not identity search.** A starter has no professional identity yet; a pensioner is losing one that defined them for 40 years. The assessment must honor the career they had (rich evidence!) while asking what they want NOW. The pro survey's career-history machinery is actually relevant again for this flavor, unlike Starter.
2. **The constraint set is inverted.** Starters optimize for getting in (money needed, learning appetite high, timeline urgent). Pensioners optimize for fit with life (energy, health, family, travel, how many hours they actually want, what they refuse to do ever again). Practical-reality questions should be about hours/energy/commitments, not salary vs learning.
3. **They do not need a job; they need a reason.** Purpose, contribution, staying sharp, social fabric. Directions should include non-employment forms: advisory, board seats, mentoring, teaching, volunteering, small business, portfolio life. The scoring workflows must not assume "job = full-time employment."
4. **Buyer = user, and the buyer is rich but skeptical.** Unlike Starter (parents buy), pensioners buy for themselves, but adult children may also gift it ("dad is retiring and lost"). Trust signals matter more than price: legitimacy, privacy, no-subscription clarity, phone-a-human support visibility.
5. **AI angle flips.** Starters fear AI eats their entry; pensioners fear irrelevance ("the world moved on"). The report should frame AI as leverage (what their judgment + experience is worth in an AI world), honestly.

### Marketing sketch (park it in a marketing handoff later, same as Starter got)
- Channels: their adult kids (via the pro audience again), financial advisors / pension funds / wealth managers (institutions with client-relationship budgets), 50+ member organizations, print-adjacent digital (newsletters), LinkedIn for the pre-retirement executive segment.
- Moments: retirement date announcements, 60th/65th birthdays, "first Monday after the farewell reception."
- Tone: respectful, direct, zero patronizing. They can smell condescension faster than any other segment.

---

## 2. The proven recipe (this is exactly how Starter was built; follow it)

Read these first, in the repo:
- `docs/superpowers/specs/2026-07-05-starter-flavor-design.md` — the architecture pattern (approaches considered, isolation constraints, review gates)
- `docs/superpowers/plans/2026-07-05-starter-flavor.md` — the task breakdown that worked
- Project memory `project_starter_flavor.md` — current state + all IDs

### 2.1 Architecture (identical shape, third instance)
Everything is additive. The platform steers flavors through ONE mechanism: `access_codes.survey_type` → `SURVEY_TYPE_MAPPING` (in `src/components/assessment/constants.ts`) → `survey_id` → questions load from DB. Downstream (reports, report_sections, chat, dashboard) is generic on report_id + section_type.

Reserved identifiers for this flavor (use exactly these to avoid collisions):
- Survey id: `00000000-0000-0000-0000-000000000003`
- Survey type string: decide the flavor name first (see open decisions), format: `<Name> - Encore Stage - 2026 v1 EN` style
- Question UUID scheme: `b2b2b2b2-000S-4000-a000-0000000000NN` (S = section 1-7, NN = question number; Starter used `a1a1a1a1-…`, pro uses `11111111…`-`77777777…`. Never reuse either.)
- Section UUIDs: `b2b2b2b2-0000-4000-a000-00000000000S`

### 2.2 The seams to touch (complete list from the Starter build)
1. **DB migration** in `supabase/migrations/` (surveys + survey_sections + questions rows, `ON CONFLICT DO NOTHING`), applied individually via Supabase MCP `apply_migration`. NEVER `supabase db push` (migration history mismatch, see memory). Verify per-survey question counts afterward; pro (60) and starter (40) must be unchanged.
2. **`src/components/assessment/constants.ts`**: add mapping entry + `PENSIONER_SURVEY_ID` (or flavor name) constants.
3. **`src/components/survey/hooks/useSurveySubmission.ts`**: the `REGION_QUESTION_IDS` array needs the new flavor's region question id appended (profile.region update).
4. **`src/pages/Assessment.tsx`**: decide whether to skip the CV-upload step. NOTE: unlike Starter, pensioners HAVE CVs and the pre-fill is valuable, BUT `src/components/resume/utils/resumeDataMapper.ts` is hardwired to PRO question ids. Either (a) skip upload like Starter (simplest), or (b) build a flavor-aware mapper (better UX for this audience; small, contained change). Recommend (b) if the survey keeps analogous intake fields.
5. **Landing page**: new route `/<flavor>` + `src/pages/<flavor>/…Index.tsx` + `src/components/<flavor>/` sections + `public/locales/en/<flavor>.json` (copy NL file as EN duplicate so HTTP backend never 404s) + namespace in `src/i18n.ts` ns array + lazy routes in `src/App.tsx` above the catch-all. Reuse `LandingNav variant="page"`, `LandingFooter`, `Reveal`, `lp-*` classes, existing palette ONLY (all tokens live across `src/components/landing/*.tsx` + `landing.css`). font-weight ≤ 700. NO em-dashes in any user-facing copy (global rule).
6. **Payment**: `/​<flavor>/payment` page wrapping `CheckoutForm flavor="<flavor>"`. `CheckoutForm` already has a `flavor` prop ('pro' | 'starter'); extend the union. `supabase/functions/create-checkout/index.ts` sanitizes flavor and puts it in Stripe `metadata.flavor` (extend the accepted literals + product_data name/description + cancel_url branch). `supabase/functions/payment-success/index.ts` maps `session.metadata?.flavor` → survey_type when minting the access code (extend the ternary; unknown/absent always falls back to pro). **Pricing:** if this flavor gets a different price, `unit_amount` in create-checkout is currently a hardcoded 3900; it will need a per-flavor amount, and `src/lib/pricing.ts` + the landing pricing section must agree.
7. **`supabase/functions/forward-to-n8n/index.ts`**: extend the webhook selection. Pattern in place: starter survey_id → `N8N_STARTER_WEBHOOK_URL`, missing secret = explicit failure (never fall back to pro; wrong question ids would poison the pro workflows). Add `N8N_PENSIONER_WEBHOOK_URL` (or flavor name) the same way. Consider refactoring the if-chain into a survey_id → env-var map now that there are three.
8. **`src/components/dashboard/v2/DashboardEntryState.tsx` + `src/pages/Dashboard.tsx`**: currently flavor-aware via an `isStarter` boolean (survey_type from the verified access code, with draftSurveyId + savedSession fallbacks). With a third flavor, REFACTOR to a `flavor: 'pro' | 'starter' | '<name>'` prop with per-flavor section lists, eyebrow timing, sub copy, and ghost cards. Also `src/components/survey/AssessmentWelcome.tsx` was made flavor-neutral already; keep it neutral.
9. **n8n chain**: duplicate the LIVE pro WF1-WF4 (ids in project CLAUDE.md), NOT the starter ones (pensioner evidence is closer to pro's career-history analysis; prompts need a different lens, not a different data shape). Recipe that worked:
   - GET each workflow via API, save pristine export to `n8n_wfs_cairnly/WF<N>_pristine_<date>.json`
   - Generate 4 fresh webhook-path UUIDs upfront (chain: Supabase → WF1P → WF2P → WF3P → WF4P)
   - One subagent per workflow with a shared reference file containing: product context, full question list with UUIDs, pro→new question mapping, chain paths, output contract. Subagents write `WF<N>P_create_body_<date>.json` with EXACTLY `{name, nodes, connections, settings}`; strip `binaryMode`, `timeSavedMode`, `availableInMCP` from settings (the API 400s on extras); keep `callerPolicy` + `errorWorkflow: FbsruPbuZI2Fgtc8`.
   - Gotchas found last time: the pro chain uses executeWorkflow/executeWorkflowTrigger between workflows; convert to webhook-in (POST) / httpRequest-out, and make downstream nodes read `$json.body.*` (webhook payloads nest under body). WF3 must insert `outside_box` LAST (frontend polls for it). WF4 must keep the `move` metadata labels (Ready now/Reframe/Upskill/Retrain) so dashboard pills render; redefine their CONTENT for this audience (e.g. readiness for an encore move). WF4's terminal `analysis-completed` edge-function call stays byte-identical.
   - Mechanically validate before POSTing: key set, webhook paths, outbound URLs, no dangling `$('Node')` refs, no pro/starter question ids, connections integrity. Then POST via API (creates INACTIVE), save created exports, commit everything.
   - **Policy:** present the per-workflow plan in chat before API calls; leave workflows INACTIVE; Sjoerd reviews prompts in the n8n editor and activates himself. Never PUT/modify existing workflows.
10. **Verification:** `npm run build` green; `git status --porcelain | grep '^??'` clean under src/; em-dash grep over locale JSON + migration; preview-walk the landing + payment routes; confirm pro AND starter routes unaffected; push to main (auto-deploys Vercel + edge functions via GitHub Action); confirm `vercel ls` shows Ready.

### 2.3 Accessibility for this flavor (new work, not in Starter)
- Bigger type on flavor routes only: cleanest is a wrapper class on the flavor's pages (e.g. `text-[17px] md:text-lg` baseline bumps or a `.flavor-lg` scope in index.css that raises font sizes ~10-15%) rather than touching the shared components. The SURVEY is shared, so consider a flavor-conditional class on `AssessmentLayout` driven by survey id: larger question text, larger touch targets. Keep it a scale, not a redesign.
- Fewer things at once: the survey already shows one question at a time; good. Landing page: shorter sections, fewer of them, high contrast, no reliance on hover.
- Make support contact visible on every step (this audience calls before they retry).

### 2.4 Survey content direction (draft for the spec; ~35-40 questions, 7 sections to keep the dashboard checklist pattern)
1. **Getting to know you**: name, age, region (SAME 10 region choices as pro/starter), current status (working & planning retirement / recently retired / retired a while / semi-retired), when the transition happens/happened, household context (free text, optional).
2. **The career you had**: what they did (career_history-style; pro question types like career_history CAN be reused since QuestionRenderer supports them and this flavor's n8n chain will be prompted for them; alternatively a simpler long_text "the short version of your career"), what they were known for, what they will NOT miss, what they secretly loved.
3. **How you operate now**: energy patterns, structure vs freedom at this stage, learning appetite, working with younger generations, feedback/ego honesty.
4. **What matters now**: ranking adapted (Purpose & contribution / Staying sharp / Social connection / Structure & routine / Recognition & being valued / Income top-up / Freedom to travel & family time / Enjoyment of the work itself), what a "good year" looks like, what they fear about this stage (relevance, boredom, identity), how they feel about the pace of tech/AI.
5. **Where you thrive**: hours per week they actually want, remote vs in-person (social component matters!), leading vs contributing vs advising, environments they are done with.
6. **Practical reality**: income need honesty (none / nice-to-have / needed), mobility, commitments (grandkids, care duties, travel plans), timeline, appetite for formal responsibility (boards carry liability).
7. **Looking ahead**: what "meaningful" concretely means to them, the thing they always wanted to try, what they want Cairnly to tell them straight, anything else.
Question types: stick to verified renderer types (short_text, long_text, number, dropdown, multiple_choice ± multi, ranking, interests_hobbies; career_history/career_happiness/skills_achievements exist too and are safe if section 2 uses them, but note `useSurveySubmission.ts` has a pro-specific skills sanitizer keyed to the PRO question id only, which is fine).

### 2.5 n8n prompt lens (for the duplication subagents)
- WF1P personality: evidence is a full career + self-report; analyze without assuming they want to climb; identity-transition aware.
- WF2P enrich 15: candidate "directions" must span employment AND non-employment forms (advisory, interim, board, mentoring, teaching, volunteering-with-substance, portfolio/passion business). AI-impact framed as leverage for judgment/experience.
- WF3P scoring: weigh energy/hours fit, purpose alignment, social component, dignity (no "greeter" style filler), NOT career progression or learnability-for-entry. Keep outside_box last.
- WF4P narratives: what the move looks like at their hours, how to enter at their seniority (networks, alumni, board registries), first 90 days, honest ageism note where relevant, `move` labels repurposed as encore-readiness.

---

## 3. Open decisions for Sjoerd (ask before building, or flag prominently)
1. ~~Flavor name + URL~~ **DECIDED: Encore** (route `/encore`; see section 0).
2. **Pricing.** High-net-worth audience; EUR 39 may undersell it. If different: create-checkout unit_amount per flavor + pricing.ts + landing copy. STILL OPEN.
3. **CV upload:** skip (Starter pattern) or build the flavor-aware resume mapper (better UX for people with 40-year CVs). STILL OPEN.
4. **Section-2 depth:** full career_history widget vs lighter free-text career summary. Widget = richer n8n input, heavier UX for less tech-savvy users. STILL OPEN; also depends on the final question count.
5. **Chat coach (WF5) tone:** shared for v1 (as Starter did) or a duplicated encore-tone coach. Recommend shared for v1, fast-follow.

## 4. Hard guardrails (unchanged from Starter)
- Zero interference with pro AND starter: only new rows/routes/workflows; never touch existing question rows, workflows, or secrets.
- New n8n workflows created INACTIVE; activation is Sjoerd's action. Export everything to `n8n_wfs_cairnly/`.
- Migrations as version-controlled files applied individually via MCP.
- Honesty: no fabricated statistics, no condescension, hard truths included (ageism, energy, board liability). No em-dashes in user-facing copy. font-weight ≤ 700.
- Commit to main + push (auto-deploy); rebase on rejection (concurrent sessions move main).

## 5. Launch checklist template (mirror Starter's)
1. Sjoerd reviews survey copy. 2. Reviews + activates WF1P-WF4P. 3. Sets `N8N_<FLAVOR>_WEBHOOK_URL` secret (value = WF1P webhook URL). 4. Pricing confirmed. 5. One end-to-end smoke test with a test access code. Do not market the URL before 1-5 are done.
