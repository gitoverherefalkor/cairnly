// ops-marketing — admin-only marketing reach for the ops dashboard.
//
// Powers the Marketing tab on cairnly.io/ops. Mirrors ops-feed's auth model:
// gated to ADMIN_EMAILS, all DB access via the service role. The browser never
// touches marketing_posts / marketing_post_stats directly (RLS locks them to
// the service role) — everything goes through this function.
//
// POST body:
//   {}                                  → { posts, traffic_series }
//   { action: 'post_upsert', post }     → create/update a post
//   { action: 'post_delete', id }       → delete a post (+ its snapshots)
//   { action: 'stat_snapshot', ... }    → append a stats snapshot (never overwrites)
//   { action: 'stat_delete', id }       → delete a single snapshot (typo fix)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';

const ADMIN_EMAILS = new Set(['sjoerd@cairnly.io', 'sjoerd@falkoratlas.com']);

const SENTIMENTS = new Set(['positive', 'mixed', 'critical', 'quiet']);
const GUT_READS = new Set(['win', 'neutral', 'miss']);
const STATUSES = new Set(['draft', 'scheduled', 'posted']);
const PROFILES = new Set(['personal', 'company']);

const json = (payload: unknown, corsHeaders: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Clamp a hand-entered stat to a sane non-negative integer.
function toCount(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1_000_000_000);
}

