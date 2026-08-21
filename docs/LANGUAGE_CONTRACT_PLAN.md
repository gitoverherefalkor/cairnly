# Plan: one language contract, end to end

**Status:** proposal, nothing executed. **Written:** 2026-08-20.
**Supersedes the diagnosis in** `n8n_wfs_cairnly/NL_language_lock_redesign_PROPOSED.md` (its *mechanism* analysis is still correct and worth reading; its *state* is out of date, see §1).

---

## Context

A live Dutch report is half English. Report `08ec34ec-89a1-4ae8-a7c6-75e4f6183588`, profile
`preferred_language = 'nl'`, 17 sections:

| Body language | Sections |
|---|---|
| Dutch (correct) | `approach`, `development`, `strengths`, `values`, `top_career_1/2/3`, `runner_ups` ×3, `init_summary` |
| English (wrong) | `dream_jobs` ×3, `outside_box` ×3 |

**All 17 rows are stamped `language = 'nl'`.** That is the finding this plan is built around.

Every previous attempt fixed one leak and left the shape that produces leaks intact. This plan
targets the shape.

### Three root causes, in order of how much damage they do

**1. Language is declared, never measured.** `report_sections.language` is `TEXT NOT NULL DEFAULT
'en'`, written from the *intent* that started the run. Nothing ever compares it to the text that
came back. Six rows above prove the column can be confidently wrong. Every consumer trusts it:
`deliver-section/index.ts:200-212` explicitly prefers the section's own `language` over the profile
preference (a fix applied earlier, and correct in principle), so it now wraps English dream-job
prose in Dutch chat boilerplate. WF7's exec summary picks the report language by polling those same
rows. A lying column is worse than no column, because it silently converts a content bug into a
presentation bug somewhere else.

**2. Language is resolved at inference time in some nodes and at expression time in others.** The
nodes that work resolve the language *before* the prompt is assembled, so the model sees one flat
sentence naming exactly one language near the top. The nodes that fail still hand the model a
decision (a conditional, or a hard English lock contradicted 19,000 characters later) and the model
adjudicates it against 20KB+ of English career data. It loses. This is per-node, not per-workflow,
which is why the same workflow emits Dutch top-careers and English dream-jobs.

**3. The repo exports are stale, so nobody can reason about live state.** The checked-in
`n8n_wfs_cairnly/WF4 - Career selection NL_EN.json` still shows `!!! ABSOLUTE LANGUAGE LOCK` on
`T3 Careers Prompt`, `Set Runner Up Prompt` **and** `Dream Job Feasibility`, and contains no
`Language Blocks` node. Live output proves the first two now resolve Dutch. Live WF4 was last
updated 2026-08-17; the export predates that. Any plan that reads the repo to decide what to change
will change the wrong thing.

### Secondary cause worth naming

**Language has three different names.** `profiles.preferred_language`, `report_sections.language`,
and `lang` in the `verify-access-code` request body. Each edge function re-implements the read and
picks its own missing-value default. There is no single resolver, so "what language is this user"
is answered slightly differently in a dozen places.

---

## The contract

Four rules. Everything below is mechanical once these hold.

