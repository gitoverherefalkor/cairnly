# Block Unentitled OAuth Sign-Ins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent users without a Cairnly purchase or product activity from signing in (via Google, LinkedIn, or email/password) and landing on a dead-end dashboard or access-code page. Unentitled users get signed out and bounced to `/` with a clear banner.

**Architecture:** A single Postgres RPC (`link_and_check_entitlement`) runs with SECURITY DEFINER and (1) auto-links any access codes whose `purchases.email` matches the signed-in user's auth email, then (2) returns whether the user is entitled. Called from `AuthConfirm.tsx` (OAuth) and `EmailPasswordForm.tsx` (email/password). Unentitled users are signed out and redirected to `/?signed_out=no_purchase&email=...`, which the landing page reads to render a banner.

**Tech Stack:** Postgres / PL/pgSQL (SECURITY DEFINER RPC), Supabase JS SDK, React 18 + TypeScript, react-router-dom v6.

**Project:** Atlas Assessments / Cairnly. Supabase project ID `pcoyafgsirrznhmdaiji`.

---

## Pre-flight safety check (already done, recorded for the audit trail)

The new rule lets a user in if ANY of these is true:
1. `access_codes.user_id = auth.uid()` (redeemed a code)
2. `lower(purchases.email) = lower(auth.email())` (paid, code maybe not yet redeemed)
3. `reports.user_id = auth.uid()` (completed an assessment — grandfather)
4. `chat_messages.user_id = auth.uid()` (used the AI coach — grandfather)
5. `saved_jobs.user_id = auth.uid()` (used job search — grandfather)
6. `saved_chat_responses.user_id = auth.uid()` (saved coach responses — grandfather)

SQL run on prod (`pcoyafgsirrznhmdaiji`):

```sql
WITH entitled AS (
  SELECT u.id FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.access_codes        ac WHERE ac.user_id = u.id)
     OR EXISTS (SELECT 1 FROM public.purchases           pu WHERE lower(pu.email) = lower(u.email))
     OR EXISTS (SELECT 1 FROM public.reports             r  WHERE r.user_id  = u.id)
     OR EXISTS (SELECT 1 FROM public.chat_messages       cm WHERE cm.user_id = u.id)
     OR EXISTS (SELECT 1 FROM public.saved_jobs          sj WHERE sj.user_id = u.id)
     OR EXISTS (SELECT 1 FROM public.saved_chat_responses sc WHERE sc.user_id = u.id)
)
SELECT (SELECT count(*) FROM auth.users) AS total,
       (SELECT count(*) FROM entitled) AS entitled,
       (SELECT count(*) FROM auth.users) - (SELECT count(*) FROM entitled) AS blocked;
```

Result: `total=15, entitled=15, blocked=0`. **Zero existing users will be locked out.**

> If you re-run this just before deploying and `blocked > 0`, STOP and investigate the new user(s) before continuing.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260526120000_link_and_check_entitlement.sql` | Create | Postgres RPC: auto-link purchases by email + entitlement check |
| `src/integrations/supabase/types.ts` | Regenerate | Pick up the new RPC in TypeScript types |
| `src/lib/entitlement.ts` | Create | Typed client wrapper around the RPC + redirect helper |
| `src/pages/AuthConfirm.tsx` | Modify | Call entitlement check on OAuth/magic-link success, sign out + redirect if not entitled |
| `src/components/auth/EmailPasswordForm.tsx` | Modify | Call entitlement check after email/password sign-in (login path only — signup already requires a code) |
| `src/components/landing/NoPurchaseBanner.tsx` | Create | Banner shown on `/` when `?signed_out=no_purchase` is set |
| `src/pages/Index.tsx` | Modify | Mount the banner above the hero when the param is present |

We are NOT touching:
- `supabase/functions/auth-callback/index.ts` — runs before session is even returned to the client; entitlement is checked client-side AFTER the session is established (so the user is still authenticated for the brief moment we need to read their email & uid). Doing it server-side here would require a much bigger refactor of the redirect contract.
- `supabase/functions/signup-with-access-code/index.ts` — already enforces an access code at signup, so this path can't produce an unentitled user.
- `src/pages/Dashboard.tsx` — Dashboard is downstream of the auth pages; once the auth pages enforce entitlement, the dashboard never sees an unentitled user.

---

## Task 1: Create the RPC migration

**Files:**
- Create: `supabase/migrations/20260526120000_link_and_check_entitlement.sql`

- [ ] **Step 1: Create the migration file**

Write this file exactly:

```sql
-- Block unentitled OAuth sign-ins.
--
-- After a user authenticates we call this RPC. It does two things in a single
-- round-trip:
--   1. Auto-link any unbound access_codes whose linked purchases.email matches
--      the signed-in user's auth email. This rescues the common "paid via
--      Stripe, then signed in with the same email via Google" case where the
--      old flow required manually entering the code.
--   2. Return whether the user is entitled to use the product. A user is
--      entitled if they own a bound access code, a matching purchase email,
--      or any prior product activity (report / chat / saved job / saved
--      response). The activity clauses grandfather existing users whose
--      codes were never bound (e.g., beta testers, manually-issued codes).
--
-- SECURITY DEFINER so the function can read purchases by email even when the
-- caller's RLS would not allow it (purchases is keyed by email, not user_id).
-- All reads/writes are scoped to the caller's auth.uid() / auth.email().

