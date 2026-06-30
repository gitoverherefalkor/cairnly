# WF3 outside-the-box — stop "safe adjacent" picks (True Pivot + avoid-signals) (PROPOSED)

**Status:** proposed, NOT applied. Prompt-only change to the `outside_box_prompt` field of
node **"Set Outside Box Prompt"** in WF3 (`zhgJuiDp60PS5ZKJ`). No node/connection changes.
Apply via the n8n API (PUT) after export+backup, leave activation alone.

## Why
The alt-titles fix (see `WF3_oob_alt_titles_fix_PROPOSED.md`) stopped OOB from echoing a
presented **title** or its **alternates**. It works. But the 2026-06-29 Prins re-run showed a
different leak: **"Account Director (Management Consultancy)"** as an OOB pick. It is not a
title echo, yet it is a *safe adjacent* role:

1. **Semantically close to a presented lane.** "Change Management Consultant" is already a
   runner-up; an Account Director at an advisory firm sits in the same consulting/advisory
   family. OOB principle 1 already warns against "Advisory" versions of past work, but the
   current wording only blocks that *phrasing* and exact presented titles, not the whole
   **function family**. Rule 6's "shares BOTH sector AND function" test is too lenient: a
   same-family role with a slightly different function slips through.
2. **It contradicts the candidate's stated goal.** Prins explicitly wants away from
   high-pressure, politically heavy environments. Account Director is a commercial,
   client-ownership, revenue-pressure role: the opposite of what he asked for. Nothing in the
   prompt makes OOB honor the candidate's stated **avoid / move-away-from** signals (input 2).

The other two picks this run (Entrepreneur in Residence, Wellbeing Program Manager) were good,
genuine pivots. The goal is to make the third slot stop being a "safe corporate move."

## The fix (two added guardrails + a self-check), all in SELECTION PRINCIPLES

### Edit A — replace PRINCIPLE 1 (semantic distance) with a stronger "True Pivot" gate

**BEFORE (current live):**
```
1. **The "Semantic Distance" Rule:** Do not suggest roles that are merely "Fractional," "Consulting," "Board Member," or "Advisory" versions of their past work. If a role is found in the "Already Presented" list (input 3), it is NOT out of the box.
```

**AFTER:**
```
1. **The "True Pivot" Rule (semantic distance, no safe corporate move):** Every pick must be a genuine pivot, not a safe lateral move. Do not suggest roles that are merely "Fractional," "Consulting," "Board Member," "Advisory," or "Account/Client-side" versions of their past work. Go beyond exact titles: reject any role that lives in the SAME FUNCTION FAMILY as a role already in the presented set (input 3 and 3b), even under a fresh title. If the presented roles already cover a family (for example change/transformation, program or operations management, L&D/training/coaching, communications, partnerships, or client advisory), another entry from that family is NOT outside the box. Litmus test: if this role could plausibly sit in their Top 3 or runner-ups, or a recruiter would file it next to the presented roles as "more of the same," it is a safe move and must be rejected. A True Pivot makes the candidate step into a different field, a different professional identity, or a different way of working.
```

### Edit B — add PRINCIPLES 8 + 9 and a two-sided self-check (after principle 7, before `## GENERAL CONSIDERATIONS`)

Principle 9 (precedence) and the two-sided self-check are the **built-in over-constraint
safeguards**: they stop the new filters from killing the good interest/driver pivots and give
the model a sanctioned escape valve instead of forcing a safe-or-absurd pick.

**ADD:**
```
8. **Respect what they want to move AWAY from.** Input 2 states what the candidate is trying to leave behind (for example: high-pressure or target-driven roles, corporate politics, a specific function, long hours, a sector). Never recommend a role whose day-to-day reality runs straight back into that, even when the skills transfer cleanly. A commercial, quota- or pipeline-carrying, or politically heavy role is the wrong call for someone whose stated goal is to escape exactly that. When skill-fit and stated direction pull apart, weight their stated direction.

9. **How these principles interact (precedence).** Principles 5 and 7 are the SOURCE of your picks: the best outside-the-box roles come from the candidate's interests and underlying drivers surfaced into a new arena. Principles 1, 6, and 8 are FILTERS that reject safe, duplicate, or contradictory picks, not reasons to abandon a strong interest- or driver-derived pivot. A pivot that reuses a familiar skill is good when the field, identity, or way of working is genuinely new (for example finance/ops rigor applied inside athlete wellbeing). Do not reject such a pivot just because it touches a skill they already have.

**Final self-check before output:** for each of the 3 picks, confirm it (a) passes the True Pivot Rule (#1) and respects #8, and (b) is still a real, attainable role, not an invented title or a path needing years of retraining. If a pick is a safe adjacent role or collides with what they want to avoid, replace it. But do not swing to the opposite error: if genuine pivots are hard to find, widen the lens (the same craft in a clearly different industry, or a driver-derived role in a new field) rather than forcing either a safe clone or a far-fetched, invented role. Always return exactly 3.
```

Nothing else changes. Principles 2-7, inputs (incl. 3b), format/tone/output-language: untouched.

## What this would have done to the Prins run
- **Account Director** → rejected (same client-advisory family as the presented Change
  Management Consultant; also a pressure/commercial role he wants to avoid). Replaced with a
  genuinely different lane.
- **Entrepreneur in Residence**, **Wellbeing Program Manager** → both survive (different
  field / identity / work structure; aligned with, not against, his stated direction).

## Risks
1. **Over-constraint ("narrowed lane") — main risk, now mitigated in-prompt.** With rule 6
   blocking titles+alts, new rule 1 blocking function families, and rule 8 blocking
   avoid-signals, the model has less room. Three mitigations are now built in: (a) **rule 9
   precedence** keeps rules 5/7 as the SOURCE and demotes 1/6/8 to FILTERS, so a strong
   driver-pivot that reuses a familiar skill is not killed for touching that skill (this is the
   most likely over-constraint failure — the new filters rejecting the *good* pivots); (b) the
   **two-sided self-check** gives a sanctioned escape valve (widen to same-craft-different-
   industry) instead of forcing a safe clone or an invented/retraining role; (c) "always return
   exactly 3." Still watch the test run for far-fetched/invented picks. If they appear, the
   granular rollback (below) softens rule 1's family clause without touching rules 6/8.
2. **Subjectivity.** "Function family" and "safe move" are judgment calls; the LLM may over- or
   under-apply. The litmus test + examples are there to anchor it.
3. **Length / cost.** Prompt grows by ~2 short paragraphs. Negligible latency/token impact.
4. **No structural changes.** Set-node value only; no nodes, connections, or activation touched.
   Lower risk than the alt-titles edit.

## Apply mechanism (on "go")
GET live WF3 → save dated backup → 3 string edits on the Set node value (replace #1, insert #8
+ self-check) with exact-anchor assertions → PUT (settings trimmed to API-allowed keys, as
before) → verify → save updated export. Then re-run Prins and confirm the third slot is a real
pivot. Activation left for manual review.
