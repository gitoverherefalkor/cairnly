# Résumé Strengthen — coaching layer for tailored résumés

**Date:** 2026-07-01
**Status:** Design — reviewed 2026-07-01, ready for planning
**Author:** Sjoerd + Claude

## Problem

WF9 turns a user's uploaded CV into a role-tailored résumé (`custom_resumes.resume_json`),
and it does so under a hard rule: **it never invents facts.** It can only reorder and
rephrase what the source CV already contains. That guardrail is correct, but it is also
exactly why a lot of tailored résumés come out generic — the source CV is generic, and
the AI cannot fill the gaps without fabricating.

The output is also treated as immutable: the only lever a user has today is "regenerate
from scratch," which rerolls everything, including lines they were happy with. There is
no way to sharpen one weak bullet.

We want to close the gap the honest way — by extracting the context that only lives in
the user's head and folding it back into the résumé — using a recruiter's real quality
bar as the rubric.

### The rubric (recruiter "cover-your-name" test)

From a recruiter's framing: cover the name at the top of a résumé; if it could be anyone's,
the value of the work won't translate. Four red flags, each of which **can only be fixed by
asking the user** (the AI cannot resolve them from the CV alone without inventing):

1. **"You had to be there" language** — generic descriptions that assume context the reader
   lacks. Fix: add a plain-English line of context.
2. **The naked number** — a metric with no referent ("$630K in Q2" — of *what*?). Fix: the
   figure *plus* what it represents and what changed.
