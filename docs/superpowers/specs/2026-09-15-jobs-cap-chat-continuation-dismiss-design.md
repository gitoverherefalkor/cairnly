# Job search free tier, chat continuation, and "Not for me"

Date: 2026-09-15. Status: Phases A and B shipped. Phase C revised 2026-09-28 (decisions H–M), not built yet.

Three independent features, built as three phases in the order below. Each
phase ships on its own; nothing in a later phase is required by an earlier one.

## Goal

1. Open job search to everyone instead of gating it behind a referral, capped
   at 4 real searches per report, with the referral removing the cap.
2. Let a user keep talking to the coach after wrap-up, on a 50-message budget,
   without that conversation ever changing the report or the dashboard.
3. Give every career card a "Not for me" control that greys it out, records an
   optional reason, and carries through to the PDF.

## Decisions (Sjoerd, 2026-09-15)

- **A.** Job search becomes a free tier of 4 searches. Earning referral 1 (or a
  comp) removes the cap. Job search stays step 1 of the referral ladder, with
  the reward changing from "unlock" to "unlimited". Existing unlocked users
  keep unlimited: nobody loses anything.
- **B.** One search = one career that actually reaches n8n. Cache hits are
  free, so Recent Searches chips never cost a credit.
- **C.** Chat continuation, 50 messages, not a transcript download. Roughly
  €1.10 per user at Sonnet 5 rates, and only if someone actually sends all 50.
  *Superseded 2026-09-28 by H (monthly top-up of 40).*
- **D.** "Not for me" asks why with optional, skippable reason chips.
- **E.** Phase C ships behind a per-user gate that only Sjoerd can open, so
  selected testers use it before anyone else sees it.
  *Superseded 2026-09-28 by I (open to all, global kill switch).*
- **F.** Build order: Phase A, then Phase B with its security fixes. Phase C is
  deferred to a separate session.
- **G.** No Starter or Encore specific work. Those flavors are not live and not
  marketed, they are only landing + payment pages today, and every buyer lands
  on the same `/dashboard`, `/chat` and `/jobs` afterwards. All three features
  therefore apply to them automatically, which is the intended end state. No
  flavor guard, no variant surfaces, no separate copy.

## Two security findings that came out of the survey

Both were found while scoping Phase B. Neither is caused by this work; both
have to be fixed for Phase B's cap to mean anything.

### 1. `search-jobs` is unauthenticated

`supabase/config.toml:58` sets `verify_jwt = false`, and
`supabase/functions/search-jobs/index.ts` never checks the caller. The comment
about in-function JWT verification sitting under that block belongs to
`ensure-referral-code`, not this function. The only protection is a 10/min IP
rate limit.

Anyone who knows the URL can trigger paid Apify LinkedIn scrapes and AI scoring
today. The referral gate lives entirely in React and protects nothing at the
endpoint. A per-user cap is impossible without knowing who the user is, so
authentication is step one of Phase B.

### 2. Every user can write every column of their own `profiles` row

The live policy is:

```
"Users can update their own profile"  UPDATE  USING (auth.uid() = id)
```

No `WITH CHECK`, no column restriction. Any logged-in user can run
`supabase.from('profiles').update({ comp_tool_unlocks: 3 })` from the browser
console and grant themselves all three referral-gated tools. `comp_tool_unlocks`
is in the shipped `types.ts`, so the column name is public.

This directly defeats Phase B: the "unlimited searches" entitlement reads
`comp_tool_unlocks`, so a self-granted comp is a self-granted uncapped search
budget. The same hole covers `partner_id`, `referral_code` and
`stripe_promotion_code_id`.

**Fix:** revoke blanket UPDATE from `authenticated` and re-grant it
column-by-column.

Allowed: `first_name`, `last_name`, `country`, `pronouns`, `age_range`,
`region`, `preferred_language`, `email_reminders_enabled`,
`privacy_consent_at`, `terms_consent_at`, `resume_data`,
`resume_parsed_data`, `resume_uploaded_at`, `resume_full_data`,
`resume_full_data_extracted_at`, `updated_at`.

Service-role only: `id`, `email`, `auth_provider`, `created_at`,
`referral_code`, `stripe_promotion_code_id`, `partner_id`,
`comp_tool_unlocks`.

**Implementation caution:** `useProfile().updateProfile` spreads an arbitrary
`updates` object, so the allowlist must be checked against every caller before
the migration is applied. A missing column silently breaks a save. Verify
against `CheckoutForm.tsx:231`, `useResumeUpload.ts:50`,
`useAIResumeUpload.ts:155`, `Profile.tsx:304`, `Profile.tsx:559` and every
`updateProfile` call site.

