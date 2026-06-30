// ops-feed — admin-only operations dashboard feed.
// Gated to ADMIN_EMAILS. Fetches support tickets, n8n errors, assessment
// misses, and mid-chat chapter feedback. Runs new items through Claude
// (cached in ops_analysis). Also fetches live provider status for Claude
// and OpenAI so upstream outages are visible alongside errors.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';

// ─── Config ───────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = new Set(['sjoerd@cairnly.io', 'sjoerd@falkoratlas.com']);

// Re-analyze cached items older than this
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

// Max new Claude calls per request (keeps cold-start fast)
const MAX_NEW_ANALYSES = 8;

// Screenshot signed URL TTL
const SCREENSHOT_TTL_SECS = 3600;

// Known n8n workflow names keyed by workflow ID (from CLAUDE.md)
const WF_NAMES: Record<string, string> = {
  myWIhgaahAXD2ULz: 'WF0 — Resume Extract',
  '0Z8WxV5tVFMJqIZt': 'WF1 — Profile Insert',
  vVv0tsnFlBnarMdq: 'WF2 — Enrich 15',
  zhgJuiDp60PS5ZKJ: 'WF3 — Scoring + OOB',
  seWmQPFQqIe60TkU: 'WF4 — Content Gen',
  h7ie9zN080IM2g7N: 'WF5 — Chat',
  CyyjL7D51NbVZNtL: 'WF6 — Feedback',
  ohNbCw7pVqvjCZHT: 'WF7 — Exec Summary',
  Bx0uNW4gnnXIGO8j: 'WF8 — Finding Roles',
  IFhL4Lno0hyMJ1Jc: 'WF9 — Custom Resume',
  M9w7xWeiPNmU7ZFb: 'WFX — Cover Letter',
  FbsruPbuZI2Fgtc8: 'Error Handler',
};

// ─── Provider status ──────────────────────────────────────────────────────────

interface ProviderStatus {
  indicator: 'none' | 'minor' | 'major' | 'critical';
  description: string;
  url: string;
  incidents: Array<{ name: string; impact: string; started_at: string }>;
}