CREATE OR REPLACE FUNCTION public.link_and_check_entitlement()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_linked_count int := 0;
  v_entitled boolean := false;
BEGIN
  -- No session → not entitled. Defensive; the client only calls this when
  -- it already has a session.
  IF v_user_id IS NULL OR v_user_email = '' THEN
    RETURN jsonb_build_object('entitled', false, 'linked_codes', 0);
  END IF;

  -- (1) Auto-link any access_codes that belong to a purchase made with the
  --     same email but aren't bound to any user yet. Only touches unbound
  --     codes — never re-assigns a code already owned by another user.
  WITH to_link AS (
    SELECT ac.id
    FROM public.access_codes ac
    JOIN public.purchases pu ON pu.access_code_id = ac.id
    WHERE ac.user_id IS NULL
      AND lower(pu.email) = v_user_email
  )
  UPDATE public.access_codes ac
     SET user_id = v_user_id
    FROM to_link
   WHERE ac.id = to_link.id
     AND ac.user_id IS NULL;  -- belt + suspenders against a race
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- (2) Entitlement check across all signals.
  SELECT
    EXISTS (SELECT 1 FROM public.access_codes        ac WHERE ac.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.purchases           pu WHERE lower(pu.email) = v_user_email)
    OR EXISTS (SELECT 1 FROM public.reports             r  WHERE r.user_id  = v_user_id)
    OR EXISTS (SELECT 1 FROM public.chat_messages       cm WHERE cm.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.saved_jobs          sj WHERE sj.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.saved_chat_responses sc WHERE sc.user_id = v_user_id)
  INTO v_entitled;

  RETURN jsonb_build_object('entitled', v_entitled, 'linked_codes', v_linked_count);
END;
$$;

-- Lock the function down. SECURITY DEFINER + revoke from PUBLIC + grant to
-- authenticated only. Anon callers (no session) would get NULL auth.uid()
-- anyway, but this is explicit.
REVOKE ALL ON FUNCTION public.link_and_check_entitlement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_and_check_entitlement() TO authenticated;

COMMENT ON FUNCTION public.link_and_check_entitlement() IS
  'Called after sign-in. Auto-links unbound purchases to the signed-in user and returns {entitled: bool, linked_codes: int}.';
```

- [ ] **Step 2: Apply the migration to Supabase**

Use the Supabase MCP `apply_migration` tool (allowed without per-command approval per CLAUDE.md, because the SQL is now version-controlled in a file).

```
Tool: mcp__plugin_supabase_supabase__apply_migration
project_id: pcoyafgsirrznhmdaiji
name: link_and_check_entitlement
query: <contents of the SQL file above>
```

- [ ] **Step 3: Verify the RPC exists and returns the expected shape**

```sql
-- Run via execute_sql. As an authenticated test, run as service role to
-- inspect the function definition itself (we cannot impersonate a real user
-- from the MCP).
SELECT pg_get_functiondef('public.link_and_check_entitlement'::regproc);
```

Expected: returns the function body we just created.

- [ ] **Step 4: Verify entitlement for one known-good user (Sjoerd)**

```sql
-- Smoke test the entitlement logic for the project owner. Replace email if
-- different. This bypasses auth.uid() so we set it manually.
DO $$
DECLARE
  v_id uuid;
  v_email text;
  v_entitled boolean;
