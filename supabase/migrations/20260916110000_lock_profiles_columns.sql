-- Stop users from granting themselves the referral-gated paid tools.
--
-- THE HOLE THIS CLOSES
-- --------------------
-- The frontend writes to `profiles` directly from the browser, and the only
-- thing between a user and their own row is this policy:
--
--     "Users can update their own profile"  UPDATE  USING (auth.uid() = id)
--
-- That scopes ROWS (you may only touch your own). It does not scope COLUMNS,
-- and RLS has no syntax that could: a policy's USING/WITH CHECK is a row
-- predicate, evaluated per row, with no notion of which columns the statement
-- actually sets. So until now any logged-in user could open devtools and run
--
--     supabase.from('profiles').update({ comp_tool_unlocks: 3 }).eq('id', <self>)
--
-- and hand themselves all three referral-gated tools (job search, tailored
-- resume, cover letters) without referring anyone. Nothing obscure about it:
-- the column name ships to the browser inside
-- src/integrations/supabase/types.ts, which is part of the client bundle.
--
-- The same one-liner also worked on:
--   partner_id                -- self-attribute to a white-label partner, which
--                                changes the branding on the generated report
--   referral_code             -- claim someone else's invite code
--   stripe_promotion_code_id  -- attach yourself to a Stripe promotion
--
-- This is a prerequisite for the job-search free tier, not just hygiene. That
-- tier reads comp_tool_unlocks to decide who is "unlimited", so a self-granted
-- comp is a self-granted uncapped search budget and the 4-search cap would be
-- decorative.
--
-- THE MECHANISM
-- -------------
-- Column-level GRANTs are the tool Postgres gives you for this, and they
-- compose with RLS rather than replacing it: a write must satisfy BOTH the
-- grant (may this role write this column?) and the policy (may this role touch
-- this row?). So we keep the existing row policy exactly as it is and narrow
-- the columns underneath it.
--
-- Table-level `GRANT UPDATE ON profiles` implies UPDATE on every column,
-- including ones added later, so it has to go first. Revoking it and
-- re-granting a named list also means a NEW column is locked down by default:
-- if someone adds `is_admin` next year it is service-role-only until a human
-- deliberately adds it to the GRANT below. Default-deny is the point.
--
-- SCOPE: THIS TOUCHES UPDATE AND NOTHING ELSE
-- -------------------------------------------
-- SELECT is deliberately left alone. The browser legitimately READS
-- comp_tool_unlocks — useReferralStatus.ts reads it to decide whether to show
-- the tools as unlocked. Revoking SELECT would break the referral gate for
-- every comped user.
--
-- INSERT is deliberately left alone too. useAuth.ensureProfile() inserts the
-- user's own profile row from the browser on first login (id, email,
-- first_name, last_name, auth_provider, preferred_language, created_at,
-- updated_at), which is a separate privilege from UPDATE and must keep working
-- or new signups break. That is why id/email/auth_provider/created_at appear in
-- the "service-role-only" list below and yet are still insertable: the list is
-- about UPDATE.
--
-- `anon` also holds a table-level UPDATE grant here. Left as-is on purpose: for
-- an anonymous request auth.uid() is NULL, so `auth.uid() = id` is NULL, the
-- policy matches zero rows, and the grant is unreachable. Not a second door.

-- 1. Drop the blanket grant that implies "every column, forever".
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 2. Re-grant exactly the columns the app actually writes from the browser.
--    Every entry below is backed by a real call site; keep this list and the
--    frontend in sync, because a column missing here does NOT fail at build or
--    type-check time. useProfile.updateProfile spreads an arbitrary `updates`
--    object into .update(), so a missing grant surfaces as a silent runtime
--    failure when a real user hits Save.
GRANT UPDATE (
  -- Profile form — src/pages/Profile.tsx handleSubmit → useProfile.updateProfile
  first_name,
  last_name,
  country,          -- also written by Dashboard.tsx and PaymentSuccess.tsx,
                    -- which backfill it from the localStorage payment_country
  pronouns,
  age_range,
  region,           -- also written by useSurveySubmission.ts from the survey's
                    -- region answer
  -- Language toggle — src/hooks/useLanguage.ts persists the i18next language
  preferred_language,
  -- Email preferences switch — src/pages/Profile.tsx (saves immediately)
  email_reminders_enabled,
  -- GDPR consent stamps — src/components/CheckoutForm.tsx, recorded at checkout
  privacy_consent_at,
  terms_consent_at,
  -- Resume upload + "Remove resume" — src/components/resume/hooks/
  -- useResumeUpload.ts and useAIResumeUpload.ts write these; Profile.tsx nulls
  -- all five when the user removes their resume
  resume_data,
  resume_parsed_data,
  resume_uploaded_at,
  resume_full_data,
  resume_full_data_extracted_at,
  -- Set by hand on nearly every write above (there is no trigger maintaining
  -- it), so it has to be writable or those updates fail as a whole
  updated_at
) ON public.profiles TO authenticated;

-- Everything NOT listed above is now service-role-only for UPDATE, i.e. only
-- edge functions can change it:
--   comp_tool_unlocks         -- the comp grant; the whole point of this file
--   referral_code             -- minted by the ensure-referral-code function
--   stripe_promotion_code_id  -- set by the Stripe/payment functions
--   partner_id                -- set by the partner attribution functions
--   id, email, auth_provider, created_at
--                             -- identity and provenance; written once at
--                                signup (INSERT) and never legitimately updated
--                                from a browser afterwards
