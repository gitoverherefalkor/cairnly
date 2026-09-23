# Cairnly — Decision Point Evidence Inventory

Repo: `/Users/sjoerdgeurts/Documents/Code Projects/Cairnly` (main, read-only pass). All paths below are relative to this repo root unless stated otherwise. This document reports facts only; it does not recommend where any external model should be used.

## Product in 12 lines

1. Cairnly (internal/legacy name "Atlas Assessments", CLAUDE.md:3) is a career-path-clarity web app: a survey-in, PDF-report-out product for professionals aged 18-55.
2. The user fills in a long multi-section survey (personal background, career history + happiness-per-role "sentiment log", values, preferences, interests, goals) — schema lives in `n8n_wfs_cairnly/WF1 - Profile Insert EN_NL.json`'s "Process Survey Data1" code node (`SURVEY_SCHEMA`, IDs `1a`…`7f`).
3. The pipeline (n8n, see below) turns that survey into a personality profile, 15 candidate careers, scores/ranks them, and writes a multi-chapter report: personality (approach/strengths/development/values), executive summary, top-3 careers, runner-up careers, "outside-the-box" pivots, and (if stated) dream-job feasibility analyses — structure locked in `docs/report/REPORT-OUTLINE.md:1-40`.
4. Each recommended career carries three visible "pills": **Match** (compatibility score), **AI Impact** (5-level), **Move** (4-level reskilling effort) — rendered in `src/components/chat/CareerScoreCard.tsx:209-343` and `src/components/dashboard/v2/ShareCardModal.tsx`.
5. After the report, the user can chat with an AI "Coach" (WF5) that can pull profile data, search the web, and trigger report edits (WF6) as a tool call.
6. The user can dismiss/"set aside" a career with a reason code (`dismissed_careers` table) and give structured chapter feedback (`submit-chapter-feedback`).
7. Paid add-ons exist: a tailored custom resume (WF9), a resume "strengthen" critique tool (WF10), AI-generated cover letters (WFX), and a LinkedIn job search matched to the chosen career (WF8).
8. Pricing is a flat one-time fee, not a subscription, and differs by flavor (from project notes, `project_homepage_flat_59_cleanup.md`, `project_starter_flavor.md`, `project_encore_flavor.md`; not independently re-verified against Stripe code in this pass): Pro €59, Starter €39, Encore €79. The partner/white-label channel is priced separately, per credit, €20-44 across six volume tiers, invoiced manually (`project_partner_marketing_pages.md`).
9. A white-label/partner channel exists: re-integration/outplacement bureaus ("spoor 2" in Dutch labour-market terms) get co-branded reports for their candidates (`src/pages/partners`, `supabase/functions/partner-public`).
10. Sjoerd also runs a separate cold-outreach operation (WF11/WF12) emailing these bureaus in Dutch to sell the pilot/partnership, independent of the end-user product.
11. Language: all AI-generated report content is produced in canonical English and translated at the boundary for display (`translate-section` edge function; "language contract", confirmed in code comments, e.g. `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json` "Parse OOB" node: `const __lang = 'en'; // language contract: canonical content is always English; translate-section adds translations`). Outreach mail is Dutch-only.
12. Stack: React/TS/Vite frontend + Supabase (Postgres/Auth/Storage/Edge Functions) + n8n for the AI pipeline (CLAUDE.md:10-16), consistent with what this pass observed.

---

## How the pipeline fits together (for orientation before the DP list)

`n8n_wfs_cairnly/*.json` node counts confirmed directly (`jq '.nodes|length'`): WF0=10, WF1=14, WF2=30, WF3=34, WF4=26, WF5=7, WF6=37, WF7=10, WF8=14, WF9=21, WF10=16, WF11=10, WF12=7, WFX=8, Global Error Handler=7.