This fix is broader than Phase B strictly needs. It is one migration and doing
half of it makes little sense, but it can be scaled back to `comp_tool_unlocks`
alone if Sjoerd prefers a smaller blast radius.

---

## Phase A — "Not for me"

No n8n changes, no prerequisites. Smallest and safest, so it ships first.

### Data

New table `dismissed_careers`:

| column | type | note |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid → auth.users | |
| `report_id` | uuid → reports | |
| `section_id` | uuid → report_sections | the exact career row |
| `section_type` | text | denormalised, for /ops aggregation |
| `career_title` | text | denormalised; survives translation churn |
| `reason` | text null | `not_interested` \| `wrong_level` \| `pay_too_low` \| `already_did` \| `location` \| `other` |
| `note` | text null | optional free text |
| `created_at` | timestamptz | |

Unique on `(report_id, section_id)`. RLS: owner may select, insert, update and
delete their own rows; service role reads for /ops and the PDF. Added to both
delete-user-data RPCs and to the retention purge.

A separate table rather than `report_sections.metadata` because that column is
written by WF4, and a user write racing a workflow write is a real collision.

`section_id` is the right key for every case: `top_career_1/2/3` are one row
each, and `runner_ups` / `outside_box` / `dream_jobs` are already one row per
career, split on `---CAREER_SPLIT---` by WF4.

### Frontend

New hook `useDismissedCareers(reportId)`: list plus a toggle mutation with
optimistic update.

`DashboardV4.tsx` gets a quiet "Not for me" control in two places: on the
top-3 accordion rows (`ReportAccordionRow`) and on each career tab inside the
grouped rows (`CareerTabs` / `CareerSlotChip`).

Dismissing a career:

- greys the card (reduced opacity, muted title), collapses it, and sinks it to
  the bottom of its group
- shows Undo, always one click, no confirmation
- reveals a skippable row of reason chips inline; choosing one saves and closes
  the row, ignoring it leaves `reason` null

Career 1 can be dismissed but **does not** promote career 2 into the hero slot.
Promoting would mean re-deriving the radar, the career map, the comparison and
the exec summary. The hero simply recedes.

### PDF

`report-print-data` adds a `dismissed` array to its payload (service-role read,
keyed by the render token).

`ReportPrintDocument.orderSections` already filters internal sections; it also
filters dismissed `runner_ups` / `outside_box` / `dream_jobs` out entirely.

A dismissed `top_career_1/2/3` stays in the PDF but carries a "Set aside"
marker, because the prose refers to the top three by number and removing one
breaks the narrative.

Bump `PRINT_BUILD` in `src/components/report-pdf/printBuild.ts`.

### /ops

A small aggregate on the Platform tab: most-dismissed careers and the reason
split, so the signal actually reaches Sjoerd. Read-only, English (per the ops
language rule).

### Out of scope for Phase A

Dismissals do not feed WF2/WF3/WF4/WF6 and do not influence a re-run. That is
production-pipeline work and a separate decision.

---

## Phase B — Job search free tier

### Prerequisites

Both security fixes above. The cap is decorative without them.

### Counting

Repurpose the existing `user_job_searches` table. Nothing writes to it today
(only the two delete RPCs reference it) and its shape is already exactly right:
one row per user + report + career + country, with a `search_status` column.

- cache miss that reached n8n → row with `search_status = 'charged'`
- cache hit → row with `search_status = 'cached'`

Confirm RLS and indexes on the table before relying on it; it has never been
exercised.

### Gate, inside `search-jobs` after the cache lookup

1. Authenticate the caller (new).
2. Resolve entitlement: unlimited if `referral_count >= 1` **or**
   `comp_tool_unlocks >= 1`, otherwise free tier.
3. Cache hit → serve it, log `'cached'`, charge nothing.
4. Cache miss + unlimited → run it, log `'charged'`.
5. Cache miss + free tier + already 4 `'charged'` rows for this report →
   return `{ error: 'search_limit_reached', used, limit }`.
6. Otherwise run it and log `'charged'`.

Four per report, lifetime. A second assessment gets a fresh four.

No real concurrency risk: `useJobSearch` loops careers sequentially.

### Frontend

- `Jobs.tsx` stops gating on `jobsFeature.unlocked`. It always renders the
  search UI and gates on credits instead.
