# GDPR-Complete Account Deletion + Email-Login Redirect Fix

> **For agentic workers:** Execute task-by-task with spec + code-quality review between tasks.

**Goal:** (1) Make account deletion erase *all* personal data across every table (currently misses 7+ tables incl. survey `answers`), while retaining + anonymizing financial records for tax law. (2) Fix email/password login so new-vs-returning routing comes from the DB, not a stale localStorage flag.

**Architecture:**
- Deletion: a single SECURITY DEFINER Postgres RPC `delete_user_personal_data(uuid)` that does every table delete/anonymize in one transaction. The `delete-user-data` edge function becomes thin: verify JWT → call RPC → delete storage → delete auth user. Service-role-only execute grant (the function trusts its caller to pass a verified user id).
- Email redirect: replace `getPostAuthRedirect()` (localStorage `atlas_is_new_user`) in the login path with a DB `profiles` lookup, mirroring how `AuthConfirm.tsx` already resolves OAuth.

**Decisions (confirmed by Sjoerd 2026-05-29):**
- Financial data (`purchases`, `referrals`, `referral_payouts`): **retain + anonymize**, never hard-delete (NL 7-year bookkeeping retention; GDPR Art. 17(3)(b) exemption).
- Build via **Postgres RPC + thin edge function** (transactional, single source of truth).

**Tech Stack:** Postgres (Supabase), Deno edge function, React/TS frontend. Project ID `pcoyafgsirrznhmdaiji`.

---

## Table inventory (what holds this user's data)

**Hard delete (pure personal/behavioral):**
`answers` (via access_code_id), `enriched_jobs` (via report_id), `report_sections` (via report_id), `reports` (user_id), `chat_messages`, `saved_chat_responses`, `saved_jobs`, `user_job_searches`, `cover_letters`, `custom_resumes`, `content_feedback`, `support_requests`, `user_engagement_tracking` (all user_id), `n8n_chat_histories` (session_id ~ report_id / user_id), `profiles` (id), resume storage objects, auth user.