async function fetchProviderStatus(
  baseUrl: string,
  pageUrl: string,
): Promise<ProviderStatus | null> {
  try {
    const r = await fetch(`${baseUrl}/api/v2/summary.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      indicator: data.status?.indicator ?? 'none',
      description: data.status?.description ?? 'Unknown',
      url: pageUrl,
      incidents: ((data.incidents ?? []) as any[])
        .filter((i) => i.status !== 'resolved')
        .map((i) => ({
          name: i.name ?? 'Incident',
          impact: i.impact ?? 'unknown',
          started_at: i.started_at ?? '',
        })),
    };
  } catch {
    return null;
  }
}

// ─── n8n API ──────────────────────────────────────────────────────────────────

async function fetchN8nErrors(): Promise<any[]> {
  const apiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey) return [];
  try {
    const r = await fetch(
      'https://falkoratlas.app.n8n.cloud/api/v1/executions?status=error&limit=20',
      {
        headers: { 'X-N8N-API-KEY': apiKey },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!r.ok) return [];
    const data = await r.json();
    return ((data.data ?? []) as any[]).map((exec) => ({
      ...exec,
      workflow_name: WF_NAMES[exec.workflowId] ?? `Workflow ${exec.workflowId}`,
      error_message:
        exec.data?.resultData?.error?.message ??
        exec.data?.resultData?.lastNodeExecuted ??
        'Unknown error',
      failed_node: exec.data?.resultData?.error?.node?.name ?? null,
    }));
  } catch (e) {
    console.error('[ops-feed] n8n API fetch failed:', e);
    return [];
  }
}

// Monthly execution limit for the n8n Cloud plan (the "X / 2,500" on the
// app.n8n.cloud dashboard). The instance API has no usage endpoint, so we
// approximate by counting executions since the 1st of the month — newest
// first, stopping once we cross the month boundary. Covers every workflow on
// the instance (Outside Input included), matching the billed pool.
const N8N_MONTHLY_LIMIT = 2500;

interface N8nUsage {
  executions_this_month: number;
  limit: number;
  capped: boolean;
}

async function fetchN8nUsage(): Promise<N8nUsage | null> {
  const apiKey = Deno.env.get('N8N_API_KEY');
  if (!apiKey) return null;
  const d = new Date();
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  let count = 0;
  let cursor = '';
  let pages = 0;
  let capped = false;
  try {
    while (pages < 40) {
      const u = new URL('https://falkoratlas.app.n8n.cloud/api/v1/executions');
      u.searchParams.set('limit', '250');
      if (cursor) u.searchParams.set('cursor', cursor);
      const r = await fetch(u.toString(), {
        headers: { 'X-N8N-API-KEY': apiKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) break;
      const data = await r.json();
      const rows = (data.data ?? []) as any[];
      if (rows.length === 0) break;
      let reachedOld = false;
      for (const ex of rows) {
        const t = new Date(ex.startedAt ?? ex.createdAt ?? ex.stoppedAt ?? 0).getTime();
        if (t >= monthStart) count++;
        else reachedOld = true;
      }
      if (reachedOld) break; // rows are newest-first — once we hit last month, stop
      cursor = data.nextCursor ?? '';
      pages++;
      if (!cursor) break;
    }
    if (pages >= 40) capped = true;
  } catch (e) {
    console.error('[ops-feed] n8n usage fetch failed:', e);
    return null;
  }
  return { executions_this_month: count, limit: N8N_MONTHLY_LIMIT, capped };
}

// ─── Vercel deploy status ─────────────────────────────────────────────────────

interface DeployInfo {
  state: string;
  commit_message: string | null;
  branch: string | null;
  created_at: string | null;
  url: string;
}

async function fetchVercelDeploy(): Promise<DeployInfo | null> {
  const token = Deno.env.get('VERCEL_API_TOKEN');
  if (!token) return null;
  try {
    const r = await fetch(
      'https://api.vercel.com/v6/deployments?app=cairnly&target=production&limit=1',
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return null;
    const data = await r.json();
    const d = data.deployments?.[0];
    if (!d) return null;
    return {
      state: d.state ?? d.readyState ?? 'UNKNOWN',
      commit_message: d.meta?.githubCommitMessage ?? null,
      branch: d.meta?.githubCommitRef ?? null,
      created_at: d.created ? new Date(d.created).toISOString() : null,
      url: d.url ? `https://${d.url}` : 'https://vercel.com',
    };
  } catch (e) {
    console.error('[ops-feed] Vercel deploy fetch failed:', e);
    return null;
  }
}

// ─── People funnel ────────────────────────────────────────────────────────────
// Derives each recent signup's current stage from profiles +
// user_engagement_tracking + reports. Privacy-light: first name + country only.

type Stage =
  | 'signed_up'
  | 'survey'
  | 'processing'
  | 'report_ready'
  | 'in_chat'
  | 'done';

interface Person {
  user_id: string;
  first_name: string;
  country: string | null;
  stage: Stage;
  detail: string;
  signed_up_at: string;
  last_activity_at: string;
  has_resume: boolean;
}

function maxTs(...ts: Array<string | null | undefined>): string {
  return ts.filter(Boolean).sort().reverse()[0] ?? '';
}

