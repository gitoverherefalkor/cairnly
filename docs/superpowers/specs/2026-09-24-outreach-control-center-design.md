# Outreach control center: concepts in /ops, scheduled sending, action pings

Date: 2026-09-24. Status: design approved by Sjoerd in chat, spec awaiting review.

## Goal

/ops becomes the place where outreach mail is decided, and Gmail becomes the
postman. Today a suggestion lands as a Gmail draft, Sjoerd opens Gmail, edits,
and sends (or WF12 sends the draft on the pacing schedule). After this change:

1. The system writes a **concept** and stores it in the database, not in Gmail.
2. /ops shows every concept **open and editable in place**, no extra click.
3. Sjoerd edits if needed and presses **Schedule** (next free slot, randomised
   pacing) or **Send** (now).
4. WF12 composes and sends the message through Gmail, in the right thread, with
   the right sender, signature and quote.

The real problem this solves is **timeliness**: follow-ups and new outreach go
out late because the work only appears when Sjoerd goes looking for it. So the
second half of the change is a cockpit that says what is waiting and whether
tomorrow's slots are filled, plus Chrome push notifications when there is
something to do.

## Decisions (Sjoerd, 2026-09-24)

- A. **Everything is approved by Sjoerd first.** Chases stop auto-queueing
  themselves. No mail leaves without a human pressing Schedule or Send.
- B. **The first mail to a new agency is in scope.** It gets a generator like
  the chases (skeleton + limited personalisation).
- C. **Use the randomised schedule as much as possible.** Schedule is the main
  button; Send is the exception.
- D. **Real Web Push** (works with the /ops tab closed, as long as Chrome runs):
  an immediate ping for an inbound reply, one bundled ping per working day for
  everything else, plus a conditional afternoon nudge.
- E. **Replies do not count toward the daily cap.** The cap of 8 exists so cold
  mail does not look like a blast; answering someone who wrote to us is not cold
  mail. Cap applies to first mails, chases and check-ins only.
- F. **Runway is shown and alarmed.** The cockpit shows how many working days
  of not-yet-contacted agencies are left; below 5 it is flagged in the daily ping.
- G. **Chases are prepared at most one working day ahead** and revalidated at
  send time, because the chase variant depends on click data that can change.
  First mails may be prepared further ahead.
- H. **A paused queue must be loud.** Red banner in the cockpit, and a ping when
  approved mail is due inside the send window while sending is paused. Same for
  a send that failed for good.

## Where it stands today (context)

- WF11 (`JXOW9lwv9MKPp9Cy`) feeds Gmail mail to `outreach-mail-sync`, which
  classifies inbound mail, advances statuses, and returns `drafts` that WF11
  creates in Gmail. Follow-ups/check-ins are composed only when /ops sets
  `followup_requested_at` ("Draft it").
- WF12 (`TNlRk9vah0xqSIZn`) is knocked by pg_cron (`outreach_send_wake`) when
  `outreach_send_due()` says a mail may leave, calls `outreach-send {action:'next'}`,
  and posts the returned **Gmail draft id** to `drafts/send`.
- All pacing lives in SQL (`outreach_send_blocked`, `outreach_send_claim`):
  weekdays, Mon from 13:00, Fri until 12:00, else 09:00-16:30, random 24-53 min
  persisted gap, 8/day, kill switch `outreach_send_state.gepauzeerd`.
- `outreach_mails.snippet` is capped at 200 chars; the full body and the RFC
  `Message-ID` header are not stored.
- OutsideInput already runs this exact model (`_outreach/queue.ts`: composed
  mail in a queue with `approved_at`, `buildMime` → Gmail `messages/send` with
  `raw`, signature appended in code, `drawGapMinutes`). Port the pattern, not the
  code: the repos stay independent.

Pipeline on 2026-09-24: 31 not contacted, 17 sent once, 16 chased once, which is
up to ~143 mails at 8/day, roughly 18 working days if every slot is filled.

## Architecture

