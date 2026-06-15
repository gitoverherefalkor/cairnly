# Post-chat email lifecycle redesign

**Date:** 2026-06-15
**Status:** Design — awaiting review
**Author:** Sjoerd + Claude

## Problem

A user (Natasha) who had completed her chat *and* viewed her dashboard still received
a "Your full career report is ready" reminder. Investigation showed:

- The email was the `report_not_viewed` reminder from `check_and_send_reminders`
  (hourly pg_cron) → `send-reminder-email`.
- Its only suppression signal is `user_engagement_tracking.dashboard_visited_after_chat_at`,
  written by a **single client-side, fire-and-forget upsert** on `Dashboard.tsx`
  (errors swallowed, no retry, value overwritten on every visit).
- Natasha's genuine 11 Jun dashboard visit never persisted (provable: the email fired
  12 Jun while the column was still NULL; it only flipped on her 13 Jun revisit).
- Root cause is structural: a flaky best-effort write gating an email that fires only
  24h after chat completion. Any single missed write inside that window = a false
  "you haven't viewed your report" email.

## Goal

Replace the post-chat reminder behaviour with a deliberate lifecycle:

1. People should not think "Cairnly is over" after the chat. Send **one** clear
   "your dashboard is ready" email the moment the full report exists.
2. Drive activation of the existing referral-unlock tools (job search, tailored CV,
   cover letters) with a short, personalized nudge sequence.
3. Stop nagging. No open-ended reminder loops.

## Non-goals / out of scope

- The pre-chat funnel (`signup_no_start`, `survey_abandoned`, `chat_not_completed`)
  is unchanged.
- No new referral mechanics. The unlock ladder, invite codes, and the three tools
  (WF8 job search, WF9 resume, WFX cover letter) already exist in `useReferralStatus.ts`.
- No n8n workflow changes.
- The per-conversion "perk unlocked" email already sent from `payment-success`
  (counts 1/2/3, with inline next-tier nudge) stays as-is; we only add a delayed
  standalone follow-up (see Progression track).

## The lifecycle

### Removed
- `report_not_viewed` email and its selection block in `check_and_send_reminders`.
  (`dashboard_visited_after_chat_at` tracking can stay in place but is no longer a
  gate for any email; we leave the client write alone to avoid churn.)

### Kept (unchanged)
- Pre-chat funnel emails.
- `payment-success` per-conversion "perk unlocked" email (Track B confirmation).

### Added — Track A: Activation (users with 0 converted referrals)

| # | Email | Trigger |
|---|-------|---------|
| A0 | **Dashboard ready** | Chat complete AND the report's `exec_summary` section exists (WF7 finished = everything populated) AND `dashboard_ready_sent_at IS NULL`. |
| A1 | **Unlock nudge #1** | `dashboard_ready_sent_at` ≥ ~2 days ago AND 0 converted referrals AND `unlock_nudge_1_sent_at IS NULL`. Personalized: "Let Cairnly find you open roles for {top role}. Invite a friend with code {CODE} to unlock it." |
| A2 | **Unlock nudge #2** | `unlock_nudge_1_sent_at` ≥ ~4 days ago (≈ day 6 overall) AND 0 converted referrals AND `unlock_nudge_2_sent_at IS NULL`. "Invite more to also unlock a tailored CV + cover letters for {top role}." |

Track A stops the instant the user has ≥1 converted referral (handoff to Track B).
Both A1 and A2 are gated on `(SELECT count(*) FROM referrals WHERE referrer_user_id = u) = 0`.

### Added — Track B: Progression follow-up

The existing `payment-success` email already confirms each conversion (counts 1/2/3)
and nudges the next tier inline. We add **one** delayed standalone nudge per gap, only
when the user stalls:

