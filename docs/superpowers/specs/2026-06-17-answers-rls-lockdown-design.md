# Lock down `answers` (and `ai_research`) public read/write — design

**Date:** 2026-06-17
**Author:** Security audit follow-up (tech-debt item #9)
**Status:** Approved — Approach A (scoped RLS only)

## Problem

`answers.payload` (jsonb) holds the most sensitive PII in the app: every survey
response. RLS was already *enabled*, but a leftover permissive policy
`"Allow public select on answers" USING (true)` let anyone holding the public
anon key dump every row via `GET /rest/v1/answers`. Companions to the hole:

- `"Allow public update on answers" USING (true)` — anyone could edit any row.
- Three duplicate public INSERT policies (`Allow public insert on answers`,
  `Anyone can submit survey responses`, `Public can insert answers`).
- A misleading no-op `"Only service role can read responses" USING (false)`
  that was OR-combined with the `true` SELECT policy, so it did nothing.

The Supabase advisor deliberately ignores permissive *SELECT* policies, so the
linter never flagged this — it was found by hand during the 2026-06-17 audit.

`ai_research` had the same pattern: public read + authenticated insert/update,
all `USING (true)`.

## Key finding that shaped the approach

The original brief assumed the survey is taken **anonymously** (before account
creation) and therefore proposed a service-role edge function (`answers-rw`) as
a broker, because RLS can't scope an anonymous caller.

That premise does **not** match the current code:

- `/assessment` renders `AssessmentPage`, which returns *"Authentication
  required"* when there is no user (`src/pages/Assessment.tsx:57`), and
  `useAssessmentLogic` redirects to `/auth` when `!user`
  (`src/components/assessment/useAssessmentLogic.ts:26`).
- There is **no anonymous auth** (`signInAnonymously`) anywhere in the app.
- All six places that touch `answers` are either authenticated frontend calls
  (5) or a service-role edge function (`get-my-access-code`, 1).
- Production check: all 12 `answers` rows are tied to an `access_code` whose
  `user_id` is set — zero orphans, zero unlinked codes. The code is linked to
  its owner at signup/verify time, before the survey loads.

So every caller is authenticated and the access code is linked to them. Even
though `answers` has no `user_id` column, the caller always has a JWT, so we can
scope ownership through the `access_codes` join. **No edge function and no
frontend changes are needed.**

## Approach A — scoped RLS only (chosen)

One forward migration:

1. **Ownership helper** `public.user_owns_access_code(uuid) -> boolean`,
   `SECURITY DEFINER` + `STABLE`, `search_path = public`. Returns true iff the
   given access_code belongs to `auth.uid()`. `SECURITY DEFINER` so the
   `access_codes` lookup is not re-filtered by `access_codes`' own RLS (robust
   to future policy changes); `STABLE` for planner caching. Returns false for
   anon (`auth.uid()` is null).

2. **`answers`** — drop the 3 duplicate public INSERTs, the `USING (true)`
   SELECT, the `USING (true)` UPDATE, and the no-op `false` SELECT. Add three
   policies `TO authenticated` keyed on `user_owns_access_code(access_code_id)`:
   SELECT, INSERT (WITH CHECK), UPDATE (USING + WITH CHECK). No DELETE policy —
   answer deletion only happens via the service-role `delete-user-data` function.

3. **`ai_research`** — drop all three permissive policies → backend-only.
   Nothing in the app reads or writes it; only n8n WF2 writes it via the direct
   Postgres/owner connection, which bypasses RLS. RLS stays enabled.

### Resulting access matrix

| Role | answers | ai_research |
|------|---------|-------------|
| anon | denied (no policy) | denied |
| authenticated | read/insert/update only own (via access_code) | denied |
| service_role / n8n owner | bypass RLS (unchanged) | bypass RLS (unchanged) |

### Why not the edge function (Approach B)

Only worth it if a pre-account **anonymous** survey is on the near-term roadmap.
It adds a new service-role function that writes PII (its own thing to secure +
rate-limit) and reroutes frontend calls — solving a problem the app doesn't have
today. Revisit if the survey ever becomes anonymous.

## Verification plan

1. **DB-level RLS proof** (impersonate roles via `set_config` of the JWT claims):
   - anon: SELECT on `answers` / `ai_research` returns 0 rows; INSERT/UPDATE denied.
   - authenticated user A: sees only their own answers; can upsert their own;
     cannot SELECT or UPDATE user B's row.
2. **Browser end-to-end** (logged-in flow, since the survey is auth-gated):
   start survey → autosave draft → refresh/resume → submit → dashboard resume →
   derived profile (pronouns/age pre-fill). Confirm no RLS errors in console.
3. **n8n** `forward-to-n8n` / WF1 path is keyed by report `user_id` and uses
   service role — independent; confirm a submission still forwards.

## Rollback

Forward-only migration. If a legitimate path breaks, the pre-change `answers`
policies were: public `SELECT`/`UPDATE`/`INSERT` all `USING/ WITH CHECK (true)`.
Re-creating the scoped policies (or, in an emergency, a temporary
`authenticated`-only `USING (true)` SELECT) restores access without re-opening
the anon hole. There were 0 in-flight drafts at apply time, so blast radius is
minimal.