```
            ┌──────────── pg_cron 07:30 + 14:45 (wd) / "Prepare more" button
            ▼
   outreach-prepare ──► outreach_concepts (voorstel)
                               ▲
   WF11 ─► outreach-mail-sync ─┘ (reply concepts; marks others 'verouderd')
                               │
   /ops cockpit ── edit / Schedule / Send ──► outreach_send_queue (concept_id)
                               │
   pg_cron outreach_send_wake ─► WF12 ─► outreach-send 'next'
                                           (revalidate, build MIME)
                                        ─► Gmail messages/send {raw, threadId}
                                        ─► outreach-send 'sent'
   pg_cron digest/nudge + events ─► ops-push ─► Web Push ─► Chrome
```

Units and their one job:

| Unit | Job | New/changed |
|---|---|---|
| `outreach_concepts` table | Holds every mail that still has to leave, and its fate | new |
| `outreach-prepare` fn | Decides which chases/check-ins/first mails are needed and writes concepts | new |
| `outreach-mail-sync` fn | Stores full inbound body + Message-ID, writes reply concepts, invalidates stale concepts, fires reply ping | changed |
| `_shared/outreachMime.ts` | Builds the RFC 2822 message (HTML, signature, thread headers, quote) | new |
| `_shared/outreachSignature.ts` | Sjoerd's Cairnly signature, verbatim from a sent mail | new |
| `_shared/outreachInitial.ts` | First-mail skeleton + personalisation, like `outreachFollowUp.ts` | new |
| `outreach-send` fn | Claims, revalidates, returns `raw` + `threadId` | changed |
| `ops-outreach` fn | Concept edit/schedule/send/discard/park, push subscribe | changed |
| `ops-push` fn | Sends Web Push; digest, nudge and event pings | new |
| WF12 | Posts `raw` to `messages/send` instead of a draft id to `drafts/send` | **existing workflow, per-workflow yes required** |
| WF11 | Unchanged. Sync returns `drafts: []`, so the draft branch creates nothing | none |
| `src/lib/outreachHighlight.ts` | Pure functions for the highlight views | new |
| `OutreachCockpit`, `ConceptCard`, `ReplyConceptCard` | The UI | new |
| `public/ops-sw.js` | Service worker for push | new |

## 1. Data model

### `outreach_concepts` (new)

```
id              uuid pk
slug            text not null            -- prospect
soort           text  check in ('initial','chase','checkin','reply')
step            int                      -- chase 1|2, else null
status          text  check in ('voorstel','ingepland','verzonden',
                                'weggegooid','verouderd','geen_antwoord')
to_email        text not null
subject         text not null
body            text not null            -- plain text, what will be sent
body_origineel  text not null            -- what the generator wrote
skeleton        text                     -- template the body was built on (null for replies)
variant         text                     -- e.g. 'clicked' | 'quiet' | 'goodbye' | subject 'a'|'b'
basis           jsonb                    -- facts the concept assumed: status, confirmed clicks,
                                         -- last inbound mail id, last outbound sent_at
thread_id       text                     -- Gmail thread (null for a first mail)
in_reply_to     text                     -- RFC Message-ID we answer or chase
references_hdr  text
answers_mail_id uuid references outreach_mails  -- reply concepts: the inbound mail
rfc_message_id  text unique              -- generated by us before sending
verouderd_reden text
bewerkt_op      timestamptz              -- set on first human edit; generator never overwrites after
created_at, updated_at timestamptz
```

One live concept per (slug, soort, step): partial unique index on status in
('voorstel','ingepland'). RLS on, no policies; /ops goes through `ops-outreach`.

### `outreach_send_queue` (changed)

- add `concept_id uuid references outreach_concepts`, `direct boolean default false`
- `draft_id` becomes nullable; `soort` gains `'checkin'`
- partial unique index on `concept_id` where status in ('queued','sending')
- Cutover rule: zero live rows with `draft_id` when WF12 switches. MEPD's
  leftover draft is sent by hand or cancelled before cutover.

### `outreach_mails` (changed)

- add `body_text text` (full plain text, quoted history stripped via existing
  `replyBodyOnly`), `rfc_message_id text`, index on `rfc_message_id`.
- Existing rows keep only the snippet; the UI says "(snippet only)" for them.
- One-off backfill of `rfc_message_id` for our first mails and chases (the ~40
  hand-sent threads), so chases can carry `In-Reply-To`/`References`. Fallback
  when missing: send in the Gmail thread with "Re: <original subject>" and no
  reply headers. Gmail threads it on our side; most clients thread on subject.

### Push (new)

