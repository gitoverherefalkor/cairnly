-- Close the delete-and-reinsert path to the referral-gated paid tools.
--
-- WHAT WAS STILL OPEN AFTER THE UPDATE LOCK
-- -----------------------------------------
-- 20260916110000_lock_profiles_columns.sql narrowed UPDATE on `profiles` to a
-- 16-column allowlist, so `comp_tool_unlocks`, `partner_id`, `referral_code`
-- and `stripe_promotion_code_id` can no longer be changed from the browser.
--
-- That fixed the obvious door and left the back one open. `authenticated`
-- still held a blanket table-level INSERT grant plus an unrestricted DELETE
-- grant, and the two matching row policies are both permissive:
--
--     "Users can insert their own profile"  INSERT  WITH CHECK (auth.uid() = id)
--     "Users can delete own profile"        DELETE  USING      (auth.uid() = id)
--
-- Neither scopes columns (a policy cannot: USING/WITH_CHECK is a row
-- predicate). So the escalation survived as a two-step instead of a one-liner:
--
--     await supabase.from('profiles').delete().eq('id', me)
--     await supabase.from('profiles').insert({ id: me, email: '...',
--                                              comp_tool_unlocks: 3 })
--
-- Throw the row away, put it back with the comp set. Same three paid tools
-- (job search, tailored resume, cover letters), same devtools console, one
-- extra line. This was confirmed against the live database, not reasoned
-- about: a probe as `authenticated` cleared both the grant check and the
-- policy check and failed only on profiles_id_fkey, which a real user's own
-- id satisfies by definition.
--
-- The delete half costs the attacker almost nothing. Nothing in the schema
-- foreign-keys to `profiles` (reports, answers, saved_jobs and friends all key
-- on auth.users), so the cascade takes out only their own profile fields, and
-- the app repopulates most of them: the survey rewrites `region`, the payment
-- flow rewrites `country`, the language toggle rewrites `preferred_language`,
-- and a re-upload rewrites the resume columns. A referral_code minted before
-- the delete is the one thing genuinely lost, and the ensure-referral-code
-- function just mints a new one.
--
-- HALF 1: MIRROR THE COLUMN LOCK ONTO INSERT
-- ------------------------------------------
-- Same mechanism as the UPDATE lock, for the same reason: column-level GRANTs
-- are what Postgres gives you for column scoping, and they compose with RLS
-- rather than replacing it. A write must satisfy BOTH the grant (may this role
-- write this column?) and the policy (may this role touch this row?).
--
-- Revoking the table-level grant first is what makes this default-deny: a
-- column added next year is service-role-only on INSERT until a human
-- deliberately adds it to the list below.
--
-- The allowlist is the 16 UPDATE-able columns PLUS id, email, auth_provider
-- and created_at. Those four are deliberately NOT update-able (identity and
-- provenance, written once and never legitimately changed from a browser) but
-- must be insertable, because writing them once is exactly what signup does.
--
-- SIGNUP IS THE THING THIS MUST NOT BREAK
-- ---------------------------------------
-- There are two paths that create a profile row, and only one of them is
-- affected by these grants:
--
--   1. public.handle_new_user(), the SECURITY DEFINER trigger on
--      auth.users AFTER INSERT. Owned by `postgres`, which owns `profiles`,
--      and `profiles` is not FORCE ROW LEVEL SECURITY — so it bypasses both
--      RLS and these column grants entirely. Untouched by this migration.
--
--   2. useAuth.ensureProfile() in the browser (src/hooks/useAuth.tsx), the
--      belt-and-braces INSERT that runs on first login if no row exists. This
--      one runs as `authenticated` and IS governed by the grant below.
--
-- Both write the same eight columns: id, email, first_name, last_name,
-- auth_provider, preferred_language, created_at, updated_at. All eight appear
-- in the GRANT below. Verified by re-auditing every `.from('profiles')` call
-- site in src/ (18 of them) — ensureProfile is the ONLY browser INSERT on this
-- table, and there is no browser INSERT that touches any of the four
-- service-role-only columns.
--
-- A missing column here would NOT fail at build or type-check time. It would
-- surface as a broken signup for every new user, in production, silently.