| Email | Trigger |
|-------|---------|
| **Progression nudge (next tool)** | User has exactly 1 or 2 converted referrals, their most recent `referrals.created_at` is ≥ ~3 days ago, and we have not yet sent a progression nudge for that referral count. Copy: "You unlocked {current tool}. Invite one more friend to unlock {next tool} for {top role}." |
| **Refund unlock (once)** | User has exactly 3 converted referrals (all tools unlocked), most recent conversion ≥ ~3 days ago, and the refund email has not been sent. Copy: "All three tools are yours. From here, every friend who joins earns you money back, up to a full refund." **Sent once. No further emails ever.** |

Refund tiers 4–6 get this single email and nothing more (per decision: one money-back
email, then silence).

## Personalization data

- **Top role title:** `report_sections.title` where `section_type = 'top_career_1'`
  for the user's latest report. Stored as HTML (e.g.
  `<h3><strong>Serious Games Product Designer</strong></h3>`) → strip tags to get the
  clean name. Fallback if missing/empty: "your top career match".
- **Referral code:** `profiles.referral_code`. Fallback: link to `/dashboard?share=1`.
- **Language:** existing `preferred_language` resolution in `send-reminder-email`.

## Architecture

Extend the existing machinery — same pattern, same templates, same dedup approach.

- **`send-reminder-email` edge function:** add three new `type` values —
  `dashboard_ready`, `unlock_nudge` (carries which nudge + top role + code), and
  `referral_progression` (carries tier context). Reuse `email-chrome.ts`
  (`renderEmail`, `bodyRow`, `ctaRow`, `h1`, `paragraph`, `callout`). EN + NL copy
  blocks like the existing ones, no em-dashes per glossary.
- **`check_and_send_reminders` (pg_cron, hourly):** remove the `report_not_viewed`
  block; add selection blocks for A0, A1, A2, and the two Track B follow-ups. Each
  block sets its sent-at flag in the same transaction (dedup), mirroring the existing
  blocks. Top role title + referral code joined in from `report_sections` / `profiles`
  so the edge function receives them ready to render.
- **State:** new nullable columns on `user_engagement_tracking`:
  - `dashboard_ready_sent_at TIMESTAMPTZ`
  - `unlock_nudge_1_sent_at TIMESTAMPTZ`
  - `unlock_nudge_2_sent_at TIMESTAMPTZ`
  - `referral_progression_nudge_count INT` (last referral count we nudged for; prevents
    repeat nudges at the same tier)
  - `refund_unlock_email_sent_at TIMESTAMPTZ`
  Added via a version-controlled migration in `supabase/migrations/`.

## Edge cases & safety

- **WF7 never produces exec_summary** (failure): A0 would never fire. **Decision: include
  a 24h long-stop** — also send A0 if chat completed > 24h ago even without an
  `exec_summary` section, so the user is never silently dropped. (WF7 failures are also
  caught by the Global Error Handler, but the long-stop guarantees the email.)
- **User converts a referral mid-Track-A:** the `count = 0` gate naturally halts A1/A2
  at the next hourly run.
- **Re-takes / timestamp rewrites:** all new flags are independent of survey/chat
  re-submission, so a re-take cannot resurrect a sent email.
- **`email_reminders_enabled = FALSE`:** respected on every block, as today.

## Timing (confirmed)

Offsets anchor to **different events**, so they are not one sequence:

- **Track A** (measured from the dashboard-ready email): day 0 ready → **day 2** nudge #1
  → **day 6** nudge #2.
- **Track B** (measured from the user's last successful conversion): **3 days** after a
  stall, nudge the next tier.

A user is in exactly one track at a time (Track A requires 0 referrals; Track B requires
≥1), so the cadences never overlap for the same person.

## Resolved decisions

1. A0 long-stop: **include the 24h fallback** (send dashboard-ready even if `exec_summary`
   is absent once chat completed > 24h ago).
2. Day offsets: **keep 2 / 6 (Track A) and 3 (Track B).**

## Rollout

- One migration (additive columns + cron function replace) → applied via MCP per repo
  policy (version-controlled SQL).
- One edge function redeploy (`send-reminder-email`) — note: re-deploying an *existing*
  function requires explicit approval per project policy.
- Export current `check_and_send_reminders` definition before replacing (already
  captured in this session's investigation).