- `ops_push_subscriptions`: endpoint unique, p256dh, auth, user_id, created_at,
  last_ok_at, failed_count. A 404/410 from the push service deletes the row.
- `ops_push_log`: (kind, key, day) unique, the dedupe for every ping.

## 2. Producing concepts

### Replies (in `outreach-mail-sync`)

As today, inbound mail is classified. Where today a reply draft is returned to
WF11, the sync instead inserts a `reply` concept (`answers_mail_id`, thread,
`in_reply_to` = their Message-ID). `drafts` is always `[]`. Auto-replies
(`sentiment = 'auto'`) produce no concept.

### Chases, check-ins, first mails (`outreach-prepare`, new)

Runs 07:30 and 14:45 Amsterdam on working days (pg_cron → pg_net → function,
free, no n8n execution) and on the /ops "Prepare more" button.

1. **Chases and check-ins**: every prospect whose `followUp()` result is due
   today or on the next working day gets a concept, using the existing
   skeletons in `_shared/outreachFollowUp.ts` (the TS copy of the rules in
   `src/lib/outreach.ts`). Chases never more than one working day ahead (G).
2. **First mails**: free cold capacity for the next 2 working days = the sum
   of each day's capacity − (cold mail already queued or prepared in that
   window). A day's capacity is `min(8, floor(window minutes / 38.5) + 1)`,
   38.5 being the mean of the 24-53 min gap: a Monday (13:00-16:30) or Friday
   (09:00-12:00) holds about 6, not 8. The same function feeds the cockpit. Fill it from
   `nog_niet_benaderd` in order warm → tier A → B → C → name.
3. Never touches a concept with `bewerkt_op` set.

### First-mail generator (`_shared/outreachInitial.ts`)

- The skeleton is Sjoerd's real first mail, pulled from Gmail Sent during
  implementation and confirmed by him before it is used.
- Subject from the prospect's existing `subject_variant` (a/b), unchanged.
- The demo link keeps the per-agency tracking exactly as in the sent mails
  (outreach-click slug), so click attribution keeps working.