Flow: WF0 (resume→profile prefill, optional) → WF1 (survey→personality profile + fact sheet) → WF2 (generate 15 candidate careers, enrich, score AI-impact & salary) → WF3 (score all 15, rank, generate "outside-the-box" pivots) → WF4 (write top-3/runner-up/dream-job narrative content) → user reads report → WF5 (coach chat) ⇄ WF6 (feedback-driven section regeneration) → WF7 (exec summary) on demand. WF8/WF9/WF10/WFX are on-demand tools triggered from the dashboard. WF11/WF12 are a separate operational pipeline (Sjoerd's own cold outreach), not part of the end-user product.

---

## DP-1: 15-career generation ("suitable_15")

- Where: `n8n_wfs_cairnly/WF2 - Source to Enrich 15.json` — node `suitable_15` (type `@n8n/n8n-nodes-langchain.chainLlm`); prompt built in node `Set Suitable 15 Prompt1`.
- Trigger / when: WF2 runs as a sub-workflow called from WF1 after profile insert (background, not directly user-blocking).
- Who waits: background (fire-and-forget pattern per CLAUDE.md:1-16 conventions observed elsewhere; report is polled/shown once ready via `ReportProcessing.tsx`).
- Decision type: generate-text producing a **choose/generate list of 15** (not a selection from a fixed list — see "career universe" below).
- Options / label set: not a fixed list. Output is 15 freeform-but-constrained career titles, each tagged `path_type` ∈ {employee, freelance_fractional, founder} and `company_size_type` from a fixed 6×8 size/culture grid (`Set Suitable 15 Prompt1` value, "Company Size/Culture Format" section).
- Input state: full survey fact sheet + 4-section personality narrative (Approach/Strengths/Development/Values). English, one user's data (~1-3k words typical based on section count).
- Current implementation: LLM generation. Model confirmed via the workflow's `connections` graph: **`gpt-5.5`** via node "OpenAI Chat Model" (`n8n_wfs_cairnly/WF2 - Source to Enrich 15.json:626`), `retryOnFail:true`. This is the only OpenAI node found anywhere across all 15 workflows in this pass — i.e. the single highest-leverage generative step in the whole pipeline (it defines the entire candidate pool every other decision point operates on) is also the one step not on Anthropic or Google.
- Prompt core (verbatim, from `Set Suitable 15 Prompt1`): "You are Cairnly, creating personalized career insights... Atlas is built for candidates exploring change, clarity, or new direction, not advancement within an existing track." / hard rule: "Founder-path ceiling (anti-flood): At most 2 of the 15 careers may be `founder` path_type... keep a floor of at least 1 when a genuine signal is present."
- Output format + validation: JSON object `{pattern_analysis_summary, careers[15], generation_metadata}`; downstream code (`15TitSizAISal1`) re-parses via regex-extracted ```json block and fuzzy title-matches back onto this list — no schema-level (e.g. structured-output-parser) enforcement observed, just regex JSON extraction.
- Confidence/thresholds/post-processing: "Founder-path ceiling" is enforced only by prompt instruction, not by code (no code-level count/cap found on `path_type==='founder'` in this workflow). Founder gating source signal is survey question 7f: `"Not for me" = HARD OPT-OUT: suggest NO founder paths"` (same node).
- Human correction: none direct at this step; downstream the user can dismiss any resulting career (see DP "dismissed_careers" below).
- Volume: 1 LLM call generating 15 careers per report (from code).
- Known problems: the prompt's own internal framing says "Then: Rigorous 0-100 scoring across 7 dimensions... Finally: Top 8 careers selected for candidate" — this does not match the actually-implemented pipeline (WF3 scores on a 64+44-point combined scale via two LLM steps, not "0-100 direct"; WF4 selects top 3 + up to 3 runner-ups, not "top 8"). Stale internal documentation inside a live prompt, not fixed in this pass.

### Career universe — direct finding (high confidence, cross-checked twice)
No fixed career taxonomy/catalog table exists in the schema. Checked two independent ways: (1) `grep`-ing all 117 files in `supabase/migrations/*.sql` for `CREATE TABLE` found no `career_taxonomy`/`career_catalog`/`career_list` table; (2) every `CREATE TABLE` statement across the full migration history was enumerated (32 application tables total) and none is a careers/occupations reference table — `custom_resumes.career_title` and `dismissed_careers.career_title` are both plain `TEXT`, not foreign keys into any lookup table. Careers are generated fresh per user by the `suitable_15` LLM call (`gpt-5.5`, DP-1), constrained only by prompt rules (no past-role duplication, no dealbreaker violations, a fixed size/culture-string grid, an optional hours-ceiling filter, and a "searchability test" — "if the exact title would return real job ads, keep it"). This is a **generate**, not a **choose-from-list**, decision. **Caveat**: `enriched_jobs` (the table that actually holds each report's per-career rows) has no `CREATE TABLE` statement anywhere in the tracked migration history — it predates the tracked migrations folder, consistent with the documented Lovable-scaffolded-then-git-tracked history (`project_migration_history_mismatch.md`). Every column reference to it found in this pass (edge functions, WF2/WF3/WF4 prompts) is consistent with free-text career data and none references a lookup table, but its original `CREATE TABLE` statement itself was not directly inspected.

### Pool survival, precisely (WF2 → WF3 → WF4)
WF2 writes up to 15 AI-generated careers to `enriched_jobs`. WF3's `Pull enriched` node pulls all of them unfiltered. All ~15 are scored twice by the 0-108-point system (DP-6 Step 1, DP-8 Step 2). `Ranking` (DP-9) then keeps exactly 3 as top picks (never empty, positionally reassigned by WF4 without re-sorting — see DP-11's known bug) and up to 3 as runner-ups (≥55 threshold, backfilled/stretch-swapped) — **careers ranked 11th or lower, or scoring below 55 after the top 10, are discarded outright** regardless of how close to 55 they were (`Ranking`'s own `discarded_reason` string: "ranked 11+ or scoring below 55... excluded"). Outside-the-box (exactly 3, DP-10) and dream jobs (0-3, DP-13) are generated **entirely outside this scored pool** — OOB is fresh LLM generation constrained only to avoid overlap with the already-presented set, and dream jobs come solely from the candidate's own stated survey answers, never scored on the 0-108 scale at all. Net: a finished report can carry up to 12 career sections, of which **only 6 (top-3 + runner-ups) ever passed through the numeric scoring/ranking system** — the other up to 6 (OOB + dream jobs) are unranked, unscored-in-the-64/108-point sense, generative picks.

## DP-2: AI-Impact scoring (5-level)

- Where: `n8n_wfs_cairnly/WF2 - Source to Enrich 15.json` — node `ai_impact1` (`@n8n/n8n-nodes-langchain.chainLlm`); prompt in `Set AI Impact Prompt1`.
- Trigger / when: runs on all 15 generated careers, after `suitable_15`, same WF2 background run.
- Who waits: background.
- Decision type: score (5-level described scale, one label per career — this is close to Jev's "Score" question shape: fixed level count with fixed descriptions).
- Options / label set (exact, verbatim from prompt): **Minimal, Moderate, High, Severe, Critical** — each with a one-sentence description and example roles in the prompt, e.g. "**Critical**: Pivot needed. The core deliverables are fully automatable by agentic AI today... Think: data entry, basic customer support, routine translation."
- Input state: the 15 career titles + `Fetch AI Research1` (an `httpRequest` node — external labor-market research fetched and injected as grounding, i.e., RAG-style context) + a fixed "Agentic AI Trajectory (2026-2028)" framing paragraph.
- Current implementation: **`claude-sonnet-5`** via node "Anthropic Chat Model1" (`WF2 - Source to Enrich 15.json:695`, default params, `retryOnFail:true`), confirmed via the connections graph. Grounded on `Fetch AI Research1` (httpRequest) pulling the latest row of an `ai_research.key_findings` table — one shared research snapshot reused across all users, not per-user retrieval.
- Prompt core (verbatim): "1. Physical Rule: If the role requires physical presence or dexterity... rate as Minimal. 2. Orchestrator Rule: If the title implies strategic accountability... rate as Moderate... 3. Execution Rule: If the role's primary output is content, analysis, code, or data processing that AI can generate at comparable or higher quality, rate as Severe or Critical."
- Output format + validation: freeform text per career (`Career Title: ... / AI Impact: [Rating] - [sentence]`), parsed by downstream code node `15TitSizAISal1` which reads `item.ai_impact_rating.rating`; the SAME exact 5-word label set is re-asserted as a hard constraint in every downstream prose-generation prompt (WF3's OOB prompt, WF4's Top-3/Runner-up/Dream prompts all repeat: "The rating word you print MUST be exactly one of: Minimal, Moderate, High, Severe, Critical... the platform parses this exact word into a fixed badge, so any other word makes the badge and your text disagree").
- Confidence/thresholds/post-processing: no numeric confidence; label is carried through as a string and re-displayed verbatim by later generation steps and by `src/lib/enumLabels.ts:14-21` (`AI_IMPACT_LABEL`, `AI_IMPACT_MEANING_I18N`) for the NL UI.
- Human correction: none — this value is never user-editable in this pass's scope.
- Volume: 1 LLM call scoring all 15 careers together (from code, single `ai_impact1` node call per report).
- Known problems: label/prose can silently disagree if the writer model in a later step doesn't reproduce the exact word (explicitly called out as a risk in the prompt text itself, repeated 4 times across WF2-WF4 prompts — a strong signal this has broken before).

## DP-3: Salary range estimation + currency lock

- Where: `n8n_wfs_cairnly/WF2 - Source to Enrich 15.json` — node `Salary Range1` (chainLlm) for the estimate; node `Extract Region (code)` (`n8n-nodes-base.code`) for the currency decision.
- Decision type: **extract-value/generate** (salary estimate, LLM) gated by a **route** decision (currency, pure code).
- Options / label set (currency route, exact list from code): region ∈ {Northern and Western Europe, Southern and Eastern Europe, United Kingdom (London), United Kingdom (Other), United States (High-Cost/Average-Cost/Lower-Cost Regions), Canada, Australia and New Zealand, Switzerland} → deterministic `CURRENCY_BY_REGION` map to {EUR, GBP, USD, CAD, AUD, CHF}.
- Current implementation: `Extract Region (code)` is explicitly **not** an LLM call — comment in the node: "Extract region from init_summary without LLM call... Deterministic region -> currency map (no LLM guessing). The salary LLM downstream is HANDED this currency, so it can never drift to USD on its own." This is a **latent decision**, not AI.
- Prompt core (Salary Range1, verbatim opening): "!!! CURRENCY LOCK - HIGHEST PRIORITY, OVERRIDES EVERYTHING BELOW !!! The candidate's region and currency have ALREADY been decided in code. Do NOT choose, infer, or convert a currency yourself."
- Known problems: project memory `project_wf2_currency_lock.md` records this was built as a fix after WF2 priced EU users' salaries in USD (44% of `enriched_jobs.salary` rows mislabeled USD against a ~92%-non-US user base); "8 old reports still USD" (unresolved backfill, per memory note). The lock was not sufficient on its own: a later enrichment call ("Enrich B", see DP-1's sibling enrichment step) is told to copy salary/AI-impact verbatim from this step's output but was found to re-price in USD/"North America" anyway despite the instruction being repeated three times in its prompt — patched by a **second, deterministic correction layer**, code node `clean up JSON1` (`WF2 - Source to Enrich 15.json:344`), which rebuilds a title(+size)-keyed lookup from this step's known-good salary and overwrites Enrich B's output with it (ambiguous same-title-different-size collisions are left as `null` rather than guessed). The same node also pads any under-length array field (`technical_skills`, `soft_skills`, `core_values`, `motivational_factors` to min 3; `typical_tasks` to min 4) with literal `"N/A"` placeholders before insert — i.e. a second layer of deterministic code exists specifically to catch an LLM step not following its own instructions.

## DP-4: Founder/entrepreneurship anti-flood gating

- Where: prompt-level rule inside `Set Suitable 15 Prompt1` (WF2) and again inside `Set Outside Box Prompt` (WF3, see DP-10) — no dedicated code-level counter found for the WF2 side in this pass.
- Decision type: route/filter (which careers may be tagged `founder`).
- Options / label set: `path_type` ∈ {employee, freelance_fractional, founder}, gated by survey question 7f ∈ {"Not for me" (hard opt-out), "Curious... not actively planning" (latent/secondary), "Interested and seriously considering it" / "I already run... my own business" (clear go-ahead)}.
- Current implementation: prompt-instructed cap ("at most 2 of the 15"), not code-enforced in WF2 (contrast with WF3/WF4's OOB founder cap, which is also prompt-only: "at most 1 of the 3 may be a founder path").
- Known problems: entirely prompt-enforced, no code-level guard found — a model that ignores the instruction would not be caught mechanically in this part of the pipeline.

## DP-5: Career-title deduping / merge back into enriched record

- Where: `n8n_wfs_cairnly/WF2 - Source to Enrich 15.json` — node `15TitSizAISal1` (`n8n-nodes-base.code`).
- Decision type: match-two-entities (fuzzy title+size match) — heuristic, not AI.
- Current implementation: `normalizeKey()` (lowercase, strip punctuation, collapse whitespace) then match by `title||size` key, fall back to title-only, fall back to positional index if array lengths align. Pure string-normalization heuristic.
- Known problems: positional fallback ("if the array lengths align") is a silent-failure risk if the LLM ever reorders or drops an item without the count changing.

## DP-6: Objective Compatibility scoring — Step 1 (0-64)

- Where: `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json` — node `OC Score` (chainLlm), prompt built in `Objective Compat score` (set node); batched 5-at-a-time by code node `BatchingOC`.
- Trigger / when: WF3 runs as a sub-workflow from WF2 ("Call 'WF3 - scoring careers NL/EN'" node in WF2), background.
- Decision type: **score**, multi-dimension rubric, run once per career (batches of ≤5).
- Options / label set: 4 sub-scores — Skills & Education (/27), Values Alignment (/12), Work Preferences (/14), Interest Match (/11) = **/64 total** ("objective_total"), plus a separate severity-only (non-scoring) list of `hard_constraint_violations` and `dealbreaker_violations`.
- Input state: one candidate's fact sheet + a batch of up to 5 enriched career profiles. English.
- Current implementation: LLM (`OC Score`/`Extract 1k-n` chain; model not individually pinned down in this pass — WF3 has 4 Gemini chat-model nodes and 1 Anthropic node across its chains).
- Prompt core (verbatim, decisive excerpt): "Score factual alignment on 0-64 scale across four dimensions. Focus on: Can they do this job? Do they meet requirements? Do hard facts align?" / non-negotiable override: "If EITHER non-negotiable is violated: still compute the sub-scores, but OVERRIDE the final `objective_total` to **5** (hard floor)... This sinks the career below viable ones in ranking... Never override when there is no [NON-NEGOTIABLE] marker."
- Output format + validation: JSON `{scored_careers:[{career_title, objective_scores{...}, objective_total, hard_constraint_violations[], dealbreaker_violations[], contextual_notes[], passes_basic_requirements}], total_careers_scored}` — parsed downstream, no formal schema/parser node observed (plain JSON.parse in the "Ranking" code node with try/catch fallback).
- Confidence/thresholds/post-processing: see DP-7 (non-negotiable override) and DP-8/DP-9 (Step 2 + ranking).
- Human correction: none direct; non-negotiables are set earlier by the user in the survey (salary/schedule "[NON-NEGOTIABLE]" markers), so the *input* to this score is user-set, but the score itself isn't editable.
- Volume: ~3 LLM calls per report (15 careers ÷ batch size 5 = 3 batches; from code, `BatchingOC`'s `batchSize = 5`).
- Known problems: project memory `project_wf3_variance_diagnosis.md` — "scoring runs on gemini-flash-latest at DEFAULT temp" (temperature not pinned, unlike the Anthropic nodes elsewhere which explicitly disable it) — flagged there as a source of run-to-run score variance; not independently re-verified against the live JSON's per-node model settings in this pass.

## DP-7: Non-negotiable hard-floor override

- Where: same `Objective Compat score` prompt (WF3), logic lives inside the Step-1 prompt text (not a separate code node) — see quote in DP-6.
- Decision type: **validate / route** (a career is sunk to a fixed floor score rather than excluded outright).
- Options / label set: two user-settable non-negotiables — salary (`3f`, "forgiving": floor = low end of bracket minus 15%) and schedule/hours (`3d`, "strict": violated if work_schedule clearly conflicts, including an optional "(max N hours/week)" ceiling).
- Current implementation: instruction embedded in the scoring LLM's prompt, enforced by the same LLM that produces the score (i.e., self-applied, not a separate downstream check) — output feeds forward into DP-9's ranking as `step1_objective_score`.
- Known problems: project memory `project_non_negotiable_riders.md` and `project_belastbaarheid_hours_ceiling.md` — a floored career can never clear the runner-up 55-point threshold (64+44 max minus the floor forces objective_total to 5, capping the combined score at ~45/100 per the code comment in DP-9), which was found to empty the runner-up list entirely in some reports; a backfill mechanism (DP-9) was added afterward specifically to patch this.

## DP-8: Pattern / Final scoring — Step 2 (adds up to +44, −50)

- Where: `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json` — node `Step 2 - Final Score` (chainLlm), prompt in `Step 2 analysis` (set node).
- Decision type: score (additive/subtractive adjustment on top of Step 1) + a non-scoring tag (`lane`: adjacent|stretch).
- Options / label set: Happiness Pattern Match (0-20), Strengths Application (0-14), Trajectory Fit (0-10), minus Burnout Risk penalty (0-15), Development Conflicts penalty (0-15), Feasibility Penalty (0-20). Formula (verbatim from prompt): `Final Score = Step 1 (0-64) + Happiness(0-20) + Strengths(0-14) + Trajectory(0-10) − Burnout(0-15) − Development(0-15) − Feasibility(0-20)`, **max possible 108**, "Realistic top score: ~90-95".
- Input state: Step 1's full JSON output + the candidate's 4-section personality narrative + sentiment log (happiness-per-past-role). English.
- Current implementation: LLM, explicitly instructed not to re-score Step 1's work ("Use Step 1's work, don't redo it... Your job is to ADD pattern-based insights, not re-score these").
- Prompt core (verbatim): "no double counting: Step 1 already scored capability fit (skills_education). Do NOT deduct here for a domain/industry change or for capability gaps Step 1 already priced in."
- Output format + validation: JSON `scored_careers[]` with nested `step2_pattern_analysis`, `penalties`, `final_compatibility_score`, `lane` (adjacent|stretch) + `lane_signal` (a required verbatim quote of the candidate's own stated pivot signal, or empty string) — again plain JSON.parse downstream, no schema-level enforcement observed.
- Volume: not independently confirmed whether Step 2 also batches at 5 or runs once on all 15 — the node has no visible batching code attached in this pass's dump (treat as 1 call unless later found otherwise; mark as **estimate**).
- Known problems: same `project_wf3_variance_diagnosis.md` memory note — "Step 2 adds ±50pts judgment vs regenerated WF1 narrative" (i.e., Step 2 is re-reading a regenerated narrative rather than a cached one, another variance source per that note; not independently re-verified in this pass).

## DP-9: Ranking, Top-3/Runner-up selection, and backfill

- Where: `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json` — node `Ranking` (`n8n-nodes-base.code`).
- Decision type: **rank / select-top-N** — entirely deterministic code, not an LLM call, operating on the LLM-produced `final_compatibility_score`.
- Logic (from the code, `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json`, node "Ranking"):
  1. Normalize: `normalized_score = round((final_compatibility_score / 108) * 100)`.
  2. Title-dedup: keep highest-scoring entry per normalized title.
  3. Sort descending by `normalized_score`, assign `rank`.
  4. `top3 = rankedCareers.slice(0, 3)` — always exactly the top 3, no score floor.
  5. `runnerUps = rankedCareers.slice(3, 10).filter(score >= 55).slice(0, 3)` — up to 3, hard 55-point floor.
  6. "Stretch slot" backfill: if 3 runner-ups already qualify and none is tagged `lane:"stretch"`, swap the 3rd runner-up slot for the highest-scoring stretch-tagged career (≥55) if one exists and wasn't already surfaced.
  7. Runner-up backfill-if-under-3: if fewer than 3 runner-ups cleared 55, top up from the next-best remaining careers regardless of the 55 floor, flagged `below_threshold: true` with `below_threshold_reason` ∈ {`non_negotiable`, `low_compatibility`} (the former specifically detects `step1_objective_score === 5`, i.e. DP-7's hard floor).
- Options / label set: n/a (numeric threshold, not a label set).
- Human correction: none.
- Volume: 1 code execution per report (not an LLM call).
- Known problems: comment in the code itself documents the exact bug this backfill was built to fix: "a floored career can never clear 55 on its own... [without backfill] runner-ups could come back as 0" — i.e., this is a patched-over consequence of DP-7.

## DP-10: "Outside-the-box" (True Pivot) career generation

- Where: `n8n_wfs_cairnly/WF3 - scoring careers NL_EN.json` — node `Outside Of Box Analysis` (chainLlm), prompt in `Set Outside Box Prompt`; parsed by code node `Parse OOB`.
- Decision type: **generate** exactly 3 careers, with an embedded **choose-one-of-4** classification (Move level) and pass-through of DP-2's AI-Impact label, per pick.
- Options / label set: Move ∈ {Ready now, Reframe, Upskill, Retrain} (verbatim from prompt, matches `src/lib/moveScale.ts:8` `MOVE_LEVELS`). Path type same 3-way gate as DP-4, capped "at most 1 of the 3 may be a founder path."
- Input state: candidate profile + interests narrative + the already-presented career titles (top-15 list + their alternate titles), so the model can enforce non-duplication. English.
- Current implementation: LLM (chainLlm; model not pinned per-node in this pass).
- Prompt core (verbatim, decisive excerpt): "Every pick must be a genuine pivot, not a safe lateral move... reject any role that lives in the SAME FUNCTION FAMILY as a role already in the presented set... OVERUSED DEFAULTS, avoid unless strongly justified: 'Immersive Experience Designer', 'Experience Design Director', 'Entrepreneur in Residence', and 'Chief of Staff' are being suggested far too often as safe filler."
- Output format + validation: freeform numbered markdown text with embedded HTML-comment tags (`<!--move:Reframe-->`, `<!--company:Scale-up / Media Company-->`) that `Parse OOB` extracts by regex; no structured-output parser node — pure text-splitting/regex in code.
- Confidence/thresholds/post-processing: `Parse OOB`'s regex also bolds any of the literal words `Minimal|Moderate|High|Severe|Critical|Augmented|At Risk|Displaced|Enhanced|Transformed` it finds — i.e. it's tolerant of AI-impact label variants the prompt itself says must never occur, suggesting this has happened in practice.
- Volume: 1 LLM call producing 3 careers (from code / prompt: "Always return exactly 3").
- Known problems: `n8n_wfs_cairnly/notes/WF3_oob_alt_titles_fix_PROPOSED.md`, `WF3_oob_true_pivot_fix_PROPOSED.md`, `WF3_outside_box_prompt_PROPOSED.md` exist as proposed-fix notes (titles suggest recurring issues with duplicate/non-pivot picks — the live prompt inspected here already contains extensive anti-duplicate and anti-"safe filler" rules, consistent with iterative patching); not cross-diffed line-by-line against the notes in this pass.

## DP-11: Top-3 narrative + per-axis fit scores

- Where: `n8n_wfs_cairnly/WF4 - Career selection NL_EN.json` — node `T3 Careers Prompt` (set) feeding an Anthropic chainLlm node; code `Top 3 only` selects the 3 records to process.
- Decision type: **generate-text**, with an embedded **score** (5-axis, 1-5 each) and the same Move **classification** as DP-10, per career.
- Options / label set: `fit_scores` axes — autonomy, social, pace, stability, schedule, each 1-5 ("5 = excellent fit, 1 = poor fit... judged against their Initial Summary"); Move same 4-level set as DP-10; plus a pairwise `comparison` (career 2 vs 1, career 3 vs 1&2) with a one-sentence `headline` + 120-170 word `explanation`.
- Input state: WF3's scored top-3 output + enriched career data + fact sheet. English (locked: "Write ALL prose in English. Always... The platform translates the finished document afterwards").
- Current implementation: LLM (Anthropic chat model node present in WF4).
- Prompt core (verbatim, decisive excerpt on the required "extends/avoids" citation): "the narrative MUST contain the literal phrase 'extends your X/10 [role name]' OR 'avoids the Y/10 [role name] pattern' at least once, where X and Y are the actual happiness scores from the sentiment log."
- Output format + validation: markdown prose per career + one trailing fenced ` ```json ` block per career holding `{fit_scores, move, comparison?}` — parsed by code node `Split Top3` (`WF4 - Career selection NL_EN.json:118`).
- Current implementation, corrected/precise: this call is made via a **raw `POST https://api.anthropic.com/v1/messages`** HTTP node (`Top 3 Careers HTTP`, `WF4 - Career selection NL_EN.json:451`) rather than n8n's LangChain chat node — `{model:"claude-sonnet-5", max_tokens:20000, thinking:{type:"adaptive"}, output_config:{effort:"low"}}`, a distinct configuration from every other Anthropic call found in WF3/WF4 (which use the LangChain node and either no `thinking` override or `disabled`). 10-minute HTTP timeout set on this node.
- Confidence/thresholds/post-processing — **two confirmed, live bugs**:
  1. **The displayed "Match %" is not WF3's deterministic Ranking score.** The LLM is given WF3's true code-computed score as context and instructed to restate it as "**Compatibility score: [XX/100]**" in its own prose; `Split Top3` then regex-extracts that self-declared number back out. The Match pill a user sees is therefore an LLM's own restatement of a number it was handed, re-parsed by regex — not a direct pass-through of the deterministic ranking value from DP-9.
  2. **Top-3 slot order (`top_career_1/2/3`) is purely positional**, assigned in `Split Top3` by the order the 3 careers appear in the LLM's response (`career1→top_career_1`, etc.) with **no `.sort()` call anywhere in the function**. The parsed score is stored but never used to reorder. A proposed fix exists (`n8n_wfs_cairnly/notes/WF4_top3_order_by_score_fix_PROPOSED.md`, "Change 1: sort by parsed score descending before assigning slots") but is **confirmed NOT applied** in the live JSON — the code matches the note's quoted "BEFORE" state verbatim. Net effect: a career the model writes third can carry a higher self-declared Match score than the career written second, and will still display as the weaker "2nd match." The same unsorted-positional pattern applies to runner-up ordering (`Parse runner up`, `WF4 - Career selection NL_EN.json:239`, `order_number: index + 1`).
- Volume: 1 LLM call for all 3 top careers together (from code: prompt says "Generate all 3 careers now").
- Known problems: two other proposed fixes in the same note file are also **not applied** in the live JSON (splitting "Alignment with your ambitions" into two paragraphs; a runner-up bullet naming the concrete Top-3 distinction) — `n8n_wfs_cairnly/notes/` in this repo appears to accumulate proposed changes that don't always get merged into the live prompt, a useful general caveat when reading any `*_PROPOSED.md` note as if it described current behavior.

## DP-12: Runner-up narrative generation

- Where: `n8n_wfs_cairnly/WF4 - Career selection NL_EN.json` — node `Runner Up Analysis` (chainLlm), prompt `Set Runner Up Prompt`; parsed by `Parse runner up` (code).
- Decision type: generate-text, with the same Move classification embedded.
- Current implementation: LLM. Notably includes a **code-level guard**, not AI: `Parse runner up`'s comment: "GUARD (2026-07-05): if no runner-up careers came in from '4-10 only', the upstream pool was empty. Do NOT parse the LLM output (it hallucinates a 'the list is empty' complaint). Emit one clean, controlled placeholder row." — i.e., a known LLM failure mode (hallucinating content on empty input) patched with a hard-coded bypass.
- Output format + validation: markdown with `---CAREER_SPLIT---` delimiter, regex-parsed (career title, alt titles, company size, compatibility score, move tag all pulled by regex in `Parse runner up`).
- Human correction: a `below_threshold`/`below_threshold_reason` flag from DP-9 is threaded through and the prompt is instructed to disclose it: "the FIRST Reality Check bullet must say plainly that this is a harder match than the top three."
- Volume: 1 LLM call for up to 3 runner-ups (from code).

## DP-13: Dream-job feasibility rating

- Where: `n8n_wfs_cairnly/WF4 - Career selection NL_EN.json` — node `Dream Job Feasibility` (chainLlm); parsed by `Parse Dream` (code).
- Decision type: **score** (5-level described scale) per stated dream job, plus the same Move classification.
- Options / label set (verbatim): **Low | Low - Moderate | Moderate | Moderate - High | High** — matches `src/lib/enumLabels.ts:53-58` `FEASIBILITY_LABEL`. Move: same 4-level set as DP-10.
- Input state: only the candidate's own stated dream job(s) from the survey (max 3 analyzed: "Analyze at most the first 3 dream jobs"), plus the already-generated top-3/runner-up/OOB lists as context to avoid overlap. English.
- Current implementation: LLM.
- Prompt core (verbatim, decisive excerpt on a credential rule): "A GATING credential is one a person cannot legally or practically be hired without: law, medicine, psychotherapy, accountancy, teaching, chartered or professional engineering... NEVER speculate about how old a degree is. No graduation date is collected anywhere, so you cannot know it."
- Output format + validation: markdown with `---DREAM_JOB_SPLIT---` delimiter + `<!--move:...-->` tag, regex-parsed in `Parse Dream` (which matches subheaders in **both** English and Dutch, "so the `<h5>` formatting never depends on which language the model actually produced" — a defensive heuristic against the language-contract prompt being disobeyed).
- Volume: 1 LLM call for up to 3 dream jobs, only runs if the user stated any (from code/prompt).
- Known problems: "EXTRACTION GUARD" section in the prompt exists specifically to stop the model inventing dream jobs from context careers — implies this happened before.

## DP-13b: AI-Impact and Feasibility badges are NOT stored fields — client-side regex re-extraction

- Where: `src/components/chat/CareerScoreCard.tsx:17-18` (5 impact levels), `:94-140` (`extractAIImpact`), `:149-167` (`leadingAIImpactLevel`); `:275-284` (5 feasibility levels), `:290-326` (`extractFeasibility`/`leadingFeasibilityLevel`).
- Decision type: **choose-one-of-list, re-derived client-side** — this directly contradicts the natural assumption (confirmed true only for Move/Match) that these badges simply display a backend-written enum column.
- Current implementation: WF2/WF3/WF4 only ever write **prose** containing the AI-Impact/Feasibility sentence (e.g. "AI Impact: High - ..."); no code node in any workflow inspected in this pass extracts that word into a dedicated column at write time. Instead, the **frontend** re-parses `report_sections.content` at render time: a cascade of 6 regexes plus an alias table (`AI_IMPACT_ALIASES`) that normalizes 3 historical eras of prompt phrasing ("Safe"→Minimal, "At Risk"→Severe, etc. — direct evidence of prompt drift over time), then a fallback context-window scan that picks the highest-tier label found near any "AI impact" mention. Feasibility extraction is English-only by design (a code comment notes the Dutch prompt branch doesn't pin the value tokens yet, so a Dutch dream-job card can silently show no Feasibility pill).
- Confidence/thresholds/post-processing: extraction can silently return `null` if a future prompt rewording doesn't match any known pattern — the exact repeated warning in every WF2/WF3/WF4 prompt ("the platform parses this exact word into a fixed badge, so any other word makes the badge and your text disagree", see DP-2) is defending against precisely this client-side regex, not a database constraint.
- Known problems: the alias table is itself documented evidence that badge/prose mismatches have happened at least 3 times before across prompt revisions.
- Contrast with Match and Move: `MatchPill`/`MoveBadge` do read a genuine stored value (`report_sections.score`, `report_sections.metadata.move` — see DP-14), so the four "pills" on a career card are implemented by three structurally different mechanisms: one deterministic-code-derived number (Match, see caveat in DP-11), one LLM-written structured field (Move), and two LLM-written-prose-then-client-regex-reparsed values (AI-Impact, Feasibility).

## DP-14: Move (reskilling-effort) classification — cross-cutting

- Where: embedded inside DP-10, DP-11, DP-12, DP-13 (four separate generation calls each independently classify Move for their own careers) — never a standalone classification call.
- Decision type: choose-one-of-4.
- Options / label set: Ready now | Reframe | Upskill | Retrain (`src/lib/moveScale.ts:8`).
- Storage: `report_sections.metadata.move` (comment, `src/lib/moveScale.ts:4-6`: "set by WF4 per career, stored report_sections.metadata.move" — OOB careers are stored via WF3's own insert, same `metadata.move` shape).
- Display: `src/components/chat/CareerScoreCard.tsx:248-250`, `ChatMessage.tsx:578,835,1080`, `ShareCardModal.tsx:952-964`, all via `moveLabel()` in `src/lib/enumLabels.ts:32-33`.
- Known problems: because this is decided independently 4 times by 4 different prompts/calls rather than once by a single classifier, there is a structural risk of inconsistent Move ratings for similar-profile careers across the top-3 vs runner-up vs OOB vs dream-job sections; not confirmed as an observed bug in this pass, but it is a direct architectural consequence of the current implementation.

## DP-15: Survey → fact-sheet extraction

- Where: `n8n_wfs_cairnly/WF1 - Profile Insert EN_NL.json` — node `Initial_summary1` (chainLlm, fed by Gemini node `3F` — confirmed via the workflow's `connections` graph), prompt in `prompt_init_summary1`.
- Decision type: extract-value (structured restatement of raw survey JSON into a labeled fact sheet), not really a choice/score.
- Input state: raw survey answers keyed `1a`…`7f` per `SURVEY_SCHEMA` (code node `Process Survey Data1`, same file) — English or Dutch depending on the survey's own language, since this runs before any translation step.
- Prompt core (verbatim): "Your goal is to transform structured JSON survey data into a high-fidelity, judgment-free 'Source of Truth' Fact Sheet... Do not interpret or coach; your job is to ensure the downstream Career Coach has 100% of the facts."
- Volume: 1 LLM call per report.

## DP-16: Personality narrative generation

- Where: same file, node `generate_personality_narrative1` (chainLlm, fed by `Anthropic Chat Model1` — confirmed via `connections` graph), prompt in `prompt_perso_prof1` (not separately dumped in this pass).
- Decision type: generate-text (4 sections: Approach/Strengths/Development/Values). Feeds every downstream scoring/generation step as context.
- Volume: 1 LLM call per report (estimate — single node, no batching observed).

## DP-17: Resume/CV data extraction (optional prefill)

- Where: `n8n_wfs_cairnly/WF0 - Resume data extraction.json` — node `Extract Resume Data` (chainLlm, fed by `Gemini Flash`; an `Anthropic Chat Model` node is also present in this workflow but its specific attachment wasn't traced in this pass); triggered by `Resume Upload Webhook`.
- Decision type: extract-value (structured fields pulled from unstructured PDF text) mapped onto survey question IDs by code node `Parse and Map to Survey IDs`.
- Who waits: this is a webhook-triggered, synchronous-feeling upload flow (user uploads a PDF and presumably waits for prefill) — not independently timed in this pass.
- Volume: 1 LLM call per resume upload.

## DP-18: Job-posting match scoring (WF8)

- Where: `n8n_wfs_cairnly/WF8 - Finding selected roles.json` — node `Score Jobs` (chainLlm), prompt built in `Build Scoring Prompt`; postings sourced via `Apify LinkedIn Scraper` (httpRequest) and cleaned by `Normalize Results`.
- Trigger / when: `Job Search Webhook`, triggered from `src/pages/Jobs.tsx` / `useJobSearch.ts` when the user runs a job search for a chosen career.
- Who waits: **user blocked in UI** — this is the clearest match-two-entities, synchronous, user-facing AI call found in this pass (webhook → scrape → score → respond).
- Decision type: **score** (0-10) — this is Cairnly's clearest **match-two-entities** decision: each scraped job posting vs. the user's chosen career + preferences.
- Options / label set: 0-10 integer score per posting; the LLM also returns a ≤14-word `reason` string per job (not a fixed label set).
- Input state: up to N scraped LinkedIn postings (title, company, employment type, first 600 chars of description) + the user's target career title + its alternate titles + a plain-English overview + stated languages + "avoid" preferences + work-arrangement/commitment preferences. English forced regardless of posting language: "LANGUAGE LOCK !!! Write every human-readable text value you output... in ENGLISH only."
- Current implementation: LLM (`Claude Son5` and `Gemini Flash (Translation)` nodes both present in this workflow — the scoring node's specific model attachment wasn't individually re-traced in this pass, but Anthropic sonnet-5 is confirmed in use somewhere in WF8 per `project_anthropic_temperature_deprecation.md`, "WF9/WF8/WFX/WF10 all fixed 2026-07-05" for the `temperature` param).
- Prompt core (verbatim, decisive excerpt): "SPECIALIZATION RULE (critical): ...If a job does NOT clearly involve that core specialization... CAP its score at 3 even if seniority and general field match. We would much rather show the user nothing, or an honestly low-scored match, than a confident-looking result that misses the whole point... BIAS TO STRICTNESS: When uncertain between two scores, pick the lower one."
- Output format + validation: strict JSON `{"scores":[{"i":0,"score":8,"reason":"..."}]}`, parsed in code node `Apply Scores` via regex-extracted `{...}` block + `JSON.parse`; on parse failure the code **falls back to returning all jobs unscored** rather than failing the request.
- Confidence/thresholds/post-processing (`Apply Scores`, verbatim constant): `const MIN_SUITABLE_SCORE = 3;` — scores 0-2 dropped entirely; sorted descending by score, tiebreak by posting date, then by fewest applicants; comment notes the frontend further splits 3-5 into a collapsible "filtered" panel vs 6+ in the main list.
- Human correction: users can save/dismiss individual job results (`useSavedJobs.ts`, not deep-read in this pass for exact storage shape).
- Volume: 1 LLM call per job search (batch-scores all scraped postings in one call, from code — `jobList` built as one array, one `Score Jobs` call).
- Known problems: `project_job_search_free_tier.md` (memory) — 4 free searches/report, referral uncaps; `project_demo_replay.md` — "WF8 scorer can return unscored + cached 24h" (a caching heuristic, not re-verified against a specific TTL constant in this pass).

## DP-19: WF6 feedback processing — routing, CAT-classification, and regeneration

WF6 is called synchronously, as a tool, by WF5's coach agent (`@n8n/n8n-nodes-langchain.toolWorkflow` node in WF5) — meaning **the agent LLM itself decides the tool-call arguments** (which `section_type` the feedback concerns), and the whole chain below runs *inside* the same blocked chat turn (see DP-22's latency note).

- **DP-19a — section_type validation + routing.** Where: `WF6 - Feedback processing NL_EN.json:465` (`Parse Query`, code) and `:719` (`Route by Section Type`, switch v3.2). Decision type: validate + route. Options (exact, 10-item hardcoded whitelist in code): `approach, strengths, development, values, top_career_1, top_career_2, top_career_3, runner_ups, outside_box, dream_jobs` → collapsed to 7 `route_category` branches (the 4 personality types → `personality`). Current implementation: heuristic (JS whitelist array + switch), not AI; an unrecognized `section_type` throws and routes to the error workflow. Known problem: `chat_highlights` is a real `report_sections.section_type` (read by WF7) but is **not** in this whitelist, so WF6 cannot process feedback tagged against it.
- **DP-19b — per-section feedback-category classification (CAT 0/1/2), combined with regeneration.** Where: 5 parallel branches, each a `Build *Prompt` (Set) → `AI *` (chainLlm) pair: personality (`:158`→`:219`), top-career ×3 (`:921`→`:519`), runner-ups (`:431`→`:234`), outside-box (`:181`→`:249`), dream (`:204`→`:264`) — all on **`models/gemini-flash-latest`**, no param overrides. Decision type: choose-one-of-3, combined with generate-text in the same call. Options (verbatim): "CAT. 0: No actionable feedback ('looks good', 'accurate') - return original unchanged / CAT. 1: Minor feedback - small adjustments / CAT. 2: Significant feedback or exploration request - detailed adjustments/additions." Runner-ups/outside-box/dream process an array of cards in one call (one CAT tag per card in one JSON response). Output written to `report_sections.feedback_category`. Known problem (confirmed structurally): **all 5 "Process \*" parser code nodes silently continue on JSON-parse failure** — on catch they emit an object missing the fields the DB-write node needs (`error: 'AI response was not valid JSON'` instead of `content`/`id`/etc.), and there is no IF/error-branch node before the Supabase update — a malformed LLM response flows straight into the section's DB row rather than being caught.
- **DP-19c — personality-score recalibration ("nudge," not re-score).** Where: `Build Personality Prompt` (`:158`) feeding `AI Personality` (`:219`). Decision type: score (5 dimensions, 1-10, same scale as WF1-DP16). Current implementation: the prompt supplies the *existing* scores as a baseline and instructs the model to nudge rather than re-derive: "CAT. 1 feedback: nudge 1-2 points only on dimensions the feedback directly speaks to. CAT. 2 feedback: adjust more meaningfully, but stay within ±3 points... unless feedback strongly justifies a bigger swing." These scores are explicitly "NOT shown to the user" per the prompt — by design, no user-facing override path exists for them. Known problem: the ±1-3 clamp is a prompt instruction only; no code-level bounds-check clips the value before the DB write.
- **DP-19d — replacement-provenance heuristic (was this career actually swapped?).** Where: `Process Outside Box` (`:363`) and, more thinly, `Process Dream`/`Process Runner-ups` (`:376`/`:350`) — all pure code, no LLM. Decision type: yes-no (`wasReplaced`) + match-two-entities (AI-returned card ↔ original DB row, via a UUID-regex check that falls back to exact-title matching). Logic (verbatim): `wasReplaced = (explore text non-empty) || (original.title !== aiCareer.title)`; if true, `metadata.origin = 'chat_replacement'` is set, which the frontend reads to show a "Chat-generated · not scored" badge instead of a Match pill (confirmed in the frontend pass — `CareerScoreCard.tsx:356-380`). Known problems (structural, confirmed against the live export): (1) `Process Dream`'s computed `title` is never written back — `Update Section in DB2` (dream_jobs' write target, `:1031`) has no `title`/`metadata` field mapping at all, unlike the outside-box/runner-ups write target which does. (2) `Process Runner-ups` never computes a `metadata` object in the first place, yet shares the same DB-write node that now always writes `metadata: {{ $json.metadata }}` on every save — for a runner-up item that expression resolves against a key that was never set.
- Volume: up to 1 regeneration LLM call per WF6 invocation per branch touched (max 10 possible section types); 0-1 WF6 invocations per coach chat turn.
- File-staleness caveat: `n8n_wfs_cairnly/WF6 - Feedback processing NL_EN.json` has file mtime 2026-07-03, while WF5/WF7 are 2026-09-17; memory (`project_ai_tell_banned_phrase_rollout.md`) records a 2026-07-12 banned-phrase edit to all 5 `Build *Prompt` nodes that a text search of the current export does **not** find — the export may not reflect the live workflow's current state.

## DP-20: Resume-issue selection and capping (WF10)

- Where: `n8n_wfs_cairnly/WF10 - Resume Strengthen.json` — node `Select & Score` (code), explicitly a verbatim copy of `supabase/functions/resume-strengthen/strength.ts` per its own header comment ("SOURCE OF TRUTH... keep in sync").
- Decision type: **rank/select-top-N**, deterministic code operating on LLM-assigned `impact` scores (1-10) produced by the upstream `Analyze LLM` node.
- Logic (verbatim constants): `WEAK_BASELINE = 40; CAP_NORMAL = 5; CAP_WEAK = 7;` — candidate issues are sorted by `impact` descending and capped at 5, or 7 if the resume's baseline score is below 40 ("weak" resumes get more surfaced issues). `score_potential = min(100, baseline + sum(surfaced impacts))`.
- Current implementation: heuristic post-processing on an LLM score; the code also **sanitizes** the LLM's impact values ("Sanitize LLM-authored impacts at intake: integers 1..10 only").
- Human correction: each surfaced issue gets `status: 'pending', user_input: null` — implying the UI lets the user accept/edit/reject each suggested resume fix individually (storage/UI not independently traced further in this pass).
- Volume: 1 selection pass per resume-strengthen run (code, not an LLM call itself; the upstream scoring call `Analyze LLM` is 1 LLM call per run).

## DP-21: ATS optimisation pass (WF9)

- Where: `n8n_wfs_cairnly/WF9 - Custom Resume.json` — node `ATS Optimisation Pass` (chainLlm, `Anthropic Sonnet (ATS)`), fed a `Build Keyword List` code node's output.
- Decision type: likely extract-value/validate (keyword coverage against a job/career's keyword list) — prompt text not dumped in this pass; inferred from node names and position in the pipeline (after `Build Keyword List`, before final assembly). Flagged as **lower-confidence** — treat as a strong lead, not a confirmed rubric.
- Other WF9 decision-shaped nodes not deep-dived in this pass: `Deep Résumé Parse` (extract-value from uploaded PDF, Anthropic Sonnet), `Merge User Overrides` (code — implies a human-correction surface for resume fields, not traced further).
- Volume: WF9 makes at least 3 LLM calls per custom-resume generation (from code: `Deep Résumé Parse`, `Résumé Content Generation`, `ATS Optimisation Pass`, each with its own Anthropic Sonnet node), run once per career via `Split In Batches` / "Fan Out Per Career" — i.e. **3 LLM calls × number of careers the user generates a resume for** (estimate based on node structure, not a traced constant).

## DP-22: WF5 Cairnly Coach — a single agent call makes four decisions at once

Architecture: one `@n8n/n8n-nodes-langchain.agent` node ("Cairnly Coach Agent", `WF5 - Cairnly Coach.json:159`) with 3 tools (`get_user_profile` Supabase read, `SerpAPI - opt. deepdive` web search, WF6-as-tool for feedback/regeneration) and Postgres-backed chat memory (10-turn window). **There is no separate classifier/router node** — every decision below is made inside the one reply-generating `claude-sonnet-5` call via its system prompt, not by a prior or dedicated LLM call. Trigger: `@n8n/n8n-nodes-langchain.chatTrigger`, `mode: webhook`, `responseMode: "lastNode"` (confirmed **not streaming** — the user gets nothing until the whole n8n execution, including any nested WF6 call, finishes).

- **DP-22a — completion-signal detection (advance vs. discuss).** Decision type: yes-no. The agent must distinguish "clean advance" (point to the Continue button) from "completion signal after real discussion" (call WF6 first, even if the words look identical — e.g. a bare "yes" after a substantive back-and-forth). Prompt core (verbatim): "If the user is signalling completion AFTER a real discussion of this section, that is NOT a clean advance, even if the words look the same... you MUST call WF6 - feedback processing with the discussion summary FIRST." Known problems: `n8n_wfs_cairnly/notes/WF5_WF6_capture_fix_TODO.md` documents a real miss requiring a manual WF6 re-run to backfill two sections; the note's proposed fix text is confirmed present (verbatim match) in the live export, though duplicated back-to-back within the same systemMessage (a copy-paste artifact, not a logic bug).
- **DP-22b — pushback-strength classification (mild vs strong).** Decision type: choose-one-of-two, gating a further yes-no (offer a replacement career). Options (verbatim): STRONG ("hard no", repeated/emphatic rejection) vs MILD ("not really my thing", "meh"). Prompt core: "Only AFTER strong pushback... may you OFFER a replacement, once, as a yes/no question." Known problems: `n8n_wfs_cairnly/notes/WF5_replacement_trigger_fix_PROPOSED.md` records a real incident where the agent fabricated and swapped a career off *mild* feedback plus an unrelated "next section please" — confirmed the fix ("REPLACEMENTS ARE A LAST RESORT") is live in the current export. No standalone "dismiss without replacing" action exists in the prompt or tool schema — the only two paths are "note mild feedback and move on, card unchanged" or "strong pushback + explicit accept → replace."
- **DP-22c — reply-depth/format routing + careers_revealed gate.** Decision type: choose-one-of-list (standard 60-150 words / deep-dive ≤220 words / career-replacement, unlimited) + yes-no gate on whether career content may be discussed at all (`careers_revealed`, a session-metadata boolean the model is instructed to respect but which is not code-enforced). None of the word-count or reveal-gate rules are checked downstream — compliance is entirely prompt-instruction-based.
- **DP-22d — tool-invocation gating.** Decision type: yes-no ×2 independent (call `get_user_profile`? call SerpAPI?) — native LLM tool-selection, no code gate.
- **Latency (this is the clearest live AI-latency path in the whole product):** a "quick yes" from the user can synchronously trigger the full WF6 chain (Supabase read → report-language fetch → routing switch → one Gemini `flash-latest` generation, or a multi-card regeneration for runner-ups/outside-box/dream → Supabase write) — all *before* the agent resumes and the webhook responds, because `Call 'WF6...'` is a blocking `toolWorkflow` call, not fire-and-forget. No `executionTimeout` override is set on WF5; `retryOnFail: true, waitBetweenTries: 3000` adds 3s+ on any transient tool failure. No runtime timing data was available in this pass; the only proxies are the word-count ceilings above and the fact that a career-replacement reply is explicitly unlimited-length ("800+ words"), the slowest path by design.

## DP-23: Cover letter generation + output validation (WFX)

- Where: `n8n_wfs_cairnly/WFX - Cover Letter.json` — node `Cover Letter` (chainLlm, `Anthropic Sonnet (Cover)`); output checked by code node `Parse Output` and routed by `If Parse OK` (`n8n-nodes-base.if`).
- Decision type: generate-text, gated by a **validate** step (parse-success check) that routes to one of two Supabase writes (`Update cover_letters (success)` vs `Update cover_letters (failed)`).
- Volume: 1 LLM call per cover letter.

## DP-23b: WF7 ExecSummary — fixed foregrounding order, narrative generation, translation dispatch

- **DP-23b-1 — fixed section order + feedback-noise filter (which careers/chapters get foregrounded).** Where: `WF7 - ExecSummary NL_EN.json:75` (`Combine Sections`, code). Decision type: route (deterministic sequencing) + yes-no filter, not AI. A hardcoded 11-item order (approach, strengths, development, values, top_career_1/2/3, runner_ups, outside_box, dream_jobs, chat_highlights) determines what the LLM sees and in what order — i.e. **which career gets "foregrounded" in the exec summary is entirely inherited from this fixed slot order** (itself inherited from WF4's positional, not score-sorted, assignment — see DP-11's known bug), not re-evaluated by any scoring step in WF7 itself. Also filters out feedback text exactly equal to two canned "no changes needed" strings, and truncates each section to 2000 chars (6000 for chat_highlights) before the prompt.
- **DP-23b-2 — Career Direction narrative.** Where: `:121` (`Basic LLM Chain`) / `:152` (`Anthropic Chat Model`, `claude-sonnet-5`, `maxTokensToSample:16000`). Decision type: generate-text with an implicit selection of which specific careers/details to mention (250-350 words, instruction-enforced only). Prompt core (verbatim, and worth flagging as a literal artifact in the live prompt): "You are an expert career assessment writer creating an Executive Summary for **Atlas Assessment's** personalized career report" — the prompt still says "Atlas" (Cairnly's internal predecessor name, see Product-in-12-lines) and later "(Atlas voice)," apparent copy-paste residue, not a functional bug.
- **DP-23b-3 — validation gate + translation dispatch.** Where: `:108` (`Prepare for Insert`, throws `Error('Executive summary generation returned empty content')` on empty output — one of the few genuinely hard-failing validation checks found across the whole pipeline, versus WF6's silent-continue pattern in DP-19b) and `:179` (`Translate Exec Summary`, httpRequest to the `translate-section` edge function, 120s timeout, `onError: "continueRegularOutput"`). Decision type: translate/route. The node's own inline note states the accepted degrade path explicitly: "Failure falls back to English display + alert email." Known problem: `Prepare for Insert` hardcodes `const lang = 'en'` immediately above a Dutch/English title ternary, making the Dutch branch dead code — the DB row's `title` is always "Executive Summary" regardless of report language (the actual NL translation happens downstream, in the separate edge-function call, not in this ternary).
- AI models in this scope: `claude-sonnet-5` (WF7's own generation); Gemini `flash-latest` ×5 identical instances across WF6's regeneration branches (DP-19b); `claude-sonnet-5` again inside WF5's agent (DP-22) and inside the WF6-tool call it can trigger.

## DP-24: Global error routing — and a coverage gap

- Where: `n8n_wfs_cairnly/Global Error Handler.json` — node `Check Error Type` (`n8n-nodes-base.if`), feeding either `Format API Error Data` or `Format General Error Data` (both `set`), then `Log to Supabase` (httpRequest) and `Send Email Alert` (gmail).
- Decision type: route (heuristic, not AI) — classifies a caught n8n error as "API-shaped" vs "general" (keyword/substring match on the error message: "API", "timeout", "rate limit", "401/403/429/500") for formatting purposes only; **both branches converge on the same single alert destination**, so the routing changes message formatting, not where the alert goes.
- Known problems: confirmed only **WF9 and WF10** have `settings.errorWorkflow` pointed at this handler's workflow id; **WF8 and WFX have no `errorWorkflow` configured at all** — an uncaught node exception in either of those two workflows produces no logged/emailed alert via this mechanism. Separately, WFX's own Anthropic Sonnet (Cover) node still has empty `options` (never received the `max_tokens:16000` fix applied to the sonnet-5 nodes in WF1/WF3/WF5/WF7/WF8/WF9/WF10 on 2026-09-16/17 per `project_sonnet5_max_tokens_trap.md`) — i.e. WFX carries both the higher silent-truncation risk *and* the weaker error-alerting coverage of any workflow in this pass.

## DP-25 / DP-26: User-override surfaces (not AI decisions themselves, but where humans correct the system)

- **DP-25 — "Not for me" / dismiss a career.** Where: `src/hooks/useDismissedCareers.ts:1-40`, table `dismissed_careers` (migration `20260915140000_dismissed_careers.sql:27-32`). Decision type: human, yes/no + reason. Options (exact, from `DISMISS_REASONS`, kept in sync with the DB `CHECK` constraint per the code's own comment): `not_interested, wrong_level, pay_too_low, already_did, location, other`. Storage: one row per (report, section) with `reason`, optional free-text `note`. This is a genuine **ground-truth label source** (see below).
- **DP-26 — Structured chapter feedback.** Where: `supabase/functions/submit-chapter-feedback/index.ts:1-50`. Decision type: human, multi-select + single-select + free text. Options (exact, from `VALID_QUALITY`/`VALID_LENGTH`): quality ∈ `{insightful, encouraging, too_obvious, off_the_mark, other}` (multi-select), length ∈ `{too_long, just_right, too_short}` (single-select), plus `strongest_subsection`/`weakest_subsection` (free text/section id) and `free_text`. Storage: `report_sections` row, `section_type='chapter_1_feedback'`, content = JSON-encoded structure; idempotent (overwrites on resubmit).

## DP-27: Pre-payment intake chat — phase routing + structured extraction

- Where: `supabase/functions/intake-chat/index.ts` (phase routing `:333-417`), `supabase/functions/intake-chat/prompts.ts` (extraction schema `:596-673`).
- Trigger / when: anonymous visitor chats on the landing page, before signup/payment.
- Who waits: user, live in chat UI for the conversation itself; the extraction call (below) runs in the background, not shown live.
- Decision type: **route** (conversation phase) + **extract-value/multi-label** (9 independently enum-constrained fields in one forced tool call) — closely resembles a multi-question batched classification call.
- Options / label set: phase ∈ {Q&A, pitch, post-pitch, hard-close} (4, server-computed from turn count vs. a per-intent beat count, never trusted from the model). Extraction fields (all from a fixed `CANON` table): `career_situation` (7), `primary_goals` (4, max 2), `obstacles` (9, max 2), `short_term_goals` (6, max 3), `long_term_goals` (7, max 3), `ai_familiarity` (5), `avoid_aspects` (10, max 3), `work_schedule` (4), `archetypes` (8, max 2) — plus free-text `dream_job`, `extra_context`, `name`.
- Input state: the full chat transcript + a chip-label-to-canonical mapping table embedded in the prompt.
- Current implementation: `claude-sonnet-5`, forced tool-use (Anthropic tool_choice), schema-enforced enums at the API level.
- Prompt core (verbatim): "When the visitor used a listed chip label, ALWAYS map it to its canonical value. For free-text answers, map onto a canonical value when the meaning clearly matches..."
- Output format + validation: Anthropic tool-use JSON schema; **re-validated a second time** in `prefillFromExtraction` against the same `CANON` table before it's allowed to pre-fill the real survey (defense in depth against a hallucinated out-of-enum value).
- Human correction: yes, directly — extraction only *pre-fills* survey answers; the user sees and can change every one in the real multi-step survey afterward.
- Volume: 1 extraction call per completed intake session (best-effort — failure is swallowed rather than blocking signup).
- Known problems: none documented.

## DP-28: Ops-dashboard AI signal triage (internal tool, not user-facing)

- Where: `supabase/functions/ops-feed/index.ts` (prompt `:464-488`, deterministic fallback `:497-548`, batch call `:550-621`).
- Trigger / when: Sjoerd opens the internal `/ops` dashboard, or a cached item's TTL expires.
- Who waits: admin (Sjoerd), live, bounded to at most 8 new LLM-analyzed items per page load (rest served from a 4-hour cache).
- Decision type: **multi-label** (severity) + **choose-one-of-list** (product stage, 9 values) + generate-text (short summary + one-sentence recommended action) — batched, up to 8 heterogeneous signal items in one call.
- Options / label set: severity ∈ {blocker, needs-action, fyi}; stage ∈ {signup, payment, survey, processing, chat, feedback, report, jobs, unknown} (9). Input signals are pooled from 4 different sources: n8n execution errors, open support tickets, `report_sections` rows carrying WF6's `feedback_category` ∈ {1,2} (DP-19b), and mid-chat chapter feedback.
- Current implementation: `claude-haiku-4-5-20251001`, `max_tokens:1200`.
- Prompt core (verbatim): "Signal-type rules: - n8n_error: almost always BLOCKER... Severity levels: - blocker: user CANNOT proceed at all..."
- Output format + validation: regex-extracted JSON array, per-item fields defaulted if missing.
- Confidence/thresholds/post-processing: sorted severity-first then date-descending; **a fully deterministic rule-based fallback classifier exists and is used whenever no API key is set or the API call/parse fails** (e.g. any `n8n_error` signal is unconditionally `blocker`; any support ticket in a fixed hard-blocking category list is unconditionally `blocker`) — i.e. this is one of the few decision points in the whole pipeline explicitly engineered with a non-AI fallback path for the exact same decision, worth noting as a existing pattern for "how would this degrade without an LLM."
- Human correction: yes — an admin "dismiss" action sets `dismissed_at` and, for support-ticket-sourced signals, also resolves the underlying ticket.
- Volume: ≤8 new Claude calls per dashboard load (each call batches up to 8 signal items together).
- Known problems: none documented.

---

## Latent decisions (regex / keyword / hardcoded rule / manual, not an LLM call)

- Currency routing by region — `Extract Region (code)`, WF2 (DP-3).
- Career title/size fuzzy-matching — `normalizeKey()` in `15TitSizAISal1`, WF2 (DP-5).
- Title-dedup + rank + threshold + backfill — `Ranking` code node, WF3 (DP-9) — the single most consequential non-AI decision found in this pass, since it turns raw LLM scores into the actual top-3/runner-up split the user sees.
- Non-negotiable hard-floor detection for the backfill reason (`step1Of(career) === 5`), inside the same `Ranking` node.
- Resume-issue selection/capping by impact score — `Select & Score`, WF10 (DP-20).
- Route-by-section-type switch — WF6 (DP-19), though the value it switches on is itself set by an upstream LLM agent's tool-call arguments (WF5).
- Error-type routing — Global Error Handler (DP-24).
- Job-search parse-failure fallback (return jobs unscored rather than erroring) — `Apply Scores`, WF8 (DP-18).
- Runner-up-empty-input guard against LLM hallucination — `Parse runner up`, WF4 (DP-12).
- Deterministic salary-restore + array-minimum padding after an LLM ignores a "copy verbatim" instruction — `clean up JSON1`, WF2 (see DP-3 known problems); a completeness guard that hard-fails WF2 if WF1's write didn't land — `Check profile exists`, `WF2 - Source to Enrich 15.json`.
- `translationGate.ts`'s structural validator (HTML-tag-sequence identity, digit-run identity, markdown-marker counts, plus a stopword-based per-paragraph language sniff requiring "≥5 hits and double the runner-up") — the deterministic gate every AI translation must pass before being shown to a user (see DP context in Product-in-12-lines item 11); on 2 failed attempts it falls back to English display and emails an alert, never blocks the user silently.
- `resume-strengthen`'s `selectIssues` — sorts LLM-flagged résumé issues by LLM-assigned `impact`, caps at 5 (7 if the résumé's baseline score is "weak," &lt;40), and clamps every LLM-authored impact value to an integer 1-10 before trusting it (DP-20).
- `ops-feed`'s deterministic rule-based fallback classifier — used whenever the Claude call is unavailable or fails, for the *same* severity/stage decision the LLM normally makes (DP-28) — one of the few decision points in this whole inventory explicitly built with a working non-AI substitute already in place.
- Access-code validation (`verify-access-code`, `signup-with-access-code`, and a SQL RPC `consume_access_code`) — the same 5-condition eligibility check (exists / active / not expired / under usage cap / not bound to another user) implemented three times across three call sites, the SQL version closing a previously-real double-increment race.
- Retention-purge eligibility (`purge_expired_assessment_data`, nightly cron) — a "no newer report" SQL gate specifically added after an earlier version wiped a user's in-progress second assessment along with an old completed one.
- Outreach (full detail in dedicated section below): `classifyOutbound` (deterministic first/follow-up/reply detection), `looksAutomatic` (regex OOO/bounce pre-check), `matchProspect` (4-step deterministic address/domain/slug matching waterfall, DP-O7), `statusForSentiment` + `outreach_advance_status` (fixed mapping + monotonic SQL state machine that never moves a bureau backwards), `outreach_send_blocked` (5-rule SQL gate), `CHASEABLE` set + working-day chase-due-date math (display-only — it never itself triggers a draft; a human click is always required).
- Manual/human steps observed: Sjoerd manually reviews and sends every outreach draft the AI writes (no auto-send of replies, confirmed by `outreach-mail-sync/index.ts:1-8` header comment: "Nothing here sends mail" and the classify prompt's own framing, "Sjoerd zelf nog nakijkt en verstuurt" — "Sjoerd still checks and sends it himself").

## Label sources (stored user feedback/selections usable as ground truth)

- `dismissed_careers` (DP-25) — reason-coded rejections (6-value enum, DB `CHECK`-constrained) of specific AI-generated career recommendations, joinable back to the exact `report_sections` row and its score/metadata. Restore is supported (delete the row); soft-hide semantics differ by section type — a dismissed repeating-group career (runner-up/OOB/dream) is fully dropped from the printed PDF, a dismissed top-3 career stays visible everywhere but flagged (never promotes #2 into the hero slot).
- `report_sections` with `section_type='chapter_1_feedback'` (DP-26) — structured multi-select quality tags (5), single-select length rating (3), strongest/weakest subsection picks (4 each), free text; idempotent upsert per report.
- `report_sections.feedback_category` (WF6's CAT 0/1/2 tag, DP-19b) — an implicit, LLM-assigned label of how much the user's chat pushback actually asked for; not user-editable, but consumed by the `ops-feed` admin triage tool as a severity signal.
- `content_feedback` table — a binary like/unlike toggle on individual chat messages or report sections (`target_type`, `target_id`, `rating:'up'` only, no thumbs-down; `content_snapshot` truncated to 8000 chars) — confirmed via `src/hooks/useContentFeedback.ts`; not yet in generated Supabase types (queried with `as any`), a sign it's a newer/lower-maturity table.
- `saved_jobs.status` — a 4-stage kanban (`saved→applied→interviewing→archived`) the user drags job-search results through, plus optional free-text notes and an `archived_reason` — a genuine implicit-relevance/outcome signal per job-to-career match (DP-18/WF8), not just a save/dismiss binary.
- `custom_resumes.strength_review` (jsonb) — per-issue accept/skip/undo decisions from the Resume Strengthen tool (DP-20), including any user-supplied replacement text for `needs_input` cards — a label source specifically usable to judge the upstream LLM's `impact` scoring (DP-20) against what a human actually agreed was worth fixing.
- `saved_chat_responses` — user-bookmarked coach replies, each carrying an AI-generated 2-3 word label the user implicitly accepts by not editing it.
- `ops_analysis.dismissed_at` — Sjoerd's own dismissal of an AI-triaged operational signal (DP: ops-feed below) — a human "this classification was wrong or already handled" correction, though not tied to any product-facing decision.
- `support_requests.category` — the user's own self-classification of their support ticket from a 9-value dropdown at submission time.
- `outreach_prospects.status` (see Outreach section) — every classified reply's sentiment label is stored, giving a labeled dataset of (email text → 7-way sentiment) pairs, currently produced by an LLM but auditable/correctable since Sjoerd reviews every draft before send, and the `/ops` status dropdown can overwrite the automated value directly at any time.

## Free text in the pipeline

- Survey free-text fields (achievements, hobbies, "other" answers, constraints `1n`) — English or Dutch depending on the user's chosen survey language; typical length not measured directly, but the fact-sheet prompt (DP-15) treats them as short verbatim fragments woven into a fact sheet, not long-form.
- Resume/CV text (WF0, WF9) — PDF-extracted, length varies by resume (typically 1-3 pages of source material per general knowledge of resumes; not measured in this pass).
- Chat messages (WF5) — user-typed, conversational length.
- Scraped job-posting descriptions (WF8) — capped at 600-700 chars before being sent to any LLM (`Prepare Scoring Input`/`Normalize Results` code, explicit `.slice(0, 600)` / `.slice(0, 700)`).
- Outreach reply emails (WF11) — Dutch, capped at `SNIPPET_MAX = 400` chars for the summary snippet and 4000 chars for the classifier's read of the reply body (`replyBodyOnly(text, max = 4000)`).
- Career descriptions/prompts themselves are entirely LLM-generated, not sourced free text (see career-universe finding under DP-1).

## Latency-sensitive paths (user waits on AI now)

1. **WF5 Coach chat (DP-22)** — confirmed the clearest live, synchronous, user-facing AI path, and confirmed **not streaming** (`responseMode: "lastNode"` — the user sees nothing until the entire n8n execution returns). Worse, a single chat turn can chain up to: the agent's own reasoning call → an optional Supabase profile fetch → an optional live SerpAPI web search (no timeout configured on either tool) → a **synchronous, blocking** call into all of WF6 (DP-19: a DB read, a language fetch, a routing switch, one full Gemini generation call or a multi-card regeneration, and a DB write) — all before the webhook responds. No hard timing was measured in this pass; the word-count ceilings (60-150 words standard, ≤220 deep-dive, unlimited for a career replacement) are the closest available proxy.
2. **WF8 Job search (DP-18)** — confirmed **user is blocked in the UI**: tracing the workflow's `connections` graph shows `Respond to Webhook` fires only *after* `Apply Scores` (the final scoring/filtering step), not before — i.e. the whole scrape→normalize→score→threshold chain runs synchronously inside one webhook round trip. Project memory (`project_job_search_free_tier.md`) puts this at roughly 20-90 seconds, inside a 150s edge-function timeout.
3. **WF0 Resume upload (DP-17), WF9 Custom Resume, WF10 Resume Strengthen, WFX Cover Letter** — all confirmed to use a `Respond Immediately`/`Respond to Webhook` node that fires in parallel off the trigger (per each workflow's `connections` graph), i.e. the caller is acknowledged immediately and the frontend polls or subscribes to Supabase Realtime for the actual result rather than blocking the HTTP request — genuine fire-and-forget-with-polling, not just an assumed convention.
4. **WF1→WF2→WF3→WF4 initial report generation** — background; user sees a processing screen (`ReportProcessing.tsx`) polling `reports.status` every 15s, with a soft warning at 5 minutes and an end-state/redirect at 8 minutes (`ReportProcessing.tsx`); on `pending_review` status it additionally checks for an `outside_box` row as a proxy for "WF3 has actually finished" before redirecting to chat. Project memory (`project_wf3_wf4_predictability_fix.md`) estimates roughly 8 minutes end-to-end for the full WF1→WF4 chain.

## Current AI vendors/models in use (exact IDs, per-node, confirmed via each workflow's `connections` graph)

**Anthropic** — the workhorse for scoring, narrative writing, and structured extraction:
- `claude-sonnet-5`: WF1 `generate_personality_narrative1` (maxTokens 20000); WF2 `ai_impact1` (default params); WF3 `Outside Of Box Analysis` (maxTokensToSample 16000); WF4 `Top 3 Careers HTTP` (raw HTTP call, not a LangChain node — `max_tokens:20000, thinking:{type:"adaptive"}, output_config:{effort:"low"}`, the only node anywhere with this exact config), `Runner Up Analysis` and `Dream Job Feasibility` (both maxTokensToSample 20000); WF5 agent's own model (`Anthropic Chat Model1`); WF7 `Basic LLM Chain` (maxTokensToSample 16000); WF8 `Score Jobs` (maxTokensToSample 16000); WF9 `Résumé Content Generation` and `ATS Optimisation Pass` (both 16000); WF10 `Analyze LLM` and `Compose LLM` (both 16000); WFX `Cover Letter` (**`options: {}` — never received the 16000 max_tokens fix**, see DP-24's known problem); edge functions `outreach-mail-sync` (reply classification + follow-up drafting) and `translate-section` (`max_tokens:8192`) both call `claude-sonnet-5` directly via `https://api.anthropic.com/v1/messages`, bypassing n8n entirely. Product-wide convention (confirmed in code comments, e.g. `outreach-mail-sync/index.ts:53`): never send `temperature` to sonnet-5 (it's rejected).
- `claude-haiku-4-5-20251001`: WF0 `Extract Resume Data` (resume field extraction + region/education/career-situation classification, one call); WF9's node literally named "Anthropic Sonnet (Parse)" (`Deep Résumé Parse`) is **actually Haiku 4.5**, a mislabeled node name; edge functions `ops-feed` (admin signal triage) and `ops-marketing` (LinkedIn post classification).

**Google Gemini**:
- `models/gemini-flash-latest`: WF1 `Initial_summary1`/node "3F" (survey→fact-sheet extraction); WF2 `Salary Range1`/"3FP Sal1" and `Enrich B`/"3FP Enrich1"; WF3 `OC Score` (temp 0.1), `Step 2 - Final Score` (temp 0.1), `Extract Interests and history`, `Extract 1k-n`; WF6 all 5 regeneration branches (`Gemini Personality/Outside Box/Dream/Top1/Runner-ups1`, identical, no overrides); WF8 `Gemini Flash (Translation)` (temp 0.1 — actually does keyword generation for the LinkedIn search, despite the "Translation" name; unconditionally fires on every search per a known problem below).
- `gemini-2.5-flash` — edge function `parse-resume-ai` (temp 0.1, JSON mime type).
- `gemini-3.1-flash-lite` — edge function `clean-transcript` (voice-dictation punctuation formatter, temp 0).

**OpenAI**:
- `gpt-5.5` — WF2's `suitable_15` node ("OpenAI Chat Model"), the **only** OpenAI usage found anywhere across all 15 n8n workflows — notably, on the single most consequential generative step in the pipeline (it defines the entire 15-career candidate pool every later scoring/ranking/selection decision operates on).
- `gpt-5.4-mini-2026-03-17` — edge functions `generate-share-quotes` (LinkedIn share-card quotes) and `wrap-up-extract` (chat discussion highlights).
- `gpt-5.4-nano` — edge function `save-chat-response` (2-3 word saved-message label).
- `gpt-4o-mini-tts` — edge function `tts` (voice synthesis; not a decision point).

**Non-LLM external vendors**: Apify (`Apify LinkedIn Scraper`, WF8's job-posting source); SerpAPI (`SerpAPI - opt. deepdive`, an optional tool available to the WF5 coach agent).

**WF0's dead node**: a `Gemini Flash` node exists in WF0 but its `ai_languageModel` connection array is empty (`[[]]`) — wired to nothing, no functional effect; the workflow actually runs on Haiku 4.5.

No LLM vendor found inside WF11/WF12's own n8n JSON (zero LangChain-typed nodes in either file) — every AI call in the outreach scope lives in the `outreach-mail-sync` edge function (see Outreach section).

---

## Outreach (WF11 / WF12) — reply classification and send-gating

Direct finding: **WF11 and WF12's n8n JSON contain zero AI/LangChain nodes.** Full node type list for both (`n8n_wfs_cairnly/WF11 - Outreach Mail Sync.json`, `WF12 - Outreach Send.json`): `scheduleTrigger, gmail, gmailTrigger, code, httpRequest, splitOut, webhook, if, stickyNote`. All reply classification and send-gating logic lives in Supabase edge functions and SQL, called via `httpRequest` from n8n. n8n's own role here is limited to Gmail I/O (it holds the OAuth credential) — confirmed by the edge function's own header comment: "n8n does the Gmail I/O... this function does everything that should live in git."

### DP-O1: Reply sentiment classification

- Where: `supabase/functions/outreach-mail-sync/index.ts:139-140` (`classifyWithClaude`), prompt/tool schema in `supabase/functions/_shared/outreachReply.ts:9-64` (`SENTIMENTS`, `SYSTEM_PROMPT`, `CLASSIFY_TOOL`).
- Trigger / when: WF11's Gmail sync (scheduled 3×/weekday + a `gmailTrigger` polling every 5 min + a debounced "sync now" webhook from the ops dashboard).
- Who waits: background (ops/Sjoerd reviews the resulting draft later, not the prospect).
- Decision type: **choose-one-of-list** (7 options), forced tool-call classification, plus co-generated draft reply text (generate-text) and a one-line summary (extract-value) in the same call.
- Options / label set (exact, `outreachReply.ts:9`): `SENTIMENTS = ['positief', 'code', 'vraag', 'later', 'afwijzing', 'auto', 'overig']`.
- Input state: bureau name, contact person, our last sent mail (trimmed), their reply subject + body (quoted history stripped, capped 4000 chars — `replyBodyOnly`), and a boolean `codeIssued`. Dutch.
- Current implementation: Anthropic `claude-sonnet-5`, forced tool choice (`tool_choice: {type:'tool', name:'classify_reply'}`), `max_tokens: 1200`, `thinking: {type:'disabled'}` (`outreach-mail-sync/index.ts:104-113`), 45s timeout, one retry on 429/5xx.
- Prompt core (verbatim, decisive excerpt, `outreachReply.ts:20-24`): "Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly... Jij leest het antwoord van een bureau, classificeert het en schrijft een conceptantwoord dat Sjoerd zelf nog nakijkt en verstuurt." / per-sentiment handling rules are extremely specific, e.g. for `afwijzing` (rejection) after a code was already issued: "vraag in één zin waarom het niet paste, met vier keuzes op één regel: (a) te weinig tijd, (b) past niet bij onze aanpak, (c) prijs, (d) anders."
- Output format + validation: Anthropic tool-use with a JSON Schema (`CLASSIFY_TOOL.input_schema`, `outreachReply.ts:60-77`: `sentiment` enum-constrained, `samenvatting` string, `concept` string|null) — genuine schema-level validation (`parseClassification` rejects any sentiment not in `SENTIMENTS`).
- Confidence/thresholds/post-processing: none numeric; `sentiment==='auto'` forces `concept:null` (no draft written for automated replies) even if the model returned text.
- Human correction: **every classification is human-reviewed before any action is irreversible** — the output is a Gmail *draft*, never sent automatically (see DP-O6); status changes from a bad classification could still auto-advance the pipeline stage via `outreach_advance_status` (see DP-O4), which is not human-gated.
- Volume: 1 Claude call per new inbound reply (from code — one `classifyWithClaude` call per processed message, capped at `MAX_MESSAGES = 300` per sync).
- Known problems: on any classification failure (including a malformed tool response), the code sets a hard-coded fallback: `row.samenvatting = 'Niet geclassificeerd (AI-fout). Lees de mail zelf.'` (`outreach-mail-sync/index.ts:352`) — i.e. failures are visible to the human operator rather than silently defaulted to a sentiment.

### DP-O2: Outbound-touch classification (first / follow-up / reply)

- Where: `supabase/functions/_shared/outreachMail.ts:217-234` (`classifyOutbound`), unit-tested in `outreachMail.test.ts:97-107`.
- Decision type: route — fully deterministic, not AI.
- Logic (verbatim rule, `outreachMail.ts:222-226`): if the bureau already replied in this thread before this outbound mail's timestamp → `antwoord` (answer), no status change; else count prior first/follow-up touches: 0 → `eerste`/`verzonden`, 1 → `opvolging`/`opvolging_1`, 2+ → `opvolging`/`opvolging_2`.

### DP-O3: Automated-reply pre-check

- Where: `outreachMail.ts` (`looksAutomatic`), regex `AUTO_SUBJECT_RE` matching "automatisch antwoord|automatic reply|out of office|afwezig(heid)?|delivery status|undeliverable|mail delivery" (case-insensitive) plus a sender-prefix check for `no-?reply|noreply|mailer-daemon|postmaster`.
- Decision type: yes-no, regex heuristic. Comment: "Cheap pre-check; the classifier makes the final call" — i.e. this does not short-circuit DP-O1, it's advisory/pre-filtering context, not a hard gate (not independently confirmed how its result is used downstream in this pass).

### DP-O4: Status-ladder progression

- Where: `statusForSentiment()`, `supabase/functions/_shared/outreachReply.ts:112-126`; applied via SQL RPC `public.outreach_advance_status`, `supabase/migrations/20260911130000_outreach_mail_sync.sql:99` (body not read in this pass, only call sites).
- Decision type: route — deterministic mapping, exhaustive switch on the 7 `SENTIMENTS`: `{positief,code} → code_request; {vraag,later,overig} → gereageerd; afwijzing → afgewezen; auto → null (no change)`.
- Access control: the RPC is locked down — `revoke all ... from public, anon, authenticated; grant execute ... to service_role` (`outreach_mail_sync.sql:207-208`) — only the edge function (service role) can advance a prospect's status, not any client.

### DP-O5: Follow-up ("chase") eligibility and step

- Where: `supabase/functions/outreach-mail-sync/index.ts:395-475` (`composePendingFollowUps`, `CHASEABLE`).
- Decision type: route/validate — deterministic, not AI (the follow-up *text* is separately LLM-generated by `writeFollowUp`, not read in this pass, but eligibility is pure rule).
- Logic (verbatim, `index.ts:396`): `const CHASEABLE = new Set(['verzonden', 'opvolging_1']);` — only prospects still at "sent" or "first follow-up" status can be chased again; anything else (replied, rejected, etc.) is silently dropped ("stale") rather than chased. `step: status === 'verzonden' ? 1 : 2` selects which follow-up template/step to write.
- Trigger: driven by an ops-dashboard "Draft follow-up" click (`followup_requested_at` column), not a schedule — runs on every sync regardless of new mail, and a click also debounce-wakes WF11's sync-now webhook.
- Human correction: entirely human-initiated (a person clicks "Draft follow-up" per prospect) and human-reviewed before send.

### DP-O6: Send gating (WF12)

- Where: SQL function `public.outreach_send_blocked`, `supabase/migrations/20260922190000_outreach_send_wake.sql:37-86`; called from WF12 via `Ask for one due mail` (httpRequest) → `Anything to send?` (if).
- Decision type: **validate** — 5 sequential deterministic checks, entirely SQL, no AI:
  1. `gepauzeerd` (paused) flag on `outreach_send_state` → blocks everything.
  2. `next_allowed_at` in the future → "tussenruimte" (spacing/cooldown between sends).
  3. outside the allowed send window (`outreach_send_in_window`, body not read in this pass) → "buiten venster".
  4. daily cap reached (`outreach_send_queue` rows sent today, `p_max_per_dag` default 8) → "dagmaximum".
  5. a queue row still `status='sending'` claimed within the last 10 minutes (in-flight lock against a slow/duplicate n8n run) → "bezig".
- Options / label set: returns one of `{gepauzeerd, tussenruimte, 'buiten venster', dagmaximum, bezig, null}` — `null` means send is allowed.
- Access control: `revoke all ... grant execute ... to service_role` (migration line 212-215) — same lockdown pattern as DP-O4.
- Human correction: the `gepauzeerd` switch is the human kill-switch; per project memory (`project_outreach_send_queue.md`) it is currently the *only* thing holding sending back (WF12 itself has been "ACTIVE since 2026-09-23").
- Volume: WF12 is woken by `pg_cron` only when a send is actually due (no polling), per project memory `project_n8n_execution_budget.md` — this was a deliberate fix after outreach polling was found to be 93% of all n8n executions.

### DP-O7: Prospect/bureau matching (inbound message → CRM row)

- Where: `supabase/functions/_shared/outreachMail.ts` (`matchProspect`).
- Decision type: match-two-entities, deterministic 4-step waterfall, first-hit-wins, no AI: (1) a `utm_content=` slug parsed out of the message body via regex + up to 2 rounds of URL-decoding; (2) counterpart email address equals a known `to_email`; (3) counterpart domain equals a known `domain`/`alt_domain`; (4) the Gmail thread was already tied to a slug earlier in the same run. A message matching none of the four is **silently dropped** (counted in a `skipped` tally, never logged as a mail).
- Volume: runs on every message in every sync (capped at `MAX_MESSAGES = 300`/sync).

### What actually triggers each kind of outbound send — direct answer

- **Initial/first cold mail**: no generator exists anywhere in this scope. The `outreach_send_queue.soort` schema allows an `'initial'` kind, but the only code that inserts rows (`queueChase`) hardcodes `soort:'chase'` — there is no code path that ever queues a first-touch mail. Sjoerd composes and sends the first mail to a bureau entirely by hand; WF11 only retroactively detects and logs it afterward (DP-O2/`classifyOutbound`).
- **Chase/follow-up mail**: the only kind that can be auto-sent. Full chain: a chase becomes "due" (pure date math, DP-O5) → Sjoerd clicks "Draft follow-up" in `/ops` (the human trigger, DP-O5) → WF11 drafts it in Gmail (DP-O1's sibling `writeFollowUp` call) → the draft is inserted into `outreach_send_queue` → DP-O6's gate decides if/when WF12 actually sends it.
- **A reply to an inbound message**: DP-O1 produces a Gmail draft, but that draft is **never** inserted into `outreach_send_queue` — confirmed by reading the draft-creation handler, which only records the `draft_id` for the chase-queueing path (`followup:` prefixed handles), not for ordinary reply drafts. A reply can only be sent by Sjoerd manually opening Gmail. In short: **AI drafts every reply and every chase; code can only auto-send a chase, never a reply to an actual human who wrote in.**

### Outreach verdict (one line)

Reply classification is genuinely AI-based (Claude sonnet-5, forced structured tool-call, DP-O1) and is the only LLM call in the entire outreach pipeline; every other outreach decision found in this pass — which "kind" of outbound touch a mail is, whether it looks automatic, which pipeline status a sentiment maps to, whether a prospect is still chaseable, and whether a send may leave right now — is deterministic code or SQL, and every AI-classified draft is human-reviewed before it can send.

---

## Scope notes / what this pass did and did not verify

This report was produced in two passes: an initial direct pass (via `jq`/`grep` on the workflow JSON and direct file reads, prioritized toward WF2/WF3/WF4's scoring-and-selection core, WF8 job matching, and WF11/WF12 outreach), followed by 8 parallel research agents covering the remaining scope in depth (WF0/WF1/WF2, WF3/WF4, WF5/WF6/WF7, WF8/WF9/WF10/WFX/Error-Handler, WF11/WF12, `supabase/functions/*` + `api/`, `src/` frontend, and `docs/`+project notes), whose findings were integrated into the sections above. Between the two passes, every one of the 15 n8n workflows, every relevant edge function, the frontend override/rendering surfaces, and the career-taxonomy/migration-history question were directly read and cited with file:line references — this is not a partial-coverage report.

Residual gaps and lower-confidence areas, for transparency:
- Per-node model attachment (which Gemini/Anthropic node feeds which chain step) is confirmed via each workflow's `connections` graph for WF0, WF1, WF2, WF3, WF4, WF5, WF6, WF7, WF9, WF10, WFX, and the outreach edge functions; a small number of individual attachments elsewhere are inferred from node adjacency/naming rather than directly traced, and are marked as such inline where relevant.
- `supabase/functions/*` — roughly 20 of the ~53 functions were read in full (the ones carrying decision logic); the remainder were triaged as pure CRUD/plumbing by grep and are listed by name only in the relevant agent's report, not individually verified beyond that grep.
- `src/` — the override/feedback surfaces, the 4 pill-rendering locations, survey-flavor routing, and several client-side heuristics (chat quick-reply intent, job-result bucketing, career-map coordinate mapping) were directly read; the full `src/pages`/`src/components` tree (33+ component directories) was not exhaustively read line-by-line.
- `n8n_wfs_cairnly/notes/*_PROPOSED.md` and `*_APPLY.md` files were cross-checked against the live workflow JSON where cited (several proposed fixes were confirmed live, several confirmed **not** applied — see DP-10's and DP-11's known-problems for specific examples); treat any note file's title as a historical record of intent, not a guarantee of current behavior, unless a DP above explicitly says "confirmed live."
- No git/DB/API/n8n-MCP mutating calls were made anywhere in this pass; all reads were local-file/read-only, consistent with the task's constraints. No personal user data (real CV content, real names, real email addresses/content beyond short structural examples) is reproduced above.
