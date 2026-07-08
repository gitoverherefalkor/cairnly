# Design: Entrepreneurship appetite question + Additional Context enrichment

- **Date:** 2026-07-08
- **Status:** Approved design, pending spec review
- **Survey:** Pro / "Cairnly Personality & Career Assessment 2026 [seeking change]" only
- **Author:** Sjoerd + Claude

## 1. Problem

The report can recommend "founder / self-employed" career paths. Today WF2 only opens that door when it detects **desire** signals already present in other answers (short-term goals `7a`, long-term goals `7b`, dream jobs `4h`, self-employment history `1j`). The prompt is explicit: *"No signal = no founder paths."*

Two gaps remain:

1. **Desire is inferred, never asked directly.** It leans on side-effects of goal/dream questions, so it can both over-fire (someone whose goals *sound* entrepreneurial but who has no interest) and under-capture (someone genuinely interested who didn't phrase a goal that way).
2. **Feasibility is never checked at all.** Even a real desire can be unrealistic right now (finances, dependents, health, risk appetite). Nothing modulates the recommendation for readiness, so users can get a "go start a business" suggestion they discard on sight.

## 2. Goals / non-goals

**In scope (this spec):**
- Add one new multiple-choice question capturing **entrepreneurial appetite** directly, with an `Other` open field.
- Enrich the existing open catch-all `1n` ("Additional Context") description to invite **feasibility color** (household finances, relocation, caregiving, health/accessibility).
- Wire the new signal into the founder gate and add a light feasibility-framing pass, via small edits to WF1 and WF2 (optionally WF4).

**Explicitly out of scope (deferred / rejected):**
- **Non-negotiable checkbox** on the existing salary (`3f`) and schedule (`3d`) preference questions. Good idea, but it changes the *stored shape* of existing high-traffic questions and ripples into WF1/WF3/WF4 scoring. Separate follow-up spec.
- **Splitting `1n` into 3 fields** (composite). Rejected: flips `1n` from string to object and forces a reparse in WF1/WF2/WF4 for little gain.
- **Conditional "required elaboration when a specific option is ticked."** Not supported by the engine; would need bespoke schema + renderer + validator work. We reuse the existing `allow_other` mechanism instead.

## 3. Key enabling fact: codes are decoupled from position

WF1 holds a hand-written dictionary of 120 `code -> uuid` entries (`1a`–`1n`, `2a`–`2j`, `3a`–`3h`, `4a`–`4h`, `5a`–`5h`, `6a`–`6g`, `7a`–`7e`). Codes are **not** derived from `order_num` (WF1 references `order_num` zero times). Therefore:

- Adding a question with a **new code + new UUID** renumbers nothing. Every existing `4h`, `7a`, etc. keeps pointing at the same UUID.
- Display order (`order_num`) and prompt code are independent. Placement is a UX choice, not a risk choice.

This removes the "shifting question numbers breaks prompts" risk entirely, as long as we assign a fresh code and never reassign an existing one.

## 4. Design

### Part A — New question `7f`: entrepreneurial appetite

| Field | Value |
|---|---|
| UUID | `77777777-7777-7777-7777-777777777776` (verified free) |
| WF1 code | `7f` (next free in section 7) |
| Section | `Career Goals and Development`, id `70000000-0000-0000-0000-000000000001` |
| `order_num` | `6` (current max is 5, so this is the last question of the section = last of the survey) |
| Type | `multiple_choice`, single-select (`allow_multiple = false`) |
| `allow_other` | `true` (open "Other" field, required once ticked, min 4 chars, via existing engine) |
| `required` | `true` |

**Label (EN):** How interested are you in starting your own business?

**Choices (EN):**
1. Not for me
2. Curious about it, but not actively planning
3. Interested and seriously considering it
4. I already run, or have run, my own business

**Description (EN):** There are no wrong answers; this just helps us judge whether self-employed paths belong in your recommendations. Choose one, or add your own.

**Dutch (`translations.nl`):**
- label: `Hoe geïnteresseerd ben je in het starten van een eigen bedrijf?`
- choices map:
  - `Not for me` -> `Niets voor mij`
  - `Curious about it, but not actively planning` -> `Nieuwsgierig, maar ik ben er niet actief mee bezig`
  - `Interested and seriously considering it` -> `Geïnteresseerd en ik overweeg het serieus`
  - `I already run, or have run, my own business` -> `Ik heb al een eigen bedrijf (gehad)`
- description: `Er zijn geen foute antwoorden; dit helpt ons bepalen of zelfstandige loopbaanpaden bij je passen. Kies er één, of vul je eigen antwoord in.`

**Config JSON shape** (mirrors the `7a` template, single-select so no `max_selections`):
```json
{
  "choices": [
    "Not for me",
    "Curious about it, but not actively planning",
    "Interested and seriously considering it",
    "I already run, or have run, my own business"
  ],
  "description": "There are no wrong answers; this just helps us judge whether self-employed paths belong in your recommendations. Choose one, or add your own."
}
```

**Stored answer shape:** plain string (the chosen option, or `"Other: <text>"`). Same shape as every other MC, so it auto-forwards to n8n with no submission-code changes.

### Part B — Enrich `1n` "Additional Context" description

**Current:**
> Anything else we should know? (Optional - skip if nothing comes to mind)

**New (EN):**
> Anything else that should shape your recommendations? Optional. Useful things to mention: your household's financial situation or need for a stable income, how far you'd be willing to relocate, any family or caregiving commitments, and any health or accessibility considerations. Skip if nothing comes to mind.

**New (NL):**
> Is er nog iets dat je aanbevelingen zou moeten beïnvloeden? Optioneel. Handig om te noemen: de financiële situatie van je huishouden of behoefte aan een stabiel inkomen, hoe ver je bereid bent te verhuizen, eventuele gezins- of zorgverplichtingen, en gezondheids- of toegankelijkheidsoverwegingen. Sla over als er niets is.

Business appetite is intentionally **left out** of `1n` because `7f` owns it now; `1n` carries feasibility color only.

### Part C — Founder-gate + feasibility logic (WF2)

Layer `7f` on top of the existing desire gate, and add a feasibility-framing pass:

| `7f` answer | Gate behavior |
|---|---|
| Not for me | **Opt-out wins.** Suppress founder/self-employed paths even if `7a`/`7b`/`4h`/`1j` hint entrepreneurial. Closes the over-fire hole. |
| Curious, not actively planning | Latent interest. Allow a founder path only as a secondary/aspirational option, and only if another signal is also present; frame long-term. |
| Interested and seriously considering | Desire confirmed. Gate opens; present as a genuine option; run feasibility framing (below). |
| Already run / have run | Strong. Founder / consulting / fractional paths are highly relevant; may be primary. |
| Other: `<text>` | Interpret the free text as a signal. |

**Feasibility framing pass** (only once a founder path is allowed): weigh `1n` (household finances, need for stable income, relocation, caregiving, health) and `2h` (risk comfort). If readiness signals are weak, still include the path but frame it as a 12–18 month build-toward goal with explicit preconditions and rank it below a safer primary. Never present "start a business" as a do-it-now recommendation when readiness is weak.

## 5. Blast radius — exact edits

| Layer | Change | Notes |
|---|---|---|
| DB migration | Insert `7f` question row; update `1n` description (EN + NL) | New migration file in `supabase/migrations/`. Row = data, not schema. |
| Frontend | **None** | `multiple_choice` + `allow_other` are already fully rendered/validated by `QuestionRenderer.tsx` + `questionValidation.ts`. |
| `forward-to-n8n` | **None** | Forwards full `survey_responses` by UUID; new answer flows automatically. |
| Supabase types | **None** | No schema change; no regen needed. |
| WF1 (`0Z8WxV5tVFMJqIZt`) | Add `"7f": { uuid: …776, ... }` to the code dict; surface `7f` in the emitted profile; broaden the `1n` extraction line from "Include burnout notes, family commitments, etc." to also capture finances / stable-income need / relocation / health-accessibility | Live workflow. Export first. |
| WF2 (`vVv0tsnFlBnarMdq`) | Read `7f` in the founder gate per §4C; add the feasibility-framing pass using `1n` + `2h` | Live workflow, delicately tuned. Export first. |
| WF4 (`seWmQPFQqIe60TkU`) | Optional: reference `7f`/`1n` to add realism caveats in the founder narrative | Can be deferred to a fast follow. |

## 6. Localization scope

Pro survey only. The Starter (`…0002`) and Encore (`…0003`) flavors are separate surveys with their own workflows (WF1S/WF1P etc.); adding a parallel question there is a future task, not part of this change.

## 7. Risks & rollback

- **Live n8n edits.** WF1/WF2 are production and the founder gate is finely tuned. Mitigation: export current WF1/WF2/WF4 JSON to `n8n_wfs_cairnly/` before editing; present the exact node diff; get per-workflow approval per repo policy; do not activate anything the user hasn't reviewed.
- **Reversibility.** The migration is reversible: delete the `7f` row and restore the prior `1n` description. Include a rollback SQL block in the plan.
- **No renumber.** Verified: codes are UUID-mapped and independent of `order_num`; `7f` + `order_num = 6` leaves every existing code untouched.

## 8. Verification

1. After migration: Pro survey shows the new question as the final item of section 7 with 4 options + Other, single-select, required; existing questions unchanged; NL renders.
2. Submit a test survey per option; confirm payload stores a plain string and WF1's profile includes `7f`.
3. Behavior checks in WF2:
   - `Not for me` -> no founder paths even when goals/dream hint entrepreneurial.
   - `Interested…` with weak `1n`/risk signals -> founder path present but framed as staged build-toward, ranked below a safer path.
   - `Already run…` -> founder/consulting path can lead.

## 9. Open decisions

- Confirm NL wording (drafts above).
- Include the WF4 narrative caveat now, or as a fast follow?
- Keep Pro-only (recommended) vs also add to Starter/Encore now.

## 10. Implementation order (per Sjoerd)

1. **Entrepreneurship question `7f`** (migration insert).
2. **`1n` description** update (same migration).
3. Export WF1/WF2 (+WF4), present node diffs, get approval, then apply the workflow edits.

## 11. Deferred follow-up

**Non-negotiable riders:** an optional "is this a non-negotiable?" checkbox under the salary (`3f`) and schedule (`3d`) preference questions. When ticked, converts a preference into a hard filter signal for WF3/WF4. Own spec, because it changes existing question shapes and multiple scoring prompts.
