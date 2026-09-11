# Outreach phase 3: mail sync, reply triage, partner hand-off

Date: 2026-09-11. Status: approved by Sjoerd in chat (answers A-D below), building.

## Goal

The Outreach tab in /ops should stop depending on hand-set statuses. What
Sjoerd sends and receives in Gmail drives the pipeline: sent mails advance the
status, replies are read and classified, a reply draft lands in Gmail, and a
bureau that wants a test code gets a partner record plus one code without
anyone opening the Partners tab. Sjoerd only adds the logo and presses Send.

## Decisions (Sjoerd, 2026-09-11)

- A. Automation runs in n8n (Gmail I/O), logic in a version-controlled edge
  function.
- B. A clear rejection sets `afgewezen` automatically. The draft for it says
  "jammer, mocht je je bedenken sturen we graag een testcode".
- C. Reply rules: je-vorm, short, one question per mail, sign "Groet, Sjoerd".
  On interest: test code FIRST, Calendly link second, both in the same mail.
  Rejection after a code was issued: ask briefly why, with multiple choice.
- D. On a code request (or plain interest) the workflow creates the partner and
  mints one code itself. The partner slug is the prospect slug.

## Architecture

```
n8n WF11 "Outreach Mail Sync" (every 15 min, inactive until Sjoerd flips it)
  Schedule → Gmail: get many (newer_than:3d, not drafts/spam/trash)
           → HTTP POST outreach-mail-sync {messages}        (x-shared-secret)
           → Split Out drafts → Gmail: create draft (in thread)
           → HTTP POST outreach-mail-sync {action:'draft_created', ...}

Supabase edge function `outreach-mail-sync` (verify_jwt=false, N8N_SHARED_SECRET)
  normalise Gmail payload → match to prospect → dedupe on gmail id
  → outbound: kind + status advance      → inbound: Claude classifies,
                                             code request → RPC mints,
                                             draft body composed
  → writes outreach_mails, calls outreach_advance_status
  → returns the drafts n8n must create
```

Why the logic lives in the edge function and not in an n8n Code node: it is
testable (Deno tests next to the prompt), reviewable in git, and n8n keeps
doing only what it is good at here (the Gmail credential). The workflow is
five nodes.

## Data

### `outreach_prospects` (additive)

- status check constraint gains `gereageerd`, `partner_aangemaakt`,
  `codes_gemint`.
- `partner_slug text references partners(slug)`, nullable.

### `outreach_mails` (new, RLS on, no policies)

| column | notes |
|---|---|
| gmail_message_id | unique, the dedupe key |
| gmail_thread_id | groups a conversation |
| slug | matched prospect, nullable |
| direction | `out` / `in` |
| kind | out: `eerste`, `opvolging`, `antwoord`; in: `reactie` |
| from_email, to_email, subject, snippet (≤ 400 chars), sent_at | |
| sentiment | in only: `positief`, `code`, `vraag`, `later`, `afwijzing`, `auto`, `overig` |
| samenvatting | one line, in only |
| draft_id | Gmail draft id once n8n created it |
| status_voor, status_na | what the mail did to the prospect status |

### `outreach_advance_status(p_slug, p_status, p_at)` (SQL, security definer)

The single "never go backwards" rule, used by n8n's edge function and by
ops-partners alike.

Ladder: nog_niet_benaderd < verzonden < opvolging_1 < opvolging_2 <
gereageerd < gesprek_gepland < gesprek_gevoerd < pilot_afgesproken <
partner_aangemaakt < codes_gemint < pilot_gestart < founding_partner.

- A target lower than or equal to the current rung is a no-op.
- `afgewezen` is accepted from any rung except `pilot_gestart`,
  `founding_partner` and `geen_fit`.
- `gereageerd` is accepted from `afgewezen` (a bureau that changed its mind
  re-opens).
