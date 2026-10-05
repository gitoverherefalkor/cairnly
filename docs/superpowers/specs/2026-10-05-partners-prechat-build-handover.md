# Partners pre-chat: build handover (2026-10-05)

For a fresh session that builds the pre-chat on `/partners`. The design, the three played-out
runs and the reasoning live in the design doc (a Claude Doc, read it with the docs tools):
https://claude.ai/code/artifact/fea86b3c-b1a5-4299-a41c-24151bad8574

Everything below is decided. Do not re-open it; ask Sjoerd only about the items under "Still
open".

## What it is

An inline chat on `/partners`, directly under `PartnersHero`, for career coaches, outplacement
agencies and career advisers who use validated tests. The demo shows what Cairnly is; this chat
answers "does it belong in my practice?". It leads with the practitioner's clients, never with
reassurance about AI, answers the AI worry honestly when raised, and ends on an offer card:
the free pilot, three free credits, or 20 minutes with Sjoerd. No checkout.

## Decisions (Sjoerd, 2026-10-05)

1. Build it now. Following up on the first partner codes runs in parallel, not as a blocker.
2. Free credits (3) are minted **by hand**. The chat promises them "within one working day".
3. The pilot is **10 credits**, for a handful of agencies, with the slot count kept **on the
   server**. The offer card stops showing the pilot when no slots are left. (The partners page
   copy was changed from 20 candidates to 10 credits in the same PR as this file.)
4. Agencies asking for an adviser view of candidate results get an honest no. Log how often.
5. Solo coaches: credits for now; a referral arrangement is a later question.
6. Brad Gentry's quote is placed by the interface, word for word, in English, for the
   validated-tests starter only. The model never quotes it.
7. Dutch and English, Dutch as the default.
8. The AI-worry starter stays visible.
9. The assessment is described as taking **about 45 minutes** ("ongeveer 45 minuten").

## Reuse map (what exists on main)

**Backend: `supabase/functions/intake-chat/`**
- `index.ts`: the server-side phase machine (`handleStart`, `handleMessage`; Q&A, then pitch +
  forced-tool extraction, then post-pitch). `MODEL = 'claude-sonnet-5-5'` with
  `output_config.effort` (low for questions, medium for the pitch), `EXTRACTION_MODEL =
  'claude-sonnet-5'`, `MAX_USER_TURNS = 12`, `MAX_MESSAGE_CHARS = 600`,
  `MAX_SESSION_TOKENS = 60_000`, 15/min per-IP rate limit, `verify_jwt = false`.
- `prompts.ts`: `INTENT_KEYS`, `INTENT_BRIEFS`, `OPENER_REPLIES` (canned, no model call),
  `BEATS` / `beatsFor()` (deterministic chips, variable plan length per intent), `STYLE_RULES`,
  `GUARDRAILS`, `qaSystem`, `pitchSystem`, `postPitchSystem`, `EXTRACTION_TOOL`.
- Add an `audience` switch (`consumer` default, `partner` new). Build it generic: an HR chat for
  `/employers` may follow on the same switch. Put the partner prompt set in its own file next to
  `prompts.ts`.

**Table: `intake_sessions`** (migration `20260713120000_create_intake_sessions.sql`): id,
created_at, updated_at, intent, language, source, status, messages jsonb, extraction jsonb,
pitch, email, resume_token, user_turns, total_tokens. RLS on, no policies, service role only.
Add `audience` (not null, default `'consumer'`) and whatever the lead needs (offer chosen, lead
status). Pilot slots need a server-side count that Sjoerd can change without a deploy.

**Frontend: `src/components/landing/intake/`**
- `IntakeChatSection.tsx` (default export `IntakeChatPanel`), `IntakeChatContext.tsx`
  (`useIntakeChat`, `INTAKE_SECTION_ID`), `intakeApi.ts`.
- Do NOT reuse the consumer localStorage keys (`intake_prefill_data`,
  `cairnly_intake_contact`, `cairnly_intake_session`): they pre-fill the survey and checkout.
  The partner chat gets its own session key and never writes a prefill.
- `intakeSlides.ts` / the hero carousel are homepage-only; not needed here.

**Partners page**
- `src/pages/partners/PartnersIndex.tsx`, order today: Hero, WhoFor, WhatYouGet,
  CandidateStart, Testimonial (`variant="full" audience="partner"`), Pricing, Pilot, FAQ,
  Closing. The chat goes right after `PartnersHero`.
- Copy: `public/locales/{en,nl}/partners.json`. Prices are strings in `pricing.rows`
  ("44 euro"). The offer card needs numbers: keep a typed tier table in code with a vitest that
  fails if it drifts from `pricing.rows` in both languages.
