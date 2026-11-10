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