3. **Insider shorthand** — internal tool names, project codenames, acronyms ("the Atlas
   migration via the FRED pipeline"). Fix: describe it in plain terms an outsider understands.
4. **The adjective posing as a skill** — "excellent communication, team player, detail-oriented."
   Fix: replace with a demonstrated, verifiable example.

## Goal

Add an opt-in **coaching layer** (capability A) on top of the existing tailored-résumé flow that:

1. Analyzes a generated résumé against the four red flags.
2. Surfaces the top few highest-impact weaknesses, one at a time, in the app's existing
   survey rhythm.
3. **Leads every item with a fix or a worked example**, never a naked question — so the
   user accepts or tweaks a draft instead of facing a blank box.
4. Lets the user apply accepted changes to the résumé surgically (only the touched lines
   change), and come back later for the rest. Fully resumable.

## Non-goals / out of scope

- **Capability B — free-form editing** ("let me hand-edit any line"). Deferred. This spec is
  the coaching layer only. The surgical-patch mechanism built here is the natural foundation
  for B later.
- **Cover-letter strengthening.** WFX is untouched.
- **Full résumé rewrite / restructure engine.** When a résumé scores very low we nudge the user
  toward regenerating with more detail (copy only, pointing at the existing WF9 flow); a dedicated
  "rewrite the whole thing" mode is deferred past V1.
- **Full résumé regeneration changes.** WF9 is not modified. The coaching layer sits beside it.
- **New résumé templates or PDF/Word rendering changes.** Rendering already reads from
  `resume_json`; we only change the JSON's contents.
- **A brand-new personality/keyword model.** Analysis reuses the enriched-job keywords and
  personality voice WF9 already has access to.

## User flow

Entry is a **smart nudge**, not a toll gate:

1. **Generate (unchanged).** User generates a tailored résumé via WF9. It appears on the
   results screen exactly as today.
2. **Nudge.** Once analysis is ready, the results screen shows a **Résumé strength** score
   and a bright *"N quick wins — Strengthen"* banner. The user who just wants the file can
   ignore it and download; the banner makes improving it the obvious next move.
3. **Review (one-at-a-time, survey rhythm).** Opening Strengthen shows the top **5** issues,
   one card at a time — the same motion as the assessment. Each card is one of two types:
   - **One-tap fix** (wording problems: adjective-as-skill, weak verb, jargon the AI can
     safely translate). The AI shows the rewrite; the user taps to accept, or tweaks it.
   - **Needs one detail** (naked number, "you had to be there"). The AI asks a single
     targeted question, pre-fills the box with an example *in the exact target format*, and
     shows a live preview of the finished line. The user edits the draft rather than writing
     from scratch.
   Every card is skippable. A completed fix collapses to a done-row with a plain-English
   summary and **Undo**.
4. **Apply (surgical + resumable).** The single **"Apply my changes & refresh résumé"** button
   is the only thing that commits. It is NOT "finish all 5." It banks whatever is staged and
   rebuilds the résumé now. On press, with items still in "Up next":
   - **Accepted / saved** items → folded into `resume_json`; those lines rewritten.
   - **Skipped** items → not applied, not deleted; remain available.
   - **Not-yet-seen** items → untouched; remain queued.
   - **Current card previewed but not saved** → treated as not-saved; a small "you have an
     unsaved answer — apply anyway?" nudge prevents accidental loss.
5. **Loop.** User lands back on the improved résumé. The strength score moves **partway**
   (e.g. 62 → 71, not the full 84, because only 2 of 5 were done — the gap is the incentive).
   The Strengthen banner persists as *"3 quick wins left."* They can resume anytime.

Full loop: **generate → nudge → fix a few → apply (surgical) → score rises → return for more.**

## UX / component reuse

Everything is built from existing parts, recolored to its job. No new visual vocabulary.

| New element | Reuses |
|---|---|
| Coaching card shell | Survey question-card (cream `#F6F0E2`, tan border `#C9B690`, `rounded-[14–22px]`) |
| Accept / Edit / Skip + suggestion box | Chat suggestion-card + "Asking about" pattern |
| Red-flag tag pills, card-type chips | Dashboard pills (Move / AI-impact shape) |
| Strength meter + done-row | Dashboard score pill + status pill; ATS-score pill pattern |
| One-at-a-time progression | Survey step rhythm (`CairnProgress` dots) |

Color logic (two colors only): **gold = "look here, a weakness"** (tags, eyebrow); **teal =
"go / good"** (suggestions, primary actions, progress). Primary actions are teal because teal
is the app's real primary button color; gold is the accent, freeing it to signal weakness.

Typography and weights follow the platform cap (Poppins/Inter, **no font-weight above 700**).
All new copy goes through the i18n system (EN + NL) — the app is bilingual and analysis/compose
must respect `preferred_language`, reusing WF9's language handling.

## Architecture

Three new pieces, all following the app's established async-webhook + Realtime pattern. **WF9,
WFX, and the existing `generate-custom-resume` edge function are not modified.**

### 1. Data model — `strength_review` (jsonb on `custom_resumes`)

One new nullable `jsonb` column mirrors how `keyword_coverage` already lives on the row (no new
table for MVP). Shape:

```jsonc
{
  "status": "ready",            // pending | ready | failed
  "score": 62,                  // current strength, deterministic (see below)
  "score_potential": 84,        // score if all open issues were resolved
  "language": "en",
  "generated_at": "2026-07-01T09:00:00Z",
  "issues": [
    {
      "id": "iss_1",
      "flag": "adjective_skill",        // you_had_to_be_there | naked_number | jargon | adjective_skill
      "card_type": "one_tap",           // one_tap | needs_input
      "impact": 8,                      // weight 1–10; drives the score math
      "target": { "section": "experience", "exp_index": 1, "bullet_index": 2 },
      "original_text": "Excellent communication. Team player.",
      "suggested_text": "Supported English- and Spanish-speaking customers…",  // one_tap
      "question": "$630K of what, and what changed?",                          // needs_input
      "example": "$630K in ad spend — cut cost-per-lead 18%…",                 // needs_input
      "preview_template": "Managed {answer} …",                               // needs_input
      "status": "pending",              // pending | applied | skipped
      "user_input": null                // filled on apply for needs_input
    }
  ]
}
```

`target` addresses a location in `resume_json` (`section`: `summary` | `experience` | `skills` |
`highlights`, with indices where relevant) so a patch touches exactly one line.

### 2. Strength score — deterministic, no LLM to move the meter

Each issue carries an `impact` weight (1–10) assigned by the analysis. The meter is pure math:

- `score = score_potential − sum(impact of issues where status ∈ {pending, skipped})`
- Resolving an issue adds its `impact` back → the meter rises **exactly** and instantly.

This makes the "dashed remaining potential" on the meter precise, and means applying a batch
never needs a re-score LLM call. Score and `score_potential` are computed from the **surfaced**
issue set (the top 5–7, see cap below), so resolving every surfaced issue reaches `score_potential`
— the meter is always fully reachable rather than gated by hidden issues. The existing
keyword-focused `ats_score` from WF9 stays separate; the two numbers sit side by side, each with a
hover tooltip naming what it measures (ATS = keyword/parsing fit; strength = recruiter clarity).

### 3. Edge function — `resume-strengthen`

One new function, two actions (auth + ownership checks like `generate-custom-resume`):

- **`action: "analyze"`** — fired by the frontend when a **tailored** résumé reaches `completed`
  (via the existing Realtime subscription) or when the user opens Strengthen and none exists yet.
  This runs on the WF9 output shown on the results screen — **never** on the raw CV uploaded before
  the survey (that path, WF0 → `profiles.resume_full_data`, is untouched). Fires the WF10 webhook
  (`mode: analyze`) and returns immediately. Result lands via Realtime.
- **`action: "apply"`** — fired on "Apply my changes & refresh résumé." Payload = the list of
  accepted issues with their `user_input`. Fires WF10 (`mode: apply`).

### 4. n8n workflow — WF10 "Resume Strengthen" (new, created per the CLAUDE.md new-workflow policy)

Single webhook, branches on `mode`. Created **inactive** for user review in the n8n editor,
exported to `n8n_wfs_cairnly/`, with the node/prompt plan presented in chat before the API call.

- **`mode: analyze`** — inputs: `resume_json`, enriched-job keywords (already fetched by WF9's
  pattern), `preferred_language`. One LLM call (Claude Sonnet 5, structured output) that scores
  the résumé against the four-flag rubric and returns the ranked `issues[]` (with `impact`,
  `card_type`, `target`, and pre-drafted `suggested_text` / `question` + `example` +
  `preview_template`). Surfaces the top **5** issues by impact — raised to **7** when the résumé is
  judged weak (low baseline / many high-impact flags), since a weak résumé needs more help. Writes
  `strength_review` (`status: ready`) to the row.
  **Hard rules:** never invent facts; `one_tap` only when the rewrite is derivable from existing
  text; anything needing an unknown fact must be `needs_input`.
- **`mode: apply`** — inputs: `resume_json` + accepted issues with `user_input`. Then:
  1. **One-tap items** → pure JSON replacement at `target`. **No LLM.**
  2. **Needs-input items** → **one batched** LLM call composing final lines from
     (original + `user_input` + target keywords). Only the accepted lines; untouched lines are
     never sent for rewrite.
  3. Patch `resume_json` at each `target`; mark those issues `status: applied`; recompute `score`
     deterministically; write both back to the row.
  Frontend Realtime re-renders the PDF preview.

**Correctness guardrail (carried from WF9):** the apply/compose step must never alter a line that
wasn't an accepted fix, and never add facts beyond the user's `user_input`.

### 5. Frontend

- `CustomResumeResults.tsx` — add the strength meter + "N quick wins — Strengthen" banner
  (reusing the score-pill and banner patterns already there).
- New `ResumeStrengthenReview` component — the one-at-a-time card flow (survey rhythm), done-rows,
  Up-next peek, and the single Apply button. Built from `ui/` primitives + the survey/chat classes.
- Reuse the `useCustomResumes` Realtime/poll pattern to watch `strength_review.status`.

## Edge cases & error handling

- **No issues found** — banner shows a positive "Recruiter-ready" state instead of a count;
  Strengthen opens to a congrats/empty state, not an empty list.
- **Analysis fails** — `strength_review.status: failed`; banner degrades to a quiet "Review
  résumé" that retries `analyze` on tap. Never blocks the résumé itself.
- **Apply fails** — staged changes are preserved client-side; show a retry, don't lose input.
- **Re-analysis after apply** — applying resolves some issues; remaining ones persist. We do
  **not** auto-re-analyze on every apply (cost); a manual "re-check for new wins" is a future
  option, noted below.
- **Unsaved current card on Apply** — nudge "you have an unsaved answer — apply anyway?".
- **Language** — analysis and compose both honor `preferred_language` (EN/NL) like WF9.
- **Multiple résumés** — `strength_review` is per `custom_resumes` row, so each tailored résumé
  has its own independent review and score.

## Decisions (resolved on review, 2026-07-01)

1. **Two scores, kept separate.** The keyword `ats_score` and the new **strength** score sit side
   by side, each with a **hover tooltip** explaining what it measures. No merge for now.
2. **Analysis fires on tailored-résumé completion** — after WF9 finishes and the résumé is on the
   results screen, entered via the Strengthen CTA. **Not** on the initial CV upload before the
   survey. Auto-runs on completion (behind a config flag) so the banner is instant.
3. **Adaptive cap.** Top **5** issues normally; **7** when the résumé scores low (very weak résumés
   get more help). Very low scores also show a gentle "this needs more than quick wins — add detail
   and regenerate" nudge pointing at the existing WF9 flow. A full rewrite *engine* is out of scope
   for V1 (see Non-goals). The strength score is computed from the surfaced set so the meter is
   always fully reachable.

## Rough implementation slices (for the plan)

1. DB: add `strength_review jsonb` column (versioned migration) + regenerate types.
2. WF10 `analyze` path + `resume-strengthen` edge function (`analyze`) + banner/meter UI +
   Realtime wiring. (Ships the read-only "here are your weaknesses" experience.)
3. The one-at-a-time review component (cards, done-rows, staging, Up-next peek).
4. WF10 `apply` path + edge function (`apply`) + surgical patch + deterministic re-score +
   resumable loop.
5. i18n (EN/NL) for all new copy; empty/error/congrats states; polish.