function derivePerson(profile: any, eng: any, report: any): Person {
  let stage: Stage = 'signed_up';
  let detail = 'Signed up, not started';

  if (eng?.survey_started_at) {
    stage = 'survey';
    const sec = eng.survey_last_section;
    const total = eng.survey_total_sections;
    detail = sec && total ? `Survey — section ${sec} of ${total}` : 'Survey in progress';
  }
  if (eng?.survey_completed_at) {
    stage = 'processing';
    detail = 'Survey done — report generating';
  }
  if (report && (report.status === 'pending_review' || report.status === 'completed')) {
    stage = 'report_ready';
    detail = 'Report ready';
  }
  if (eng?.chat_started_at) {
    stage = 'in_chat';
    const idx = eng.chat_last_section_index;
    detail = idx != null ? `In chat — section ${idx}` : 'In chat';
  }
  if (eng?.chat_completed_at || eng?.dashboard_visited_after_chat_at) {
    stage = 'done';
    detail = 'Finished — chat wrapped up';
  }

  return {
    user_id: profile.id,
    first_name: profile.first_name ?? '(no name)',
    country: profile.country ?? null,
    stage,
    detail,
    signed_up_at: profile.created_at,
    last_activity_at: maxTs(
      profile.created_at,
      eng?.survey_last_activity_at,
      eng?.chat_last_activity_at,
      eng?.updated_at,
      report?.updated_at,
    ),
    has_resume: !!profile.resume_uploaded_at,
  };
}

async function fetchPeople(
  supabase: ReturnType<typeof createClient>,
  sinceDays: number,
): Promise<Person[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, first_name, country, created_at, resume_uploaded_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !profiles || profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);

  const [engResult, reportResult] = await Promise.all([
    supabase.from('user_engagement_tracking').select('*').in('user_id', ids),
    supabase
      .from('reports')
      .select('user_id, status, updated_at, created_at')
      .in('user_id', ids)
      .order('created_at', { ascending: false }),
  ]);

  const engMap = new Map<string, any>();
  for (const e of engResult.data ?? []) engMap.set(e.user_id, e);

  // Keep the most recent report per user (rows already sorted desc by created_at)
  const reportMap = new Map<string, any>();
  for (const r of reportResult.data ?? []) {
    if (!reportMap.has(r.user_id)) reportMap.set(r.user_id, r);
  }

  return profiles.map((p) =>
    derivePerson(p, engMap.get(p.id), reportMap.get(p.id)),
  );
}

// ─── AI analysis ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are triaging operational signals for Cairnly, a B2C/B2B career-guidance SaaS.

Platform overview:
- Users buy access (or enter a B2B access code from their employer), then complete a multi-section personality + career survey
- An AI pipeline (n8n, using Claude + OpenAI) generates a personality profile and ranked career recommendations
- Users chat with an AI career coach; they can push back ("I see this differently")
- WF6 incorporates serious feedback and regenerates affected report sections
- Users then get an executive summary, can search open roles, and generate tailored resumes + cover letters

Journey stages (in order): signup → payment → survey → processing (AI pipeline running) → chat → feedback → report → jobs/resume

