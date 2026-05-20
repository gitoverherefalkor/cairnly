# Handoff: Journal Newsletter Signup

## Overview

Make the email signup form on [`/journal`](src/pages/Journal.tsx) actually capture subscribers. Today it calls `e.preventDefault()` and does nothing. The Journal publishes three to four times a year (per the on-page copy), so the volume is tiny — but it needs to be GDPR-compliant (Sjoerd is in NL, the site has a CookieConsentBanner).

**Recommended approach: Supabase table + Resend double opt-in.** Resend is already integrated in this project (`RESEND_API_KEY` in env, ~5 existing edge functions use it), so this adds no new vendors.

## Scope

**In scope:**
- New Supabase table for subscribers + RLS
- Edge function that handles signup (writes a `pending` row, sends a confirmation email)
- A confirmation route that flips `pending` → `active`
- Wire the existing form in [Journal.tsx](src/pages/Journal.tsx) to the edge function
- Toast feedback on success/error
- An unsubscribe edge function + route (one-click, no login)

**Out of scope (separate work later):**
- Sending the actual newsletter broadcast (the user will export the active list or wire Resend Broadcasts when they publish)
- An admin UI for managing subscribers
- Welcome email after confirmation

## Database

New migration: `supabase/migrations/<timestamp>_create_newsletter_subscribers.sql`

```sql
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  source text,                                  -- 'journal' | future sources
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- No client access — all writes go through edge functions using the service-role key.
-- (No SELECT/INSERT policy needed.)

CREATE INDEX newsletter_subscribers_email_status_idx
  ON public.newsletter_subscribers (email, status);
```

## Edge Functions

Three small Deno functions in `supabase/functions/`. Follow the existing pattern from [send-confirmation-email/index.ts](supabase/functions/send-confirmation-email/index.ts) — same CORS helpers, same Resend import, same error response style.

### `journal-subscribe`

`POST { email: string, source?: string }`

1. Validate email (basic regex + lowercase + trim).
2. Look up by email.
   - If exists with `status = 'active'` → return `{ ok: true, status: 'already-subscribed' }` (don't leak that they're subscribed by reusing the token; just succeed silently).
   - If exists with `status = 'pending'` → reuse the existing `confirmation_token` (resend the same email so old links keep working).
   - If exists with `status = 'unsubscribed'` → reset to `pending`, mint a new token, treat as new signup.
   - If not found → insert a new row with `status = 'pending'`, `source = body.source ?? 'journal'`.
