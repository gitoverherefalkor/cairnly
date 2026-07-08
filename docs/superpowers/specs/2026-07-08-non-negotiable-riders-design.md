# Design: Non-negotiable riders for salary & schedule

- **Date:** 2026-07-08
- **Status:** Approved design; implementation staged
- **Survey:** Pro / "Cairnly Personality & Career Assessment 2026 [seeking change]" only (Starter/Encore later)
- **Author:** Sjoerd + Claude

## 1. Problem
Salary (`3f`) and schedule (`3d`) are captured as *preferences* and scored softly in WF3. A user can't say "this one is a wall, not a preference." We want an optional per-question "non-negotiable" checkbox that turns a preference into a (guarded) hard constraint — without emptying anyone's report and without over-trusting AI salary estimates.

## 2. Scope
**In:** a checkbox rider on `3f` (desired compensation range) and `3d` (schedule) only.
**Out (separate/later):** any other question; Starter/Encore flavors; a general conditional-field engine.

## 3. Behavior when checked
- **Schedule `3d` — hard filter.** Disqualify careers whose `work_schedule` clearly conflicts with the user's `3d` (e.g. user "Standard 9-to-5 schedule" vs career "50+ hours/week" or "on-call / irregular"). Categorical → reliable, low false-positive risk.
- **Salary `3f` — forgiving hard filter.** Career salaries are AI estimates (WF2 "Salary Range1"), so only disqualify when the gap is unambiguous: drop only if the **top** of the career's estimated range is below **(user floor × 0.85)** (15% margin for estimate error + negotiation headroom). `user floor` = the low end of the selected `3f` band (e.g. "100,000–150,000" → 100,000).
- **Kept-but-under careers (salary):** when a career survives but its estimated pay sits below the user's floor, WF4 adds a narrative line, e.g. *"The estimated pay may come in slightly below your stated minimum, though this is often negotiable with the employer."*
- **Safety floor (both):** if applying the filters would leave fewer than **6** careers passing basic requirements, do NOT remove — instead apply a heavy penalty (rank to bottom) and set an internal degraded flag. No empty/thin reports. (Ties to the pipeline-failure-alerting backlog.)

## 4. Storage — sidecar (low-ripple)
Keep `3f`/`3d` answers as **plain strings** (unchanged), so WF1's dict, WF2's salary calc, and today's soft scoring keep working untouched. Store the flags in a sidecar on the submission payload:
```json
"__non_negotiables": { "33333333-3333-3333-3333-333333333336": true,
                        "33333333-3333-3333-3333-333333333334": true }
```
(keys = question uuids for `3f`/`3d`). Absent/false = normal preference. This avoids changing the shape of high-traffic questions.

## 5. Edits by layer
| Layer | File / node | Change | Live vs branch |
|---|---|---|---|
| DB | migration | set `config.non_negotiable_rider = true` on `3f` (…336) + `3d` (…334) | live (no-op until read) |
| Frontend | `QuestionRenderer.tsx` (multiple_choice case) | when `question.config.non_negotiable_rider`, render a checkbox under the options; reads/writes the sidecar via a new handler | **branch/PR** |
| Frontend | `SurveyForm.tsx` / `useSurveyState` | thread a `nonNegotiables` map + setter to the renderer; include `__non_negotiables` in the submitted payload | branch/PR |
| Frontend | `questionValidation.ts` | passthrough — the rider is optional, never blocks Continue; `3f`/`3d` value validation unchanged | branch/PR |
| Submission | `useSurveySubmission.ts` | already passes `payload` through; ensure the sidecar key is included | branch/PR |
| WF1 | `Process Survey Data1` + `prompt_init_summary1` | read `__non_negotiables`; surface "[3f: NON-NEGOTIABLE]" / "[3d: NON-NEGOTIABLE]" in the profile | live (PUT+diff) |
| WF3 | `Objective Compat score` (cai_score_prompt) + `Ranking` | pre-scoring hard-constraint filter (schedule hard; salary −15%; safety floor); Ranking drops `passes_basic_requirements=false` | live (PUT+diff) |
| WF4 | `T3 Careers Prompt` (+ runner-up/narrative) | salary "may be under, negotiable" acknowledgment line when a kept career is below floor | live (PUT+diff) |

Careers already carry `salary: {region, range}` and `work_schedule` (WF2 enrichment) — no data gaps for the comparison.

## 6. Rollout order (safe)
WF + DB edits are no-ops until a user can tick the box (needs the frontend merged), so:
1. Spec (this doc) + commit.
2. DB flag migration (live, harmless).
3. WF1 → WF3 → WF4 edits (live, PUT+diff, backups first) — inert until sidecar data arrives.
4. Frontend on a branch/PR; verify via preview.
5. Merge frontend → feature live end-to-end.

## 7. Risks & mitigations
- **Empty/thin pool** → safety floor (≥6) + internal degraded flag.
- **Salary estimate error** → 15% margin + kept-but-under narrative + negotiable framing.
- **Shape breakage** → avoided via sidecar (existing readers untouched).
- **Live scoring is delicate** → WF3 edit is additive (a pre-filter before the existing 0–64 loop); backups + node-diff assertion before PUT; staged with verification.

## 8. Open/none
Numbers chosen: salary margin **15%**, safety floor **6** careers. Adjustable.