- `src/components/partners/constants.ts`: `CALENDLY_URL`, `CONTACT_EMAIL`,
  `PARTNER_DEMO_PERSONA = 'marcel'`, `PARTNER_DEMO_SEARCH = '?p=partners'`.
- `src/components/landing/Testimonial.tsx`: the `BRAD` constant is not exported. Export it (or a
  small quote component) instead of copying the text. Never put the quote in a locale file.

**Partner machinery (already live)**
- `ops-partners` edge function: actions `list`, `save`, `mint`, `setActive`, `delete`;
  `mint` calls RPC `mint_partner_codes(slug, count, expires_at, survey_type)`.
- `/p/:slug` start page (`PartnerLanding.tsx` + `partner-public` function), the partner PDF
  closing page that hands the reader to their adviser, `partner_code_status` view, and the
  code-activation nudge.
- Push to Sjoerd: `supabase/functions/_shared/opsPush.ts` (`notifyPush`). Event pings call it
  where the event happens; `ops-push` is only the clock-driven digest.
- Email: Resend via `fetch('https://api.resend.com/emails')` (see `translate-section/index.ts`),
  layout helpers in `_shared/email-chrome.ts`.

## Suggested order

1. Migration (audience, lead fields, pilot slot setting). Write the SQL file, apply it
   individually through the Supabase MCP, verify with `information_schema`.
2. Partner prompt set: starters, opener replies, beats with chips, pitch, post-pitch, extraction.
3. `audience` switch in `intake-chat`; for partners: no survey pre-fill, the pitched response
   carries the offer card computed on the server.
4. Offer card rules + tier table + drift test.
5. A lead action (email + chosen offer): store it, send the recap mail, `notifyPush`.
6. Partner chat section on `/partners`, both languages, Brad's quote slot for `validated`.
7. A lead list in `/ops` (English only) with statuses: new, credits sent, pilot call booked,
   pilot running, buying, lost.
8. Before launch: one real end-to-end run of the partner chain (mint a code, open the `/p/`
   link, sign up, finish, check the PDF). As of 2026-10-05, 8 real partner codes are out and
   none has been redeemed, so the chain has never run with a real candidate.

## The conversation

**Starters** (seeded, editable first message; unedited sends get the canned reply, edited or
typed ones get a live reply):

| Intent | EN | NL |
|---|---|---|
| clients-blank | My clients come in with no idea where to start. | Mijn kandidaten komen binnen zonder idee waar ze moeten beginnen. |
| clients-ai | My clients keep asking whether AI will take their job. | Mijn kandidaten vragen steeds of AI hun baan gaat overnemen. |
| validated | I work with validated tests, and I'm wary of AI tools. | Ik werk met gevalideerde tests en ben voorzichtig met AI-tools. |
| shorter | I want shorter trajectories without losing quality. | Ik wil kortere trajecten zonder in te leveren op kwaliteit. |
| ai-self | I'm curious, but I wonder what AI means for coaches like me. | Ik ben nieuwsgierig, maar vraag me af wat AI betekent voor coaches zoals ik. |
| other | (typed) | (getypt) |

**Canned opener replies (EN; Dutch still to be written and reviewed by Sjoerd):**
- clients-blank: "That first step is what Cairnly is built for. In about 45 minutes the
  candidate goes from a blank page to a top 3 with match scores, alternatives, salary ranges and
  an AI-impact rating for each career. Before anything else: what kind of work do your clients
  mostly come from?" (asks the client-group question, so that beat is skipped)
- clients-ai: "Your clients are far from alone: in the Netherlands, 45% of workers think AI
  could do part or all of their job (CBS, 2026), and two in three Europeans expect AI to replace
  more jobs than it creates (Eurobarometer, 2025). Every career Cairnly suggests carries an
  AI-impact rating from Minimal to Critical, so the question gets a concrete answer per role.
  What do you tell clients now when they ask it?"
- validated: "Fair. Cairnly isn't a psychometric instrument or a COTAN-rated test, and doesn't
  claim to be. It translates experience, values and preferences into concrete careers with
  salary and AI-impact, and it sits alongside your validated instruments. Which instruments do
  you use, and where does the process tend to stall after the test?"
- shorter: "Before the first conversation with you, the candidate already has a top 3,
  alternatives, salary ranges and AI-impact for each, so the first session can start from
  concrete directions. How is a trajectory paid for in your practice?" (asks the payment
  question, so that beat is skipped)
- ai-self: "A straight answer, then. Cairnly does the research part: it maps someone's
  experience, values and preferences to concrete careers, with salary and AI-impact for each.
  The conversation, the judgment and the client's decision stay with you, and the report is
  written to be talked through with an adviser. What does your work with a client look like
  today?"

