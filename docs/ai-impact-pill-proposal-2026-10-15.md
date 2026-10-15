# AI-impact pill: where it comes from today, and a proposal (2026-10-15)

Side-session report for the main session. Investigation and offline rehearsal only: no n8n workflow,
production table or edge function was changed. Rehearsal script: `scripts/jev-ai-impact-rehearse.mjs`.

## 1. In short

- **The label on the pill today is not the careful AI rating.** WF2 asks Sonnet (`ai_impact1`) for a
  rating on the right 5-level scale, then throws it away. What gets stored is a word that Gemini's
  `Enrich B` step makes up on its own (it never sees Sonnet's rating), often on old scales:
  "Substantial", "Transformative", "Low to Moderate". WF4 then turns that word into one of the five
  pill words, again by an AI, a second time.
- **Jev is ready but has never run.** The edge secret `TYPESAFE_API_KEY` is set, the `ai-impact`
  function is deployed, but 0 of 842 `enriched_jobs` rows have a Jev label.
- **Rehearsal (12 reports, 184 careers, $0.009):** with Jev, the same career gets the same label in
  86% of cases (today 63%). With one extra rule (reuse the first label ever given to a title) that
  becomes 100%. Jev is cheaper than a coffee per 1,000 reports: $0.0007 per report, about 1 second.
- **Proposal:** WF2 calls the `ai-impact` function after it saves the 15 careers; WF4 passes Jev's
  word instead of the made-up one. Two small n8n edits plus one small edge-function change. The
  Severe/Critical top-3 ban is a short addition to WF3 `Ranking`, and in these 12 reports it would
  have changed nothing.

## 2. What is true now

### 2.1 Shadow build (commit 3674c271)

| Check | Result |
| --- | --- |
| `TYPESAFE_API_KEY` edge secret | **Set** (name present in `supabase secrets list`) |
| `ai-impact` function | Deployed; no call in the last 24 h of logs |
| Rows with `enriched_jobs.ai_impact_level` | **0 of 842**: it has never run for real |
| `dry_run` on Stuart's newest report | Not done through the function: the shared secret it needs (`N8N_SHARED_SECRET`) is not in `.env.local`, and I may not read it from Supabase. Done instead with the same rules file run locally (section 4), which gives the same answer. |

### 2.2 Where the pill label comes from today, step by step

Checked against the export and a real run (WF2 execution 12866, Stuart, this morning).

1. **WF2 `ai_impact1`** (Sonnet 5.5, 16k tokens, so the old token trap is fixed) rates the 15
   careers on the 5-level scale with the physical / orchestrator / execution rules.
2. **WF2 `Salary Range1`** (Gemini) gets that text and copies the rating into its JSON;
   `15TitSizAISal1` parses it. Up to here the rating is the good one.
3. **WF2 `Tit_and_Co1`** keeps only title and company type. **The rating is dropped here.**
4. **WF2 `Enrich B`** (Gemini, `gemini-flash-latest`) is told to "copy ai_impact_rating verbatim
   from input", but its input has none. So it invents one, nudged by the example in its prompt,
   which says "Substantial". In execution 12866 it wrote Substantial 9 times, Transformative twice,
   Low once; Sonnet had said Moderate/High/Severe.
5. **WF2 `clean up JSON1`** puts back salary and path type from step 2, but **not** the AI rating.
   Since today (2026-10-15) it does copy `ai_impact_rating` from the **first stored row with the same
   title** ("pinned profiles", rows since 2026-07-10). So for a known title the label is now frozen
   to whatever Gemini made up the first time; for a new title it is fresh and random.
6. **`enriched_jobs.ai_impact_rating`** stores that word (JSON string `{rating, explanation}`).
7. **WF3** reads the rows (`Pull enriched`, `content in order`) but the score prompts do not use the
   rating. The outside-the-box careers get their own label from the OOB prompt; they are not in
   `enriched_jobs` at all.
8. **WF4** `Pull enriched T3` → `t3 content order` (top 3) and `Pull Runner up` → `Combine runners`
   (runner-ups) hand the word to the writing prompts, which must print one of
   Minimal/Moderate/High/Severe/Critical. So "Substantial" or "Transformative" gets translated by
   the AI, and not always the same way.
9. **`report_sections.content`** holds the prose; **`CareerScoreCard.tsx` `extractAIImpact()`**
   finds the word under "How AI will impact this role" with a regex and shows the pill.

Net effect in the rehearsal: the pill on a card equals the stored word (after the frontend's alias
table) only 31 of 45 times. Two AIs in a row, both guessing.

## 3. Proposal: the smallest live change

**Source of truth:** Jev's `ai_impact_level`, with the 2.3b rules already in
`supabase/functions/_shared/aiImpactRules.ts` (physical → Minimal; leaders and owners at most
Moderate; Severe/Critical only when Jev is sure).

### 3.1 What changes

| # | Where | Change | Needs |
| --- | --- | --- | --- |
| A | Edge fn `ai-impact` | **Title pin:** before asking Jev, look for an earlier row with the same title (same "own company vs employer" split as WF2's pin) that already has an `ai_impact_level`; reuse it. Only new titles go to Jev. | Redeploy of an existing function (Sjoerd's yes) |
| B | WF2, new HTTP node `AI impact (Jev)` | Between `Aggregate3` and `Merge1` (all 15 rows are saved, WF3 not yet called). POST `.../functions/v1/ai-impact` with `{report_id}`, reuse credential "Supabase Edge Functions — Shared Secret", timeout 30 s, **On Error: continue**. | Per-workflow yes for WF2 |
| C | WF4 `t3 content order` and `Combine runners` | One line each: if the row has `ai_impact_level`, hand the prompt `ai_impact_rating = {rating: ai_impact_level}` instead of the stored word. | Per-workflow yes for WF4 |
| D (optional, now) | WF2 `clean up JSON1` | Put back Sonnet's rating from `15TitSizAISal1` like salary, so the fallback (when Jev is down) is at least on the right scale. | Same WF2 yes |

Nothing changes in WF1, WF3 scoring, WF6 or the frontend for step 1.

### 3.2 Timing, cost, failure

- **When it runs:** at the end of WF2, before WF3 starts. WF4 writes the cards minutes later, so the
  label is always there in time.
- **Time:** 15 Jev calls in parallel, median 241 ms each; about 1 to 2 seconds on a WF2 run that
  takes 3.5 minutes. With the title pin most careers need no call at all.
- **Cost:** $0.0007 per report (measured).
- **If Jev fails** (TypeSafe down, key missing): the function returns an error per career and leaves
  `ai_impact_level` empty; the n8n node continues; WF4 falls back to the old word. The report is
  never blocked, it just looks like today.
- **Old reports:** untouched. Their cards keep the word in their text; the frontend parser keeps
  working. No backfill needed for display. (A backfill of `ai_impact_level` for the title pin is
  optional; without it the pin simply fills up from new reports.)

### 3.3 The Severe/Critical top-3 ban in WF3 `Ranking`

`Ranking` already has the sorted, deduplicated list. Add before `top3 = rankedCareers.slice(0, 3)`:

```js
// Severe/Critical never in the top 3 for employee roles (design doc 2.3b). Own work is exempt.
const jobRows = $('Pull enriched').all().map(i => i.json);
const levelOf = (c) => jobRows.find(r => normalizeTitle(r.career_title) === normalizeTitle(c.career_title)) || {};
const isOwn = (r) => ['founder', 'freelance_fractional'].includes(String(r.path_type || '').toLowerCase())
  || /^\s*own company/i.test(String(r.company_size_type || ''));
const banned = (c) => { const r = levelOf(c); return ['Severe', 'Critical'].includes(r.ai_impact_level) && !isOwn(r); };
const eligible = rankedCareers.filter(c => !banned(c));
const top3 = eligible.slice(0, 3);
// banned careers stay in the pool and can still become runner-ups
const rest = rankedCareers.filter(c => !top3.includes(c));
```

and take `runnerUps` from `rest` instead of `rankedCareers.slice(3, 6)`. Rows without a Jev label
are never banned (old behaviour). Runner-ups that are Severe/Critical get `ai_impact_level` passed
along so WF4 can add the warning; that prompt line is a later, separate WF4 edit.

**Impact measured:** in 184 careers only one was Severe (HR Coordinator, another user, not in that
report's top 3 or runner-ups). The ban would have changed **no** top 3 in these 12 reports. It is a
safety net, not a reshuffle. Because it touches WF3, which the main session is testing right now, it
can wait until those tests are done.

### 3.4 Later (not needed for the pill to be stable)

- Parsers write `metadata.ai_impact` and the frontend reads it before the regex. That removes the
  last AI step (WF4 copying the word). With a clean five-level word as input, copying should be near
  perfect; check that on the first live reports before deciding this is needed.
- Outside-the-box and dream jobs are not in `enriched_jobs`, so they keep an AI-written label.
  The `ai-impact` function could label them from their card text after WF3; separate step.

## 4. Rehearsal numbers

10 of Stuart's runs (13 to 15 October) plus 2 other recent reports; 184 careers. Jev answers came
from the same rules file the edge function uses. "Today" = the stored word through the frontend's
alias table.

| | Today (stored) | Jev | Jev + title pin |
| --- | --- | --- | --- |
| Same title, same label in every report (28 titles in 2+ reports) | 63% (15 of 24) | 86% (24 of 28) | 100% (by construction) |
| Stored word not one of the five levels | 24 of 184 ("Transformative", "Low to Moderate") | 0 | 0 |
| Minimal / Moderate / High / Severe / Critical | 6 / 58 / 96 / 0 / 0 (+24 unreadable) | 4 / 105 / 74 / 1 / 0 | same |

**What would change on the 45 cards that showed a pill:** 32 stay the same, 11 go High → Moderate,
2 go Moderate → High. The big shift is that "Substantial" (90 of 184 stored words) is mapped to High
by the frontend today; Jev puts about half of those at Moderate. For Stuart's product and strategy
roles that is the more realistic reading (AI takes routine research and drafting, he keeps the
judgment).

**Where Jev still flips without the pin:** four titles, all with scores right on the Moderate/High
line (1.46 to 1.58; e.g. Entrepreneur in Residence, Director of Experimentation). The career text was
rewritten every run before today's pinning went live, so Jev saw slightly different input. With WF2's
text pin plus the title pin in A, this goes away.

**Leaders and owners rule:** 28 careers hit the "at most Moderate" ceiling, but only 6 of those would
otherwise have been High (e.g. Founder, AI Prototyping Studio; Customer Insights Director). One odd
one: Jev counted "AI Automation Consultant" as a leadership role in one run.

## 5. Risks

- **Label shift on new reports:** fewer High pills for senior office roles. That is the intended
  2.3b scale, but Sjoerd will notice it.
- **Founders capped at Moderate** by the leaders-and-owners rule, while the 2.3b text says own work is
  where AI is leverage. Not wrong, but worth a look (see decisions).
- **WF6 (feedback)** has its own rating scale and could rewrite a card's label after chat feedback.
  Not checked in this pass.
- **A pinned label is frozen.** If the Jev questions change later, the pin must be cleared (one SQL
  update), otherwise old labels live on. Same trade-off as WF2's text pin.
- The `x-shared-secret` credential in n8n must hold the same value as the `N8N_SHARED_SECRET` edge
  secret. It already does for `analysis-completed`, so this should just work.

## 6. What Sjoerd must decide

1. **Go for step 1** (A + B + C, optionally D)? Each needs his per-workflow yes (WF2, WF4) and a yes
   to redeploy `ai-impact`.
2. **Title pin, yes or no?** Yes = 100% consistent per title, but a label is frozen once given.
3. **Founders:** keep the "at most Moderate" ceiling for founder and freelance titles, or apply the
   ceiling only to employee leadership roles?
4. **Top-3 ban in `Ranking`:** now, or after the main session's WF3 stability tests (my advice: after).
