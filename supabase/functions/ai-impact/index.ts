// ai-impact: Jev AI-impact label for every career of one report (design doc 2.3b).
//
// POST, x-shared-secret = N8N_SHARED_SECRET (n8n / pg_net / manual).
// Body: { report_id: string, dry_run?: boolean }
//
// Reads the report's enriched_jobs rows and the newest active ai_research.key_findings, sends one
// Jev request per career (all in parallel), applies the 2.3b rules and writes ai_impact_level,
// _confidence, _probabilities, _model and _at. dry_run returns the labels without writing.
//
// Only job information goes to TypeSafe (title, overview, tasks, size type, path type, research),
// never profile, CV or chat data. The old ai_impact_rating column is not touched.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { callJev, JevError, requireJevKey } from '../_shared/jev.ts';
import { AI_IMPACT_QUESTIONS, designLabel, jevState, ownershipOf } from '../_shared/aiImpactRules.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: { report_id?: string; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }
  const reportId = body.report_id;
  if (!reportId || !/^[0-9a-f-]{36}$/i.test(reportId)) return json({ error: 'report_id (uuid) required' }, 400);

  let key: string;
  try {
    key = requireJevKey();
  } catch (e) {
    console.error('[ai-impact]', (e as Error).message);
    return json({ error: 'Server misconfigured' }, 503);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const [jobsRes, researchRes] = await Promise.all([
    supabase
      .from('enriched_jobs')
      .select('id, career_title, overview, typical_tasks, company_size_type, path_type')
      .eq('report_id', reportId)
      .order('id'),
    supabase
      .from('ai_research')
      .select('key_findings')
      .eq('is_active', true)
      .order('published_date', { ascending: false })
      .limit(1),
  ]);
  if (jobsRes.error) {
    console.error('[ai-impact] enriched_jobs', jobsRes.error.message);
    return json({ error: 'Failed to read careers' }, 500);
  }
  if (researchRes.error) {
    console.error('[ai-impact] ai_research', researchRes.error.message);
    return json({ error: 'Failed to read research' }, 500);
  }
  const jobs = jobsRes.data ?? [];
  if (!jobs.length) return json({ report_id: reportId, labelled: 0, results: [] });
  const research = (researchRes.data?.[0]?.key_findings as string | null) ?? null;

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const res = await callJev(
          key,
          { state: jevState(job, research), questions: AI_IMPACT_QUESTIONS },
          { tag: `report=${reportId} job=${job.id}` },
        );
        const a = res.answers;
        const { label, rule } = designLabel(a as any);
        const row = {
          ai_impact_level: label,
          ai_impact_confidence: a.ai_impact?.confidence ?? null,
          ai_impact_probabilities: a.ai_impact?.probabilities ?? null,
          ai_impact_model: res.model,
          ai_impact_at: new Date().toISOString(),
        };
        if (!body.dry_run) {
          const { error } = await supabase.from('enriched_jobs').update(row).eq('id', job.id);
          if (error) throw new Error(`update: ${error.message}`);
        }
        return {
          id: job.id,
          title: job.career_title,
          level: label,
          rule,
          ownership: ownershipOf(job),
          score: a.ai_impact?.score ?? null,
          confidence: row.ai_impact_confidence,
        };
      } catch (e) {
        const status = e instanceof JevError ? e.status : undefined;
        console.error(`[ai-impact] job ${job.id}`, (e as Error).message);
        return { id: job.id, title: job.career_title, error: (e as Error).message, status };
      }
    }),
  );

  const failed = results.filter((r) => 'error' in r).length;
  return json(
    { report_id: reportId, dry_run: Boolean(body.dry_run), labelled: results.length - failed, failed, results },
    failed && failed === results.length ? 502 : 200,
  );
});
