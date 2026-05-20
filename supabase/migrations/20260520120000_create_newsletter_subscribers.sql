-- Newsletter subscribers for the Journal.
-- All access goes through the journal-subscribe / journal-confirm /
-- journal-unsubscribe edge functions using the service-role key, so RLS is
-- enabled with no policies (no client can read or write directly).

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  source text,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE INDEX newsletter_subscribers_email_status_idx
  ON public.newsletter_subscribers (email, status);

CREATE INDEX newsletter_subscribers_confirmation_token_idx
  ON public.newsletter_subscribers (confirmation_token);

CREATE INDEX newsletter_subscribers_unsubscribe_token_idx
  ON public.newsletter_subscribers (unsubscribe_token);
