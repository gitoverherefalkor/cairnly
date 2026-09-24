# Outreach control center: concepts in /ops, scheduled sending, action pings

Date: 2026-09-24. Status: design approved by Sjoerd in chat (automation policy revised same day), spec awaiting review.

## Goal

/ops becomes the place where outreach mail is decided, and Gmail becomes the
postman. Today a suggestion lands as a Gmail draft, Sjoerd opens Gmail, edits,
and sends (or WF12 sends the draft on the pacing schedule). After this change:

1. The system writes a **concept** and stores it in the database, not in Gmail.
2. Boilerplate (first mails, chases, clear-rejection replies) is approved
   automatically and goes out inside the randomised schedule, with a veto
   window. Replies to a real conversation wait for Sjoerd.
3. /ops shows every concept **open and editable in place**, no extra click;
   Sjoerd presses **Schedule** (next free slot, randomised pacing) or **Send**
   (now).
4. WF12 composes and sends the message through Gmail, in the right thread, with
   the right sender, signature and quote.

The real problem this solves is **timeliness**: follow-ups and new outreach go
out late because the work only appears when Sjoerd goes looking for it. So the
second half of the change is a cockpit that says what is waiting and whether
tomorrow's slots are filled, plus Chrome push notifications when there is
something to do.

## Decisions (Sjoerd, 2026-09-24)

- A. **Automate everything that is boilerplate; Sjoerd only sees real
  conversations.** (Revised later on 2026-09-24; the first version had
  everything approved by hand.) "I'm a one-man operation and need smart
  automation." See "Who approves what" below. First mails, chases (clicked /
  quiet / goodbye) and the rejection reply go out automatically inside the
  schedule. Replies to an interested or maybe party, and check-ins on a parked
  conversation, wait for Sjoerd.
- B. **The first mail to a new agency is in scope.** It gets a generator like
  the chases (skeleton + limited personalisation) and is auto-approved.
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

## Who approves what

| Situation | Concept | Approval | Lane |
|---|---|---|---|
| New agency on the target list | First mail | **auto** | cold, cap, randomised gap |
| No reaction after first mail / chase 1 | Chase (clicked / quiet / goodbye variant) | **auto** | cold |
| Clear rejection, no code issued yet | Boilerplate: "jammer, laat het weten als je van gedachten verandert, dan stuur ik je een testcode" | **auto** | reply lane, 60-180 min delay |
| Clear rejection after a code was issued | Boilerplate: brief "why?" with multiple choice (decision C of 2026-09-11) | **auto** | reply lane, 60-180 min delay |
| "Stop mailing me" / unsubscribe | **Nothing is sent.** Prospect gets `niet_mailen`, every live concept is cancelled | n/a | n/a |
| Bounce (mailer-daemon, address unknown) | Nothing is sent. Prospect gets `email_ongeldig`, concepts cancelled, shown under "Needs you" | Sjoerd fixes the address | n/a |
| Out-of-office | Nothing; chases keep their cadence | n/a | n/a |
| Interested, wants a code, question, "later"/maybe, other | Reply concept | **Sjoerd** | reply lane |
| Check-in on a parked conversation | Check-in concept | **Sjoerd** (it follows a real conversation) | cold |

Guard rails that make "auto" safe:

1. **Validator before auto-approve.** A generated first mail or chase is only
   auto-approved if it passes: salutation matches the contact's first name or
   the generic form (the seed traps), the tracked demo link is present and
   intact, word limit, no em-dash, no "niet X, maar Y", ends on the signature
   line. Fail → falls back to the plain skeleton, which is always valid. A
   mail is never auto-approved with unvalidated LLM text.
2. **Rejection auto-reply only when unambiguous:** sentiment `afwijzing`, no
   question mark in their text (after stripping the quote), and no earlier
   conversation beyond the rejection (`status` below `gesprek_gepland`).
   Anything else becomes a reply concept for Sjoerd. "Not now, maybe later" is
   `later` and always goes to Sjoerd.
