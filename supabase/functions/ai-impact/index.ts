// ai-impact: Jev AI-impact label per career (design doc 2.3b).
//
// POST, x-shared-secret = N8N_SHARED_SECRET (n8n / pg_net / manual). Two modes:
//
// 1. Report mode  { report_id, dry_run? }  (WF2, after the 15 careers are saved)
//    Labels every enriched_jobs row of the report and writes ai_impact_level, _confidence,
//    _probabilities, _model and _at.
// 2. Items mode   { items: [{ key, title, overview?, typical_tasks?, company_size_type?, path_type? }], dry_run? }
//    (WF3 outside-the-box cards, WF4 dream-job cards, which are not in enriched_jobs)
//    Returns [{ key, level, rule, pinned }] and writes nothing but the pin table.
//
// Title pin (both modes): public.ai_impact_pins holds the FIRST label per normalized title
// (titleNorm: letters and digits only) + own-work/employee split. A pinned title reuses that label
// instead of asking Jev, so the same career shows the same pill on every card type and every report.
// A fresh Jev label is stored as the pin (first one wins). To relabel everything, empty the pin
// table and null out enriched_jobs.ai_impact_level.
//
// Only job information goes to TypeSafe (title, overview, tasks, size type, path type, research),
// never profile, CV or chat data. The old ai_impact_rating column is not touched.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { callJev, JevError, requireJevKey } from '../_shared/jev.ts';
import { AI_IMPACT_QUESTIONS, designLabel, jevState, ownershipOf, titleNorm } from '../_shared/aiImpactRules.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const MAX_ITEMS = 10;

interface Career {
  career_title: string | null;
  overview: string | null;
  typical_tasks: string[] | null;
  company_size_type: string | null;
  path_type: string | null;
}

interface Pin {
  title_norm: string;
  ownership: string;
  level: string;
  confidence: number | null;
  probabilities: Record<string, number> | null;
  model: string | null;
}

const pinKey = (c: Pick<Career, 'career_title' | 'company_size_type' | 'path_type'>) =>
  `${titleNorm(c.career_title)}|${ownershipOf(c)}`;

async function loadPins(supabase: SupabaseClient, careers: Career[]): Promise<Map<string, Pin>> {
  const norms = [...new Set(careers.map((c) => titleNorm(c.career_title)).filter(Boolean))];
  const pins = new Map<string, Pin>();
  if (!norms.length) return pins;
  const { data, error } = await supabase
    .from('ai_impact_pins')
    .select('title_norm, ownership, level, confidence, probabilities, model')
    .in('title_norm', norms);
  if (error) console.error('[ai-impact] pin lookup', error.message); // fall through to Jev
  for (const p of (data ?? []) as Pin[]) pins.set(`${p.title_norm}|${p.ownership}`, p);
  return pins;
}