function str(v: unknown, max = 400): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// Whitelist + shape the incoming post so a client can never write arbitrary
// columns. Everything is optional on update; sensible defaults on insert.
function cleanPost(raw: any) {
  const out: Record<string, unknown> = {};
  if ('posted_at' in raw) out.posted_at = raw.posted_at ? new Date(raw.posted_at).toISOString() : null;
  if ('status' in raw) out.status = STATUSES.has(raw.status) ? raw.status : 'draft';
  if ('author' in raw) out.author = str(raw.author, 120) ?? 'Sjoerd';
  if ('profile' in raw) out.profile = PROFILES.has(raw.profile) ? raw.profile : 'personal';
  if ('post_type' in raw) out.post_type = str(raw.post_type, 120);
  if ('hook_style' in raw) out.hook_style = str(raw.hook_style, 200);
  if ('has_image' in raw) out.has_image = !!raw.has_image;
  if ('image_type' in raw) out.image_type = str(raw.image_type, 120);
  if ('is_series' in raw) out.is_series = !!raw.is_series;
  if ('series_name' in raw) out.series_name = str(raw.series_name, 200);
  if ('body' in raw) out.body = typeof raw.body === 'string' ? raw.body.slice(0, 20000) : '';
  if ('comment_sentiment' in raw)
    out.comment_sentiment = SENTIMENTS.has(raw.comment_sentiment) ? raw.comment_sentiment : null;
  if ('gut_read' in raw) out.gut_read = GUT_READS.has(raw.gut_read) ? raw.gut_read : null;
  if ('notes' in raw) out.notes = str(raw.notes, 2000);
  return out;
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  if (!ADMIN_EMAILS.has(authed.email ?? '')) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body?.action;

  try {
    // ── Create / update a post ────────────────────────────────────────────────
    if (action === 'post_upsert') {
      const fields = cleanPost(body.post ?? {});
      if (body.post?.id) {
        const { data, error } = await supabase
          .from('marketing_posts')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', body.post.id)
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, post: data }, corsHeaders);
      }
      const { data, error } = await supabase
        .from('marketing_posts')
        .insert(fields)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, post: data }, corsHeaders);
    }

    // ── Delete a post ─────────────────────────────────────────────────────────
    if (action === 'post_delete' && typeof body.id === 'string') {
      const { error } = await supabase.from('marketing_posts').delete().eq('id', body.id);
      if (error) throw error;
      return json({ ok: true }, corsHeaders);
    }

    // ── Append a stats snapshot (never overwrites) ────────────────────────────
    if (action === 'stat_snapshot' && typeof body.post_id === 'string') {
      const row: Record<string, unknown> = {
        post_id: body.post_id,
        impressions: toCount(body.impressions),
        reactions: toCount(body.reactions),
        comments: toCount(body.comments),
        reposts: toCount(body.reposts),
      };
      // Optional backdated capture time (entering a day-14 number after the fact).
      if (body.captured_at) row.captured_at = new Date(body.captured_at).toISOString();
      const { data, error } = await supabase
        .from('marketing_post_stats')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, stat: data }, corsHeaders);
    }

    // ── Delete a single snapshot ──────────────────────────────────────────────
    if (action === 'stat_delete' && typeof body.id === 'string') {
      const { error } = await supabase.from('marketing_post_stats').delete().eq('id', body.id);
      if (error) throw error;
      return json({ ok: true }, corsHeaders);
    }

    // ── Classify a pasted post (type + hook style) with a small model ─────────
    // Saves hand-tagging: reads the verbatim text and guesses the post type and
    // the opening-hook technique. Best-effort — returns nulls (never errors the
    // form) if the key is missing or the model is unsure.
    if (action === 'classify') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const empty = { post_type: null as string | null, hook_style: null as string | null };
      if (!text) return json(empty, corsHeaders);
      const key = Deno.env.get('ANTHROPIC_API_KEY');
      if (!key) return json(empty, corsHeaders);

      const prompt = `You tag LinkedIn posts for a marketing dashboard. Read the post and return ONLY valid JSON:
{"post_type": one of ["personal_story","opinion","behind_the_build","career_data","success_story","launch_series"] or null, "hook_style": "2-4 word label for the opening-line technique"}

post_type meanings:
- personal_story: a personal narrative or lived experience
- opinion: a take, argument, or hot take
- behind_the_build: building Cairnly in public — product/dev progress
- career_data: data, teardown, or analysis about careers / jobs / AI's impact on work
- success_story: a user's or customer's positive outcome
- launch_series: announcing or launching something / part of a launch push

hook_style examples: "bold claim", "question", "personal confession", "surprising stat", "story open", "contrarian take", "how-to promise".

Post:
"""
${text.slice(0, 6000)}
"""
Return only the JSON object, no prose.`;

      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) return json(empty, corsHeaders);
        const resp = await r.json();
        const t: string = resp.content?.[0]?.text ?? '';
        const m = t.match(/\{[\s\S]*\}/);
        if (!m) return json(empty, corsHeaders);
        const parsed = JSON.parse(m[0]);
        const TYPES = new Set(['personal_story', 'opinion', 'behind_the_build', 'career_data', 'success_story', 'launch_series']);
        return json(
          {
            post_type: TYPES.has(parsed.post_type) ? parsed.post_type : null,
            hook_style: typeof parsed.hook_style === 'string' ? parsed.hook_style.trim().slice(0, 60) : null,
          },
          corsHeaders,
        );
      } catch (e: any) {
        console.error('[ops-marketing] classify failed:', e?.message ?? e);
        return json(empty, corsHeaders);
      }
    }

    // ── Default: read everything the tab needs ────────────────────────────────
    const [postsRes, statsRes, seriesRes] = await Promise.all([
      supabase.from('marketing_posts').select('*').order('posted_at', { ascending: false, nullsFirst: true }),
      supabase.from('marketing_post_stats').select('*').order('captured_at', { ascending: true }),
      supabase.rpc('ops_traffic_series', { p_days: 14 }),
    ]);

    if (postsRes.error) throw postsRes.error;

    const statsByPost = new Map<string, any[]>();
    for (const s of statsRes.data ?? []) {
      const arr = statsByPost.get(s.post_id) ?? [];
      arr.push(s);
      statsByPost.set(s.post_id, arr);
    }

    const posts = (postsRes.data ?? []).map((p: any) => {
      const snapshots = statsByPost.get(p.id) ?? [];
      const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
      return { ...p, snapshots, latest };
    });

    return json(
      {
        posts,
        traffic_series: seriesRes.error ? [] : seriesRes.data ?? [],
        fetched_at: new Date().toISOString(),
      },
      corsHeaders,
    );
  } catch (e: any) {
    console.error('[ops-marketing] error:', e?.message ?? e);
    return errorResponse(e?.message ?? 'Marketing request failed', 500, corsHeaders);
  }
});