3. **Veto window.** Auto-approved mail is visible under "Going out" in the
   cockpit for at least 60 minutes before it can leave (`niet_voor >=
   goedgekeurd_op + 60 min`); Unschedule and Edit work until it is claimed. The
   morning ping says "6 mails go out automatically today" as information.
4. **One switch back to manual.** `outreach_send_state.auto_goedkeuren`
   (default **off** at launch). Off = every concept waits for Sjoerd, which is
   the first-version behaviour. The kill switch `gepauzeerd` still stops
   everything, auto or not.
5. **Opt-out and bounces stop everything for that agency**, permanently for
   `niet_mailen`. This is also the GDPR line: a "stop" request never gets a
   "let me know if you change your mind" mail.

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
| `_shared/outreachRejection.ts` | The two rejection boilerplates (before / after a code) | new |
| `_shared/outreachValidate.ts` | The auto-approve validator (guard rail 1) | new |
| `outreach-send` fn | Claims, revalidates, returns `raw` + `threadId` | changed |
| `ops-outreach` fn | Concept edit/schedule/send/discard/park, push subscribe | changed |
| `ops-push` fn | Sends Web Push; digest, nudge and event pings | new |
| WF12 | Posts `raw` to `messages/send` instead of a draft id to `drafts/send`; reports `threadId` back | **existing workflow, per-workflow yes required** |
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
goedgekeurd_door text check in ('auto','sjoerd')  -- null while voorstel
goedgekeurd_op  timestamptz              -- veto window runs from here
validatie       jsonb                    -- validator result; auto-approve requires ok
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

### `outreach_prospects` (changed)

- add `niet_mailen_op timestamptz` (explicit opt-out; permanent, nothing is
  ever generated or sent for this slug again) and `email_ongeldig_op
  timestamptz` (bounce; cleared when Sjoerd corrects the address).

### `outreach_send_state` (changed)

- add `auto_goedkeuren boolean not null default false`. Launches off.

### `outreach_mails` (changed)

- sentiment gains `stop` (asks not to be mailed) and `bounce` (delivery
  failure notice). Classifier prompt in `outreach-mail-sync` is extended; a
  bounce is recognised deterministically first (mailer-daemon / postmaster
  sender, `Content-Type: multipart/report`) before any LLM call.

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
`in_reply_to` = their Message-ID). `drafts` is always `[]`. Routing by the
"Who approves what" table:

- `auto` → no concept. `stop` → `niet_mailen_op`, status `afgewezen`, live
  concepts cancelled, no concept. `bounce` → `email_ongeldig_op`, live concepts
  cancelled, no concept (shown under "Needs you").
- `afwijzing` that passes guard rail 2 → boilerplate concept from
  `_shared/outreachRejection.ts` (two templates: before / after a code was
  issued; the existing classifier already knows which), auto-approved when
  `auto_goedkeuren` is on.
- Everything else → Claude-written reply concept for Sjoerd (as today).

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
| **Schedule** | Queue; existing window + persisted random gap + cap 8/day; priority chase/checkin before initial | Queue; weekdays 08:00-18:00, random delay (5-20 min when Sjoerd approved it, 60-180 min for an auto rejection reply, so it never answers in minutes); **no cap, does not move the cold gap** |
| **Send** | `direct`: ignores window and gap, **counts toward the cap**, re-rolls the gap after | `direct`: immediately |
| Kill switch | Respected by both. Send while paused says so and waits. |
| Auto-approved | Same lanes as Schedule, plus `niet_voor >= goedgekeurd_op + 60 min` (veto window) | same |

Auto-approval happens where the concept is written (`outreach-prepare` for
first mails and chases, `outreach-mail-sync` for rejection replies), only when
`auto_goedkeuren` is on and `validatie.ok`. It inserts the queue row in the
same transaction as the concept.

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

