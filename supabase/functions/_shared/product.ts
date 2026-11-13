// Which product a report belongs to (Pro/Starter vs Encore), server side.
//
// reports.survey_id and reports.access_code_id are NOT filled for current
// reports (checked 2026-11-13 on all four round 6 Encore reports), so they
// can't be the only signal. The survey id the user submitted is always in
// reports.payload.survey_id (forward-to-n8n routes on that same field), and
// the owner's access code carries survey_type as a last fallback.
//
// deno-lint-ignore-file no-explicit-any

export const ENCORE_SURVEY_IDS = new Set([
  '00000000-0000-0000-0000-000000000003', // Encore v1
  '00000000-0000-0000-0000-000000000004', // Encore v2
]);

/** Encore v2 Q3.5 "Is there something you already tried, or an idea you keep
 *  coming back to?". Optional. Empty = WF4P writes no dream_jobs ("Your
 *  idea") section, by design (Sjoerd 2026-11-10). */
export const ENCORE_IDEA_QUESTION_ID = 'c3c3c3c3-0003-4000-a000-000000000005';

export interface ReportProduct {
  encore: boolean;
  /** False only when we KNOW no dream_jobs/idea section is coming. */
  expectsDreamJobs: boolean;
}

function answerText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(answerText).join(' ').trim();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return answerText(o.value ?? o.text ?? o.answer ?? '');
  }
  return String(v).trim();
}

/** Product facts for one report. Never throws: unknown → Pro defaults. */
export async function getReportProduct(supabase: any, reportId: string): Promise<ReportProduct> {
  try {
    const { data: report } = await supabase
      .from('reports')
      .select('user_id, survey_id, payload')
      .eq('id', reportId)
      .maybeSingle();
    if (!report) return { encore: false, expectsDreamJobs: true };

    const payload = (report.payload ?? {}) as Record<string, any>;
    const surveyId = String(report.survey_id ?? payload.survey_id ?? '');
    let encore = ENCORE_SURVEY_IDS.has(surveyId);

    if (!encore && !surveyId && report.user_id) {
      const { data: codes } = await supabase
        .from('access_codes')
        .select('survey_type, created_at')
        .eq('user_id', report.user_id)
        .order('created_at', { ascending: false })
        .limit(1);
      encore = /^encore/i.test(String(codes?.[0]?.survey_type ?? ''));
    }

    const responses = (payload.responses ?? {}) as Record<string, unknown>;
    const expectsDreamJobs = encore ? answerText(responses[ENCORE_IDEA_QUESTION_ID]) !== '' : true;
    return { encore, expectsDreamJobs };
  } catch (e) {
    console.error('[product] lookup failed:', e);
    return { encore: false, expectsDreamJobs: true };
  }
}