- New hook `useJobSearchCredits(reportId)` → `{ used, limit, unlimited, remaining }`.
- `JobsSearch` shows "4 of 4 searches left" and warns when the user has
  selected more careers than they have credits.
- `JobsLocked` stops being a wall and becomes an out-of-searches state, with
  the invite CTA as the way out.
- `useReferralStatus`: job search stays in `REFERRAL_FEATURES` and
  `UNLOCK_LADDER`, with title and description changed from unlocking the tool
  to making it unlimited. The dashboard `UnlockToolkit` copy follows.

---

## Phase C — The coach after the report (revised 2026-09-28)

**Revised 2026-09-28 (decisions H–M below).** The original 50-message design
is superseded. Phases A and B shipped; nothing of Phase C existed yet when it
was revised.

### Revised decisions (Sjoerd, 2026-09-28)

- **H.** Monthly top-up instead of a lifetime 50. Start generous: **40
  messages per report per calendar month**, no end date. Tighten later with
  data.
- **I.** No hand-picked tester gate. Open to every user with a completed
  chat, behind one global kill switch only Sjoerd can flip. Replaces
  decision E. The early goal is feedback and volume, not cost.
- **J.** The coach behaves like a career advisor: conversation, agreed next
  steps, a check-in later. The check-in is the reason to come back.
- **K.** Entry points live on the dashboard (career cards, Move pill, "Not
  for me", later job results and custom resume), each opening the coach with
  a question already sent. A "continue" box at the bottom of /chat is
  secondary.
- **L.** WF5 prompt caching turned on (node v1.6, 5 min TTL). Done
  2026-09-28, version `48a94f4b`. WF5C is built with caching from the start.
- **M.** Existing users get it too. Anyone with a completed chat sees the
  entry points.
- **N.** The coach also reads the user's **saved ("Keep") messages**
  (`saved_chat_responses`, never purged).
- **O.** Users choose how long their raw chat is kept (30 days / 12 months /
  until deleted), with a clear warning about what the coach forgets after
  that date. Existing users stay on 30 days until they choose.
- **P.** Before a raw chat is deleted, a short **coach notes** summary is
  written and kept with the report, so the coach keeps its memory without
  the transcript. Disclosed on the choice screen.

### Why the original design needed changes

1. **Memory.** WF5 memory is a 10-message window, so "same memory keyed by
   report_id" only remembers the last 10 messages (usually the wrap-up). On
   top of that, the retention purge deletes `n8n_chat_histories` 30 days
   after `chat_completed_at`, so for most existing users the raw
   conversation is already gone. The real memory is the **final report**:
   WF6 has already written every piece of chat feedback into
   `report_sections`. WF5C gets a snapshot tool (below).
2. **Prompt.** Cloning the WF5 prompt as-is tells the coach to call WF6, to
   handle section buttons and to promise "this will be reflected in your
   report". Without the WF6 tool it would make promises it cannot keep. The
   WF5C prompt is a rewrite: roughly 11k of WF5's 25k characters (free-text
   advance, quick replies, replacements, WF6 rules, dream-jobs wrap-up) do
   not apply.

### n8n: WF5C "Cairnly Coach Continued"

New workflow, created **inactive**, copy saved to `n8n_wfs_cairnly/`. Node
plan is shown in chat before the API call.

- Chat trigger: same shape as WF5 (basic auth, `metadata` carries
  `report_id`, `first_name`, `preferred_language`, `country`, `entry_point`,
  `entry_context`).
- Anthropic Chat Model: Sonnet 5, node v1.6, **prompt caching 5 min**.
- Postgres Chat Memory: key `report_id`, window 10. Continues the old thread
  where it still exists; empty for purged users, which the snapshot covers.
- Tools:
  - `get_report_snapshot` (new, read-only): exec summary, top 3 + runner-ups
    with Move / feasibility / AI impact (incl. chat-generated replacement
    careers, labelled as such), the section feedback WF6 wrote, dismissed
    careers with reasons, saved ("Keep") messages with their section, coach
    notes, open next steps. One Supabase RPC returning a compact JSON, so the
    prompt stays small. Called once at the start of a conversation.
  - `get_user_profile`: unchanged from WF5 (`init_summary`).
  - `save_next_steps` (new, write): 1–3 steps plus a check-in date, into
    `coach_next_steps`. Writes **never** touch `report_sections`.
  - SerpAPI: carried over only if a supported replacement node exists (the
    current `toolSerpApi` node type is retired).
  - **No WF6 tool.** That removal is what guarantees the report and
    dashboard never change.