- Claude may only adapt the salutation and opening line, same rules and same
  fallback-to-skeleton as the chases. The seed traps (`agencyName()`, "K. Dalm;
  Clemens van Gemert") apply.
- Ends with the full Cairnly signature (first mail has no thread below it).

## 3. Staleness: concepts that stopped being true

A concept is marked `verouderd` (with a reason) and any live queue row for it
is cancelled when:

- a new **inbound** mail for that slug is stored after the concept was created,
  unless it is an auto-reply (out-of-office must not stop chases);
- an **outbound** mail for that slug is stored that was not sent by our queue
  (matched on `rfc_message_id`): Sjoerd answered from Gmail directly;
- the prospect's status moves to one where the concept no longer applies
  (e.g. `geen_fit`, `afgewezen`, `gesprek_gepland` for a chase).

These run in the sync and in `ops-outreach` status updates. A second inbound
mail on a thread with a live reply concept first marks that concept
`verouderd`, then creates a fresh reply concept answering the newest mail; if
the old one was edited, /ops shows both so Sjoerd's text is not lost. Then, at send
time, `outreach-send 'next'` **revalidates** the claimed concept against
`basis`: for a chase, status and last-outbound unchanged, and the click-variant
still the one `followUp`/templates would pick now; for a first mail, status
still `nog_niet_benaderd`. If not, the concept goes `verouderd`, the queue row
`cancelled`, and `next` returns `{send:null, reason:'stale'}`; the next knock
takes the next row.

An edited (`bewerkt_op`) concept that goes stale keeps Sjoerd's text; /ops shows
it with the reason and three buttons: Schedule anyway, Regenerate, Discard.

## 4. Sending

### Schedule and Send semantics

| | Cold (initial, chase, checkin) | Reply |
|---|---|---|
| **Schedule** | Queue; existing window + persisted random gap + cap 8/day; priority chase/checkin before initial | Queue; weekdays 08:00-18:00, random 5-20 min delay; **no cap, does not move the cold gap** |
| **Send** | `direct`: ignores window and gap, **counts toward the cap**, re-rolls the gap after | `direct`: immediately |
| Kill switch | Respected by both. Send while paused says so and waits. |

Send has a 15 second **Undo**: the queue row gets `niet_voor = now() + 15s`; the
card shows a countdown; Undo cancels the row. After the 15 seconds `ops-outreach`
knocks WF12 directly; if the tab is closed, the next minutely `outreach_send_wake`
picks it up (direct rows bypass the 3-minute knock throttle).

Every scheduled concept shows an estimated send time ("~Tue 10:40"), computed
from `next_allowed_at`, the window and the mean gap. It is labelled as an
estimate.

`outreach_send_blocked()` gains the reply lane and the direct lane; the rule
stays in SQL and stays testable with an injected clock. `MAX_PER_DAG` stays
equal in SQL and `outreach-send`.

### Composing the message (`_shared/outreachMime.ts`)

- HTML via the existing `outreachHtml.ts` conversion (plain text upstream,
  one boundary), plus a text/plain alternative.
- `From: Sjoerd Geurts <sjoerd@cairnly.io>` (the address the Gmail filter and
  WF11 watch), `To`, `Subject` (replies and chases: "Re: " + thread subject).
- `Message-ID` generated by us and stored on the concept **before** sending,
  so the sync recognises our own mail and later chases can reference it.
- `In-Reply-To` / `References` from the concept.
- Replies: their last message quoted below, Gmail style ("Op <datum> schreef
  <naam> <email>:" + blockquote of `body_text`). Chases: no quote, same as the
  16 chases Sjoerd sent by hand on 2026-09-21.
- Signature: full Cairnly signature on first mails only; replies, chases and
  check-ins keep ending on "Groet,\nSjoerd" as today.
- Returned to WF12 as base64url `raw` plus `threadId` (null for a first mail).

### WF12 change (needs Sjoerd's explicit yes for WF12)

One node: the HTTP request posts `{raw, threadId}` to
`https://gmail.googleapis.com/gmail/v1/users/me/messages/send` instead of
`{id}` to `drafts/send`, and reports `id` + `threadId` back in `sent`. Export
WF12 to `n8n_wfs_cairnly/backups/` first. No other node changes.

### After sending

`outreach-send 'sent'` marks the concept `verzonden`, stores the Gmail message
and thread id, writes the outbound `outreach_mails` row directly (so the
status ladder moves without waiting for a sweep), and calls
`outreach_advance_status` exactly as the sync does for outbound mail. The
sync later dedupes on `gmail_message_id`.

## 5. The cockpit (/ops, English UI)

At the top of the Outreach tab. /ops is English; the mails themselves stay Dutch.

```
TODAY 3/8 sent · next ~10:42    TOMORROW 5/8 planned · 3 slots empty    RUNWAY 9 working days
[red bar when sending is paused and something is due]
──────────────────────────────────────────────────────────────────────────────
WAITING ON YOU (7)
 Reply · Ingrid, Bureau X · 2h ago             [their mail | concept, side by side]
 Chase 1 · Bureau Y · 1 day late               [concept open, editable]
 First mail · Bureau Z · tier A                [concept open, editable]
                                    [Schedule all chases + first mails]
SCHEDULED (5)  ~10:42 Bureau Q · ~11:20 Bureau R · …          [Unschedule]
```

- Order in "Waiting on you": replies, then late chases/check-ins (most late
  first), then due today, then first mails.
- Every concept is an open, autosaving textarea (debounced). Buttons: Schedule,
  Send, Discard. Reply cards add **Park** (existing check-in logic) and **No
  reply needed** (status `geen_antwoord`).
- **Schedule all** covers chases, check-ins and first mails. Replies are always
  approved one by one.
- Tomorrow's "slots empty" = that day's capacity (see prepare) − cold mail scheduled for it.
- Runway = not-contacted agencies ÷ expected first-mail slots per working day
  over the next 10 working days (cap minus expected chases). Amber below 5.
- The existing table, focus cards and filters stay below the cockpit. The
  "Draft it" / "Draft all due" / "Draft early" buttons are removed; their job is
  now done by `outreach-prepare`.
- OutreachTab.tsx is already 1,220 lines; the cockpit lives in its own files.
- Mobile: reply view stacks their mail above the concept.

### Highlighting (`src/lib/outreachHighlight.ts`, pure, unit-tested)

- **First mails, chases, check-ins:** word diff of `body` against `skeleton`.
  Anything not in the skeleton is highlighted (generator's personalisation and
  Sjoerd's own edits); the boilerplate renders muted.
- **Replies:** content words (NL + EN stopword list, simple stemming by
  lowercasing and trimming common suffixes) that appear in both their mail and
  the concept are highlighted on both sides. Sentences in their mail ending in
  "?" are marked as questions; a question none of whose content words appear
  in the concept gets a warning marker ("not answered?").
- Highlights recompute live as Sjoerd edits.

## 6. Push notifications

- Service worker `public/ops-sw.js` (scope `/ops`). A "Notifications on"
  button in the cockpit asks Chrome for permission and stores the subscription
  via `ops-push`/`ops-outreach` (admin only).
- VAPID: public key in the frontend as `VITE_VAPID_PUBLIC_KEY` (public by
  design), private key only as Supabase secret `VAPID_PRIVATE_KEY` with
  `VAPID_SUBJECT=mailto:sjoerd@cairnly.io`. Never in git.
- Clicking a notification opens /ops on the relevant concept.
- iPhone only works if /ops is added to the home screen; Chrome on the Mac
  works directly. Out of scope to make /ops a full PWA.

| Ping | When | Content |
|---|---|---|
| Reply | Inbound mail that needs an answer, 08:00-20:00 Amsterdam; outside that it folds into the morning ping | "Ingrid (Bureau X) replied: <samenvatting>" |
| Morning | 08:30 working days, **only if there is something** | "5 concepts waiting · 1 reply · tomorrow 3 slots empty · runway 4 days" |
| Afternoon nudge | 15:00 working days, only if tomorrow has empty cold slots and concepts are ready | "Tomorrow 3 of 8 slots empty, 4 concepts ready to schedule" |
| Paused alarm | Approved mail due inside the window while paused; once per day | "Sending is paused, 3 mails waiting" |
| Send failed | A queue row reaches `failed` | "Mail to Bureau Y failed: <error>" |

pg_cron runs in UTC; the digest jobs fire at both possible UTC times and
`ops-push` checks the Amsterdam clock, with `ops_push_log` preventing doubles.

## Error handling

- Generation failure → fallback to the plain skeleton (existing pattern); a
  reply concept that fails to generate is still created with an empty body and
  a "generation failed" label so the reply is never invisible.
- MIME build or revalidation error in `next` → row `failed` with reason, send
  failed ping. Two attempts max, then waits for a human (existing rule).
- Push delivery failure → counted per subscription; 404/410 removes it. A
  failed ping never blocks anything else.
- Every mutation from /ops goes through `ops-outreach` with the admin check.

## Testing

- Deno unit tests: MIME builder (headers, threading, HTML escaping, signature
  only on first mail, quote only on replies), first-mail generator (seed traps,
  fallback), staleness and revalidation rules, prepare's slot arithmetic.
- SQL: the cap/lane/direct rules with an injected clock inside a DO block that
  ends in RAISE EXCEPTION (existing auto-rollback pattern).
- Vitest: `outreachHighlight.ts` (skeleton diff, shared terms, unanswered
  question), runway and slots arithmetic. Mind the Vitest Node-env traps.
- End to end before any agency gets mail: a concept addressed to Sjoerd's own
  address, scheduled through the real queue with sending unpaused for that one
  row. Check thread, signature, quote and HTML in his inbox. Then one reply
  concept on a real thread with Sjoerd watching.
- Push: Sjoerd clicks "allow" once in Chrome; test ping from the cockpit.

## Rollout

1. Build on a branch; migrations and new functions can land first (inert
   while nothing writes concepts).
2. Pause sending. Clear legacy draft-based queue rows (MEPD).
3. Present the WF12 node change; on Sjoerd's yes, export WF12 and update it.
4. Deploy, run the self-addressed test, unpause.
5. Turn on `outreach-prepare` cron and push crons.
6. Later, separately: remove WF11's now-idle draft branch and the
   `followup_requested_at` / `draft_created` code paths.

## Out of scope

- Open tracking (rejected 2026-09-21, stays rejected).
- Raising the daily cap. The design makes it one number to change later.
- Sourcing new agencies. Runway makes the need visible; filling it is separate.
- OutsideInput. Same pattern, separate repo, untouched.
- Learning from Sjoerd's edits (`body_origineel` is stored so it can come later).