- `geen_fit` is never set automatically.
- Target `verzonden` stamps `verzonden_op = p_at` when it is still null, so
  the scanner filter has a real send time.

Returns the resulting status.

### `outreach_code_request(p_slug, p_lang)` (SQL, security definer)

Creates the partner from the prospect (slug = prospect slug, name = naam) if
it does not exist, links `partner_slug`, mints one code expiring in six weeks
via `mint_partner_codes`, advances status to `codes_gemint`, returns
`{code, link}`. The link is the /p/:slug landing page, same as ops-partners
mints.

## Matching a Gmail message to a prospect

Our addresses: sjoerd@cairnly.io, sjoerd@bethehitl.com. From one of those =
outbound, otherwise inbound.

Match order, first hit wins:
1. `utm_content=<slug>` anywhere in the body (Gmail wraps links in
   google.com/url with double encoding; decode up to three times).
2. Counterpart address equals `to_email`.
3. Counterpart domain equals `domain` or `alt_domain`.
4. Thread id already known in `outreach_mails` (a reply without the link).

Unmatched messages are ignored, not stored.

## Outbound kind and status

Per prospect, in send order:
- if the thread already has an inbound message before this one: `antwoord`,
  no status change;
- else the n-th outbound overall: 1 → `eerste` (status verzonden), 2 →
  `opvolging` (opvolging_1), 3+ → `opvolging` (opvolging_2).

## Inbound: classification and draft

Claude sonnet-5 (thinking disabled, no temperature) receives the prospect
name, contact, our last mail (snippet), the reply text, and whether a code was
already issued. It returns JSON: `sentiment`, `samenvatting`, `concept`.

Reply rules (the prompt, `_shared/outreachReply.ts`):
- Dutch, je-vorm, max 120 words, one question per mail, no attachments, no
  em-dashes, sign "Groet,\nSjoerd".
- `positief` / `code`: thank, give the test code link (`[CODELINK]`, filled by
  the code request), then the Calendly link for 20 minutes once they have
  looked.
- `vraag`: answer from cairnly.io/partners facts (pilot: five bureaus, five
  candidates each, six weeks, free, their logo on the report, the advisor's
  conversation stays theirs), close with the 20-minute question.
- `later`: confirm, ask when it does suit.
- `afwijzing`, no code issued: "jammer, mocht je je bedenken sturen we graag
  een testcode", door open.
- `afwijzing`, code issued: short thanks, ask why with four options
  (a. te weinig tijd, b. past niet bij onze aanpak, c. prijs, d. anders).
- `auto` (out-of-office, auto-reply): no draft, no status change.
- `overig`: draft a neutral acknowledgement, status `gereageerd`.

Status per sentiment: positief/code → codes_gemint (via the code request),
vraag/later/overig → gereageerd, afwijzing → afgewezen, auto → none.

The draft is created in the thread by n8n, never sent. `draft_id` is written
back so the tab can show "concept klaar".

## /ops changes

Outreach tab, per row:
- Contact: last mail (direction, date), sentiment badge, "concept klaar" when
  a draft exists. Rows whose last mail is inbound sort first (they need Sjoerd).
- Partner: linked partner + codes issued, or a "Partner aanmaken" button.
- A collapsible mail history (kind, date, snippet, sentiment).

"Partner aanmaken" switches to the Partners tab with the add form prefilled
(name, slug = prospect slug) and a `prospectSlug` on the save call.
ops-partners `save` then links the prospect and advances to
`partner_aangemaakt`; `mint` advances a linked prospect to `codes_gemint`.

## Backfill

After the function is deployed, one run over `newer_than:30d` through the same
workflow (manual execution) processes the 18 sent mails and the two replies
that already exist. Statuses set by hand stay (the ladder never lowers).

## Not built

- Sending mail. Everything stops at a draft.
- Follow-up reminders / "opvolging verlopen" (phase 1 worklist).
- Any change to access_codes, survey flow, or the WF1-WF10 pipeline.
