# Outreach Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move outreach mail from Gmail drafts to concepts in /ops, send them from the database queue as composed MIME messages, auto-approve boilerplate, and ping Sjoerd through Web Push when a real conversation needs him.

**Spec:** `docs/superpowers/specs/2026-09-24-outreach-control-center-design.md` (read it first; decisions A-H and "Who approves what" are binding).

**Architecture:** Pure, Deno-tested modules in `supabase/functions/_shared/` do all the thinking (schedule arithmetic, first-mail and rejection templates, validator, routing, MIME). One migration adds `outreach_concepts`, lanes in the send rules and the push tables. Edge functions (`outreach-mail-sync`, new `outreach-prepare`, `outreach-send`, `ops-outreach`, new `ops-push`) wire the modules to the database. WF12 changes two nodes. The /ops cockpit is new components beside the 1,220-line `OutreachTab.tsx`.

**Tech stack:** Deno edge functions (std@0.224.0 assert for tests), Postgres + pg_cron + pg_net + vault, React/TypeScript/Tailwind, Vitest for `src/lib`, n8n (WF12 only), Web Push (VAPID).

**House rules that apply to every task**

- Work in the worktree/branch `outreach-control-center`, never in the main checkout (it carries someone else's untracked files).
- Mail text is Dutch and leaves the building: no em-dashes, no "niet X, maar Y". /ops UI text is English.
- Deno tests: `deno test --allow-env <file>`; every new Deno-style test file under `supabase/functions` must be added to the `exclude` list in `vite.config.ts` (Vitest cannot import `https://` specifiers).
- Vitest: `npx vitest run <file>`. Build check: `npm run build` (the typecheck in the build is a no-op, see memory).
- Migrations: write the file in `supabase/migrations/`, apply it with the Supabase MCP `apply_migration` (never `supabase db push`, history mismatch), verify via `information_schema`.
- SQL rules are tested with an injected clock inside a `DO` block that ends in `raise exception 'rollback'` (auto-rollback; pg_net never sends uncommitted requests).
- Every `RETURNS TABLE (id …)` function aliases every table (the `id` shadowing trap).
- Commit after every task. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Existing edge functions redeploy only on merge to main (all ~48 redeploy). Nothing in this plan deploys from the branch except where a step says so.

---

## File map

**New, pure (Deno, tested)**
- `supabase/functions/_shared/outreachSchedule.ts`: send window per Amsterdam day, day capacity, working-day stepping, send-time estimates.
- `supabase/functions/_shared/outreachInitial.ts`: first-mail skeleton, category words, Claude pass, fallback.
- `supabase/functions/_shared/outreachRejection.ts`: the two rejection boilerplates.
- `supabase/functions/_shared/outreachValidate.ts`: guard rail 1.
- `supabase/functions/_shared/outreachRouting.ts`: bounce detection, question detection, inbound routing.
- `supabase/functions/_shared/outreachSignature.ts`: Cairnly signature (HTML + text), verbatim from Sent.
- `supabase/functions/_shared/outreachMime.ts`: RFC 2822 builder, quote block, Message-ID.

**New, I/O**
- `supabase/functions/_shared/outreachConcepts.ts`: DB helpers shared by four functions (insert, approve, invalidate, supersede).
- `supabase/functions/_shared/outreachPrepare.ts`: the prepare run (imported by `outreach-prepare` and `ops-outreach`).
- `supabase/functions/outreach-prepare/index.ts`
- `supabase/functions/ops-push/index.ts` + `supabase/functions/_shared/opsPush.ts`
- `supabase/migrations/20260924120000_outreach_concepts.sql`
- `supabase/migrations/20260924120100_ops_push.sql`
- `supabase/migrations/20260924120200_outreach_control_center_cron.sql` (applied last)
- `public/ops-sw.js`

**New, frontend**
- `src/lib/outreachHighlight.ts` (+ test)
- `src/lib/outreachCockpit.ts` (+ test): mirrors outreachSchedule for the browser, plus slots/runway.
- `src/components/ops/outreach/Cockpit.tsx`, `ConceptCard.tsx`, `ReplyConceptCard.tsx`, `HighlightedText.tsx`, `pushClient.ts`

**Modified**
- `supabase/functions/_shared/outreachMail.ts` (+ test): Message-ID / In-Reply-To / References from the Gmail item.
- `supabase/functions/_shared/outreachReply.ts`: `stop` sentiment.
- `supabase/functions/outreach-mail-sync/index.ts`
- `supabase/functions/outreach-send/index.ts`
- `supabase/functions/ops-outreach/index.ts`
- `supabase/config.toml`: `[functions.outreach-prepare]`, `[functions.ops-push]`
- `src/lib/outreach.ts`: sentiment labels, types for concepts.
- `src/components/ops/OutreachTab.tsx`: mount cockpit, drop Draft-it buttons.
- `vite.config.ts`: exclude the new Deno tests.
- `n8n_wfs_cairnly/WF12 - Outreach Send.json` (+ backup) after the WF12 edit.

---

## Phase 0: Workspace

### Task 0: Worktree

- [ ] Create a worktree off `origin/main` on branch `outreach-control-center` (EnterWorktree, or `git worktree add ../Cairnly-occ -b outreach-control-center origin/main`).
- [ ] `npm ci` is NOT needed if `node_modules` is symlinked/available; otherwise run `npm install --no-audit --no-fund` in the worktree.
- [ ] Run the existing outreach Deno tests to get a green baseline:
  `deno test --allow-env supabase/functions/_shared/outreach*.test.ts` → all pass.

---

## Phase 1: Pure building blocks (Deno, TDD)

### Task 1: Schedule arithmetic (`outreachSchedule.ts`)

The SQL `outreach_send_in_window` is the source of truth; this module mirrors it so prepare and the cockpit can reason about capacity.

**Interface**
```ts
export const COLD_CAP_PER_DAY = 8;
export const GAP_MIN = 24, GAP_MAX = 53;          // minutes, mirrors outreach_send_done
export const MEAN_GAP = (GAP_MIN + GAP_MAX) / 2;   // 38.5
/** Amsterdam calendar day as 'YYYY-MM-DD'. */
export function amsterdamDay(at: Date): string;
/** Cold send window for that day in minutes after Amsterdam midnight, or null on a weekend. Mon 13:00-16:30, Fri 09:00-12:00, else 09:00-16:30. */
export function coldWindow(day: string): { start: number; end: number } | null;
/** min(cap, floor(windowMinutes / MEAN_GAP) + 1); 0 on weekends. */
export function dayCapacity(day: string, cap?: number): number;
/** The next n working days starting at `from` (inclusive when it is a working day). */
export function nextWorkingDays(from: Date, n: number): string[];
/** Reply lane: weekdays 08:00-18:00 Amsterdam. */
export function inReplyWindow(at: Date): boolean;
```

- [ ] **Test first** (`outreachSchedule.test.ts`), concrete cases:
  - `coldWindow('2026-09-28')` (Mon) → `{start: 780, end: 990}`; `dayCapacity` → `min(8, floor(210/38.5)+1)` = 6.
  - `2026-10-02` (Fri) → `{540, 720}`, capacity `floor(180/38.5)+1` = 5.
  - `2026-09-29` (Tue) → `{540, 990}`, capacity 8 (`floor(450/38.5)+1` = 12, capped).
  - `2026-09-26` (Sat) → null, capacity 0.
  - `nextWorkingDays(new Date('2026-09-25T20:00:00Z'), 2)` (Fri evening) → `['2026-09-25','2026-09-28']`… define precisely: a day counts if it is a working day and `from` is before that day's window end; Fri 22:00 Amsterdam is after 12:00, so result is `['2026-09-28','2026-09-29']`.
  - `inReplyWindow` true at Tue 07:30Z (09:30 CEST), false at Tue 16:30Z (18:30 CEST), false on Sunday.
  - DST: `amsterdamDay(new Date('2026-10-24T22:30:00Z'))` → `'2026-10-25'`.
- [ ] Run → fails (module missing). Implement with `Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam'})`, no libraries. Run → passes.
- [ ] Add the test to `vite.config.ts` exclude. Commit `outreach: schedule arithmetic for capacity and windows`.

### Task 2: First-mail generator (`outreachInitial.ts`)

Skeleton is Sjoerd's real first mail (Gmail Sent, 2026-09-18/21, messages `1a0c28cc213f5df3`, `1a0b38876558d344`, `1a0c28cc2c7dc746`). Personalised parts in those mails: the opening line (from `openingshaak`), the category phrase and role word in the "voorwerk" paragraph, one bespoke sentence in that paragraph, and the role plural in the pilot paragraph. The subject comes from `subject_variant` (`SUBJECT_VARIANTS` in `src/lib/outreach.ts`; copy the two strings, the A/B test is defined on exactly these).

**Interface**
```ts
export interface InitialInput {
  slug: string; bureau: string; contactpersoon: string | null;
  categorie: 'D' | 'O' | 'DO' | string | null; openingshaak: string | null;
  campaign: string | null; subjectVariant: 'a' | 'b' | null;
}
export const INITIAL_SUBJECTS = { a: 'Vraagje over jullie spoor 2-trajecten', b: 'Doen jullie het loopbaanonderzoek in spoor 2 zelf?' } as const;
export function initialSubject(v: 'a' | 'b' | null): string;          // null → a
export function categoryWords(c: string | null): { traject: string; rol: string; rollen: string };
//   D  → { traject: 'Voor een spoor 2-traject', rol: 'arbeidsdeskundige', rollen: 'adviseurs' }
//   O  → { traject: 'Voor een outplacementtraject', rol: 'coach', rollen: 'coaches' }
//   DO / other → { traject: 'Voor een outplacement- of spoor 2-traject', rol: 'adviseur', rollen: 'adviseurs' }
export function renderInitial(input: InitialInput, personal?: { opening?: string | null; bespoke?: string | null }): string;
export const INITIAL_SYSTEM_PROMPT: string;
export const INITIAL_TOOL: { name: 'write_first_mail'; input_schema: { opening: string; bespoke: string } };
export function buildInitialMessage(input: InitialInput): string;
export function parseInitial(resp): { opening: string; bespoke: string } | null;
```
Rendered body (plain text; links as `[label](url)` so `textToHtml` makes anchors):
```
{salutation(input)}                                  ← reuse from outreachFollowUp.ts

{opening}                                            ← omitted entirely when null

Ik ben Sjoerd Geurts, oprichter van Cairnly in Utrecht. De afgelopen twee jaar heb ik een online tool gebouwd die mensen helpt een loopbaanswitch te maken: 25 tot 40 minuten invullen, en er komt geen testuitslag uit maar een top 3 concrete beroepen met matchscore, alternatieven, salarisranges en per beroep een inschatting van wat AI ermee gaat doen.

In plaats van dat verder uit te leggen: hier is een demo, geen login nodig.

[Bekijk Marcels sessie (2 minuten)]({demoLink(slug, campaign)})

Marcel, 41, teamleider klantenservice bij een verzekeraar, wil dichter bij de inhoud werken. Je ziet het gesprek met de AI-coach, de harde eis (woensdag thuis) die in de matches wordt meegewogen, en het rapport dat eruit komt. Fictieve kandidaat, echte output.

Wil je hem echt aan de tand voelen met je eigen antwoorden of met een casus van een klant: reageer met "code" en ik stuur er een, gratis, geen voorwaarden. Daar leer ik zelf ook het meest van.

{traject} is Cairnly voorwerk: de kandidaat komt bij jullie {rol} binnen met richting in plaats van met een leeg vel. {bespoke ?? 'Het vervangt dat gesprek niet, het zit ervoor.'} Het rapport draagt jullie logo, het echte gesprek blijft van jullie. Werkwijze en prijzen staan open en bloot op [cairnly.io/partners](https://cairnly.io/partners).

We zoeken vijf bureaus voor een gratis pilot: vijf kandidaten per bureau, binnen zes weken. Geen voorwaarden, ik wil vooral horen wat jullie {rollen} ervan vinden. Is dat 20 minuten waard?

Groet,
Sjoerd
```
Claude writes only `opening` (one sentence starting "Ik zag dat jullie", max 30 words, built only from `openingshaak`; if the haak holds nothing specific — "website niet bereikbaar", "website gaf 503" — return an empty string) and `bespoke` (one sentence, max 20 words, how voorwerk helps this kind of bureau; no numbers not in the haak). Parse rejects: opening not starting with "Ik zag dat jullie" (unless empty), any em-dash, bespoke > 20 words.

- [ ] **Tests** (`outreachInitial.test.ts`):
  - `renderInitial` without personal: no "Ik zag" line, contains the default bespoke sentence, demo link with `utm_content=<slug>`, ends `Groet,\nSjoerd`, no `—`.
  - `categoryWords('D').rol === 'arbeidsdeskundige'`, `'O'` → coach/coaches, `null` → adviseur.
  - `salutation` traps carry over: contactpersoon `'A. Bosman'` → `Beste team van Rea College Pluryn,`; `'Robert (achternaam onbekend)'` → `Beste Robert,`; `'Nanya Radema (directie)'` → `Beste Nanya,`.
  - `initialSubject(null)` → variant a string; `'b'` → b string.
  - `parseInitial` returns null for an opening with `—`, accepts `{opening:'', bespoke:'…'}`.
- [ ] Implement, run, pass. Add to vite exclude. Commit `outreach: first-mail skeleton from the real sent mail`.

### Task 3: Rejection boilerplates (`outreachRejection.ts`)

```ts
export interface RejectionInput { bureau: string; replierName: string | null; codeIssued: boolean }
export function templateRejection(i: RejectionInput): string;
```
- no code: `Hoi {first}` / `Beste team van {agency},` + "Dank voor je reactie, helder. Jammer, maar goed om te weten." + blank + "Mocht je je later bedenken: laat het weten, dan stuur ik je een gratis testcode, zonder voorwaarden." + blank + `Groet,\nSjoerd`.
- code issued: thanks line + "Mag ik vragen waarom het niet paste? Eén letter terugmailen is genoeg: (a) te weinig tijd, (b) past niet bij onze aanpak, (c) prijs, (d) anders." + signature.
- `replierName` from the From display name (Task 7 gives it); `firstName()` from outreachFollowUp applies.
- [ ] Tests: both variants, salutation fallback, no `—`, exactly one `?` in the code-issued variant, zero in the other. Implement. Exclude. Commit.

### Task 4: Validator (`outreachValidate.ts`)

```ts
export interface ValidationResult { ok: boolean; problems: string[] }
export function validateOutgoing(body: string, opts: {
  soort: 'initial' | 'chase' | 'checkin' | 'reply';
  expectedSalutation: string;          // salutation() result for this prospect
  demoLink?: string | null;            // required for initial + quiet chase
  maxWords: number;                    // initial 330, chase 170 (quote excluded like the prompt says: strip the COACH_QUOTE line first), checkin 80
}): ValidationResult;
```
Rules: first line equals `expectedSalutation` OR starts with `Hoi `/`Beste ` followed by the same first name; contains `demoLink` verbatim when given; word count ≤ `maxWords`; no `—` or `–`; no `/\bniet\b[^.?!]{1,60},\s*maar\b/i`; ends with `/Groet,\nSjoerd\s*$/`; no leftover `[CODELINK]`; no `{` or `}` template residue.
- [ ] Tests: the rendered skeletons from Tasks 2 and 3 and `renderFollowUp()` all pass; each rule has one failing case (em-dash, wrong name "Beste K.,", missing link, too long, missing signature, "niet X, maar Y"). Implement. Exclude. Commit.

### Task 5: Signature + MIME (`outreachSignature.ts`, `outreachMime.ts`)

Signature HTML: copy verbatim from message `1a0c28cc213f5df3` (`gmail_signature` block, strip google.com/url wrappers; keep `https://www.cairnly.io/logos/cairnly-wordmark-email.png`). Text version:
```
--
Sjoerd Geurts
cairnly - career path clarity.
Book a call with me: https://calendly.com/sjoerd-bethehitl/new-meeting
Or reach out via sjoerd@cairnly.io | https://www.linkedin.com/in/sjoerdgeurts/
```
MIME interface:
```ts
export const FROM_HEADER = 'Sjoerd Geurts <sjoerd@cairnly.io>';
export function newMessageId(now?: Date): string;   // `<occ.${base36 time}.${random}@cairnly.io>`
export interface MimeInput {
  to: string; subject: string; body: string;          // plain text with [label](url)
  messageId: string; inReplyTo?: string | null; references?: string | null;
  signature: boolean;                                  // initial only
  quote?: { at: string; name: string | null; email: string; text: string } | null;  // replies only
  date?: Date;
}
export function buildMime(i: MimeInput): string;       // base64url of the whole message
export function quoteHeader(at: string, name: string | null, email: string): string; // 'Op do 24 sep 2026 om 10:52 schreef Ingrid <x@y.nl>:'
```
HTML part = `textToHtml(body)` + (`signature` ? `<br>` + SIGNATURE_HTML) + (`quote` ? `<br><div class="gmail_quote"><div class="gmail_attr">{quoteHeader}</div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">{escaped quote text with <br>}</blockquote></div>`). Text part = `toPlainText(body)` + signature text + `> `-prefixed quote. Headers: From, To, Subject (RFC 2047 `=?UTF-8?B?…?=` when non-ASCII), Date, Message-ID, In-Reply-To/References when given, MIME-Version, multipart/alternative, both parts base64 wrapped at 76. Port `utf8ToBase64` logic from OutsideInput `_outreach/lib/outreachQueue.ts` (TextEncoder + btoa over bytes), do not import it.

- [ ] Tests (decode the base64url in the test and assert on the text):
  - headers present and in order; `Subject: =?UTF-8?B?` for "Vraagje over jullie spoor 2-trajecten é"; plain ASCII subject stays plain.
  - `In-Reply-To` and `References` only when given.
  - signature only when `signature: true`; quote only when given; quote text HTML-escaped (`<b>` → `&lt;b&gt;`).
  - base64url has no `+`, `/`, `=`.
  - `quoteHeader('2026-09-24T08:52:00Z','Ingrid','i@x.nl')` → `Op do 24 sep 2026 om 10:52 schreef Ingrid <i@x.nl>:`.
- [ ] Implement, pass, exclude, commit.

### Task 6: Routing (`outreachRouting.ts`)

```ts
export type Route = 'ignore' | 'stop' | 'bounce' | 'auto_rejection' | 'review';
export function isBounce(m: { from: string; subject: string; contentType?: string | null }): boolean;
//   from mailer-daemon@/postmaster@ OR subject /undeliverable|delivery status notification|mail delivery (failed|subsystem)|onbestelbaar|niet afgeleverd/i OR contentType includes 'multipart/report'
export function hasQuestion(replyOnly: string): boolean;   // a '?' outside URLs
export function routeInbound(x: {
  bounce: boolean; sentiment: Sentiment | null;             // null = classifier failed
  replyOnly: string; statusBefore: string;
}): Route;
```
Rules in order: bounce → `bounce`; sentiment null → `review`; `auto` → `ignore`; `stop` → `stop`; `afwijzing` and `!hasQuestion` and statusRank(statusBefore) < rank('gesprek_gepland') → `auto_rejection`; everything else → `review`. Put a TS copy of the status ladder order (from `outreach_status_rank`) in this module.
- [ ] Tests: each branch; afwijzing with "Waarom vraag je dat?" → review; afwijzing at `gesprek_gevoerd` → review; a URL with `?utm=` does not count as a question; mailer-daemon → bounce even if sentiment says afwijzing. Implement, exclude, commit.

### Task 7: Header capture in the normaliser (`outreachMail.ts`)

Add to `NormalisedMail`: `messageId: string | null`, `inReplyTo: string | null`, `references: string | null`, `fromName: string | null`, `contentType: string | null`. n8n Gmail `simple=false` items are mailparser output: `messageId`, `inReplyTo`, `references` (string or array), `from.value[0].name`, `headers['content-type']` (object with `value`) or `headerLines`. REST shape: `payload.headers[{name,value}]`. Accept all three.
- [ ] Extend `outreachMail.test.ts`: mailparser shape (`messageId: '<abc@x>'`, `references: ['<a>','<b>']` → `'<a> <b>'`), REST shape via `payload.headers`, missing → nulls, `fromName` from `from.value[0].name`. Implement. Run the whole file green. Commit.

### Task 8: `stop` sentiment

- [ ] `outreachReply.ts`: add `'stop'` to `SENTIMENTS`; prompt line under PER SOORT: `- stop (vraagt uitdrukkelijk om niet meer gemaild te worden, "haal me van de lijst", "geen mails meer"): geen concept (null). Een gewone afwijzing ("geen interesse", "past niet") is afwijzing, niet stop.`; `parseClassification` returns `concept: null` for `stop` too; `statusForSentiment('stop')` → `'afgewezen'`.
- [ ] `src/lib/outreach.ts`: `MailSentiment` gains `'stop' | 'bounce'`, labels `Unsubscribe` / `Bounced`.
- [ ] Deno test for parse + status mapping (new small file `outreachReply.test.ts`, exclude it). Commit.

---

## Phase 2: Database

### Task 9: Migration `20260924120000_outreach_concepts.sql`

Write the file, then apply via MCP, then run the DO-block tests.

Contents (in this order):
1. `outreach_concepts` exactly as the spec's data model, plus `created_at/updated_at default now()`; checks on `soort` and `status`; partial unique index `(slug, soort, coalesce(step,0)) where status in ('voorstel','ingepland')`; index on `(status, created_at)`; RLS on, no policies.
2. `outreach_prospects`: `niet_mailen_op timestamptz`, `email_ongeldig_op timestamptz`.
3. `outreach_mails`: `body_text text`, `rfc_message_id text` + index; replace the sentiment check with one that adds `'stop','bounce'` (drop constraint by name from `pg_constraint` lookup, re-add).
4. `outreach_send_state`: `auto_goedkeuren boolean not null default false`, `alarm_gepauzeerd_op date`.
5. `outreach_send_queue`: `concept_id uuid references outreach_concepts(id)`, `direct boolean not null default false`, `draft_id` drop not null, `soort` check re-created with `'checkin'`; partial unique index on `concept_id where status in ('queued','sending')`.
6. `outreach_reply_in_window(p_at timestamptz) returns boolean` (weekday 08:00-18:00 Amsterdam).
7. Replace `outreach_send_blocked(p_max_per_dag int, p_now timestamptz, p_lane text default 'cold')`:
   - all lanes: `gepauzeerd` → 'gepauzeerd'; in-flight 'sending' < 10 min → 'bezig'.
   - `cold`: persisted gap → 'tussenruimte'; `outreach_send_in_window` → 'buiten venster'; cold sent today (`soort <> 'reply'`) ≥ cap → 'dagmaximum'.
   - `reply`: `outreach_reply_in_window` → 'buiten venster'.
   - `direct_cold`: cap only. `direct_reply`: nothing extra.
   Keep a 2-arg overload delegating to lane `'cold'` so nothing old breaks mid-rollout.
8. `outreach_queue_lane(q outreach_send_queue) returns text` (sql, immutable-ish): `case when q.direct then 'direct_'||(case when q.soort='reply' then 'reply' else 'cold' end) when q.soort='reply' then 'reply' else 'cold' end`.
9. Replace `outreach_send_due` and `outreach_send_claim`: candidate = first `queued` row with `niet_voor <= now` whose lane is unblocked, ordered `direct desc, prioriteit, created_at`. Claim returns `(id, slug, soort, draft_id, thread_id, to_email, concept_id)`; lock the state row first as today. Alias every table.
10. Replace `outreach_send_done(p_id uuid, p_gmail_message_id text)`: roll the gap only when the row's lane is cold or direct_cold.
11. `outreach_send_wake`: unchanged logic but throttle becomes 30 s when a `direct` row is due, else 3 min. Reschedule cron `outreach-send-wake` to `* 6-17 * * 1-5` (reply lane reaches 18:00 CEST = 16:00Z / 17:00Z in winter).
12. Grants: revoke from public/anon/authenticated, grant execute to service_role for every new/replaced function.

- [ ] Write file. Apply with MCP `apply_migration` (name `outreach_concepts`). Verify columns via `information_schema.columns` for the four tables.
- [ ] DO-block test (execute_sql), asserting with `raise exception` on mismatch and ending in `raise exception 'ok: rollback'`:
  - paused → claim returns nothing for every lane.
  - unpaused, Tue 10:00 Amsterdam, gap in future: a queued `reply` row with `niet_voor` past is claimed; a queued `chase` row is not.
  - 8 cold rows sent today: cold row blocked ('dagmaximum'), reply row still claimed.
  - Sat 11:00: cold blocked, reply blocked, `direct` cold claimed (cap permitting).
  - `done` on a reply row leaves `next_allowed_at` untouched; on a chase row it moves 24-53 min ahead.
  - Expected final error text: `ok: rollback`.
- [ ] Commit `outreach: concepts table and lanes in the send rules`.

### Task 9b: Backfill Message-IDs of the hand-sent threads

Chases thread onto our last outbound mail, which needs its RFC `Message-ID`.
- [ ] SELECT the latest outbound `gmail_message_id` per prospect in `verzonden` / `opvolging_1` (plus parked ones for check-ins).
- [ ] For each, fetch the message with the Gmail MCP `get_message` (`messageFormat: RAW`), read the `Message-ID:` header.
- [ ] Write `supabase/migrations/20260924120050_outreach_backfill_message_ids.sql` with one `update outreach_mails set rfc_message_id = '<…>' where gmail_message_id = '…' and rfc_message_id is null;` per row (version-controlled, re-runnable), apply via MCP, verify the count. Rows that could not be fetched fall back to "Re: subject" threading at send time (spec).
- [ ] Commit.

---

## Phase 3: Edge functions

### Task 10: Concept helpers (`_shared/outreachConcepts.ts`)

```ts
export type ConceptSoort = 'initial' | 'chase' | 'checkin' | 'reply';
export interface NewConcept { slug; soort; step?; to_email; subject; body; skeleton?; variant?; basis; thread_id?; in_reply_to?; references_hdr?; answers_mail_id?; validatie }
export async function insertConcept(db, c: NewConcept, opts: { autoApprove: boolean; lane: 'cold' | 'reply'; replyDelayMin?: [number, number] }): Promise<string | null>;
//   inserts with body_origineel = body; if autoApprove && validatie.ok → status 'ingepland', goedgekeurd_door 'auto', goedgekeurd_op now, and a queue row with niet_voor = now + 60 min (cold) or now + random(replyDelayMin) (reply, auto rejection uses [60,180]). 23505 on the live index → return null (someone else made it).
export async function approveConcept(db, id, opts: { direct: boolean; by: 'sjoerd' }): Promise<void>;
//   status 'ingepland', goedgekeurd_*; queue row: direct → niet_voor now + 15 s; reply lane → now + random 5-20 min; cold → null
export async function invalidateForSlug(db, slug, reason, opts?: { exceptId?: string; keepEdited?: boolean }): Promise<number>;
//   status voorstel|ingepland → 'verouderd' + reason; queue rows queued → 'cancelled'. Edited concepts become 'verouderd' too but keep body (UI shows them).
export async function cancelAllForSlug(db, slug, reason): Promise<void>;  // opt-out/bounce: 'weggegooid'
export const PRIORITY = { reply: 0, chase: 1, checkin: 1, initial: 2 } as const;
```
- [ ] Implement (no unit test; exercised by Task 11-14 and the E2E). Commit.

### Task 11: `outreach-mail-sync` rewrite of the inbound/outbound legs

Changes in `index.ts`:
1. Row gets `body_text: replyBodyOnly(mail.text, 20000)` for inbound and `mail.text.slice(0,20000)` for outbound, and `rfc_message_id: mail.messageId`.
2. **Outbound:** if `mail.messageId` matches an `outreach_concepts.rfc_message_id` → it is our queue's mail: set that concept `verzonden` if not already, do NOT invalidate. Else (Sjoerd sent it by hand): `invalidateForSlug(slug, 'Sjoerd mailde zelf vanuit Gmail')`. Status advance stays as today. Delete the `followup_requested_at` clearing.
3. **Inbound:** compute `bounce = isBounce(...)` before any Claude call. If bounce: sentiment `'bounce'`, samenvatting "Bounce: adres onbestelbaar.", `email_ongeldig_op = now`, `cancelAllForSlug`, no concept, `notifyPush('bounce', …)` (Task 23 provides it; until then a no-op import). Else classify as today (`looksAutomatic` still short-circuits to `auto`).
   Then `routeInbound`:
   - `ignore`: nothing (chases keep their cadence; do NOT invalidate).
   - `stop`: `niet_mailen_op = now`, advance to `afgewezen`, `cancelAllForSlug(…,'Wil geen mail meer')`.
   - `auto_rejection`: `invalidateForSlug(…,'Nieuwe mail van het bureau')`, advance to `afgewezen`, `insertConcept` reply with `templateRejection`, `validatie = validateOutgoing(…,'reply')`, `autoApprove = state.auto_goedkeuren`, lane reply, delay [60,180]; `in_reply_to = mail.messageId`, `references_hdr = [mail.references, mail.messageId].filter(Boolean).join(' ')`, `thread_id = mail.threadId`, `answers_mail_id = inserted mail id`.
   - `review`: invalidate as above; status/code-minting logic exactly as today; `insertConcept` reply with the Claude `concept` (or empty body + `validatie {ok:false, problems:['generation failed']}` when Claude failed), never auto; `notifyPush('reply', …)`.
4. `sync` returns `drafts: []` always. Remove `composePendingFollowUps` from the handler, keep `draft_created` answering `{ok:true}` so a stale WF11 run cannot error. Delete `queueChase`, `writeFollowUp`, `writeCheckIn` from this file (they move to prepare).
5. Every concept insert happens AFTER the mail row insert so `answers_mail_id` exists.

- [ ] Implement. `deno check supabase/functions/outreach-mail-sync/index.ts` passes. Commit `outreach: sync writes concepts instead of Gmail drafts`.

### Task 12: Prepare (`_shared/outreachPrepare.ts` + `outreach-prepare/index.ts`)

`runPrepare(db, now = new Date()): Promise<{ chases: number; checkins: number; initials: number; skipped: string[] }>`
1. Load prospects (all columns used by follow-ups + `categorie, openingshaak, subject_variant, niet_mailen_op, email_ongeldig_op, reply_dismissed_at, partner_slug`), latest mails per slug (with `rfc_message_id`, `gmail_thread_id`, `subject`, `from_email`, `body_text`, `samenvatting`), click stats, live concepts, `outreach_send_state.auto_goedkeuren`.
2. Skip any slug with `niet_mailen_op` or `email_ongeldig_op` or a live concept of the same kind.
3. **Chases** (G): TS port of `followUp()` from `src/lib/outreach.ts` into `_shared/outreachFollowUp.ts` as `followUpDue(p, mails, now)` (copy the working-day helpers verbatim; add a Deno test mirroring two cases of `src/lib/outreach.test.ts`). Take chases whose `dueDay` ≤ next working day. Body via the existing `writeFollowUp` logic (moved here), `skeleton = renderFollowUp(input)`, `variant = step===2 ? 'goodbye' : clicks>0 ? 'clicked' : 'quiet'`, `basis = {status, clicks, clickDays, lastOutAt}`, thread = thread of the last outbound mail, `in_reply_to = that mail's rfc_message_id`, subject `Re: {first mail subject}`. `validatie` with demoLink required only for quiet. Auto-approve when state says so.
4. **Check-ins**: same due rule for parked ones; body via `writeCheckIn`; never auto; to = replier's `from_email`.
5. **First mails**: capacity = Σ `dayCapacity` over `nextWorkingDays(now, 2)` − (cold concepts `voorstel|ingepland` + cold queue rows queued) − chases prepared in step 3. Candidates `nog_niet_benaderd` with `to_email`, ordered warm (confirmed clicks > 0) → tier A → B → C → naam. For each: Claude pass (`INITIAL_SYSTEM_PROMPT`), fallback `renderInitial(input)`, subject `initialSubject`, `basis = {status:'nog_niet_benaderd'}`, `thread_id null`, auto-approve when state says so.
6. Never overwrite a concept with `bewerkt_op`.

`outreach-prepare/index.ts`: POST, `verifySharedSecret`, calls `runPrepare`, returns the counts. `config.toml` gets `[functions.outreach-prepare] verify_jwt = false` with a comment in the house style.
- [ ] Implement. `deno check` both. Deploy this NEW function from the branch (allowed: new function) only after Task 9 is applied: `supabase functions deploy outreach-prepare --project-ref pcoyafgsirrznhmdaiji --use-api`. Do not run it against production yet (auto_goedkeuren is false, so a run would only create `voorstel` rows; still wait for the rollout step).
- [ ] Commit `outreach: prepare chases and first mails ahead of the slots`.

### Task 13: `outreach-send` for concepts

- `next`: claim (new signature). Row without `concept_id` (legacy draft) → return as today (for the cutover window). With `concept_id`: load concept + prospect + latest mails + click stats; **revalidate**:
  - status must be `ingepland`;
  - prospect not `niet_mailen_op` / `email_ongeldig_op`;
  - initial: prospect status still `nog_niet_benaderd`;
  - chase: status equals `basis.status`, no inbound mail after concept `created_at`, and the variant `renderFollowUp` would pick now equals `concept.variant`;
  - reply: no inbound mail in the thread newer than `answers_mail_id`'s.
  Failing → concept `verouderd` + reason, queue row `cancelled`, respond `{send:null, reason:'stale'}`.
  Passing → `messageId = newMessageId()`, store on concept, `raw = buildMime({...signature: soort==='initial', quote: soort==='reply' ? {their mail} : null})`, respond `{ send: { id, slug, soort, thread_id, raw } }`.
- `sent`: `outreach_send_done`; concept `verzonden`; insert outbound `outreach_mails` row (`gmail_message_id` from body, `gmail_thread_id` from body `thread_id` or the concept's, `kind` via `classifyOutbound`, `rfc_message_id`, `body_text`) and `outreach_advance_status` as the sync does; first mail also stamps `verzonden_op` through the ladder.
- `failed`: as today, plus when the row reaches `failed`: `notifyPush('failed', …)`.
- Header comment updated (no more "polls every ten minutes", no more drafts).
- [ ] Implement. `deno check`. Commit.

### Task 14: `ops-outreach` actions

`list` gains: `concepts` (live + today's verzonden/verouderd/weggegooid, with the answered mail's `body_text` for replies), `handled_today` (counts from `outreach_mails` today by sentiment auto/stop/afwijzing-with-auto-concept, bounce), `capacity` inputs (`next_allowed_at`, today's cold sent), `auto_goedkeuren`. New actions (all admin-gated, same `ok()` helper):
- `concept_update {id, body, subject?}` → save, `bewerkt_op = coalesce(bewerkt_op, now)`, recompute `validatie`.
- `concept_schedule {id}` / `concept_schedule_all {ids}` (≤ 40, cold only) → `approveConcept(direct:false)`.
- `concept_send {id}` → `approveConcept(direct:true)`; respond with `niet_voor`.
- `concept_undo {id}` → queue row queued→cancelled, concept back to `voorstel` (only while not claimed).
- `concept_unschedule {id}` → same as undo for non-direct.
- `concept_discard {id}` → `weggegooid`, cancel queue row.
- `concept_no_reply {id}` → `geen_antwoord`.
- `concept_regenerate {id}` → discard + run the single-slug path of prepare (or, for replies, re-classify is out of scope: return 400 "Regenerate works for chases, check-ins and first mails").
- `prepare_now` → `runPrepare(db)`.
- `auto_toggle {on}` → `outreach_send_state.auto_goedkeuren`.
- `fix_email {slug, to_email}` → update, clear `email_ongeldig_op`.
- `knock` (internal, used after the 15 s undo window) → POST WF12 webhook with the vault secret? The function has `N8N_SHARED_SECRET` in env: `fetch('https://falkoratlas.app.n8n.cloud/webhook/d56ec58d-99d7-4c1e-bfd0-e6ffce6b894a', {headers:{'x-shared-secret':…}})`.
- Remove `queue_followup` (and its UI).
- [ ] Implement. `deno check`. Commit.

---

## Phase 4: WF12 (approval gate)

### Task 15: WF12 two-node change

**Stop here and ask Sjoerd for an explicit yes for WF12**, presenting: node "Gmail: send the draft" → URL `…/messages/send`, body `={{ JSON.stringify(Object.assign({ raw: $json.send.raw }, $json.send.thread_id ? { threadId: $json.send.thread_id } : {})) }}` (legacy rows with `draft_id` would break, so cutover requires zero legacy rows: check `select count(*) from outreach_send_queue where status in ('queued','sending') and concept_id is null` = 0); node "Report sent" body adds `thread_id: $json.threadId`. Rename the node to "Gmail: send the message". Risk: while WF12 is on the new shape and the old `outreach-send` is still deployed, a knock would post a draft id as raw; mitigation: pause sending before the edit and keep it paused until the merge deploys.
- [ ] After yes: export current WF12 to `n8n_wfs_cairnly/backups/WF12 - Outreach Send (pre-control-center 2026-09-24).json`; update with n8n MCP `update_workflow` (only these two nodes; assert the node diff before sending); re-export to `n8n_wfs_cairnly/WF12 - Outreach Send.json`; commit.

---

## Phase 5: Frontend

### Task 16: Highlighting (`src/lib/outreachHighlight.ts`)

```ts
export type Span = { text: string; mark: 'none' | 'new' | 'shared' | 'question' | 'unanswered' };
export function diffAgainstSkeleton(body: string, skeleton: string): Span[];   // word-level LCS; tokens in body not matched in skeleton → 'new'
export function contentWords(text: string): Set<string>;                      // lowercase, strip punctuation/URLs, drop NL+EN stopwords, drop ≤ 2 chars, crude stem: strip trailing 'en','s','e'
export function sharedSpans(text: string, other: Set<string>): Span[];        // words whose stem is in `other` → 'shared'
export function questions(text: string): string[];                            // sentences ending in '?', URLs ignored
export function unansweredQuestions(theirText: string, reply: string): string[]; // question with zero content-word overlap with the reply
```
Stopword list inline (≈120 Dutch + ≈60 English function words).
- [ ] Vitest (`outreachHighlight.test.ts`): identical body → all 'none'; a changed salutation name → only the name 'new'; "prijs per kandidaat?" vs reply containing "kandidaat" → not unanswered; vs reply without → unanswered; URLs never 'shared'; stopwords never 'shared'. Implement. Commit.

### Task 17: Cockpit math (`src/lib/outreachCockpit.ts`)

Mirror of Task 1 (`coldWindow`, `dayCapacity`, `nextWorkingDays`) plus:
```ts
export function slotsFor(day: string, scheduledColdThatDay: number): { capacity: number; filled: number; empty: number };
export function estimateTimes(nextAllowedAt: string | null, queued: Array<{ id: string; lane: 'cold'|'reply'; niet_voor: string | null }>, now: Date): Record<string, string>; // ISO estimate per id; cold rows step by MEAN_GAP inside windows, reply rows at max(niet_voor, now)
export function runwayDays(notContacted: number, now: Date, expectedChasesPerDay: number): number | null;
```
- [ ] Vitest with the same Monday/Friday/Tuesday numbers as Task 1 (the two copies must agree; the test is the guard). Commit.

### Task 18: Components

- `HighlightedText.tsx`: renders `Span[]`; `new` = gold background, `shared` = teal underline, `question` = bold, `unanswered` = red dotted underline + ⚠ title. Muted text for `none` only in skeleton mode.
- `ConceptCard.tsx` (initial/chase/checkin): header (kind, bureau, due/late, tier, auto tag), a `textarea` with a highlight overlay layer behind it (same font/padding; the overlay renders `diffAgainstSkeleton(body, skeleton)`), debounced (800 ms) `concept_update`, validation problems listed under it, buttons Schedule / Send / Discard (+ Regenerate when stale). Send shows a 15-second Undo countdown, then calls `knock`.
- `ReplyConceptCard.tsx`: two columns ≥ `md`, stacked below: left their mail (`body_text`, else snippet + "(snippet only)") rendered with `sharedSpans` and question marks; right the concept textarea with `sharedSpans` overlay; unanswered questions listed as warnings; buttons Schedule / Send / Park / No reply needed / Discard.
- `Cockpit.tsx`: top strip (Today x/cap sent · next ~time; Tomorrow filled/capacity · empty; Runway days, amber < 5), red banner when paused and anything is scheduled or due, `auto_goedkeuren` toggle beside the pause toggle, sections Needs you / Going out / Handled for you today, "Prepare more" button, "Schedule all" (only when auto is off), notifications button (Task 22).
- Styling: reuse the /ops glass surfaces from `OutreachTab.tsx`/`Ops.tsx` (do not restore the text-gray ramp); font weights ≤ 700.
- [ ] Build each component; wire in `OutreachTab.tsx` above the existing cards; delete the Draft it / Draft all due / Draft early buttons and the `queue_followup` call; replace the "Draft it" help text. `npm run build` passes; `npx vitest run src/lib` passes. Commit.

---

## Phase 6: Push

### Task 19: VAPID keys (no key in the transcript)

- [ ] In the scratchpad: `npx --yes web-push generate-vapid-keys --json > $SCRATCH/vapid.json`, then build `$SCRATCH/vapid.env` with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:sjoerd@cairnly.io` via a `node -e` that reads the JSON and writes the file without printing; `supabase secrets set --env-file $SCRATCH/vapid.env --project-ref pcoyafgsirrznhmdaiji`; `rm` both files. Only the public key is ever shown (it is public by design); the browser gets it from `ops-outreach` (`vapid_public_key` action), so no Vercel env var is needed.

### Task 20: Migration `20260924120100_ops_push.sql`

`ops_push_subscriptions (id uuid pk, endpoint text unique not null, p256dh text not null, auth text not null, user_email text not null, created_at, last_ok_at, failed_count int default 0)`; `ops_push_log (kind text, key text, day date, sent_at timestamptz default now(), primary key (kind, key, day))`; RLS on, no policies.
- [ ] Apply via MCP, verify. Commit.

### Task 21: `_shared/opsPush.ts` + `ops-push` function

- `_shared/opsPush.ts`: `sendToAll(db, payload: {title, body, url, tag})` using `npm:web-push@3.6.7` (`setVapidDetails`, `sendNotification`); 404/410 → delete subscription; other errors → `failed_count+1`. `notifyPush(db, kind, key, payload, opts?: {quietHours?: boolean})`: insert into `ops_push_log` first (conflict → already sent → return); quiet hours 20:00-08:00 Amsterdam → skip (the morning digest covers it). If `npm:web-push` fails to import in the edge runtime, switch to `jsr:@negrel/webpush` in this one file.
- `ops-push/index.ts` (shared secret, called by pg_cron): actions
  - `digest {slot:'morning'|'afternoon'}`: only proceeds when the Amsterdam clock is within 20 minutes after 08:30 / 15:00 (cron fires at both UTC offsets); morning = replies needing Sjoerd + concepts waiting + auto mails going out today + empty slots tomorrow + runway warning < 5; afternoon only if tomorrow has empty cold slots and (concepts wait for Sjoerd or no first-mail supply left). Nothing to say → no push.
  - `alarm`: paused while a queued row is due inside its window → once per day (`alarm_gepauzeerd_op`).
- `ops-outreach` gains `push_subscribe {endpoint, keys}`, `push_unsubscribe`, `push_test`, `vapid_public_key`.
- `config.toml`: `[functions.ops-push] verify_jwt = false` + comment.
- Hooks: `outreach-mail-sync` reply/bounce (Task 11 placeholders become real), `outreach-send` failed.
- [ ] Implement, `deno check`, deploy `ops-push` from the branch (new function). Commit.

### Task 22: Service worker + subscribe UI

- `public/ops-sw.js`: `push` → `showNotification(title, {body, tag, data:{url}})`; `notificationclick` → focus an open `/ops` client or `clients.openWindow(url)`.
- `src/components/ops/outreach/pushClient.ts`: `enablePush()` registers `/ops-sw.js` with scope `/ops`, asks permission, subscribes with the VAPID public key from `vapid_public_key`, posts to `push_subscribe`; `pushState()` for the button label.
- Cockpit button: "Notifications on" / "Notifications active" / "Blocked in Chrome settings", plus "Send test".
- Check `vercel.json` headers do not block `/ops-sw.js` (Service-Worker-Allowed is not needed for scope `/ops` when the file is at the root).
- [ ] Build passes. Commit.

### Task 23: Cron migration `20260924120200_outreach_control_center_cron.sql` (apply at rollout, not before)

pg_cron jobs, each calling the edge function with `x-shared-secret` from vault `n8n_shared_secret` via a small `security definer` helper `outreach_call_function(p_name text, p_body jsonb)`:
- `outreach-prepare`: `30 5,6 * * 1-5` and `45 12,13 * * 1-5` UTC; the function itself runs only when Amsterdam time is 07:30-07:50 or 14:45-15:05 (add that guard in `outreach-prepare/index.ts`, bypassed when body has `force: true` for the button path).
- `ops-push-digest-morning`: `30 6,7 * * 1-5` UTC → `{action:'digest', slot:'morning'}`.
- `ops-push-digest-afternoon`: `0 13,14 * * 1-5` UTC → `{slot:'afternoon'}`.
- `ops-push-alarm`: `15 7-15 * * 1-5` UTC → `{action:'alarm'}`.
- [ ] Write the file now, commit; apply it in Task 25 step 7.

---

## Phase 7: Verify and roll out

### Task 24: Full verification on the branch

- [ ] `deno test --allow-env supabase/functions/_shared/outreach*.test.ts` all green.
- [ ] `npx vitest run` green (check the exit code, the Node-env trap).
- [ ] `npm run build` green.
- [ ] Code review at `high` or above on the branch diff; fix findings.
- [ ] Present to Sjoerd: "Heads up, this is not live yet" + what's on the branch.

### Task 25: Rollout (each step needs the preceding one green)

1. Pause sending (`/ops` toggle or `update outreach_send_state set gepauzeerd = true`).
2. MEPD legacy draft: ask Sjoerd (send by hand or cancel); then `outreach_send_queue` live legacy rows = 0.
3. Migration Task 9 is already applied (Phase 2); Task 20 applied.
4. WF12 edited (Task 15, after his yes).
5. Merge the branch to main (Sjoerd's go) → all functions redeploy + Vercel.
6. Self-test: insert a temporary prospect `test-sjoerd` (to_email = an address Sjoerd names, not cairnly.io/bethehitl.com), run `prepare_now` with `force`, check the concept in the cockpit, press Send, unpause for that one mail, confirm in his inbox: sender, HTML, signature, link. Reply to it from that inbox → reply concept appears with his mail on the left, a ping arrives. Then delete the test prospect and its rows.
7. Apply the cron migration (Task 23).
8. Unpause. Trust run with `auto_goedkeuren` off.
9. Sjoerd flips `auto_goedkeuren` on when satisfied.

### Task 26: Housekeeping

- [ ] Update memory `project_outreach_control_center.md` (built/live state, traps found), `project_outreach_send_queue.md` and `project_outreach_mail_sync.md` (superseded parts).
- [ ] Later, separate change: remove WF11's idle draft branch and the `followup_requested_at` / `draft_created` code paths.
