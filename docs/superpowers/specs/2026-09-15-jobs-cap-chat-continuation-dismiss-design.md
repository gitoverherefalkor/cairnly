# Job search free tier, chat continuation, and "Not for me"

Date: 2026-09-15. Status: approved by Sjoerd in chat (answers A–E below), building.

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
- **D.** "Not for me" asks why with optional, skippable reason chips.
- **E.** Phase C ships behind a per-user gate that only Sjoerd can open, so
  selected testers use it before anyone else sees it.
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

## Phase C — Chat continuation, 50 messages

**Deferred to a separate session (decision F).** The design below is recorded
so that session can pick it up without re-deciding anything. Nothing in Phase A
or Phase B depends on it.

### Tester gate (decision E)

The gate must live on a table users cannot write. It cannot be a column on
`profiles`, for exactly the reason in finding 2 above: a user would simply
grant it to themselves.

New table `beta_access`:

| column | type | note |
|---|---|---|
| `user_id` | uuid → auth.users | |
| `feature` | text | e.g. `chat_continuation` |
| `granted_at` | timestamptz | |
| `note` | text null | why, for Sjoerd's own memory |

Primary key `(user_id, feature)`. RLS: authenticated may **select their own
rows only**. No insert, update or delete policy for authenticated at all, so
the only way in is the service role. Sjoerd grants access with a one-line SQL
insert (documented in the spec's runbook section below).

Enforced in two places: the frontend hides the entry point, and `chat-proxy`
refuses `mode: 'continue'` for a user with no row. The server check is the real
one; hiding the button is only cosmetics.

When Phase C leaves beta, the gate becomes "row present **or** feature is
generally available", flipped by a constant in one place.

### n8n

New workflow **WF5C "Cairnly Coach Continued"**, a clone of WF5
(`h7ie9zN080IM2g7N`) with:

- the `Call 'WF6 - Feedback processing NL/EN'` tool **removed**. That removal,
  not a prompt instruction, is what guarantees the dashboard never changes.
- the agent prompt reframed: the report is fixed, the coach cannot edit it, its
  job is helping the user think, not rewriting sections
- the same Postgres chat memory keyed by `report_id`, so the follow-up thread
  remembers the first conversation at no extra cost
- the same `get_user_profile` tool (reads `init_summary` only)
- the same banned-phrase and reply-length rules already applied to WF5

A new workflow rather than a mode flag on WF5, because WF5 is live and a clone
carries zero risk to it. Under the n8n policy in CLAUDE.md this is allowed
without per-workflow approval, but the node plan is still shown in chat before
the API call, the workflow is created **inactive** for Sjoerd to review and
activate himself, and a copy is saved to `n8n_wfs_cairnly/`.

New edge secret `N8N_CHAT_CONTINUE_WEBHOOK_URL`.

### Budget

Enforced in `chat-proxy`, which already has auth, IP rate limiting and the
shared secret. A `mode: 'continue'` branch:

1. reject if the user has no `beta_access` row for `chat_continuation`
2. read `chat_continuation_usage` for this report; reject at 50
3. forward to the continuation webhook
4. increment the counter

New table `chat_continuation_usage`: `report_id` pk, `user_id`,
`messages_used`, `first_message_at`, `last_message_at`. Service-role write
only; the user reads their own row for the counter display.

The counter is authoritative for spend. The continuation thread also gets a
fresh `session_id`, so its messages stay distinguishable inside `chat_messages`.

### Frontend

- After wrap-up, the dead chat input becomes a "Continue the conversation"
  entry, shown only to gated testers.
- The follow-up thread lives at `/chat?mode=continue` with its own session id,
  keeps the report sidebar, and shows "42 of 50 left".
- No WrapUpCard in continuation mode, no WF6 call, so the dashboard is
  untouched by construction.
- At zero, a clear end state pointing at the existing transcript export under
  Profile → Export my data.

### Copy

The entry copy has to set the expectation up front: this is thinking it
through, not editing the report. A follow-up chat that cannot change anything
reads as a nerfed version unless it is framed as coaching from the start.

### Cost

WF5 runs Claude Sonnet 5 ($2/M in, $10/M out) with a 10-message memory window,
a ~6.5k-token system prompt, and a tool that fetches only the compact
`init_summary` rather than the whole report. That is roughly €0.02 a message,
so 50 messages is about €1.10, and only for a user who actually sends all 50.

---

## Testing

- **Phase A**: unit tests for the dismiss hook's optimistic toggle and for the
  PDF section filter. Browser check that a dismissed hero does not disturb the
  radar, career map or exec summary. PDF render check against a report with one
  dismissed runner-up and one dismissed top-3 career.
- **Phase B**: edge-function tests for each branch of the gate (cached,
  unlimited, under cap, at cap). An explicit test that an unauthenticated call
  is rejected, and one that a free-tier user cannot exceed 4 charged searches.
- **Phase C**: the tester gate is the test plan. Grant access to one account,
  run a full continuation thread to exhaustion, and confirm `report_sections`
  and the dashboard are byte-identical before and after.
- `tsc --noEmit` checks zero files in this repo, so verification is
  `npm run build` plus vitest plus the browser.

## Runbook

Grant a tester access to the continuation chat:

```sql
insert into public.beta_access (user_id, feature, note)
select id, 'chat_continuation', 'first beta round'
from auth.users where email = 'someone@example.com';
```

Revoke:

```sql
delete from public.beta_access
where feature = 'chat_continuation'
  and user_id = (select id from auth.users where email = 'someone@example.com');
```

## Sequencing note

Resolved. The PR #84 hero-video merge landed as `7bec153` and `main` is clean,
so Phase A starts from a settled tree.
