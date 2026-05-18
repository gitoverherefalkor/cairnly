# Career Comparison — Design Spec

**Date:** 2026-05-18
**Status:** Approved — chat scope. Dashboard placement deferred to a separate effort.

## Problem

The Top-3 career write-ups read "samey". Users land on three matches that feel like the same ballpark and struggle to see the main differences between them. The report also never compares a career to the ones the user has already seen — each career is presented in isolation.

## Goal

Add a visual, explainable comparison to the Top-3 careers so the differences are obvious:

- Career 1: no comparison (the user has not seen the others yet).
- Career 2: compared to Career 1.
- Career 3: compared to Careers 1 and 2.

## Scope

**In scope (this spec):** the comparison feature in the **chat**.

- WF4 prompt change + data generation/storage
- A reusable radar component
- The in-chat comparison card and "Explain this comparison" button

**Out of scope (separate session):** dashboard placement and the broader section-report layout redesign. The radar component is built reusable so that effort can drop it in without rework. Tracked as a separate task.

## The comparison

A **headline** plus a **5-axis fit-radar**, with a pre-written prose **explanation** available on demand.

### Fit axes

Five axes, scored 1-5, oriented as **fit for this specific candidate** (5 = excellent fit, 1 = poor fit), judged against the candidate's Initial Summary (values, constraints, energy, work preferences, sentiment log):

| Axis | Meaning |
|------|---------|
| Autonomy | Does the role's independence match their need for autonomy? |
| Social load | Does the people/interaction load sit within their social energy? |
| Pace & pressure | Does the pace and pressure match their stress tolerance? |
| Stability | Does the income/path stability match their security needs and constraints? |
| Schedule | Does the working schedule match their work-life-balance needs? |

Plotting fit (not raw attributes) means the polygon is meaningful: a round shape = strong all-round fit, a dent = a specific misfit. Overlaying the careers shows all of them at once, and the dents are the differences.

"Day-to-day work" is deliberately **not** an axis — it is categorical, not a magnitude. It lives in the headline instead.

### Headline & explanation

- **Headline:** one sentence naming the single biggest way this career differs from the earlier one(s).
- **Explanation:** a pre-written 120-170 word paragraph (1-2 short paragraphs), shown when the user taps "Explain this comparison". Pre-written, not live — see Decisions.

## Data model

Uses the existing `report_sections.metadata` JSONB column. **No migration, no new table.**

- Every `top_career_1/2/3` row gets `metadata.fit_scores`:
  ```json
  { "autonomy": 1-5, "social": 1-5, "pace": 1-5, "stability": 1-5, "schedule": 1-5 }
  ```
- `top_career_2` and `top_career_3` rows additionally get `metadata.comparison`:
  ```json
  { "headline": "string", "explanation": "string" }
  ```
- `top_career_1` stores `fit_scores` only — no `comparison`. Its scores are still needed so Careers 2 and 3 can plot it.

The radar for Career N reads its own row plus the sibling `top_career` rows for the other careers' scores. `useReportSections` already loads every section for a report, so no extra fetch is needed.

## WF4 changes (n8n — requires approval)

WF4 is `n8n_aa/WF4 Career selection.json`. Per the project's n8n policy: export WF4 first, present the exact node changes, get per-workflow sign-off before any n8n API call.

### 1. Top-3 prompt (`T3 Careers Prompt` set node)

