# Encore v2: n8n plan for WF1P and WF2P

Status: approved by Sjoerd 2026-11-10 ("yes WF1P" / "yes WF2P") and applied in n8n the same day; both workflows still inactive. Current exports: `n8n_wfs_cairnly/WF1P - Encore Profile Insert EN.json` and `n8n_wfs_cairnly/WF2P - Encore Source to Enrich 15.json`. Backups of the current state: `n8n_wfs_cairnly/backups/WF1P ... _BACKUP_pre_v2_20261110.json` and `WF2P ... _BACKUP_pre_v2_20261110.json`. Both workflows stay inactive; Sjoerd activates.

Question ids and answer values: `docs/encore-v2-question-ids.md`.

## WF1P (e8CCWoDbMuAmBId5): profile

Changes, 4 nodes:

1. **Process Survey Data1** (code): replace the v1 `SURVEY_SCHEMA` (41 `b2b2b2b2` ids, keys 1a-7d) with the 28 v2 ids (keys 1.1-7.3, 7.2 skipped), English labels and option lists. Handle slim career_history entries (title, company, years, the per-role "what you did" text). Output shape stays `{report_id, user_id, preferred_language, summary, questions[]}`.
2. **prompt_init_summary1** (fact sheet for Gemini): rewrite for the v2 fields and sections. Must print the region band verbatim (WF2P's Extract Region reads it from this text, falls back to Northern and Western Europe silently). Must carry 6.1-6.4, 3.3, 3.4, 3.5 and 5.1-5.2 so WF2P-WF4P can read them.
3. **prompt_perso_prof1** (the 4-section narrative): retarget to strengths, energy and what they want to keep (2.2, 2.3, 3.2, 4.1-4.3), what to avoid (2.4), what matters (4.4, 3.1 read by meaning, never exact text). Drop happiness ratings, ranked priorities, good-year, AI note, education. Dutch line switches from "je, never u" to "u". Same 4 section_types (approach, strengths, development, values) so the dashboard keeps working. Personality radar scores: drop for Encore (v2 has too few signals; dashboard shows no radar when scores are missing).
4. **extract_report_sections_code1**: new subheader patterns (EN + NL "u") matching the new prompt headings.

Unchanged: webhook (same URL, so v1 submissions would break after this; 0 v1 reports exist and paid codes now mint v2), Gemini/Claude models, SB insert, status update, WF2P trigger.

What could break: section split if headings drift (fallback keeps the whole text as one block), region default, dashboard section titles.

## WF2P (HOuMhANfFnDjUqmw): 15 options

Already Encore-framed (forms, dignity, hours, no filler). Changes, 1 node:

1. **Set Suitable 15 Prompt1**: rewrite the input reading (STEP 1) and the mix rules for v2 signals:
   - Forms come from 3.4 (what they want to explore) instead of the fixed "at least 5 non-employment" rule; at least 2 options outside their picks for "options I hadn't thought of" (7.1).
   - Every option names who it serves, from 3.3.
   - Hard limits: hours 6.1, fixed calendar 6.2, place 6.3, pay 6.4, energy and company 4.1/5.3/5.4, rhythm 4.2, role 4.3, glad-to-leave 2.4.
   - The 3.5 idea gets an honest, realistic option when present.
   - 1.4 (stage) and 1.5 (own choice or decided for them) set urgency and tone.
   - Remove v1 inputs that no longer exist: happiness ratings, 8-item ranking, good year, fears, tendencies, AI feeling, language profile, education.

Unchanged: 15 options and the JSON shape (WF3P/WF4P depend on it), AI impact, Salary Range1 (it only sees titles; whether pay is shown is a WF4P call based on 6.4), enrich prompt (already Encore-framed; first step per option belongs in WF4P), Supabase insert, WF3P trigger. Output stays English, Dutch happens in WF3P/WF4P, same as Pro.

What could break: JSON parse in 15TitSizAISal1 if the output format drifts (keep the format block verbatim).

## Applied beyond the plan

- WF1P profile headings are new, Encore-specific: How You Work Best Now / What You Bring / What to Watch For / What Matters to You Now (NL: Hoe u nu het beste werkt / Wat u meebrengt / Waar u op moet letten / Wat nu voor u telt). Same section_types. They need Sjoerd's OK in copy doc 2b, with the dashboard one-liners per section.
- Profile length 200-280 words per section (was 280-350), because the survey is shorter.
- From the strategy thread (pending Sjoerd's read): one-sentence acknowledgement of 1.5 "decided for me"; banned age labels (senior, oudere, pensionado, vitaal ouder worden, nog niet afgeschreven, never too old); WF2P country routes (NL toezicht, PUM, NLvoorelkaar, ZZP; UK and US equivalents), at least one Dutch toezicht option when allowed, realistic entry route for every paid option, age bias named only where real and never "hide your age".
- WF2P `Combine rep and profile1` also passes the report language (from report_sections.language) so the prompt can pick country routes.

## Test

Run both on a test submission (code TEST-ENC2-V2NL-K7Q4, one EN and one NL) with WF3P/WF4P still on v1 logic, inspect report_sections and enriched_jobs, then gate B on 3-5 profiles after WF3P/WF4P.

# WF3P and WF4P (applied 2026-11-10 after Sjoerd's "OK to edit WF3P and WF4P"; all four workflows still INACTIVE)

Backups: `n8n_wfs_cairnly/backups/WF3P - Encore scoring directions EN_BACKUP_pre_v2_20261110.json` and `WF4P - Encore Direction selection EN_BACKUP_pre_v2_20261110.json` (commit 1ba219b). Both inactive. Every prompt in both is keyed to v1 question codes ([2b] happiness log, [4a] ranking, [5a] hours, [6e] liability, [7b] always-wanted-to-try), so this is a full prompt rewrite. The code nodes and JSON keys stay, so Ranking, Prep WF4 data and the inserts keep working.

## WF3P (oqS22CXD84dAqwjk): scoring, 15 to top 3 + runner-ups + 3 outside-the-box

Prompts that change (6):
1. **Extract encore evidence**: v2 question list instead of the v1 codes.
2. **Extract Interests and history** (profile summary used by outside-the-box and WF4P): same headers, filled from v2 fields; "Dream Jobs" becomes their idea (3.5).
3. **Objective Compat score** (step 1, max 64, same 4 blocks): experience from roles, known-for and what they loved (2.1-2.3), no education or skills list; purpose from the 3 picks (4.4), audiences (3.3), 3.1 and pay (6.4); energy, time and people from 6.1, 4.1, 4.2, 5.3, 5.4, 6.2, 6.3; interest from 2.3, 3.2, 3.5. Hard limits from 2.4 and 6.1-6.4; board liability only when 3.4 allows boards. Strategy input: entry feasibility weighs more when 1.5 is "decided for me" and pay matters.
4. **Step 2 analysis** (max 44, total stays 108): "happiness pattern" becomes "usefulness pattern" (2.3, 3.2 against the direction), transition fit from 1.4, 1.5, 3.1, 4.4; penalties read WF1P's "What to Watch For". JSON key names unchanged.
5. **Set Outside Box Prompt**: v2 fields, Dutch "u", age-label ban, roles already held from 2.1.
6. **Parse OOB**: Dutch heading "Waarom dit bij je past" becomes the "u" version (frontend share-quote list gets the new string too).

Unchanged: webhook, Supabase pulls, Ranking (top 3 + up to 3 runner-ups at 55+), batching, inserts, WF4P call.

## WF4P (ID5CaNR7Ux7TEzS5): report texts for top 3, runner-ups, the idea

Prompts that change (3) plus 3 parsers:
1. **T3 Careers Prompt** and **Set Runner Up Prompt**: v2 fields; Dutch "u". Every option gets a first step they can take next week, and one line on how people actually get in at this stage. Pay shown honestly, and kept short when 6.4 says money is not the point. Age bias named at most once, only on paid routes, with a counter-move, never "hide your age". NL users near or past AOW who want paid work: mention the lower employer risk (shorter sick pay). Partner context (5.1, 5.2) where it changes the advice. "A quiet year" is allowed as a valid conclusion when the evidence points there.
2. **Dream Job Feasibility** becomes "your idea" (3.5): an honest look at their own idea. 3.5 is optional, so a decision is needed for people without an idea (see below).
3. **Split Top3, Parse runner up, Parse Dream**: Dutch heading lists in "u".

Unchanged: webhook, report-language lookup, Supabase pulls and inserts, analysis-completed call.

## Added from the strategy thread (Sjoerd's answers, 2026-11-10 14:24)
- NL first at launch: the Dutch route catalogue in WF2P is the one that matters; the UK/US lines stay as harmless fallbacks.
- AI honesty: for paid knowledge-work options, WF4P (top 3 and runner-ups) says plainly which AI skills the role now expects, and the first step includes one small way to build them. Not for volunteering or hands-on routes. WF2P needs no change for this: its AI impact and enrich steps already cover tooling per direction.
- Job hunting and CV help stay in Cairnly Pro: WF4P may point to Pro as an add-on when someone wants paid work and needs that help.

## Open decisions for Sjoerd
- No idea in 3.5: DECIDED 2026-11-10 by Sjoerd: skip the idea section (Dream prep / Dream Job Feasibility only run when 3.5 has text; check the dashboard and PDF handle a missing dream_jobs section).
- Executive summary: the v1 Encore chain ends at analysis-completed and WF7 has no Encore branch. Check whether Encore needs its own summary (the "open with the 3.1 problem" line from the plan lives there).

## Status 2026-11-10 evening: WF1P, WF3P, WF4P rewritten (inactive)

Review findings from the "Encore prompt review" doc (https://claude.ai/artifact/RxXqYY3ST8RyLdaGdQ11kf) are folded in. Exports on main: WF1P, WF3P (9d8584e), WF4P (e513163).

- **WF1P**: the extract node now writes a structured `facts` object (region, typed location, age, stage, roles, audiences, forms, idea, role fit, picks, partner, time, calendar, place, pay, worth_it, ...) to the init_summary row's `metadata.facts`, so later prompts read answers as data. Heading parsing only matches at line start (no more splits on "key insight" mid-sentence). Personality subheaders: What People Count On You For / Where Your Energy Comes From; Your Core Strengths / What Carries Over, and What Does Not; Old Habits in a New Setting / What This Means for Your Choices; Your Values Now / Choosing With Your Values; Key Insight (NL "u" equivalents in the code).
- **WF3P**: step 1 reweighted (usefulness 22, time/energy/people 18, experience 14, pull 10 = 64); step 2 usefulness pattern 20, strengths 14, trajectory 10, with burnout/development/feasibility penalties. Ranking now sums the parts in code with clamping and only falls back to the model total when it is 0-108 (a garbage 200 used to rank first). Facts passed on to WF4P. Outside-the-box: no product names, no idea suggested on their behalf, NL heading "Waarom dit bij u past".
- **WF4P**: new top-3 prompt (Overview, Why this fits you, What you'll actually do, How people get in, Your first step, The Reality Check, The practical stuff with Money/Time/People/Place, AI impact, Future-proof skills only for paid desk work). Age bias, the Pro add-on sentence and "a quiet season" each owned by the top 3 only, once. Runner-ups 170-220 words, no legal claims. "Your idea" first classifies tried-and-stopped / doing it now / not yet tried, then proposes a small version to test. New IF node "Has idea?" skips the idea branch when 3.5 is empty. Parsers carry EN and NL ("u") heading lists.
- **Frontend** (3f32987): icon map and share-quote anchors know the new EN and NL headings. headingPins untouched (Pro only).

Deferred (to report with the test): WF2P passing overview/why_this_fits through, form and pay per direction, country capture in the region picker, WF2P quotas and executive assumptions in Salary/AI/enrich, pinning the Gemini model version, batching step 2, how scores are shown, fixed AOW/WW sentences (needs Sjoerd), a verified organisation list, an Encore executive summary, copy doc 2b for dashboard labels in "u".

Next: end-to-end test with TEST-ENC2-V2NL-K7Q4 (EN and NL). Needs WF1P-WF4P active, which is Sjoerd's action or his explicit OK.

## Persona test round 1 (2026-11-11)
Four personas ran end to end (findings: /mnt/project-files/encore-tests/runs/20261110/findings.md).
- Triple runs: one WF2P call reached WF3P as 3 HTTP requests. Fixed with `claim_workflow_stage` (migration 20261111190000) and a claim + IF + restore step after each webhook in WF2P, WF3P, WF4P.
- NL top_career_3 cut off (Henk, Marjan): output hit maxTokensToSample 16000. Raised to 21000 on all three WF4P Anthropic models (32000 failed: the Anthropic SDK requires streaming above ~21333 max tokens); Split Top3 throws when direction 3 has no comparison JSON.
- Peter had 10 of 15 enriched rows: a stray `]` in one Enrich B batch failed the whole batch. WF2P "clean up JSON1" now repairs stray/missing brackets and trailing commas and falls back to per-object parsing; warns when fewer than 15 come out.
- Open: ranking ignores form (3.4) and pay (proposed hard rules: 2 of top 3 in a ticked form, no unpaid in top 3 when pay matters, non-negotiable clash never #1); OOB names organisations and invents roles/quotes; NL reports show English AI labels including off-scale "Low"; scores vary between identical runs (observation).

## Persona test round 3 fixes (2026-11-13, need Publish of WF2P, WF3P, WF4P)
- WF2P: Enrich B only received title and company, so it invented salary (one batch of five in US dollars), AI ratings (off-scale "Low") and path types. "combine to " now feeds it the 15TitSizAISal1 items, and "clean up JSON1" puts the upstream salary, ai_impact_rating, path_type and path_type_notes back after enrichment.
- WF3P OOB prompt: new HARD LIMITS ON FACTS block (no named organisations, no quotes, only real searchable titles, never refer to "the personality profile").
- WF4P idea prompt: Dutch bullet lead-ins (Contact en energie, Tijd en ritme, Geld), no English words, Dutch titles for other directions.
- Not changed: AI labels stay English in the report text by design (CareerScoreCard parses them; pills translate). Showing them in Dutch in the body is a frontend display change that also affects Pro NL. Hours steering, spread rule and score stability wait on Sjoerd's ranking decision.
- Ranking rules (Sjoerd chose "hours and variety", 2026-11-13): Step 2 - Final Score appends a request for `honest_hours_per_week` and `activity_family` per direction. Ranking maps 6.1 to a weekly range (few hours a month 0.5-3, half a day 3-6, one or two days 8-16, three days+ 20-40, season = no rule), deducts up to 12 points when a direction is under 75% of the low end and up to 6 when over 150% of the high end, and allows one direction per activity_family in the top 3 (same family = all words of the shorter label in the longer one). `hours_check.combine_needed` (wanted >= 8 h and all top 3 under 60% of the low end) goes via Prep WF4 data to WF4P, where the Top 3 Careers Generator adds one combine sentence to direction 1.
- Round 4 (2026-11-13): enriched_jobs.path_type was null for all rows because suitable_15 now returns unfenced JSON and 15TitSizAISal1 only read a ```json block (previously hidden because Enrich B invented path types). 15TitSizAISal1 now reads fenced, bare or wrapped JSON. Salary stored as a JSON string is pre-existing and identical in Pro WF2 (`JSON.stringify($json.salary)` in Supabase Insert1); left as is.
- Pay rule (Sjoerd chose "low pay can't be #1", 2026-11-13): Step 2 - Final Score also asks for `pay_level` (none/low/fair). When 6.4 starts with "Yes", Ranking pulls the best clean fair-paid direction into #1 if the top 3 has none, and orders the top 3 paid first. Summary reports `pay_rule`.

## Round 5 review fixes (2026-11-13, published WF3P 99aa84c4, WF4P a1294f13)
- WF3P OOB prompt: no organisation names in titles; no internal words (main set, pivot, outside-the-box keuze) in output; realistic way in (no volunteer roles at statutory bodies unless real, no "volunteer beside a therapist", no care coordinator without care background); licence examiner/instructor roles only with that exact licence (forklift is not truck examiner); never third person.
- Shared "Facts you must get right" block in OOB, Top 3, runner-up and idea prompts: current year from `$now.year`, no "in uw land", no hard "verplicht"/"gebruikelijke eis" claims unless certain, people named by role (not "uw partner"), no italic asides, Dutch spelling check.
- WF3P Ranking: runner-ups that outscore a top 3 pick carry `held_back_reason` (variety/pay) and `similar_to_top3`; the runner-up prompt explains this in one sentence.
- WF4P Top 3: employee-only history + freelance direction = "first step into freelancing" line, plus one benefit/pension check sentence per report.
- Idea section: Heads-up is a bold label line (Dutch **Let op:**), not italics.
- Open: combine-hours threshold (Sjoerd's pick pending: 60% of minimum vs all under minimum).

## Eval fixes (2026-11-13, WF3P ab5efa44)
From the first eval run (n8n_wfs_cairnly/evals/):
- Ranking repairs broken Step 2 JSON (stray brace, trailing commas, per-career fallback). If fewer than 3 directions, or under 70% of the expected count (Step 2 text or Pull enriched rows), survive, Ranking throws so the Error Handler alerts instead of WF4P writing an empty top 3. Margaret's broken run (eval exec 15340) recovers all 15.
- activity_family now comes from a fixed list of 33 activities in the Step 2 prompt; equal labels = same activity (word rule only for "other: ..."). Eval after fix: variety_ok 1 for all 4 personas (Marjan was 0.33).
- combine_needed: all three top 3 directions under the minimum wanted hours (Sjoerd 2026-11-13), was under 60% of the minimum.
- Stability after fix (eval run 15351): top3_stability 0.78 for Marjan, Peter, Margaret, 0.56 for Henk; #1 same for Henk and Peter, 2 of 3 for Marjan and Margaret. The remaining flips are 2-5 point scoring noise between close options. Experiment: Gemini temperature 0.2 in the eval copy only (run 15379).
- Temperature experiment (eval run 15379, Gemini 0.2 on OC Score, Step 2, encore evidence): top3_stability Marjan 1.0, Henk 0.78, Peter 0.78, Margaret 0.56 (avg 0.78 vs 0.73); #1 same in 11 of 12 runs vs 10 of 12; no failed runs. Adopted in WF3P 3f8ead5f (eval copy has the same setting). Remaining flips are between options within ~4 points; the next step, if needed, is scoring twice and averaging (about double Gemini cost and a few minutes longer per report).

## Round 6 fixes (2026-11-13, WF4P a48e9c63 + translate-section)
- WF4P runner-up: the held_back_reason "variety"/"pay" sentence is now a warm reader-facing sentence with an EN/NL example; never copy the instruction (Peter's report printed "so the top 3 shows something different instead").
- Dutch "je" in NL reports came from the chat rewrite path, not WF1P/WF4P: WF6 (Pro) regenerates a section in canonical English, then translate-section translated it in the Pro "je" register. translate-section now detects Encore reports (survey ...0003/...0004) and uses formal "u", an Encore audience line and Encore heading pins (_shared/headingPins.ts ENCORE_HEADING_PINS). Encore sections already written in Dutch are skipped quietly instead of raising a "canonical-not-english" alert.
- Exec summary in English for NL: WF7 inserts English, translate-section adds Dutch ~30s later, but the dashboard stopped polling once the English row appeared. useReportSections now keeps polling (max 3 minutes) until the translation is there.
- Prompt review of round 6 (WF4P 49e5aa7c and WF3P 5d65b12b published; evals 15632: avg stability 0.81, variety OK): Ranking treats titles sharing a core-activity word (implementation, rollout, mentor, mediator/mediation, examiner, invigilator, treasurer, inspector, auditor) as the same activity (Henk's two implementation roles); every runner-up skipped for variety carries held_back_reason (Peter's tie at 83 got none, WF4P invented a reason). Step 2: implementation work is always "software and systems implementation". FACTS block in OOB/T3/runner-up/Dream: never print the region label, never carry a role over from another country's system (Peter's UK-style "Tax Tribunal Lay Member"), Dutch -t verb form after u, "één", singular titles.
- Not changed, on purpose: Henk #1 pay (Step 2 rates it fairly paid; the pay rule only acts on low/none), Marjan #1/#2 (outside school, no meetings, matches her 7.3), Marjan #1 company size and hourly rate (WF2P enrichment, minor). WF6 top-3 "No changes needed" and the English write-back are fixed by the coach chat thread (WF6 read feedback from the wrong node).