1. **One name.** `language` in every payload, column and function signature. `profiles.preferred_language` stays (it is the user's stored preference and a different concept), but the moment it is read it becomes `language`.
2. **One resolver.** Anything not exactly `'nl'`, including `undefined`, `null`, `'NL'` and `'nl-NL'` before normalisation, resolves to `'en'`. English is the safe default and must be unreachable by accident.
3. **Resolved before the prompt, never inside it.** No generator node may contain a conditional, a ternary, or the name of a language it is not writing in. The prompt receives a finished instruction.
4. **Stamped from the artifact, not the intent.** `report_sections.language` records what the text *is*, measured after generation. If measurement disagrees with intent, that is an incident, not a silent write.

---

## Phase 0: freeze the truth (no behaviour changes)

Nothing else is safe until this is done.

- **Re-export every live workflow** to `n8n_wfs_cairnly/` via the n8n API. This is both the rollback artifact and the only trustworthy diff baseline. The current exports are demonstrably stale.
- **Add the language audit as a saved query** (`docs/sql/language_audit.sql`). The sniffer used to produce the table above, generalised:
  ```sql
  SELECT s.report_id, s.section_type, s.language AS stamped,
         CASE WHEN s.content ~* '\m(het|een|jouw|jij|omdat|niet|maar|deze|voor)\M'
              THEN 'nl' ELSE 'en' END AS measured
  FROM report_sections s
  WHERE s.language <> (CASE WHEN s.content ~* '...' THEN 'nl' ELSE 'en' END);
  ```
  Any row returned is a mismatch. Today this returns 6 rows for the report above. The target is zero, and this query is the acceptance test for the whole plan.
- **Correct the docs that are now wrong.** `CLAUDE.md` and `NL_language_lock_redesign_PROPOSED.md` both state or imply WF3/WF4 are hard-locked to English and Dutch is unreachable. That was true on 2026-07-08 and is not true now. Leaving it uncorrected is how the next session re-derives the wrong fix. Also note in `CLAUDE.md` that exports go stale and must be re-pulled before any workflow reasoning.

---

## Phase 1: one resolver, one field name

**New:** `supabase/functions/_shared/language.ts`

```ts
export type Lang = 'en' | 'nl';
export const resolveLang = (v: unknown): Lang =>
  String(v ?? '').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en';
```

This is the same normalisation `verify-access-code/index.ts` already does inline (`pickLang`); lift
it, do not re-invent it. Then:

- Every edge function that reads a language imports `resolveLang`. Delete the per-function copies.
- Every outgoing payload carries `language`, not `lang` or `preferred_language`. Keep accepting the old key for one release so nothing breaks mid-deploy.
- `forward-to-n8n` is the important one: whatever key it puts on the WF1 webhook is the key every workflow reads downstream. Fix it here and the workflows inherit it.

Frontend already has one resolver (`i18n.language`) and PR #79 wires it into the three
`verify-access-code` call sites. Nothing more needed there.

---

## Phase 2: fix the two broken generators

This is the visible half/half. Two nodes, and only two.

| Workflow | Node | Currently |
|---|---|---|
| WF4 | `Dream Job Feasibility` | unresolved / hard-locked, emits English |
| WF3 | `Set Outside Box Prompt` | unresolved / hard-locked, emits English |

**Do not design a new pattern.** `T3 Careers Prompt` and `Set Runner Up Prompt` in the same
workflow already produce correct Dutch. Export live WF4, read what those two nodes do, and apply
exactly that to `Dream Job Feasibility`. Same for WF3's `Set Outside Box Prompt`. The fix is
"make the broken nodes look like the working ones", which is far lower risk than inventing a
third pattern.

**Method, non-negotiable** (this is the one part of the prior proposal to carry over verbatim,
and it was right):

- Build the edit **with a script**, never in the n8n expression editor. The prompts contain
  typographic apostrophes, `€`, `->` and triple backticks; a browser textarea is the single
  largest risk here.
- Slice the English arm **programmatically out of the live export**, never retype it. Assert
  `EN_ARM === original.slice(start, end)`.
- Anchor on literal strings (`!!! ABSOLUTE LANGUAGE LOCK` … `!!! END LANGUAGE LOCK !!!`), never
  on byte offsets. The prior proposal measured the lock at 441 chars after a draft claimed 417;
  an offset-based edit would have left a 24-char fragment in every English prompt.
- **WF3 differs from WF4:** in WF4 the language tail runs to end-of-string, in WF3 it is followed
  by ~966 chars of `# INPUTS` carrying every data injection the prompt has. Applying the WF4
  recipe to WF3 deletes them. Anchor the WF3 tail to stop before `# INPUTS`.
- **Byte-diff gate:** render the edited node with `language='en'` and diff against the original.
  Require **zero bytes of difference**. Render with `undefined` and `'EN'` and confirm both fall
  to English. Only then PUT.

---

## Phase 3: pin the machine contract inside the Dutch arm

Dutch prose is the goal; Dutch *structural tokens* break the app. In the NL arm, pin these as
English literals:

- `## How AI will impact this role` and `Future-proof skills` (`extractAIImpact` regexes these; if it returns null, `CareerQuadrant` bails and the whole Career Map disappears)
- the five feasibility labels, the `<!--move:X-->` tokens (`Ready now` / `Reframe` / `Upskill` / `Retrain`), `<!--company:X-->` bands
- `---CAREER_SPLIT---` (`Split Top3` throws `Expected 3 careers but found N` without it, and that failure means the report silently never completes)
- JSON keys and `fit_scores` / `move` values. `headline` and `explanation` **must** be Dutch: they render at `DashboardV4.tsx` and are pushed into chat.

**Belt and braces in the frontend:** widen the parsers to accept both languages rather than relying
on the pin alone. `dashboardV2Shared.tsx`, `CareerScoreCard.tsx` and the subsection-icon map should
union the English and Dutch heading sets. Pure alternation, no English behaviour change. Do both:
the pin prevents the breakage, the union makes it non-fatal if a future prompt edit forgets.

---

## Phase 4: close the loop

The part every previous attempt skipped, and the reason this keeps recurring.

- **Stamp from measurement.** In the four parser nodes (`Split Top3`, `Parse runner up`, `Parse Dream`, `Parse OOB`), run a cheap Dutch-stopword sniff over the produced text and write *that* into `report_sections.language`, not the intent.
- **Flag disagreement.** When measured ≠ intended, log it and surface it. Options, cheapest first: a `language_mismatch` boolean column; a row in an existing ops/log table; or reuse the Global Error Handler (`FbsruPbuZI2Fgtc8`) which already does email alerts. Recommend the error handler, since it needs no schema change and someone already reads it.
- **Gate `analysis-completed`** on zero mismatches, or let it through but mark the report. Sjoerd's call, see open questions.
- **`Parse OOB` also needs its subheader fix**: it currently picks the Dutch subheader list because the column says `nl`, finds none in English text, and stores the section with zero `<h5>` tags. Union both arrays and add the generic `## X` → `<h5>` rule that `Split Top3` and `Parse runner up` already have.

Once this phase lands, the Phase 0 audit query is a permanent regression test, not a one-off.

---

## Phase 5: the surfaces still in English

Independent of the pipeline, branch-deployable, zero live-prompt risk.

- **Merge PR #79** (candidate path: dashboard → survey → report processing, 317 keys). Green, mergeable, waiting on review.
- **`src/components/assessment/PreSurveyUpload.tsx`** — the CV upload screen, entirely hardcoded English, sits between access-code verification and the survey. Confirmed still English; missed by the twelve-file handoff inventory.
- **Six `DashboardAppNav` callers** pass hardcoded English `pageLabel` / `backLabel`: `JobsSearch`, `JobsResults`, `JobsSavedKanban`, `JobsLocked`, `CustomResume`, `Profile`.
- **`PaymentSuccess.tsx`**, cookie consent banner, sibling auth pages (forgot/reset password, email confirmation).
- **Résumé templates** — section headings are hardcoded English literals in the React templates while WF9 writes Dutch bullets. This is the only Dutch artifact a user hands to a third party, so it is higher stakes than its size suggests.
- **DB content:** `questions.translations.nl.langLabels` is unpopulated on both `skills_achievements` questions, so language preset names render English. Starter and Encore surveys have zero Dutch question translations (0/40 and 0/41).

---

## Verification

**Static, before anything is written:**
1. Byte-diff gate on every edited prompt node (Phase 2). Zero bytes of English difference, or stop.
2. Full node-array diff before/after: exactly the intended fields changed, plus any new node, nothing else.

**The reproduction tests that matter** (both directions, because only one has ever been tested):
3. **Dutch cue pressure on an English user:** a candidate with a Dutch name and Dutch employers whose `language = 'en'`. This exact profile broke WF1 twice in July. Run it twice; the original failure was reproducible.
4. **English cue pressure on a Dutch user:** an English-named candidate with English employers whose `language = 'nl'`. Never tested, and it is the harder direction: a Dutch run receives 20-25KB of hardcoded English survey schema and English enriched career data from WF2.

**End to end:**
5. Three to five full `nl` reports through WF1→WF7, read by a Dutch speaker. Check the machine contract too, not just that it reads as Dutch: every prescribed `<h5>` present, `<!--move:-->` still an English token, `---CAREER_SPLIT---` intact, three careers parsed, fenced JSON present with Dutch `headline`/`explanation`.
6. **Phase 0 audit query returns zero rows.** This is the acceptance test.

**Never** execute WF4 against a real report to test: its insert nodes use `autoMapInputData` and it
POSTs to `analysis-completed`, so a test run duplicates rows for a paying customer. Use a throwaway
report id with `Insert Top 3`, `Insert Runner Ups`, `Insert dream` and the `analysis-completed`
node disabled.

**Cutover gate:** WF6 never writes the `language` column. A pre-fix Dutch report that receives chat
feedback afterwards gets exactly one section regenerated into Dutch inside an otherwise-English
report. Report `08ec34ec…` predates this fix; delete and re-run it rather than letting WF6 patch it.

---

## Sequencing

Phase 0 first, always. Then Phase 1 and Phase 5 in parallel (both branch-deployable, no live-prompt
risk). Phase 2 and 3 must ship together, since Phase 2 makes Dutch reachable and Phase 3 stops
Dutch from breaking the parsers. Phase 4 last, because a mismatch detector on a half-migrated
pipeline generates noise rather than signal.

---

## Open questions for Sjoerd

1. **Does a mismatch block the report or just flag it?** Blocking means a Dutch candidate sees a failure instead of a half-English report. Flagging means you find out afterwards. Given week 38 partner traffic, I lean flag-and-alert for launch, block later.
2. **Quick-reply pills** (`QuickReplies.tsx`) still write English sentences into the chat transcript as the user's own turns, feeding WF5 the exact mixed context that caused the original bug. Fixing it must be *additive* (keep the phrase matchers, add intent keys) or it breaks wrap-up rehydration for every existing English customer. Before or after the partner rollout?
3. **English tokens visible inside Dutch reports** (`Ready now` / `Reframe` / `Upskill` / `Retrain`, `Minimal` … `Critical`). They stay English because the parsers match them exactly. Acceptable, or add a display-layer translation map keyed off the canonical English value?
4. **`init_summary`** currently sniffs as Dutch, but it has no language logic by design and `PersonalityRadar`'s legacy fallback regexes English labels out of it. Worth confirming the radar still works on this Dutch report before assuming it is fine.
5. **Native Dutch prompts, now or later?** This design produces Dutch from an English prompt spec. Separate per-language prompt nodes give better Dutch at the cost of maintaining two copies of ~56KB of prompt, in a codebase whose dominant failure mode is prompt drift. Recommend later.
