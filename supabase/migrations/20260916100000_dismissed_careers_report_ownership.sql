-- dismissed_careers RLS: a dismissal must belong to a report the caller owns.
--
-- The original policy (20260915140000_dismissed_careers.sql) was:
--
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
--
-- which only validates who owns the DISMISSAL ROW. It never checks that the
-- report_id the row points at is the caller's. So any authenticated user could
-- write rows against any report id they can guess or observe, and those rows
-- would pass every check: user_id is honestly their own, and the foreign keys
-- are satisfied because the ids are real. They are just somebody else's.
--
-- This was not theoretical. The public demo at /demo/dashboard renders the
-- real dashboard from a frozen fixture whose reportId and section_ids are REAL
-- values, so a signed-in visitor clicking "Not for me" on the marketing page
-- filed a dismissal against a stranger's report — and, because /ops aggregates
-- dismissals across all users with the service role, quietly polluted the
-- founder-facing numbers with demo-browsing noise. The demo no longer renders
-- the control at all; this is the layer underneath, so the next caller that
-- gets a report_id wrong cannot write through it either.
--
-- Why the foreign keys were never enough: dismissed_careers_report_id_fkey and
-- dismissed_careers_section_id_fkey prove the rows EXIST. Ownership is a
-- different question, and only RLS can answer it.
--
-- ── Why the ownership test lives in WITH CHECK and NOT in USING ──────────────
--
-- FOR ALL applies USING to SELECT/UPDATE/DELETE and WITH CHECK to the new row
-- on INSERT/UPDATE. Putting the report join in USING as well would be stricter
-- but WRONG: it would make a user's own leftover rows unreadable and
-- undeletable the moment the parent report stopped resolving for them, i.e. it
-- would convert a data-lifecycle event into rows the owner can neither see nor
-- clean up. USING therefore stays exactly as it was — you see and delete your
-- own dismissals, full stop. WITH CHECK is where a WRITE has to earn its
-- report, which is the only direction the vulnerability ran.
--
-- ── Why the happy path still passes (verified against the live policies) ─────
--
-- A subquery inside a policy is itself subject to RLS, so both EXISTS clauses
-- must be satisfiable BY THE CALLER, not just true in the abstract:
--
--   * reports SELECT policy is `auth.uid() = user_id`, so a user can always
--     see their own report row → the first EXISTS resolves for the owner.
--   * report_sections SELECT policy is
--     `EXISTS (SELECT 1 FROM reports WHERE reports.id = report_sections.report_id
--              AND reports.user_id = auth.uid())`,
--     so a user can always see the sections of their own report → the second
--     EXISTS resolves for the owner. For an attacker it returns zero rows
--     before our own report_id equality test even gets a say, which is a
--     second independent barrier rather than a replacement for the first.
--
-- The second EXISTS also closes a narrower hole the first one does not: it
-- forbids stapling one of your OWN report ids to a section id from a DIFFERENT
-- report, which would otherwise sail past a report-only ownership check and
-- corrupt the /ops per-career aggregate with a career that report never had.
--
-- The separate "Service role full access on dismissed careers" policy is
-- untouched. PERMISSIVE policies OR together, so ops-feed keeps its
-- cross-user read; this migration only tightens the anon/authenticated path.
--
-- Replacing the policy IN PLACE (same name) rather than adding a second one is
-- deliberate and load-bearing: two PERMISSIVE policies would be OR'd, and the
-- old permissive one would go on allowing exactly what this is meant to stop.

DROP POLICY IF EXISTS "Users manage their own dismissed careers" ON public.dismissed_careers;

CREATE POLICY "Users manage their own dismissed careers"
  ON public.dismissed_careers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = dismissed_careers.report_id
        AND r.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.report_sections s
      WHERE s.id = dismissed_careers.section_id
        AND s.report_id = dismissed_careers.report_id
    )
  );

COMMENT ON TABLE public.dismissed_careers IS
  'Careers the user set aside via the dashboard "Not for me" control. Greys the card, omits it from the PDF (runner-ups/outside-box) or marks it "set aside" (top 3), and feeds the /ops dismissal aggregate. Never read by any n8n workflow. RLS: reads/deletes are scoped to your own rows; writes must additionally target a report you own and a section belonging to that report.';
