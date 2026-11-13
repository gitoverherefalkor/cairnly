# Encore evals (n8n)

Automated checks for the Encore scoring step (WF3P), built on n8n's Evaluations feature
(evaluation trigger + data table dataset + Set Outputs / Set Metrics). Built 2026-11-13.

## What runs where

| Piece | n8n id | What it does |
|---|---|---|
| `EVAL - Encore WF3P scoring checks` | `Wx1G3akYH8ILT6LE` | The eval. For each persona it scores the same fixed input 3 times and computes the checks. |
| `EVAL - Encore WF3P scoring core (copy, no writes)` | `yoRGLPj80geyRZTS` | Exact copy of WF3P's scoring nodes ("Add structure" to "Ranking"). Reads Supabase, writes nothing, never calls WF4P, no outside-the-box step. |
| Data table `encore_eval_wf3p_dataset` | `e3s4JIlVRWYfv7ae` | One row per persona: the report_id whose WF1P profile and WF2P 15 options are reused, plus hand-written reference labels per option (form, activity, pay level, EUR/hour for Henk). |
| Data table `encore_eval_wf3p_results` | `r2xPfQ0ERrYJKhYE` | History: one row per persona per eval run. Row 1 (14:59 UTC, 2026-11-13) was a wiring test, ignore it. |

All live in the n8n project "Cairnly". Both workflows stay unpublished; they do not need to be active.

## The checks (each 0 to 1, 1 = good)

- `runs_ok`: share of the 3 runs that produced a top 3.
- `top3_stability`: average overlap of the top 3 between every pair of runs. 1 = same three every time. Below 0.78 fails.
- `top1_same`: share of runs that agree on #1.
- `pay_rule_ok`: when extra income matters [6.4 starts with "Yes"], #1 must be fairly paid (reference label, not the model's own label).
- `pay_not_bottom_third`: stricter, same condition: #1 is not among the lowest-paid third of the 15 options (needs `eur_hour` labels; only Henk has them).
- `form_fit`: at least 2 of the top 3 sit in a form the person ticked [3.4]. Skipped (1) for "I don't know yet".
- `variety_ok`: the top 3 are three different activities (reference activity labels).

Reference labels are hand-made in `build_wf3p_eval_labels.py`, so the checks do not trust the labels
the scoring model gives itself. Sjoerd can edit them in the data table.

## How to run

- n8n editor: open the eval workflow, tab **Evaluations**, **Run test** (metric-based view), or
  "Execute workflow" from the evaluation trigger.
- One persona by hand (also how Claude runs it via the n8n MCP): execute the workflow from the
  `Run by hand (persona)` trigger with body `{"persona": "Henk"}` or `{"persona": "all"}`.
- A full run is 12 scoring passes (4 personas x 3), roughly 3 to 5 minutes each, Gemini Flash cost only.

## Keeping the copy in sync (important)

The core is a copy, so after any WF3P scoring change it must be re-synced, or the eval tests old logic:
1. Export WF3P (n8n MCP `get_workflow_details`) to a JSON file.
2. `python3 sync_wf3p_core_ops.py <wf3p.json>` writes `ops.json`; remove the copy's old nodes and apply
   the ops with `update_workflow` (the ops add nodes, settings and connections).
3. Export the copy and run `python3 check_wf3p_core_in_sync.py` (expects `wf3p.json` and `core.json`):
   it must print `diffs 0` and no missing/extra connections.

Not yet covered: WF4P text checks (named organisations, invented roles, English words in Dutch reports)
with a light AI judge, and the currency check, which belongs to WF2P/WF4P output, not WF3P.