Signal-type rules:
- n8n_error: almost always BLOCKER (user's pipeline failed, they have no results and are stuck)
- support / category=account_login or access_code_payment or bug_report: likely blocker if user can't proceed
- support / category=feature_idea: always fyi
- assessment_miss / feedback_category=2: WF6 had to significantly rework the AI output (needs-action)
- assessment_miss / feedback_category=1: minor AI refinement (fyi)
- chapter_feedback: user mid-chat quality rating of a report section (fyi unless pattern)

Severity levels:
- blocker: user CANNOT proceed at all (pipeline failure, login broken, no results after submission)
- needs-action: something is wrong but user can partially continue (bad AI output, feature broken)
- fyi: feature request, minor question, positive feedback, minor refinement

Keep summary under 12 words. recommended_action is one concrete sentence.`;

interface AnalysisResult {
  severity: 'blocker' | 'needs-action' | 'fyi';
  summary: string;
  stage: string;
  recommended_action: string;
}

function heuristicAnalysis(source: string, data: any): AnalysisResult {
  if (source === 'n8n_error') {
    return {
      severity: 'blocker',
      summary: `Pipeline failure: ${data.workflow_name ?? 'unknown workflow'}`,
      stage: 'processing',
      recommended_action:
        'Open n8n and check the failed execution log for the specific node and error.',
    };
  }
  if (source === 'assessment_miss') {
    const isMajor = String(data.feedback_category) === '2';
    return {
      severity: isMajor ? 'needs-action' : 'fyi',
      summary: isMajor
        ? 'Major AI correction: WF6 significantly reworked output'
        : 'Minor AI refinement applied by WF6',
      stage: 'chat',
      recommended_action: isMajor
        ? 'Review the WF6 correction text to understand what the initial AI got wrong.'
        : 'No action needed; monitor for patterns across users.',
    };
  }
  if (source === 'chapter_feedback') {
    return {
      severity: 'fyi',
      summary: 'User submitted mid-chat section feedback',
      stage: 'chat',
      recommended_action: 'No immediate action needed; review for content quality patterns.',
    };
  }
  if (source === 'support') {
    const cat = String(data.category ?? '');
    const blockerCats = ['account_login', 'access_code_payment', 'bug_report'];
    return {
      severity: blockerCats.includes(cat)
        ? 'blocker'
        : cat === 'feature_idea'
          ? 'fyi'
          : 'needs-action',
      summary: `Support ticket: ${cat.replace(/_/g, ' ')}`,
      stage: 'unknown',
      recommended_action: 'Read the message and reply by email if the user is stuck.',
    };
  }
  return {
    severity: 'fyi',
    summary: 'Ops signal received',
    stage: 'unknown',
    recommended_action: 'Review manually.',
  };
}

async function analyzeItemsBatch(
  items: Array<{ key: string; source: string; data: unknown }>,
): Promise<Map<string, AnalysisResult>> {
  const results = new Map<string, AnalysisResult>();
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!anthropicKey) {
    for (const item of items) {
      results.set(item.key, heuristicAnalysis(item.source, item.data));
    }
    return results;
  }

  const prompt = `Analyze these ${items.length} operational signals for Cairnly. Return ONLY a valid JSON array (same order as input, one object per item). Schema per object: {"severity":"blocker|needs-action|fyi","summary":"max 12 words","stage":"signup|payment|survey|processing|chat|feedback|report|jobs|unknown","recommended_action":"one concrete sentence"}

Items:
${JSON.stringify(
  items.map((i) => ({ source: i.source, data: i.data })),
  null,
  2,
)}

Return only the JSON array. No prose.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (r.ok) {
      const resp = await r.json();
      const text: string = resp.content?.[0]?.text ?? '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed: AnalysisResult[] = JSON.parse(match[0]);
        for (let i = 0; i < items.length && i < parsed.length; i++) {
          results.set(items[i].key, {
            severity: parsed[i]?.severity ?? 'fyi',
            summary: parsed[i]?.summary ?? 'No summary available',
            stage: parsed[i]?.stage ?? 'unknown',
            recommended_action: parsed[i]?.recommended_action ?? '',
          });
        }
        return results;
      }
    } else {
      console.error('[ops-feed] Claude API error:', r.status, await r.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[ops-feed] Claude batch call failed:', e);
  }

  // Fallback for any items that didn't get an analysis
  for (const item of items) {
    if (!results.has(item.key)) {
      results.set(item.key, heuristicAnalysis(item.source, item.data));
    }
  }
  return results;
}

// ─── Upstream flag helper ─────────────────────────────────────────────────────