BEGIN
  SELECT id, lower(email) INTO v_id, v_email FROM auth.users
   WHERE email ILIKE 'sjoerd@%' LIMIT 1;

  SELECT
    EXISTS (SELECT 1 FROM public.access_codes ac WHERE ac.user_id = v_id)
    OR EXISTS (SELECT 1 FROM public.purchases pu WHERE lower(pu.email) = v_email)
    OR EXISTS (SELECT 1 FROM public.reports r WHERE r.user_id = v_id)
    OR EXISTS (SELECT 1 FROM public.chat_messages cm WHERE cm.user_id = v_id)
    OR EXISTS (SELECT 1 FROM public.saved_jobs sj WHERE sj.user_id = v_id)
    OR EXISTS (SELECT 1 FROM public.saved_chat_responses sc WHERE sc.user_id = v_id)
  INTO v_entitled;

  RAISE NOTICE 'Sjoerd entitled=%', v_entitled;
END $$;
```

Expected: `NOTICE: Sjoerd entitled=t`. If `f`, STOP — the rule has a bug.

- [ ] **Step 5: Commit the migration file**

```bash
git add supabase/migrations/20260526120000_link_and_check_entitlement.sql
git commit -m "feat(auth): add link_and_check_entitlement RPC for OAuth entitlement gate"
```

---

## Task 2: Regenerate TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Regenerate types via MCP**

```
Tool: mcp__plugin_supabase_supabase__generate_typescript_types
project_id: pcoyafgsirrznhmdaiji
```

Write the returned string to `src/integrations/supabase/types.ts`.

- [ ] **Step 2: Sanity check the diff**

```bash
git diff src/integrations/supabase/types.ts | head -50
```

Expected: a new `link_and_check_entitlement` entry under `Functions` returning `Json` (or the equivalent). No unrelated changes.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): regenerate supabase types for link_and_check_entitlement RPC"
```

---

## Task 3: Create the entitlement client helper

**Files:**
- Create: `src/lib/entitlement.ts`

- [ ] **Step 1: Create the helper file**

```typescript
import { supabase } from '@/integrations/supabase/client';

export interface EntitlementResult {
  entitled: boolean;
  linkedCodes: number;
}

/**
 * Calls the link_and_check_entitlement RPC. This both auto-links any unbound
 * purchases to the current user (by email match) AND tells us whether the
 * user is entitled to use the product.
 *
 * Returns `{ entitled: false, linkedCodes: 0 }` on any error so the caller
 * treats it as "block" — failing open would re-introduce the bug.
 */
export async function checkEntitlement(): Promise<EntitlementResult> {
  try {
    const { data, error } = await supabase.rpc('link_and_check_entitlement');
    if (error) {
      console.error('Entitlement check failed:', error);
      return { entitled: false, linkedCodes: 0 };
    }
    // The RPC returns jsonb: { entitled: boolean, linked_codes: number }
    const payload = (data ?? {}) as { entitled?: boolean; linked_codes?: number };
    return {
      entitled: payload.entitled === true,
      linkedCodes: typeof payload.linked_codes === 'number' ? payload.linked_codes : 0,
    };
  } catch (err) {
    console.error('Entitlement check threw:', err);
    return { entitled: false, linkedCodes: 0 };
  }
}

/**
 * Signs the user out and routes them to the landing page with a banner
 * explaining why. The email is shown in the banner so users with multiple
 * Google/LinkedIn accounts can spot that they signed in with the wrong one.
 */
export async function signOutNoPurchase(email: string | null | undefined): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    // Even if sign-out somehow fails, force-clear the local session marker
    // so the next render shows the unauthenticated UI.
    console.error('Sign-out during entitlement block failed:', err);
  }
  const params = new URLSearchParams({ signed_out: 'no_purchase' });
  if (email) params.set('email', email);
  // Hard navigation so any in-memory auth state is fully reset.
  window.location.href = `/?${params.toString()}`;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && npm run build 2>&1 | tail -20
```

