-- Add natasha@cairnly.io (Tasha, employers channel) to the SQL-side Ops admin
-- allowlist, so the "rerun report" buttons in Ops work for her like the rest of
-- the console. Mirrors supabase/functions/_shared/admins.ts and
-- src/lib/admins.ts, which got the same address in the same change.
--
-- Only the list changes; signature and attributes are as in
-- 20260821110000_ops_admin_allowlist.sql.

CREATE OR REPLACE FUNCTION public.is_ops_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p_email, ''))) IN (
    'natasha@cairnly.io',
    'sjn.geurts@gmail.com',
    'sjoerd@bethehitl.com',
    'sjoerd@cairnly.io',
    'sjoerd@falkoratlas.com'
  );
$$;

COMMENT ON FUNCTION public.is_ops_admin(TEXT) IS
  'Ops admin allowlist for SQL-side gates. Mirrors supabase/functions/_shared/admins.ts.';