3. Send confirmation email via Resend with a link to `https://cairnly.io/newsletter/confirm?token=<confirmation_token>`. Subject and body should match Cairnly's voice — short, no marketing fluff. Sjoerd's writing rule: **no em-dashes in customer-facing copy**. Suggested copy:

   > **Subject:** Confirm your Cairnly Journal subscription
   >
   > Hi,
   >
   > Click below to confirm you'd like the Cairnly Journal — three to four short emails a year when a new piece is published, nothing else.
   >
   > [Confirm subscription](https://cairnly.io/newsletter/confirm?token=...)
   >
   > Didn't request this? Ignore the email and nothing happens.
   >
   > Cairnly · Utrecht

4. Return `{ ok: true, status: 'confirmation-sent' }` on success, structured error on failure.

### `journal-confirm`

`GET ?token=<uuid>` (called by the confirmation page; could also be POST)

1. Look up by `confirmation_token`.
2. If found and status is `pending`, set `status = 'active'`, `confirmed_at = now()`, rotate the token (set it to a new uuid so the old link can't be replayed).
3. Return `{ ok: true, email }` so the page can show "✓ Subscribed as foo@bar.com".
4. If the token is invalid or already confirmed, return a friendly `{ ok: false, reason: 'invalid-or-expired' }` — don't 500.

### `journal-unsubscribe`

`GET ?token=<uuid>`

1. Look up by `unsubscribe_token`.
2. If found, set `status = 'unsubscribed'`, `unsubscribed_at = now()`.
3. Always return success-shaped JSON (don't leak whether the token matched).

## Frontend

### Wire the form — [src/pages/Journal.tsx](src/pages/Journal.tsx)

The form is in the subscribe block near the bottom of the page. Replace `onSubmit={(e) => e.preventDefault()}` with a handler that:

1. Reads the email from a controlled state.
2. Calls `supabase.functions.invoke('journal-subscribe', { body: { email, source: 'journal' } })`.
3. On success → render an inline success message in place of the form ("Check your inbox — we sent a link to confirm.") AND toast.
4. On error → toast with the error reason; keep the form visible.
5. Disable the submit button while in flight, swap the label to "Sending…".

Use the existing `useToast` hook (`@/hooks/use-toast`) for feedback. The form already has the right styling — keep it intact.

### New page — `src/pages/NewsletterConfirm.tsx`

Minimal landing page rendered at `/newsletter/confirm`:
- Reads `?token=` from the URL.
- On mount, calls `journal-confirm` with the token.
- Three states: loading, success ("You're subscribed. We'll only email when there's something worth reading."), failed ("This link has expired or already been used. Try signing up again.").
- Uses the same landing-page-style chrome (LandingNav + LandingFooter, same cream background as Journal).

### New page — `src/pages/NewsletterUnsubscribe.tsx`

At `/newsletter/unsubscribe?token=`. Calls `journal-unsubscribe` on mount, always shows "You've been unsubscribed."

### Route additions — [src/App.tsx](src/App.tsx)

Add the two new lazy-loaded routes above the catch-all:
```tsx
<Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
<Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
```

### Unsubscribe link in every broadcast

Reminder for whoever sends the eventual newsletter broadcast: the email footer must include `https://cairnly.io/newsletter/unsubscribe?token=<unsubscribe_token>` per-recipient. Resend Broadcasts supports per-recipient variables, so this is a template substitution.

## Copy / brand guardrails

- **No em-dashes** in any user-facing copy (Sjoerd's global rule). Confirmation email, success states, toasts, all of it. Use commas, periods, parentheses, sentence breaks.
- Cairnly's tone is short, honest, low-fluff. Avoid marketing-speak ("excited", "thrilled", "exclusive").
- The form's existing copy ("Three to four times a year. No marketing newsletter.") is the voice to match.

## GDPR notes

- **Double opt-in** is the whole point of this design — the table only stores `pending` until the user clicks the confirmation link, after which `status = 'active'`.
- **Unsubscribe link** in every email is mandatory.
- The cookie banner already handles consent for analytics. Newsletter signup is its own explicit consent (the user actively typed an email and submitted the form), so no extra cookie banner work is needed.
- Privacy policy may need a one-line addition mentioning the newsletter. Check [src/pages/PrivacyPolicy.tsx](src/pages/PrivacyPolicy.tsx).

## Acceptance

The work is done when:
1. Submitting the Journal form sends a confirmation email within ~2 seconds.
2. Clicking the link in that email lands on `/newsletter/confirm` with a success state, and the DB row flips to `status = 'active'`.
3. The same form submitted twice doesn't create duplicate rows or send duplicate confirmation emails (idempotent on `pending`).
4. Resubmitting after unsubscribing re-opts the user in via a fresh confirmation flow.
5. `/newsletter/unsubscribe?token=<valid>` flips status to `unsubscribed` without revealing whether the token matched.
6. Migration runs cleanly on the remote Supabase project.
7. No em-dashes in any user-visible string.

## Tech-stack references

- Existing Resend pattern: [supabase/functions/send-confirmation-email/index.ts](supabase/functions/send-confirmation-email/index.ts)
- CORS helpers: [supabase/functions/_shared/cors.ts](supabase/functions/_shared/cors.ts)
- Migration directory: `supabase/migrations/` (use `YYYYMMDDHHMMSS_*.sql` naming)
- Toast: `@/hooks/use-toast` (`useToast()` returns `{ toast }`)
- Supabase client: `@/integrations/supabase/client` (use `supabase.functions.invoke(name, { body })`)

## Open decisions for the implementer

1. **Sender address** — pick one: `journal@cairnly.io`, `hello@cairnly.io`, or reuse whatever sender Cairnly already verified in Resend. Check existing email functions for the current `from:` value before choosing.
2. **Confirmation token expiry** — none is fine for v1 (a token is single-use because we rotate it on confirm). If you want belt-and-braces, add a `created_at` check that rejects tokens older than 30 days.
3. **Honeypot / rate limit** — for a low-volume form on a public page, the unique-email constraint plus the double-opt-in flow is enough deterrent. Skip captcha unless abuse shows up.