- Prompt: advisor framing. The report is fixed; the job is thinking it
  through, making decisions, planning and preparing (interviews, networking
  conversations, applications). Shared rules copied from WF5: tone, banned
  words, one idea per reply, stay grounded, output language, security.
  Static text first, per-user session data last.
- **Maintenance note:** tone, banned words and language rules now live in
  two prompts. Any change to those sections in WF5 is copied to WF5C.

New edge secret `N8N_CHAT_CONTINUE_WEBHOOK_URL`.

### Data

`coach_usage`: `(report_id, month)` primary key, `user_id`,
`messages_used`, `first_message_at`, `last_message_at`. Service-role write
only; the user reads their own rows for the counter.

`coach_next_steps`: `id`, `user_id`, `report_id`, `step` text,
`career_section_id` null, `check_in_at` date, `status`
(`open` | `done` | `dropped`), `created_at`, `updated_at`. Owner may select
and update `status`; inserts are service role (from WF5C). Added to both
delete-user-data RPCs.

`app_flags` (or one row in an existing config table): `coach_enabled`
boolean, service-role write only. The kill switch.

**Retention (must fix with this phase):** the nightly purge marks a user
`data_purged_at` and never rescans them until a newer chat completes. Coach
messages written after that would be kept forever, which breaks the 30-day
promise. The purge gets a second clock: coach transcripts are deleted 30
days after `coach_usage.last_message_at`. `coach_next_steps` follow the
account (they are user-visible data, like the report).

### Chat retention choice and coach notes (decisions O, P)

