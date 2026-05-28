-- pg_cron job: process eligible referral payouts daily at 02:00 UTC.
--
-- Requires the service_role JWT to be stored in Supabase Vault under the
-- name 'service_role_key'. This is a one-time setup on the project (the
-- migration logs a NOTICE if it's missing, but does not fail — schema goes
-- in regardless, you can add the secret afterwards).
--
-- To set the vault secret (Supabase Dashboard → Project Settings → Vault →
-- New Secret), or via SQL:
--   select vault.create_secret(
--     '<paste service_role JWT here>',
--     'service_role_key',
--     'Service role key for pg_cron -> edge function calls'
--   );
--
-- pg_cron 1.6 and pg_net 0.14.0 are already installed on this project (no
-- CREATE EXTENSION needed — Supabase manages them).

-- Idempotent: if this migration re-runs, unschedule the previous job first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-referral-payouts-daily') THEN
    PERFORM cron.unschedule('process-referral-payouts-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'process-referral-payouts-daily',
  '0 2 * * *',  -- 02:00 UTC daily (~ 04:00 CEST). Low traffic, plenty of head
                -- room before the European workday.
  $$
  SELECT net.http_post(
    url := 'https://pcoyafgsirrznhmdaiji.supabase.co/functions/v1/process-referral-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Warn (don't fail) if the vault secret is missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    RAISE NOTICE E'\n\n!!  service_role_key not found in Supabase Vault.\n    The cron job is scheduled, but the HTTP call will send no Authorization header until you add it:\n      select vault.create_secret(''<service_role JWT>'', ''service_role_key'', ''pg_cron auth'');\n    Find the service_role JWT under Project Settings -> API.\n';
  END IF;
END $$;