Sources for the AI figures: CBS, 25 Feb 2026
(https://www.cbs.nl/en-gb/news/2026/09/almost-half-of-workers-believe-ai-could-do-their-job):
41% think AI could do part of their job, 4% all of it. Special Eurobarometer 554, fieldwork
Apr-May 2024, published Feb 2025
(https://www.veriangroup.com/news-and-insights/artificial-intelligence-and-the-future-of-work):
66% fear AI will replace more jobs than it creates.

**Beats after the opener** (chips deterministic from the server):
- Client group: office or knowledge work / leadership and executive / a mix / mostly
  healthcare, education or production.
- Payment: a fixed fee per trajectory (the employer pays) / by the hour or session / the client
  pays me directly / a mix.
- Yearly volume: fewer than 10 / 10 to 49 / 50 to 199 / 200 or more.

**Offer card (computed in code):**
- Mostly healthcare, education or production: no offer; the honest limit plus the sample report.
- Office, knowledge or mixed, 50+ a year, pilot slots left: "Book 20 minutes about the pilot"
  first, 3 free credits second.
- Office, knowledge or mixed, under 50 a year (or no slots left): "Send me 3 free credits" first,
  a call second (a quiet text link for "just exploring" solos).
- Always: links to the sample report and to Marcel's session with `?p=partners`.
- Money argument by payment model: fixed fee means a shorter discovery phase is margin; hourly
  means better sessions and the credit is passed on; client pays means a credit of 20 to 44 euro
  against the 59 euro consumer price.

## Guardrails (absolute, in the system prompt)

- Lead with the clients. Never raise AI replacing coaches unprompted; when raised, say what
  Cairnly does (the research), what stays with a person (listening, judgment, the decision,
  capacity judgments that belong to the occupational physician) and the uncomfortable part
  (Cairnly also sells to individuals for 59 euro). Never "AI will never replace coaches".
- Validity in the FAQ's words: not psychometric, not COTAN, alongside validated instruments.
  Never "validated", "accurate", "scientifically proven", "better than".
- Office and knowledge work only; say so and make no offer for other groups.
- No invented proof: no client counts, agency names or pilot results. Brad's quote only via the
  interface.
- Prices from code; no discounts. No promises beyond what exists (no own domain or payment
  environment, no adviser dashboard, no API).
- Never ask for a client's name, story or scores; the extraction never stores one.
- Homepage style rules: no em-dashes, no "it's not X, it's Y" in any form, no flattery, no
  exclamation marks, acknowledgements of six words or fewer, never restating the visitor.

## Traps (from earlier sessions)

- Sonnet 5.x returns a `thinking` block before the text: always
  `content.find(c => c.type === 'text')`, never `content[0]`, and keep `max_tokens` generous
  because thinking shares it. Never send `temperature`.
- `supabase db push` is unsafe here (migration history mismatch): apply migrations one by one
  through the MCP.
- Any push to main that touches `supabase/functions` redeploys all edge functions. A new
  function needs its `[functions.*]` block in `config.toml`.
- `tsc --noEmit` checks nothing in this repo: verify with `npm run build`, vitest and the
  browser. Tests that import the Supabase client fail in a worktree without `.env`.
- Analytics: conversions are events, never a session id tied to an email.
- `/ops` is English only. Font weight never above 700. CTAs use the squared `lp-btn-primary`
  style.
- Frontend goes to a branch and a PR first; say plainly what is not live yet.

## Still open (ask Sjoerd)

- The total number of pilot slots.
- Review of the Dutch opener replies and pitch wording.
- The outreach prompts in `supabase/functions/_shared/outreach*.ts` still say "25 tot 40
  minuten" and describe a different pilot ("vijf kandidaten per bureau, zes weken"). Whether
  outreach moves to 10 credits and 45 minutes is Sjoerd's call; the chat follows the partners
  page.

## Done when

- [ ] Five starters plus free text, Dutch and English; canned replies are instant.
- [ ] Three or four questions with server chips; plans skip the question an opener already asked.
- [ ] Pitch of 70 to 110 words that never reads the visitor's answers back.
- [ ] Offer card follows the rules above; the pilot disappears at zero slots.
- [ ] Healthcare, education or production clients get the honest limit and no offer.
- [ ] An email produces a recap mail, a push to Sjoerd and a lead row in `/ops`.
- [ ] Brad's quote appears verbatim for `validated` only, placed by the interface.
- [ ] Pricing drift test passes; `npm run build` passes; checked in the browser in both languages.
