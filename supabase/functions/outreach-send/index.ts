// Hand n8n one outreach mail that may go out right now, and record what
// happened to it.
//
// This function decides nothing about CONTENT. By the time a row reaches the
// queue the mail already exists as a Gmail draft, written and reviewable; all
// that is left is when it leaves. Keeping that split means a bug here can
// delay a mail or fail to send one, but can never send the wrong words.
//
// It decides nothing about PACING either — that lives in outreach_send_claim()
// in the database. A workflow that polls twice as often therefore sends
// exactly as much mail, which is the reason the rule is not in the workflow.
//
// Shape (all POST, x-shared-secret, same secret as outreach-mail-sync):
//   { action: 'next' }                        -> { send: {...} | null }
//   { action: 'sent', id, gmail_message_id }  -> { ok: true }
//   { action: 'failed', id, error }           -> { ok: true, status }
//
// WF12 "Outreach Send" polls 'next' every ten minutes, posts the draft id to
// Gmail's drafts/send, and reports back. Nothing else calls this.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Mirrors the agreed ceiling. The database enforces it; this is the dial. */
const MAX_PER_DAG = 8;

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const action = String(body.action ?? 'next');

  try {
    if (action === 'next') {
      // Claims in the same statement that selects, so two overlapping runs
      // cannot both be handed the same mail.
      const { data, error } = await supabase.rpc('outreach_send_claim', { p_max_per_dag: MAX_PER_DAG });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      // No row is the normal answer outside the window, over the daily cap, or
      // inside the gap. n8n treats it as "nothing to do", not as a failure.
      return json({ send: row ?? null });
    }

    if (action === 'sent') {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id required' }, 400);
      const { error } = await supabase.rpc('outreach_send_done', {
        p_id: id,
        p_gmail_message_id: body.gmail_message_id ? String(body.gmail_message_id) : null,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'failed') {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id required' }, 400);
      const fout = String(body.error ?? 'unknown').slice(0, 500);
      const { error } = await supabase.rpc('outreach_send_failed', { p_id: id, p_fout: fout });
      if (error) throw error;
      // Two tries and then it waits for a human: a mail that keeps failing has
      // something wrong with it, and retrying forever only risks a double send.
      const { data } = await supabase
        .from('outreach_send_queue')
        .select('status, pogingen')
        .eq('id', id)
        .maybeSingle();
      console.error('[outreach-send] send failed for', id, fout);
      return json({ ok: true, status: data?.status ?? null, pogingen: data?.pogingen ?? null });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[outreach-send]', action, e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