// Label one career: the pin if there is one, else Jev + the 2.3b rules (and store the new pin).
async function labelCareer(
  supabase: SupabaseClient,
  key: string,
  research: string | null,
  career: Career,
  pins: Map<string, Pin>,
  dryRun: boolean,
  tag: string,
) {
  const ownership = ownershipOf(career);
  const pin = pins.get(pinKey(career));
  if (pin) {
    return {
      level: pin.level,
      rule: 'pinned',
      ownership,
      confidence: pin.confidence,
      probabilities: pin.probabilities,
      model: pin.model,
      score: null as number | null,
    };
  }
  const res = await callJev(key, { state: jevState(career, research), questions: AI_IMPACT_QUESTIONS }, { tag });
  const a = res.answers;
  const { label, rule } = designLabel(a as any, ownership);
  const out = {
    level: label as string,
    rule: rule as string,
    ownership,
    confidence: a.ai_impact?.confidence ?? null,
    probabilities: a.ai_impact?.probabilities ?? null,
    model: res.model,
    score: a.ai_impact?.score ?? null,
  };
  const norm = titleNorm(career.career_title);
  if (!dryRun && norm) {
    const { error } = await supabase.from('ai_impact_pins').upsert(
      {
        title_norm: norm,
        ownership,
        level: out.level,
        confidence: out.confidence,
        probabilities: out.probabilities,
        model: out.model,
        sample_title: career.career_title,
        source: 'jev',
      },
      { onConflict: 'title_norm,ownership', ignoreDuplicates: true },
    );
    if (error) console.error('[ai-impact] pin write', error.message);
  }
  return out;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: { report_id?: string; items?: unknown; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }
  const dryRun = Boolean(body.dry_run);
  const reportId = body.report_id;
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items && (!reportId || !/^[0-9a-f-]{36}$/i.test(reportId))) {
    return json({ error: 'report_id (uuid) or items[] required' }, 400);
  }
  if (items && (items.length === 0 || items.length > MAX_ITEMS)) {
    return json({ error: `items must hold 1 to ${MAX_ITEMS} careers` }, 400);
  }

  let key: string;
  try {
    key = requireJevKey();
  } catch (e) {
    console.error('[ai-impact]', (e as Error).message);
    return json({ error: 'Server misconfigured' }, 503);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const researchRes = await supabase
    .from('ai_research')
    .select('key_findings')
    .eq('is_active', true)
    .order('published_date', { ascending: false })
    .limit(1);
  if (researchRes.error) {
    console.error('[ai-impact] ai_research', researchRes.error.message);
    return json({ error: 'Failed to read research' }, 500);
  }
  const research = (researchRes.data?.[0]?.key_findings as string | null) ?? null;

  // ---- Items mode: outside-the-box and dream-job cards ----
  if (items) {
    const careers = items.map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      return {
        key: String(it.key ?? ''),
        career: {
          career_title: str(it.title),
          overview: str(it.overview),
          typical_tasks: Array.isArray(it.typical_tasks) ? (it.typical_tasks as string[]) : null,
          company_size_type: str(it.company_size_type),
          path_type: str(it.path_type),
        } as Career,
      };
    });
    const pins = await loadPins(supabase, careers.map((c) => c.career));
    const results = await Promise.all(
      careers.map(async ({ key: itemKey, career }) => {
        if (!career.career_title) return { key: itemKey, error: 'title required' };
        try {
          const r = await labelCareer(supabase, key, research, career, pins, dryRun, `item=${career.career_title}`);
          return { key: itemKey, title: career.career_title, level: r.level, rule: r.rule, pinned: r.rule === 'pinned', ownership: r.ownership, score: r.score };
        } catch (e) {
          const status = e instanceof JevError ? e.status : undefined;
          console.error(`[ai-impact] item ${career.career_title}`, (e as Error).message);
          return { key: itemKey, title: career.career_title, error: (e as Error).message, status };
        }
      }),
    );
    const failed = results.filter((r) => 'error' in r).length;
    return json({ mode: 'items', dry_run: dryRun, labelled: results.length - failed, failed, results }, failed && failed === results.length ? 502 : 200);
  }

  // ---- Report mode: the report's enriched_jobs rows ----
  const jobsRes = await supabase
    .from('enriched_jobs')
    .select('id, career_title, overview, typical_tasks, company_size_type, path_type')
    .eq('report_id', reportId)
    .order('id');
  if (jobsRes.error) {
    console.error('[ai-impact] enriched_jobs', jobsRes.error.message);
    return json({ error: 'Failed to read careers' }, 500);
  }
  const jobs = jobsRes.data ?? [];
  if (!jobs.length) return json({ report_id: reportId, labelled: 0, results: [] });
  const pins = await loadPins(supabase, jobs as Career[]);

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const r = await labelCareer(supabase, key, research, job as Career, pins, dryRun, `report=${reportId} job=${job.id}`);
        if (!dryRun) {
          const { error } = await supabase
            .from('enriched_jobs')
            .update({
              ai_impact_level: r.level,
              ai_impact_confidence: r.confidence,
              ai_impact_probabilities: r.probabilities,
              ai_impact_model: r.model,
              ai_impact_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          if (error) throw new Error(`update: ${error.message}`);
        }
        return { id: job.id, title: job.career_title, level: r.level, rule: r.rule, ownership: r.ownership, score: r.score, confidence: r.confidence };
      } catch (e) {
        const status = e instanceof JevError ? e.status : undefined;
        console.error(`[ai-impact] job ${job.id}`, (e as Error).message);
        return { id: job.id, title: job.career_title, error: (e as Error).message, status };
      }
    }),
  );

  const failed = results.filter((r) => 'error' in r).length;
  return json(
    { report_id: reportId, dry_run: dryRun, labelled: results.length - failed, failed, results },
    failed && failed === results.length ? 502 : 200,
  );
});
