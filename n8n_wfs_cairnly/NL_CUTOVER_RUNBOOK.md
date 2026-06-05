# NL Bilingual Cutover Runbook

**Goal:** make the bilingual (EN/NL) duplicate workflows the live pipeline, keep the
English-only originals as an untouched backup. Reversible.

## Why it's not just "activate the dups"
n8n sub-workflows are chosen by **ID in the caller's `Execute Workflow` node**, not by
active status. So:
- **Webhook entry points** (WF1, WF7) swap by activation + where the platform points.
- **Sub-workflows** (WF3, WF4, WF6) run whenever their caller's `Execute Workflow` node
  references them — active status is irrelevant for being *called*.

WF2 is a single shared node (never duplicated). It's the one original we repoint.

## Current state (ready, nothing live changed)
- Dutch chain wired internally: `WF1-dup → WF2(orig) → WF3-dup → WF4-dup`
- `WF3-dup` → calls `WF4-dup` ✅
- `WF7-dup` → webhook path set to `exec-summary-6508dd5f8e79419599dc8fff32fb6703` ✅
- `WF2` still → `WF3-orig` (this is the cutover flip, do it WITH the entry switch)
- `WF5` chat feedback tool still → `WF6-orig` (cutover flip)
- All dups **inactive**. All originals **untouched + active**.

## Workflow IDs / paths
| | original | duplicate (EN/NL) |
|---|---|---|
| WF1 Profile Insert | `nupGvBByAGh4A9tL` (webhook `dfe2a07c-…`) | `0Z8WxV5tVFMJqIZt` (webhook `28477bc7-d895-4b0e-bc45-a030312f6fcc`) |
| WF3 scoring | `LJA5JPHvnqhA36Oh` | `zhgJuiDp60PS5ZKJ` |
| WF4 careers | `pXlzC6vuG7TO28oQ` | `seWmQPFQqIe60TkU` |
| WF6 feedback | `XuOb0iIv1Hwc2t62` | `CyyjL7D51NbVZNtL` |
| WF7 exec summary | `yg7naUkC6oqr2WpU` (webhook `exec-summary-6508…`) | `ohNbCw7pVqvjCZHT` |
| WF2 enrich (shared, not duplicated) | `vVv0tsnFlBnarMdq` | — |
| WF5 chat (shared, already bilingual) | `h7ie9zN080IM2g7N` | — |

Entry secret: `N8N_WEBHOOK_URL` (Supabase edge-function secret, used by `forward-to-n8n`).

## CUTOVER (pick a low-traffic moment)
1. **(You, n8n UI)** Activate `WF1-dup` and `WF7-dup`. Deactivate `WF7-orig`
   (the exec-summary path can only have one active owner).
   - Sub-workflows (WF3-dup, WF4-dup, WF6-dup) don't strictly need activating
     (they're called by ID), but activating them is harmless/cleaner.
2. **(Claude, on your "go")** Repoint the two shared originals to the dups:
   - `WF2` `Execute Workflow1` → `WF3-dup` (`zhgJuiDp60PS5ZKJ`)
   - `WF5` `Call 'fb_unified_all_sections'` → `WF6-dup` (`CyyjL7D51NbVZNtL`)
3. **(You, Supabase secrets)** Set `N8N_WEBHOOK_URL` to:
   `https://falkoratlas.app.n8n.cloud/webhook/28477bc7-d895-4b0e-bc45-a030312f6fcc`

Do steps 2 and 3 close together (seconds), so no Dutch user gets a half-English report
mid-flip. (EN users are unaffected throughout — the dups are bilingual/English-safe.)

## ROLLBACK (back to English-only originals)
1. **(You)** Set `N8N_WEBHOOK_URL` back to the WF1-orig URL
   (`https://falkoratlas.app.n8n.cloud/webhook/dfe2a07c-…` — confirm the exact value before changing).
2. **(Claude)** Repoint `WF2` → `WF3-orig` (`LJA5JPHvnqhA36Oh`) and `WF5` → `WF6-orig` (`XuOb0iIv1Hwc2t62`).
3. **(You)** Reactivate `WF7-orig`, deactivate `WF7-dup`.
The originals were never edited, so they are a clean known-good fallback.

## Still English-only (not yet duplicated/localized)
- `WF_cover_letter` (`M9w7xWeiPNmU7ZFb`) and `WF_custom_resume` (`IFhL4Lno0hyMJ1Jc`).