-- 1. Drop the blanket grant that implies "every column, forever".
REVOKE INSERT ON public.profiles FROM authenticated;

-- 2. Re-grant exactly the columns a browser may legitimately write at INSERT.
GRANT INSERT (
  -- The eight columns useAuth.ensureProfile() actually writes at signup.
  -- These are load-bearing: remove one and new accounts break.
  id,
  email,
  first_name,
  last_name,
  auth_provider,
  preferred_language,
  created_at,
  updated_at,
  -- The remaining UPDATE-able columns. No browser INSERT sets these today
  -- (only ensureProfile inserts, with the eight above), but they are all
  -- columns the user is already allowed to write via UPDATE, so withholding
  -- them on INSERT would buy no security and would only create a confusing
  -- asymmetry for a future upsert.
  country,
  pronouns,
  age_range,
  region,
  email_reminders_enabled,
  privacy_consent_at,
  terms_consent_at,
  resume_data,
  resume_parsed_data,
  resume_uploaded_at,
  resume_full_data,
  resume_full_data_extracted_at
) ON public.profiles TO authenticated;

-- Deliberately NOT granted, i.e. now service-role-only for INSERT as well as
-- UPDATE. These four are the entire point of this migration:
--   comp_tool_unlocks         -- the comp grant; self-granting it was the hole
--   partner_id                -- self-attribution to a white-label partner
--   referral_code             -- claiming someone else's invite code
--   stripe_promotion_code_id  -- attaching yourself to a Stripe promotion

-- HALF 2: REMOVE THE DELETE PATH ENTIRELY
-- ---------------------------------------
-- The browser never deletes a profile row. Account deletion (Profile.tsx
-- handleDeleteAccount) invokes the `delete-user-data` edge function, which
-- calls the delete_user_personal_data(uuid) RPC with the SERVICE ROLE key.
-- That RPC is SECURITY DEFINER owned by `postgres`, so it is exempt from RLS
-- twice over (definer + table owner + no FORCE ROW LEVEL SECURITY) and does
-- its own `DELETE FROM public.profiles WHERE id = p_user_id`. Dropping a
-- policy that only ever gated the `authenticated` role cannot reach it.
--
-- Verified before dropping: zero `.from('profiles').delete(` call sites
-- anywhere in src/. The policy has no legitimate user.
DROP POLICY "Users can delete own profile" ON public.profiles;

-- And take the grant too, not just the policy.
--
-- Dropping the policy alone is sufficient TODAY: RLS is enabled on `profiles`,
-- there is no other DELETE policy, and with no permissive policy for a command
-- RLS denies it. But that leaves a loaded gun on the table — the day anyone
-- adds any DELETE policy for any reason, the unrestricted grant underneath it
-- makes this hole live again instantly, with no second check to catch it.
-- Belt and braces, and reversible with a one-line GRANT if a real need appears.
REVOKE DELETE ON public.profiles FROM authenticated;

-- NOT TOUCHED, ON PURPOSE
-- -----------------------
-- SELECT stays as it is. useReferralStatus.ts legitimately READS
-- comp_tool_unlocks to decide whether to show the tools as unlocked; revoking
-- it would break the gate for every comped user.
--
-- `anon` keeps its table-level INSERT/UPDATE/DELETE grants, exactly as the
-- UPDATE lock left them. All four policies on this table are declared TO
-- public rather than TO authenticated, so they apply to `anon` too — and for
-- an anonymous request auth.uid() is NULL, so `auth.uid() = id` evaluates to
-- NULL, the policy matches zero rows, and every one of those grants is
-- unreachable. Narrowing them would be noise, not a second door closed.