**Anonymize, retain (financial/legal):**
`purchases` (strip name/email/country, keep amount + stripe_session_id + access_code_id), `referrals` (scrub invitee identifiers when this user is the invitee), `access_codes` (null `user_id`; codes aren't PII and are referenced by retained purchases). `referral_payouts` untouched (pure financial, keyed by uuid).

FK notes: `answers→access_codes` and `enriched_jobs→reports` need explicit pre-deletion; `content_feedback→reports` is SET NULL so must be deleted by user_id; the rest CASCADE on `reports` delete but we delete explicitly by user_id anyway to catch null-report_id rows.

---

## Task 1: RPC migration `delete_user_personal_data`

**Files:**
- Create: `supabase/migrations/20260529120000_delete_user_personal_data.sql`

**Step 1:** Write the file:

```sql
-- GDPR Art. 17 complete erasure, done transactionally in one function.
-- Called by the delete-user-data edge function (service role) AFTER it has
-- verified the caller's JWT identity. The function trusts p_user_id to be the
-- verified caller; it is therefore granted to service_role ONLY (never anon /
-- authenticated, who could otherwise pass someone else's id).
--
-- Pure personal/behavioral data is hard-deleted. Financial records
-- (purchases, referrals, referral_payouts) are RETAINED for statutory
-- bookkeeping retention and instead anonymized, per GDPR Art. 17(3)(b).
CREATE OR REPLACE FUNCTION public.delete_user_personal_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email      text := lower(coalesce((SELECT email FROM auth.users WHERE id = p_user_id), ''));
  v_code_ids   uuid[];
  v_report_ids uuid[];
  v_anon_email text := 'deleted+' || replace(p_user_id::text, '-', '') || '@deleted.invalid';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT array_agg(id) INTO v_code_ids   FROM public.access_codes WHERE user_id = p_user_id;
  SELECT array_agg(id) INTO v_report_ids FROM public.reports      WHERE user_id = p_user_id;

  -- ---- Hard delete: pure personal data ----

  -- Survey answers are tied to the user's access codes (no user_id column).
  IF v_code_ids IS NOT NULL THEN
    DELETE FROM public.answers WHERE access_code_id = ANY(v_code_ids);
  END IF;

  -- Report-scoped job research (no cascade from reports).
  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.enriched_jobs WHERE report_id = ANY(v_report_ids);
  END IF;

  -- User-scoped behavioral tables. Several cascade on reports delete, but we
  -- delete explicitly by user_id to also catch rows with a null report_id.
  DELETE FROM public.chat_messages            WHERE user_id = p_user_id;
  DELETE FROM public.saved_chat_responses     WHERE user_id = p_user_id;
  DELETE FROM public.saved_jobs               WHERE user_id = p_user_id;
  DELETE FROM public.user_job_searches        WHERE user_id = p_user_id;
  DELETE FROM public.cover_letters            WHERE user_id = p_user_id;
  DELETE FROM public.custom_resumes           WHERE user_id = p_user_id;
  DELETE FROM public.content_feedback         WHERE user_id = p_user_id;  -- report_id FK is SET NULL, so must be explicit
  DELETE FROM public.support_requests         WHERE user_id = p_user_id;
  DELETE FROM public.user_engagement_tracking WHERE user_id = p_user_id;

  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.report_sections WHERE report_id = ANY(v_report_ids);
  END IF;
  DELETE FROM public.reports WHERE user_id = p_user_id;

  -- n8n LangChain chat memory: session_id is free text; in this app sessions
  -- are keyed by report id (and historically user id). Best-effort match.
  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.n8n_chat_histories
     WHERE session_id = ANY (SELECT (unnest(v_report_ids))::text)
        OR session_id = p_user_id::text;
  ELSE
    DELETE FROM public.n8n_chat_histories WHERE session_id = p_user_id::text;
  END IF;

  -- ---- Anonymize: financial / legal-retention data ----

  IF v_code_ids IS NOT NULL THEN
    UPDATE public.purchases
       SET first_name = '[deleted]', last_name = '[deleted]', country = NULL, email = v_anon_email
     WHERE access_code_id = ANY(v_code_ids);
  END IF;
  IF v_email <> '' THEN
    UPDATE public.purchases
       SET first_name = '[deleted]', last_name = '[deleted]', country = NULL, email = v_anon_email
     WHERE lower(email) = v_email;
  END IF;

  -- This user as an invitee: scrub their identifiers, keep the financial row
  -- for the referrer's payout record.
  UPDATE public.referrals
     SET invitee_user_id = NULL, invitee_email = v_anon_email
   WHERE invitee_user_id = p_user_id;

  -- De-link access codes (not PII; referenced by retained purchase rows).
  UPDATE public.access_codes SET user_id = NULL WHERE user_id = p_user_id;

  -- Profile last (within public schema). Auth user + storage handled by caller.
  DELETE FROM public.profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'email_anonymized_to', v_anon_email,
    'access_codes_unlinked', coalesce(array_length(v_code_ids, 1), 0),
    'reports_deleted', coalesce(array_length(v_report_ids, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_personal_data(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_user_personal_data(uuid) IS
  'GDPR erasure: hard-deletes personal data, anonymizes retained financial rows. Service-role only; caller must verify identity first.';
```

**Step 2:** Apply via `apply_migration` (project `pcoyafgsirrznhmdaiji`, name `delete_user_personal_data`).

**Step 3:** Verify ACL is service_role-only (no anon/authenticated/PUBLIC):
`SELECT proacl FROM pg_proc WHERE proname = 'delete_user_personal_data';`

**Step 4: Synthetic test (the important one).** Create a throwaway auth user, seed one row in several covered tables, run the RPC, assert all hard-delete tables are empty and purchases is anonymized, then clean up the throwaway. Use service-role MCP `execute_sql`. The test must prove `answers`, `content_feedback`, `support_requests`, and at least one report-child are gone, and `purchases.email` is anonymized while the row still exists. If any assertion fails, STOP / report BLOCKED.

**Step 5:** Commit ONLY the migration file.

## Task 2: Thin out the `delete-user-data` edge function

**Files:**
- Modify: `supabase/functions/delete-user-data/index.ts`

Replace the body of per-table `.delete()` calls (steps 1-6 in the current file) with a single RPC call. Keep: JWT identity verification (unchanged), then RPC, then storage deletion, then `auth.admin.deleteUser`. Order: **RPC first; if it errors, return 500 and DO NOT delete the auth user** (so the user can retry; the RPC is idempotent). Storage deletion stays best-effort. Keep the partial-error response shape.

New core (between identity verification and the final response):

```typescript
    // Delete all personal data + anonymize financial records, transactionally.
    const { error: rpcError } = await supabase.rpc('delete_user_personal_data', {
      p_user_id: userId,
    });
    if (rpcError) {
      console.error(`[delete-user-data] RPC failed for ${userId}:`, rpcError);
      // Abort before deleting the auth user so the user can retry (RPC is idempotent).
      return errorResponse('Failed to delete account data. Please contact support.', 500, corsHeaders);
    }

    const errors: string[] = [];

    // Delete resume files from storage (best-effort).
    try {
      const { data: files } = await supabase.storage.from('resumes').list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from('resumes').remove(files.map(f => `${userId}/${f.name}`));
      }
    } catch (storageError) {
      errors.push(`storage: ${String(storageError)}`);
    }

    // Delete the auth user (also clears auth-schema sessions/identities).
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) errors.push(`auth: ${authDeleteError.message}`);
```

Keep the existing `if (errors.length > 0) { ...partial... }` and success responses below this. Remove the now-dead per-table delete blocks and the `reports` lookup. Deploy via `deploy_edge_function` (allowed: re-deploying existing function is needed for this feature; present is fine since user approved the GDPR work). Save the new file to repo + commit.

## Task 3: Email-login DB-based redirect

**Files:**
- Modify: `src/components/auth/EmailPasswordForm.tsx`

In the LOGIN success block (after the entitlement check that already exists), replace:

```typescript
          localStorage.setItem('atlas_auth_method', 'email');
          toast({
            title: t('toasts.welcomeBack'),
            description: t('toasts.loggedInSuccess'),
          });
          // ensureProfile may have set the new-user flag via onAuthStateChange
          // Give it a tick to run, then consume the flag
          await new Promise(r => setTimeout(r, 100));
          navigate(getPostAuthRedirect());
```

with:

```typescript
          localStorage.setItem('atlas_auth_method', 'email');
          toast({
            title: t('toasts.welcomeBack'),
            description: t('toasts.loggedInSuccess'),
          });
          // Resolve destination from the DB (not the localStorage new-user flag,
          // which could be stale across accounts on a shared browser). A returning
          // user with a profile goes to the dashboard; the rare profile-less case
          // falls through to /payment, matching the OAuth path in AuthConfirm.
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle();
          navigate(profileRow ? '/dashboard' : '/payment');
```

If `getPostAuthRedirect` is now unused, leave the import out (remove it from the import line). Do not modify `useAuth.tsx`. Build to verify. Commit.

## Task 4: Verify + ship

- `npm run build` clean.
- Manual: email-login as a returning user lands on /dashboard (not /payment) even with a stale `atlas_is_new_user` in localStorage.
- Push to main (auto-deploys frontend). Edge function already deployed in Task 2.

## Out of scope / follow-ups (flag, don't do here)
- `export-user-data` has the same blind spot (won't export answers/saved_jobs/etc.) — Art. 15/20 gap, fix next if wanted.
- Clean up existing orphaned `answers` from prior manual test deletions.
- Natasha report reset (`c725e198…`) still pending from earlier conversation.