function isUpstreamOutageAt(
  ts: string,
  claudeStatus: ProviderStatus | null,
  openaiStatus: ProviderStatus | null,
): boolean {
  if (!ts) return false;
  const errorTime = new Date(ts).getTime();
  const now = Date.now();
  // If there's an active incident that started before the error time, flag it
  const statuses = [claudeStatus, openaiStatus].filter(Boolean) as ProviderStatus[];
  return statuses.some((s) => {
    if (s.indicator === 'none') return false;
    return s.incidents.some((inc) => {
      const incStart = new Date(inc.started_at).getTime();
      return incStart <= errorTime && errorTime <= now;
    });
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

  // Parse the body once; an { action: 'dismiss', item_key } request resolves an
  // item instead of returning the feed.
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body?.action === 'dismiss' && typeof body.item_key === 'string') {
    const itemKey: string = body.item_key;
    // Flag it in the analysis cache so non-support items stay hidden.
    await supabase
      .from('ops_analysis')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('item_key', itemKey);
    // Support tickets carry a real status — resolve at the source too.
    if (itemKey.startsWith('support:')) {
      const id = itemKey.slice('support:'.length);
      await supabase.from('support_requests').update({ status: 'resolved' }).eq('id', id);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch all data sources in parallel (fire and forget individual failures)
  const [
    claudeStatus,
    openaiStatus,
    n8nErrors,
    n8nUsage,
    people,
    deploy,
    trafficResult,
    supportResult,
    missesResult,
    chapterFeedbackResult,
  ] = await Promise.all([
    fetchProviderStatus('https://status.anthropic.com', 'https://status.anthropic.com'),
    fetchProviderStatus('https://status.openai.com', 'https://status.openai.com'),
    fetchN8nErrors(),
    fetchN8nUsage(),
    fetchPeople(supabase, 30),
    fetchVercelDeploy(),
    supabase.rpc('ops_traffic_stats'),
    supabase
      .from('support_requests')
      .select('*')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('report_sections')
      .select(
        'id, user_id, report_id, section_type, feedback, feedback_category, created_at',
      )
      .in('feedback_category', [1, 2])
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('report_sections')
      .select(
        'id, user_id, report_id, section_type, feedback, feedback_category, created_at',
      )
      .like('section_type', 'chapter_%_feedback')
      .not('feedback', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const supportRows = supportResult.data ?? [];
  const missRows = missesResult.data ?? [];
  const chapterRows = chapterFeedbackResult.data ?? [];
  const traffic = trafficResult.data ?? null;

  // Build raw items from each source
  const rawItems: Array<{ key: string; source: string; raw: Record<string, unknown> }> = [
    ...n8nErrors.map((e) => ({
      key: `n8n:${e.id}`,
      source: 'n8n_error' as const,
      raw: e,
    })),
    ...supportRows.map((r) => ({
      key: `support:${r.id}`,
      source: 'support' as const,
      raw: r,
    })),
    ...missRows.map((r) => ({
      key: `assessment_miss:${r.id}`,
      source: 'assessment_miss' as const,
      raw: r,
    })),
    ...chapterRows.map((r) => ({
      key: `chapter_feedback:${r.id}`,
      source: 'chapter_feedback' as const,
      raw: r,
    })),
  ];

  // Deduplicate (chapter_feedback rows might also appear in missRows if they have category)
  const seen = new Set<string>();
  const dedupedItems = rawItems.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });

  if (dedupedItems.length === 0) {
    return new Response(
      JSON.stringify({
        provider_status: { claude: claudeStatus, openai: openaiStatus },
        items: [],
        people,
        deploy,
        traffic,
        n8n_usage: n8nUsage,
        fetched_at: new Date().toISOString(),
        new_analyzed: 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Check cache for all item keys
  const allKeys = dedupedItems.map((i) => i.key);
  const { data: cachedRows } = await supabase
    .from('ops_analysis')
    .select('*')
    .in('item_key', allKeys);

  const cacheMap = new Map<string, any>();
  for (const row of cachedRows ?? []) {
    cacheMap.set(row.item_key, row);
  }

  // Drop items an admin has dismissed (support tickets are already excluded at
  // the source via status='resolved'; this covers n8n errors / misses / feedback).
  const visibleItems = dedupedItems.filter((item) => !cacheMap.get(item.key)?.dismissed_at);

  const now = Date.now();
  const needsAnalysis = visibleItems.filter((item) => {
    const cached = cacheMap.get(item.key);
    if (!cached) return true;
    const age = now - new Date(cached.analyzed_at).getTime();
    return age > CACHE_TTL_MS;
  });

  // Run Claude analysis on new/stale items (capped to MAX_NEW_ANALYSES)
  let newAnalyzedCount = 0;
  if (needsAnalysis.length > 0) {
    const batch = needsAnalysis.slice(0, MAX_NEW_ANALYSES);
    newAnalyzedCount = batch.length;
    const analyses = await analyzeItemsBatch(
      batch.map((item) => ({
        key: item.key,
        source: item.source,
        data: item.raw,
      })),
    );

    // Upsert results into ops_analysis cache
    const upsertRows = batch.map((item) => {
      const analysis = analyses.get(item.key) ?? heuristicAnalysis(item.source, item.raw);
      return {
        item_key: item.key,
        source: item.source,
        severity: analysis.severity,
        summary: analysis.summary,
        stage: analysis.stage,
        recommended_action: analysis.recommended_action,
        raw_data: item.raw,
        analyzed_at: new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase
      .from('ops_analysis')
      .upsert(upsertRows, { onConflict: 'item_key' });

    if (upsertErr) {
      console.error('[ops-feed] ops_analysis upsert error:', upsertErr);
    } else {
      for (const row of upsertRows) {
        cacheMap.set(row.item_key, row);
      }
    }
  }

  // Generate signed URLs for support ticket screenshots
  const screenshotUrls = new Map<string, string>();
  const supportWithScreenshots = supportRows.filter((r) => r.screenshot_path);
  await Promise.all(
    supportWithScreenshots.map(async (r) => {
      const { data: signed } = await supabase.storage
        .from('support-attachments')
        .createSignedUrl(r.screenshot_path, SCREENSHOT_TTL_SECS);
      if (signed?.signedUrl) {
        screenshotUrls.set(`support:${r.id}`, signed.signedUrl);
      }
    }),
  );

  // Build final items list
  const items = visibleItems.map((item) => {
    const cached = cacheMap.get(item.key);
    const analysis = cached
      ? {
          severity: cached.severity,
          summary: cached.summary,
          stage: cached.stage,
          recommended_action: cached.recommended_action,
          analyzed_at: cached.analyzed_at,
        }
      : heuristicAnalysis(item.source, item.raw);

    const rawTs =
      (item.raw as any).created_at ??
      (item.raw as any).startedAt ??
      (item.raw as any).timestamp ??
      null;

    const upstreamFlag =
      item.source === 'n8n_error'
        ? isUpstreamOutageAt(rawTs, claudeStatus, openaiStatus)
        : false;

    return {
      key: item.key,
      source: item.source,
      severity: (analysis as AnalysisResult).severity,
      summary: (analysis as AnalysisResult).summary,
      stage: (analysis as AnalysisResult).stage,
      recommended_action: (analysis as AnalysisResult).recommended_action,
      analyzed_at: (cached as any)?.analyzed_at ?? new Date().toISOString(),
      raw: item.raw,
      upstream_flag: upstreamFlag,
      ...(item.source === 'support' && screenshotUrls.has(item.key)
        ? { screenshot_url: screenshotUrls.get(item.key) }
        : {}),
    };
  });

  // Sort: blockers first, then needs-action, then fyi; within each group by date desc
  const severityOrder: Record<string, number> = { blocker: 0, 'needs-action': 1, fyi: 2 };
  items.sort((a, b) => {
    const sDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (sDiff !== 0) return sDiff;
    const aTs =
      (a.raw as any).created_at ?? (a.raw as any).startedAt ?? '';
    const bTs =
      (b.raw as any).created_at ?? (b.raw as any).startedAt ?? '';
    return bTs.localeCompare(aTs);
  });

  return new Response(
    JSON.stringify({
      provider_status: { claude: claudeStatus, openai: openaiStatus },
      items,
      people,
      deploy,
      traffic,
      n8n_usage: n8nUsage,
      fetched_at: new Date().toISOString(),
      new_analyzed: newAnalyzedCount,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