Expected: build succeeds. If the RPC isn't in the regenerated types yet (Task 2), TypeScript will yell about `'link_and_check_entitlement'` not being a known function — finish Task 2 first.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entitlement.ts
git commit -m "feat(auth): add entitlement check helper for post-signin gate"
```

---

## Task 4: Wire the OAuth path in AuthConfirm.tsx

**Files:**
- Modify: `src/pages/AuthConfirm.tsx` (the three success branches that currently call `resolvePostAuthRedirect`)

- [ ] **Step 1: Add the import at the top**

In `src/pages/AuthConfirm.tsx`, just after the existing imports (around line 8):

```typescript
import { checkEntitlement, signOutNoPurchase } from '@/lib/entitlement';
```

- [ ] **Step 2: Replace the helper function**

Replace the existing `resolvePostAuthRedirect` (lines 13-20) with this version that consults the entitlement RPC:

```typescript
// Decide where to send the user after a successful auth handshake.
// Returns null if the caller has already signed the user out (not entitled).
async function resolvePostAuthRedirect(userId: string, userEmail: string | null | undefined): Promise<string | null> {
  const { entitled } = await checkEntitlement();
  if (!entitled) {
    await signOutNoPurchase(userEmail);
    return null;
  }
  // Entitled — keep existing behavior: new vs returning is based on whether a
  // profile row exists. (The profile trigger runs synchronously on auth user
  // insert, so by this point a profile always exists; returning users hit
  // /dashboard.)
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return data ? '/dashboard' : '/payment';
}
```

- [ ] **Step 3: Update the three callers in AuthConfirm to pass the email and bail if null**

There are three places that call `resolvePostAuthRedirect`. Update each.

**Caller 1 (Edge Function session branch, around line 65):**

Old:
```typescript
const dest = await resolvePostAuthRedirect(sessionData.user?.id);
setTimeout(() => {
  window.location.href = dest;
}, 1000);
return;
```

New:
```typescript
const dest = await resolvePostAuthRedirect(sessionData.user?.id, sessionData.user?.email);
if (dest === null) return; // signOutNoPurchase already navigated away
setTimeout(() => {
  window.location.href = dest;
}, 1000);
return;
```

**Caller 2 (OAuth implicit-flow branch, around line 127):**

Old:
```typescript
const dest = await resolvePostAuthRedirect(user.id);
setTimeout(() => {
  window.location.href = dest;
}, 1000);
return;
```

New:
```typescript
const dest = await resolvePostAuthRedirect(user.id, user.email);
if (dest === null) return;
setTimeout(() => {
  window.location.href = dest;
}, 1000);
return;
```

**Caller 3 (already-logged-in fallback, around line 159):**

Old:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const dest = await resolvePostAuthRedirect(session.user.id);
  navigate(dest);
  return;
}
```

New:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const dest = await resolvePostAuthRedirect(session.user.id, session.user.email);
  if (dest === null) return;
  navigate(dest);
  return;
}
```

**Caller 4 (email confirmation success, around line 194):**

Old:
```typescript
const dest = await resolvePostAuthRedirect(data.user.id);
setTimeout(() => {
  navigate(dest);
}, 2000);
```

New:
```typescript
const dest = await resolvePostAuthRedirect(data.user.id, data.user.email);
if (dest === null) return;
setTimeout(() => {
  navigate(dest);
}, 2000);
```

- [ ] **Step 4: Build to verify**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && npm run build 2>&1 | tail -20
```

Expected: builds with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AuthConfirm.tsx
git commit -m "feat(auth): gate OAuth and magic-link sign-in on entitlement"
```

---

## Task 5: Wire the email/password sign-in path in EmailPasswordForm.tsx

The signup path already requires an access code (line 126-129), so this only touches the login path.

**Files:**
- Modify: `src/components/auth/EmailPasswordForm.tsx`

- [ ] **Step 1: Add the import**

Just after the existing imports (around line 10), add:

```typescript
import { checkEntitlement, signOutNoPurchase } from '@/lib/entitlement';
```

- [ ] **Step 2: Gate the login navigate**

Replace the existing login-success block (around lines 103-113):

Old:
```typescript
if (data.user) {
  localStorage.setItem('atlas_auth_method', 'email');
  toast({
    title: t('toasts.welcomeBack'),
    description: t('toasts.loggedInSuccess'),
  });
  // ensureProfile may have set the new-user flag via onAuthStateChange
  // Give it a tick to run, then consume the flag
  await new Promise(r => setTimeout(r, 100));
  navigate(getPostAuthRedirect());
}
```

New:
```typescript
if (data.user) {
  // Entitlement gate: if this user has no purchase / no product activity,
  // sign them back out and bounce to the landing page with a banner.
  const { entitled } = await checkEntitlement();
  if (!entitled) {
    await signOutNoPurchase(data.user.email);
    return;
  }

  localStorage.setItem('atlas_auth_method', 'email');
  toast({
    title: t('toasts.welcomeBack'),
    description: t('toasts.loggedInSuccess'),
  });
  // ensureProfile may have set the new-user flag via onAuthStateChange
  // Give it a tick to run, then consume the flag
  await new Promise(r => setTimeout(r, 100));
  navigate(getPostAuthRedirect());
}
```

- [ ] **Step 3: Build to verify**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && npm run build 2>&1 | tail -20
```