Two nodes: the send request posts `{raw, threadId}` to
`https://gmail.googleapis.com/gmail/v1/users/me/messages/send` instead of
`{id}` to `drafts/send`, and "Report sent" also passes `threadId` back.
Export WF12 to `n8n_wfs_cairnly/backups/` first. No other node changes.

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
NEEDS YOU (3)
 Reply · Ingrid, Bureau X · interested · 2h ago [their mail | concept, side by side]
 Check-in · Bureau Y · parked 10 days ago      [concept open, editable]
 Bounce · Bureau Z · address unknown           [fix address]
GOING OUT (6)  auto · ~10:42 First mail Bureau Q · ~11:20 Chase 1 Bureau R · …
               [each expands to the full text; Edit / Unschedule until claimed]
HANDLED FOR YOU TODAY  2 rejections answered · 1 opt-out stopped · 1 out-of-office
```

- "Needs you" holds only: interested/maybe replies, check-ins, stale concepts
  Sjoerd had edited, bounces, failed sends, and (while `auto_goedkeuren` is
  off) every concept. Order: replies first, then failures, then the rest.
- "Going out" shows every scheduled mail with its estimated time and an
  `auto` or `approved` tag; opening one shows the full text with highlights.
- "Handled for you" is a one-line log of what the automation decided today, so
  nothing happens silently.
- The cockpit carries the `auto_goedkeuren` toggle next to the pause switch.
- Every concept is an open, autosaving textarea (debounced). Buttons: Schedule,
  Send, Discard. Reply cards add **Park** (existing check-in logic) and **No
  reply needed** (status `geen_antwoord`).
- With `auto_goedkeuren` off, **Schedule all** covers chases and first mails.
  Replies and check-ins are always approved one by one.
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
- VAPID: both keys are Supabase secrets (`VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:sjoerd@cairnly.io`), generated
  without passing through the transcript. The browser fetches the public key
  from `ops-outreach`, so no Vercel env var is needed. Never in git.
- Clicking a notification opens /ops on the relevant concept.
- iPhone only works if /ops is added to the home screen; Chrome on the Mac
  works directly. Out of scope to make /ops a full PWA.

| Ping | When | Content |
|---|---|---|
| Reply | Inbound mail that lands in "Needs you" (interested / maybe / question), 08:00-20:00 Amsterdam; outside that it folds into the morning ping. Auto-handled rejections, opt-outs and out-of-office never ping | "Ingrid (Bureau X) replied: <samenvatting>" |
| Morning | 08:30 working days, **only if there is something** | "1 reply needs you · 6 mails go out automatically today · runway 4 days" |
| Bounce | A bounce is stored | "Mail to Bureau Z bounced, address needs fixing" |
| Afternoon nudge | 15:00 working days, only if tomorrow has empty cold slots and something can fill them (concepts awaiting Sjoerd, or no first-mail supply left) | "Tomorrow 3 of 6 slots empty: 2 concepts need you" / "…: no agencies left to contact" |
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
- Deno unit tests for routing: bounce detection, `stop` vs `afwijzing`, the
  rejection guard rail (question mark, prior conversation), the validator
  (every rule, and that failure falls back to the skeleton).
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
5. Turn on `outreach-prepare` cron and push crons, with `auto_goedkeuren` off.
6. Trust run: Sjoerd approves by hand until he has seen the first ~10 first
   mails and a handful of chases come out right (a day or two at current
   volume). Then he flips `auto_goedkeuren` on. The rejection auto-reply goes
   on together with it.
7. Later, separately: remove WF11's now-idle draft branch and the
   `followup_requested_at` / `draft_created` code paths.

## Out of scope

- Open tracking (rejected 2026-09-21, stays rejected).
- Raising the daily cap. The design makes it one number to change later.
- Sourcing new agencies. Runway makes the need visible; filling it is separate.
  With sending automated, this becomes the next bottleneck: the 31 remaining
  agencies are in the pipeline within about a week. An "add agencies" import
  in /ops (so new additions flow straight into first mails) is the natural
  next project.
- OutsideInput. Same pattern, separate repo, untouched.
- Learning from Sjoerd's edits (`body_origineel` is stored so it can come later).
