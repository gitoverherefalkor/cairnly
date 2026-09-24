// outreach-prepare — fill the next two working days with outreach concepts.
//
// Called by pg_cron at 07:30 and 14:45 Amsterdam on working days. pg_cron
// runs in UTC, so each job fires at both possible UTC times (summer and
// winter) and this function only works when the Amsterdam clock is within
// twenty minutes after one of those moments. The "Prepare more" button in
// /ops calls the same code through ops-outreach, with no clock check.
//
// POST, x-shared-secret = N8N_SHARED_SECRET (the value pg_cron reads from
// vault 'n8n_shared_secret').
//   {}              → { ran: true, chases, checkins, initials, capacity, skipped }
//                     or { ran: false, reason: 'not the moment' }
//   { force: true } → runs regardless of the clock (manual runs, tests)
//
// All the logic is in _shared/outreachPrepare.ts.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { runPrepare } from '../_shared/outreachPrepare.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 07:30 and 14:45 Amsterdam, as minutes after midnight. */
const MOMENTS = [7 * 60 + 30, 14 * 60 + 45];
const TOLERANCE_MIN = 20;

function amsterdamMinutes(now: Date): number {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is a plain cron call.
  }

  const now = new Date();
  if (!body.force) {
    const m = amsterdamMinutes(now);
    if (!MOMENTS.some((t) => m >= t && m < t + TOLERANCE_MIN)) {
      return json({ ran: false, reason: 'not the moment' });
    }
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // { force: true, slug } prepares one agency regardless of capacity: for
  // checking a first mail (and the second reader) on a real agency.
  const slug = typeof body.slug === 'string' && body.slug ? body.slug : undefined;
  try {
    const result = await runPrepare(supabase, now, slug);
    console.log('[outreach-prepare]', JSON.stringify(result));
    return json({ ran: true, ...result });
  } catch (e) {
    console.error('[outreach-prepare]', e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