Why: WF6 does not capture every discussion (see
`n8n_wfs_cairnly/notes/WF5_WF6_capture_fix_TODO.md`, Scott's session), so
some of what users said exists only in the raw chat, which the purge
deletes.

- `profiles.chat_retention`: `'30d'` (default, today's promise) | `'12m'` |
  `'forever'`, plus `chat_retention_chosen_at`. Added to the allowed
  user-writable columns in the profiles column lock.
- The purge reads it: raw transcripts (`chat_messages`,
  `n8n_chat_histories`) are deleted 30 days / 12 months after the later of
  `chat_completed_at` and `coach_usage.last_message_at`, or never for
  `'forever'`. Replaces the one-shot `data_purged_at` logic for chat
  (answers purge unchanged).
- Asked at wrap-up for new users and on first coach entry for existing
  users. Changeable in Profile, next to "Delete my chat now". Copy warns:
  "After this date your coach remembers your report, saved messages and
  notes, not the conversation itself."
- `coach_notes` table: `report_id` pk, `user_id`, `notes` text (a few
  paragraphs: worries, decisions, open questions), `source_through`
  timestamptz, `updated_at`. Written by one cheap LLM call (a small new
  workflow or edge function) before a transcript is purged, and refreshed
  after a coach conversation goes idle. Service-role write, owner read.
  Added to both delete-user-data RPCs; deleted with the account.
- **Open decision (Sjoerd):** existing users whose raw chat still exists
  were promised 30 days and have not seen the notes disclosure yet. Either
  (a) generate notes for them now, before the purge, and disclose it on
  their first coach entry with a delete option, or (b) only generate notes
  for users who have seen the choice screen, accepting that most current
  transcripts are gone before anyone is asked.
- **Privacy policy** must describe the choice, the notes and the defaults
  before this ships. Current wording not yet checked.

### chat-proxy

A `mode: 'continue'` branch, reusing the existing auth, IP rate limit and
shared secret:

1. reject if `coach_enabled` is false
2. reject if the report has no completed chat or does not belong to the user
3. read this month's `coach_usage`; reject at 40 with `{ error:
   'coach_limit_reached', used, limit, resets_at }`
4. forward to the WF5C webhook
5. increment the counter (only on a successful reply)

### Frontend

- Dashboard "Ask the coach" buttons: career cards (top 3 and grouped rows),
  the Move pill (sends the existing `buildFeasibilityQuestion`), after a "Not
  for me" dismissal ("Want to talk through why?"). Later: job results,
  custom resume.
- "Your next steps" card on the dashboard: open steps, check-in date, mark
  done / drop.
- `/chat?mode=continue`: own session id, report sidebar, "32 of 40 left
  this month", no WrapUpCard, no quick-reply advance buttons. At zero: when
  it tops up, plus the transcript export.
- After wrap-up, the disabled chat input becomes a "Keep talking to your
  coach" entry.
- Entry copy sets expectations: thinking it through and planning, not
  editing the report.

### Check-ins

- On `check_in_at`, an email: "How did [step] go?", linking to
  `/chat?mode=continue&checkin=<step id>`. The coach opens from that step.
- Respects `profiles.email_reminders_enabled`. Reuse the existing reminder
  email path if it fits (to verify when building).
- Monthly top-up email ("Your coach messages for October are ready") only
  for users who used the coach before. Optional, decide after the first
  month.

### Measurement

Analytics events per entry point, messages per user per month, thumbs
up/down on coach replies (existing), check-in email to conversation rate,
next steps marked done. A small read-only panel on /ops (English).

### Cost

Estimates from character counts, not measured. Rewritten prompt ~3.5k
tokens plus tools, cached at 10% after the first message; 10-message memory
uncached; ~300 output tokens. About €0.01 per message, so 40 messages is
about €0.40 per user per month worst case. Verify with cache-read numbers in
the Anthropic console after launch.

### Build order

1. WF5 caching. **Done 2026-09-28.**
2. Coach core. **Built 2026-09-29, on branch, kill switch off:**
   - DB: `app_flags`, `coach_usage`, `coach_next_steps`, `coach_notes`,
     `get_coach_snapshot()`, `coach_save_next_step()`, `coach_usage_bump()`
     (migrations `20260929100000`, `20260929120000`, applied).
   - WF5C `wPBE2wIwDaj6Wy8D` in the Cairnly n8n project, **inactive**. The
     snapshot is loaded before every reply and put in the system prompt (tool
     results are not kept in n8n chat memory, so a snapshot tool would be lost
     after one turn). Prompt: `n8n_wfs_cairnly/notes/WF5C_system_prompt.md`.
   - `chat-proxy` v106 deployed: `mode: 'continue'` branch, and a report
     ownership check for every request (previously missing: a signed-in user
     could send another user's report_id).
   - Frontend: `/coach` page, dashboard "Your coach" card with next steps,
     clickable Move pill, "Ask the coach" links on career rows (incl. after
     "Not for me"), banner under a finished first chat. All hidden while the
     kill switch is off.
3. Coach notes. **Done 2026-09-29:** `coach-notes` edge function, cron every
   3h plus 02:15 UTC before the purge (migration `20260929110000`). First
   backfill: 13 reports, 6 with notes, 7 without real discussion. The first
   coach visit shows a notice explaining what the coach remembers (option a
   disclosure). Still open: the retention choice screen, purge changes for
   coach transcripts, privacy policy update.
4. Advisor loop: `save_next_step` and the next steps card are built; check-in
   emails are not.
5. /ops panel.

### Go-live checklist

1. Merge the branch (frontend).
2. Activate WF5C in n8n.
3. `update public.app_flags set value = true where key = 'coach_enabled';`
4. Send one coach message from a real account and check the reply, the
   counter, and that `report_sections` did not change.

---

## Testing

- **Phase A**: unit tests for the dismiss hook's optimistic toggle and for the
  PDF section filter. Browser check that a dismissed hero does not disturb the
  radar, career map or exec summary. PDF render check against a report with one
  dismissed runner-up and one dismissed top-3 career.
- **Phase B**: edge-function tests for each branch of the gate (cached,
  unlimited, under cap, at cap). An explicit test that an unauthenticated call
  is rejected, and one that a free-tier user cannot exceed 4 charged searches.
- **Phase C**: with the kill switch on, run a coach thread on Sjoerd's own
  account to the monthly limit and confirm `report_sections` and the dashboard
  are byte-identical before and after. Edge-function tests for each chat-proxy
  branch (switch off, not owner, under limit, at limit, month rollover). Check
  a purged (older than 30 days) report still gets a grounded first reply from
  the snapshot tool.
- `tsc --noEmit` checks zero files in this repo, so verification is
  `npm run build` plus vitest plus the browser.

## Runbook

Turn the coach on or off for everyone (service role / SQL editor):

```sql
update public.app_flags set value = true  where key = 'coach_enabled';
update public.app_flags set value = false where key = 'coach_enabled';
```

Roll back WF5 prompt caching: restore
`n8n_wfs_cairnly/backups/WF5 - Cairnly Coach_LIVE_BACKUP_pre_prompt_caching_20260928.json`
or publish the previous version (`f4e06f57`) from the n8n version history.

## Sequencing note

Resolved. The PR #84 hero-video merge landed as `7bec153` and `main` is clean,
so Phase A starts from a settled tree.
