// google-ads-ingest — receives the daily push from the Google Ads script.
//
// Server-to-server only (Google Ads Scripts -> this function). Deploy with
// verify_jwt = false; auth is a dedicated shared secret, kept separate from
// N8N_SHARED_SECRET so the value living inside Google Ads can't reach n8n endpoints.
//
//   Supabase Edge Function secret:  GOOGLE_ADS_INGEST_SECRET=<value>
//   Google Ads script:              same value in CONFIG.INGEST_SECRET
//
// Body: { date_from, date_to, campaigns: [...], keywords: [...], search_terms: [...] }
// Rows are upserted, so re-sending the last N days (late conversions) is safe.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const int = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const txt = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : null);
const MAX_ROWS = 20000;

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Fail closed: no secret configured means no endpoint.
  const secret = Deno.env.get('GOOGLE_ADS_INGEST_SECRET');
  if (!secret) return json({ error: 'Server misconfigured' }, 503);
  if ((req.headers.get('x-shared-secret') || '') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const now = new Date().toISOString();

  const campaigns = (Array.isArray(body.campaigns) ? body.campaigns : [])
    .filter((r: any) => isDate(r.date) && r.campaign_id)
    .slice(0, MAX_ROWS)
    .map((r: any) => ({
      date: r.date,
      campaign_id: String(r.campaign_id),
      campaign_name: txt(r.campaign_name) ?? '',
      campaign_status: txt(r.campaign_status, 40),
      impressions: int(r.impressions),
      clicks: int(r.clicks),
      cost_eur: num(r.cost_eur),
      conversions: num(r.conversions),
      conversion_value: num(r.conversion_value),
      synced_at: now,
    }));

  const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
    .filter((r: any) => isDate(r.date) && r.ad_group_id && r.criterion_id && r.keyword)
    .slice(0, MAX_ROWS)
    .map((r: any) => ({
      date: r.date,
      campaign_id: String(r.campaign_id),
      ad_group_id: String(r.ad_group_id),
      criterion_id: String(r.criterion_id),
      ad_group_name: txt(r.ad_group_name),
      keyword: txt(r.keyword),
      match_type: txt(r.match_type, 40),
      impressions: int(r.impressions),
      clicks: int(r.clicks),
      cost_eur: num(r.cost_eur),
      conversions: num(r.conversions),
      synced_at: now,
    }));

  const terms = (Array.isArray(body.search_terms) ? body.search_terms : [])
    .filter((r: any) => isDate(r.date) && r.ad_group_id && r.search_term)
    .slice(0, MAX_ROWS)
    .map((r: any) => ({
      date: r.date,
      campaign_id: String(r.campaign_id),
      ad_group_id: String(r.ad_group_id),
      ad_group_name: txt(r.ad_group_name),
      search_term: txt(r.search_term),
      term_status: txt(r.term_status, 40),
      impressions: int(r.impressions),
      clicks: int(r.clicks),
      cost_eur: num(r.cost_eur),
      conversions: num(r.conversions),
      synced_at: now,
    }));

  const log = {
    date_from: isDate(body.date_from) ? body.date_from : null,
    date_to: isDate(body.date_to) ? body.date_to : null,
    campaign_rows: campaigns.length,
    keyword_rows: keywords.length,
    term_rows: terms.length,
  };

  try {
    const upsert = async (table: string, rows: any[], onConflict: string) => {
      if (!rows.length) return;
      const { error } = await supabase.from(table).upsert(rows, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    };
    await upsert('google_ads_campaign_daily', campaigns, 'date,campaign_id');
    await upsert('google_ads_keyword_daily', keywords, 'date,ad_group_id,criterion_id');
    await upsert('google_ads_search_term_daily', terms, 'date,ad_group_id,search_term');

    await supabase.from('google_ads_sync_log').insert({ ...log, ok: true });
    return json({ ok: true, ...log });
  } catch (e: any) {
    console.error('[google-ads-ingest] error:', e?.message ?? e);
    await supabase.from('google_ads_sync_log').insert({ ...log, ok: false, error: String(e?.message ?? e).slice(0, 1000) });
    return json({ error: 'Ingest failed' }, 500);
  }
});