Add a new "Comparison Data" section to the "Output Structure (Each Career)" block, placed after the `**More details about this role...**` line. It instructs the model to emit a fenced ```json block as the last thing in each career, containing `fit_scores` (all careers) and `comparison` (careers 2 and 3 only). The exact markdown is in Appendix A.

### 2. `Split Top3` code node — **changes required**

Currently: splits the LLM text on `---CAREER_SPLIT---`, extracts title/score/content, outputs 3 items with no `metadata` field.

Add:
1. Extract the ```json block from each career chunk via regex.
2. `JSON.parse` it inside a try/catch. On failure → `metadata: null` (graceful degradation: a malformed block never breaks the report; the radar simply does not render).
3. Strip the ```json block from the text so it does not appear in `content`.
4. Add `metadata` to each output item.

### 3. `Insert Top 3` Supabase node — **no change**

It uses `dataToSend: autoMapInputData`, which maps every field on the item to a same-named column. Once `Split Top3` emits `metadata`, it auto-maps to the existing `metadata` JSONB column.
*Verify on first run:* that the autoMap insert writes the object to the JSONB column rather than stringifying it.

## Frontend — radar component

A new React component (working name `CareerComparisonRadar`).

- Renders a 5-axis pentagon: focal career filled, other careers as outlines.
- Axis labels carry **hover tooltips** with plain explanatory copy ("Social load — how much client and colleague interaction the role demands vs solo focus time"). The "deeper analysis" tooltip variant is a later enhancement; v1 ships plain copy.
- Renders purely from `fit_scores`; reads sibling `top_career` rows for the other careers.
- **Self-contained and aspect-flexible** — works inside a square / 4:3 box, no dependency on page width. This is a hard requirement so the future dashboard effort can reuse it untouched.
- Graceful: if `metadata.fit_scores` is missing or malformed, the component renders nothing (no error, no empty frame).

## Frontend — chat placement

- On the **Career 2 and Career 3** messages: a compact comparison card showing the headline and the radar. Career 1: no card.
- An **"Explain this comparison"** button on the card. On click it posts `metadata.comparison.explanation` into the chat as a coach message, saved to chat history so follow-up questions have context.
- Follow-up questions then flow through the normal chat (WF5.3) unchanged.

## WF5.3 (chat) — no change needed

The latest chat workflow is `WF5.3 Atlas Chat (slim).json`. It is slimmed to 7 nodes and, unlike WF5.2, does not read the `report_sections.metadata` column for career sections.

This does not affect the feature: the "Explain" button's text is supplied by the **frontend** (which already loads `metadata` via `useReportSections`), not generated by WF5.3. Follow-up questions are answered by WF5.3 from the career content it already works with.

*Future optional enhancement:* add a tool to WF5.3 so the chat can quote the exact numeric fit scores in follow-ups. Not part of v1.

## Decisions (resolved during brainstorming)

- **Radar, not tracks or a table.** The radar shows all careers in one view; fit-orientation makes the shape meaningful.
- **5 axes, fit-oriented.** Raw-attribute axes have no "good direction" so the shape would be meaningless; fit-orientation fixes that.
- **Pre-written explanation, not live.** Generated by WF4 in the same call/context as the radar data, so it can never contradict the chart; it is instant on tap; it still lands in the chat so follow-ups stay live. The first canonical explanation is controlled; open-ended Q&A is live.
- **Money and AI-impact are not axes.** Money data is unreliable ("higher risk of being off"); AI impact is already on the dashboard Career Map.

## Build sequence

1. WF4 prompt + `Split Top3` code node (n8n — needs approval). Generates and stores `fit_scores` + `comparison`.
2. `CareerComparisonRadar` component (reusable, aspect-flexible).
3. Chat comparison card + "Explain" button + chat-history insertion.
4. Verify end-to-end with a real report.

## Risks & mitigations

- **LLM emits invalid JSON island** → `Split Top3` parses in try/catch; failure degrades to no radar, report unaffected.
- **autoMap writes object to JSONB** → verify on first run; the column already exists.
- **Samey Top-3s produce near-overlapping radars** → acceptable and honest (the careers genuinely overlap); the headline carries the difference in words.

## Appendix A — exact prompt markdown

Added to the WF4 Top-3 prompt's "Output Structure (Each Career)", after the `**More details about this role can be viewed in your dashboard after this chat.**` line:

> ## Comparison Data
>
> As the LAST thing in each career (after the "More details..." line, before the career split), output one fenced ```json code block. The platform reads this to render a visual comparison and a written explanation — it is never shown to the candidate as raw text. Always include it.
>
> ### fit_scores — every career
>
> Rate THIS career from 1 to 5 on each axis. The score is FIT FOR THIS CANDIDATE — 5 = excellent fit, 1 = poor fit — judged against their Initial Summary (values, constraints, energy, work preferences, sentiment log):
>
> - autonomy — does the role's independence match their need for autonomy?
> - social — does the people and interaction load sit within their social energy? (5 = comfortably within their limit, 1 = will drain them)
> - pace — does the pace and pressure match their stress tolerance? (5 = comfortable, 1 = high-pressure mismatch)
> - stability — does the income and path stability match their security needs and stated constraints?
> - schedule — does the working schedule match their work-life-balance needs?
>
> Score all three careers on ONE consistent scale — they are generated together, so a 4 on "social" must mean the same thing across all three.
>
> ### comparison — career 2 and career 3 ONLY
>
> Career 1 omits this entirely. Career 2 compares to career 1. Career 3 compares to careers 1 and 2.
>
> - headline — one sentence naming the single biggest way THIS career differs from the earlier one(s). Direct, no hedging.
> - explanation — 120 to 170 words, one or two short paragraphs. Walk the candidate through how this career genuinely differs and what that means for them. Ground it in the axes where the fit scores differ most. Same voice and Writing Rules as the rest of the output.
>
> ### Format
>
> Career 1: `{"fit_scores":{"autonomy":5,"social":5,"pace":5,"stability":2,"schedule":4}}`
>
> Careers 2 and 3: `{"fit_scores":{...},"comparison":{"headline":"...","explanation":"..."}}`
>
> Output valid JSON only — no comments, no trailing commas. This block does not count toward the per-career word target.