Expected: builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/EmailPasswordForm.tsx
git commit -m "feat(auth): gate email/password sign-in on entitlement"
```

---

## Task 6: Create the no-purchase banner

**Files:**
- Create: `src/components/landing/NoPurchaseBanner.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

/**
 * Shown above the landing hero when a user was just bounced from sign-in
 * because their account has no purchase or product activity. Reads
 * ?signed_out=no_purchase&email=... from the URL.
 *
 * Renders nothing if the param is absent.
 */
const NoPurchaseBanner: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_out') === 'no_purchase') {
      setEmail(params.get('email'));
    }
  }, []);

  if (dismissed || email === null) return null;

  return (
    <div
      role="status"
      className="w-full px-4 py-3 text-sm"
      style={{ background: '#FFF6D6', borderBottom: '1px solid rgba(201,182,144,0.6)', color: '#122E3B' }}
    >
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold mb-1">No Cairnly purchase found{email ? ` for ${email}` : ''}.</p>
          <p>
            If you used a different email or Google account at checkout, please sign in with that one instead.
            Otherwise, get your assessment below.{' '}
            <button
              type="button"
              onClick={() => navigate('/payment')}
              className="font-semibold underline hover:no-underline"
              style={{ color: '#1F8282' }}
            >
              Buy access
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-1 rounded hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default NoPurchaseBanner;
```

> Copy is em-dash free, per global writing-style preference.

- [ ] **Step 2: Mount it on Index.tsx**

In `src/pages/Index.tsx`, add the import after the other landing imports:

```typescript
import NoPurchaseBanner from '@/components/landing/NoPurchaseBanner';
```

Then place the banner just inside the outer div, before `<LandingNav>`:

Old (lines 23-29):
```tsx
const Index: React.FC = () => (
  <div
    className="min-h-screen font-sans overflow-x-clip"
    style={{ background: '#F4ECDA', color: '#122E3B' }}
  >
    <LandingNav variant="home" />
    <main>
```

New:
```tsx
const Index: React.FC = () => (
  <div
    className="min-h-screen font-sans overflow-x-clip"
    style={{ background: '#F4ECDA', color: '#122E3B' }}
  >
    <NoPurchaseBanner />
    <LandingNav variant="home" />
    <main>
```

- [ ] **Step 3: Build to verify**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && npm run build 2>&1 | tail -20
```

Expected: builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/NoPurchaseBanner.tsx src/pages/Index.tsx
git commit -m "feat(landing): no-purchase banner for users bounced from sign-in"
```

---

## Task 7: Manual verification matrix

This is the "no surprises" task. Do every row before pushing to main. Use a private/incognito window so localStorage is clean.

**Files:**
- None (manual testing in browser)

- [ ] **Step 1: Run dev server**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && npm run dev
```

Open the local URL printed in the terminal.

- [ ] **Step 2: Test matrix — go through every row**

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 1 | **Existing paying user (Sjoerd) signs in with Google** | Use sjoerd@falkoratlas.com or your paid Google account. | Lands on `/dashboard`. |
| 2 | **Brand-new Google account signs in (no purchase)** | Use a Google account that has never been seen. | Sees the no-purchase banner on `/`. The email shown matches the Google account. |
| 3 | **Brand-new LinkedIn account signs in (no purchase)** | Same as #2 but via LinkedIn button. | Same as #2. |
| 4 | **Paid via Stripe, first time signing in with that email via Google** | Buy a test code first (or pick an existing `purchases.email` and sign in with a matching Google account). | Lands on `/dashboard`. Verify in Supabase: the `access_codes` row matching that purchase now has `user_id` set (auto-link worked). SQL: `SELECT user_id FROM access_codes WHERE id = '<the code id>';` |
| 5 | **Existing user signs in with email/password** | Existing paying email/password user. | Lands on `/dashboard`. No banner. |
| 6 | **Email/password signup with valid access code (the canonical happy path)** | Buy → land on PaymentSuccess → click signup → fill form → submit. | Account created, lands on `/dashboard`. |
| 7 | **Banner dismiss button** | After scenario 2, click the X on the banner. | Banner disappears; refreshing brings it back (URL still has the param). Acceptable. |
| 8 | **Direct visit to `/?signed_out=no_purchase&email=foo@bar.com`** | Paste URL. | Banner renders with `foo@bar.com`. |
| 9 | **Visit `/` with no param** | Plain `/`. | No banner. |
| 10 | **Natasha-style grandfather** | Sign in as `tasha.geurts@mews.com` via LinkedIn. | Lands on `/dashboard`, NO bounce. (She has 1 report → grandfathered.) Only do this if you can actually authenticate as her, otherwise just verify she would not be blocked via SQL: `SELECT (link_and_check_entitlement()) FROM auth.users WHERE email = 'tasha.geurts@mews.com';` — except RPC needs auth.uid(), so use the inline-EXISTS query from the pre-flight section instead. |
| 11 | **Already-signed-in user revisits `/auth/confirm`** | Open `/auth/confirm` directly while signed in as an entitled user. | Redirects to `/dashboard`. |
| 12 | **Already-signed-in unentitled user revisits `/auth/confirm`** | This requires manually creating an unentitled test session. Skip if no convenient way to set up — covered indirectly by #2 / #3. | Should sign out + bounce to `/` with banner. |

If any row fails, do not proceed to Step 3 — diagnose and fix.

- [ ] **Step 3: Cross-reference the prod DB once more after testing**

```sql
SELECT count(*) FROM auth.users u
WHERE NOT (
     EXISTS (SELECT 1 FROM public.access_codes        ac WHERE ac.user_id = u.id)
  OR EXISTS (SELECT 1 FROM public.purchases           pu WHERE lower(pu.email) = lower(u.email))
  OR EXISTS (SELECT 1 FROM public.reports             r  WHERE r.user_id  = u.id)
  OR EXISTS (SELECT 1 FROM public.chat_messages       cm WHERE cm.user_id = u.id)
  OR EXISTS (SELECT 1 FROM public.saved_jobs          sj WHERE sj.user_id = u.id)
  OR EXISTS (SELECT 1 FROM public.saved_chat_responses sc WHERE sc.user_id = u.id)
);
```

Expected: `0`. If your testing in scenario #2 added a new "test" Google user, you'll see `1` here — that's fine, just delete the test user from auth.users after the rollout: `DELETE FROM auth.users WHERE id = '<test-user-id>';` (CASCADE will remove the profile row).

---

## Task 8: Push to main

Per project memory: commit straight to main, the GitHub → Vercel integration auto-deploys.

- [ ] **Step 1: Final status check**

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly" && git status && git log --oneline -8
```

Expected: clean working tree, the 6 commits from this plan visible.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Smoke-test prod after Vercel deploys (~2 min)**

Repeat verification matrix rows #1 and #2 on the live site.

---

## Self-Review

**Spec coverage**

| Spec requirement (from the conversation) | Implemented in |
|---|---|
| Unentitled OAuth sign-in is blocked | Task 4 (AuthConfirm.tsx) |
| Unentitled email/password sign-in is blocked | Task 5 (EmailPasswordForm.tsx) |
| Email/password signup unaffected | Confirmed in File Structure note + Task 7 row #6 |
| Paid-but-not-redeemed users let in | Task 1 RPC clause #2 (`purchases.email`) |
| Auto-link purchase to user on first sign-in | Task 1 RPC step (1) |
| Multi-Google-account confusion mitigated | Task 6 banner shows the email they signed in with |
| Existing users not locked out (Natasha case) | Task 1 RPC clauses #3–#6 (grandfather) + Task 7 row #10 |
| No surprises (audit current users) | Pre-flight safety check section |
| No em-dashes in user-facing copy | Task 6 banner copy reviewed |

**Placeholder scan:** none — every step contains the exact code, file path, command, or expected output.

**Type / name consistency:**
- RPC name: `link_and_check_entitlement()` — used identically in Task 1, 2, 3, the smoke-test SQL in Task 7.
- Helper: `checkEntitlement()` / `signOutNoPurchase(email)` — used identically in Tasks 3, 4, 5.
- Return shape: `{ entitled: boolean, linked_codes: number }` server-side, mapped to `{ entitled, linkedCodes }` client-side in Task 3, consumed correctly in Tasks 4 & 5.
- URL param: `?signed_out=no_purchase&email=...` — written by Task 3 helper, read by Task 6 banner. Same param names.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-block-unentitled-oauth-signins.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
