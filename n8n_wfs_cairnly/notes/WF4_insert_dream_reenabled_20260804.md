# WF4 — "Insert dream" node re-enabled (2026-08-04)

## What was wrong

The `Insert dream` Supabase node in **live WF4** (`seWmQPFQqIe60TkU`) was
**disabled**. WF4's `updatedAt` was `2026-07-30T15:51:02.468Z`, one minute after
a manual test run (execution `9603`, 15:49–15:50) — the credential-reality
prompt edit. The node looks like it was switched off so the prompt could be
tested without writing rows, and was never switched back on.

Diffing the repo export against `WF4 …_LIVE_BACKUP_pre_credential_20260730.json`
confirms that session touched exactly one node's parameters: `Dream Job
Feasibility`.

## Why it was invisible

A disabled n8n node passes its input straight through and counts as successful.
So WF4 kept reporting `status: success`, the Global Error Handler never fired,
and nothing landed in `error_logs`. Silent data loss.

Execution `9712` (report `b96479dc-a39e-43a5-89a2-85373ca22c97`) shows the shape
clearly:

| Node | Output |
|---|---|
| Dream Job Feasibility | 2 full dream job analyses |
| Parse Dream | 2 clean records, correct `report_id` |
| Insert Top 3 | rows carry `id` + `created_at` → really inserted |
| Insert Runner Ups | same |
| **Insert dream** | **no `id`, no `created_at`** — input echoed, nothing written |

## Impact

Last successful `dream_jobs` write: **23 July 2026**. Report
`b96479dc-a39e-43a5-89a2-85373ca22c97` (3 Aug) was the only submission in the
window, so exactly one user was affected — but every later submission would have
hit the same wall.

Downstream, the chat gates career sections on a `report_sections` row existing
(`ChatContainer.tsx`, `waitForSectionRow`). With no row ever arriving, the user
looped on "taking a little longer… tap Continue again" indefinitely and could
not reach the dream job section, wrap-up, or their exec summary.

## The fix

`disabled: true` removed from the `Insert dream` node via
`PUT /api/v1/workflows/seWmQPFQqIe60TkU`.

Two things worth knowing for future API edits to a live workflow:

1. The n8n public API rejects three settings keys this instance stores
   (`binaryMode`, `callerPolicy`, `availableInMCP`) with
   `request/body/settings must NOT have additional properties`. They must be
   stripped from the PUT body.
2. n8n **merges** settings rather than replacing them, so stripping those keys
   does not drop them. Verified first on the inactive
   `WF4S - Starter Career selection EN` (`CrTJxSJw1wdSx59J`) before touching
   live WF4.

### Verification

Captured before and after the PUT:

| | before | after |
|---|---|---|
| `connections` md5 | `9e0e56c154a528fb8fb650cf7d9722be` | unchanged |
| `settings` md5 | `0906021c9be28a57524c61de995064fc` | unchanged |
| node count | 26 | 26 |
| `active` | true | true |
| disabled nodes | 1 (`Insert dream`) | 0 |

All 26 nodes were also compared by name and by prompt/code length before vs
after: zero differences. The PUT changed exactly one flag.

### Rollback

```
PUT /api/v1/workflows/seWmQPFQqIe60TkU
```
with `disabled: true` restored on the `Insert dream` node (or toggle it in the
n8n editor). Nothing else was touched, so nothing else needs restoring.

## Backfill

The two dream job sections for report `b96479dc-…` were recovered verbatim from
execution `9712`'s `Parse Dream` output and inserted into `report_sections`:

| order | title | move | chars |
|---|---|---|---|
| 1 | Hands-On Wildlife Conservation & Rewilding Work | Retrain | 4146 |
| 2 | Flexible, Laptop-Based Remote Role (Work-Life Balance First) | Ready now | 3547 |

`fb_status` was left `null`, which is correct — `deliver-section` sets it to
`true` when the section is delivered; WF4 never sets it.

## Note on the repo export

`WF4 - Career selection NL_EN.json` in this folder is **stale** relative to
live. Three nodes differ in body length (`Dream Job Feasibility`,
`Parse runner up`, `Split Top3`), so it predates some live edits. It was not
refreshed as part of this fix — re-export it from the n8n editor when
convenient.
