
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, checkRateLimit, errorResponse } from "../_shared/cors.ts";

// Cache duration: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  // Handle CORS preflight
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Rate limit: 10 requests per minute per IP
  const rateLimited = checkRateLimit(req, 10, corsHeaders);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { career_title, location, alternate_titles, work_arrangement, job_commitment, report_id } = body;

    // Survey-derived "avoid" preferences (industries + career aspects the user
    // wants to steer clear of). Forwarded to n8n's scorer as a penalty signal.
    const avoidPreferences: string[] = Array.isArray(body.avoid_preferences)
      ? body.avoid_preferences.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];

    // Accept country_codes (array, 1-2 entries) OR country_code (legacy single).
    // Always normalize to a sorted, deduped array internally.
    const rawCountries: string[] = Array.isArray(body.country_codes) && body.country_codes.length > 0
      ? body.country_codes
      : body.country_code
        ? [body.country_code]
        : [];

    if (!career_title || rawCountries.length === 0) {
      return errorResponse('career_title and country_codes (or country_code) are required', 400, corsHeaders);
    }

    const countries = [...new Set(rawCountries.map((c: string) => String(c).toLowerCase().trim()))]
      .filter(Boolean)
      .slice(0, 2)
      .sort();
    // Work arrangement: 'any' (no filter) | 'remote_friendly' (remote+hybrid)
    // | 'remote_only' (fully remote). Defaults to 'any'. Legacy callers that
    // still send remote_only=true are mapped to 'remote_only'.
    const VALID_ARRANGEMENTS = new Set(['any', 'remote_friendly', 'remote_only']);
    const workArrangement = VALID_ARRANGEMENTS.has(String(work_arrangement))
      ? String(work_arrangement)
      : (body.remote_only ? 'remote_only' : 'any');

    // Hours / commitment: 'any' (no filter) | 'full_time' | 'part_time' |
    // 'contract' (covers fractional/interim/freelance/consultant). Defaults
    // to 'any'.
    const VALID_COMMITMENTS = new Set(['any', 'full_time', 'part_time', 'contract']);
    const jobCommitment = VALID_COMMITMENTS.has(String(job_commitment))
      ? String(job_commitment)
      : 'any';

    // User languages — the frontend extracts these from the user's report payload
    // when the survey collected them. Format: [{ language: 'Dutch', proficiency: 'fluent' }, ...]
    // Older reports (pre-language-question) will pass an empty array, which we treat
    // as "no language gating" so behavior is unchanged for legacy users.
    type UserLanguage = { language: string; proficiency: string };
    const userLanguages: UserLanguage[] = Array.isArray(body.user_languages)
      ? body.user_languages.filter((l: any) => l && typeof l.language === 'string')
      : [];

    // Cache signature for languages: sorted list of languages the user holds at
    // conversational+ (so basic/none don't affect the cache). Two users sharing
    // the same conversational+ language set get the same cached result.
    const CONVERSATIONAL_OR_BETTER = new Set(['native', 'fluent', 'conversational']);
    const langSignature = userLanguages
      .filter((l) => CONVERSATIONAL_OR_BETTER.has((l.proficiency || '').toLowerCase()))
      .map((l) => (l.language || '').toLowerCase().trim())
      .filter(Boolean)
      .sort()
      .join('+') || 'any';

    // Initialize Supabase client with service role for cache + enriched_jobs access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Look up alternate_titles for this career upfront. n8n's anon-keyed
    // Supabase node would be blocked by RLS, so we pre-fetch here using the
    // service role and forward to n8n. n8n's conditional fallback then
    // decides whether to actually use these.
    let dbAlternateTitles: string[] = [];
    if (report_id && career_title) {
      const { data: enrichedRow, error: enrichedErr } = await supabase
        .from('enriched_jobs')
        .select('alternate_titles')
        .eq('career_title', career_title)
        .eq('report_id', report_id)
        .limit(1)
        .maybeSingle();

      if (!enrichedErr && enrichedRow?.alternate_titles) {
        const raw = enrichedRow.alternate_titles;
        // alternate_titles is jsonb — could be array or object
        if (Array.isArray(raw)) {
          dbAlternateTitles = raw.map((t: any) => String(t || '').trim()).filter(Boolean);
        } else if (raw && typeof raw === 'object') {
          dbAlternateTitles = Object.values(raw)
            .map((t: any) => String(t || '').trim())
            .filter(Boolean);
        }
      }
    }

    // Bump this whenever the n8n search/scoring logic changes, so stale
    // results cached under the old logic stop matching and fresh searches run.
    // v2: LLM keyword generator + scoring specialization rule (2026-05-22).
    // v3: avoid-preferences penalty in scoring (2026-05-22).
    // v4: scoring sees 400 chars of description (was 200) (2026-05-22).
    // v5: capture workplace_type + employment_type for result badges (2026-05-22).
    // v6: apply_url now uses LinkedIn job page instead of offsite applyUrl (2026-05-23).
    // v7: split commitment 'part_time' (was P,C) into 'part_time' (P) + 'contract' (C) (2026-05-23).
    // v8: scoring tightened (role-function + seniority rules) + desc slice 400→600 (2026-05-26).
    // v9: rebuild descriptions from descriptionHtml so headings/paragraphs no longer smash together (2026-05-26).
    // v10: scoring upgraded to Claude Sonnet 4.5 + Apply Scores threshold 5→3 (frontend partitions 3-5 vs 6+) (2026-05-26).
    // v11: scorer now sees alt titles + alt-search uses up to 3 (was 1) + Apify count cap 15→40 (2026-05-26).
    const SEARCH_LOGIC_VERSION = 'v11';

    // Avoid-prefs signature: stable per user, so users with different avoid
    // lists don't share each other's scored cache. Sorted so order doesn't matter.
    const avoidSignature = avoidPreferences.length
      ? [...avoidPreferences].map((s) => s.toLowerCase()).sort().join('|')
      : 'none';

    // Cache key: logic version + sorted country list + arrangement + language
    // signature. Same query in NL+DE hits the same cache regardless of which
    // order the user picked; same query for users with the same language
    // profile reuses.
    const searchQuery = career_title.toLowerCase().trim();
    const countryNormalized = SEARCH_LOGIC_VERSION + ':'
      + countries.join('+')
      + (workArrangement !== 'any' ? ':' + workArrangement : '')
      + (jobCommitment !== 'any' ? ':jt=' + jobCommitment : '')
      + ':lang=' + langSignature
      + ':avoid=' + avoidSignature;

    // Check cache first
    const { data: cached } = await supabase
      .from('job_search_cache')
      .select('results, result_count, fetched_at')
      .eq('search_query', searchQuery)
      .eq('country_code', countryNormalized)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({
        jobs: cached.results,
        total_count: cached.result_count,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache miss — call n8n webhook
    const n8nWebhookUrl = Deno.env.get('N8N_JOB_SEARCH_WEBHOOK_URL');

    if (!n8nWebhookUrl) {
      console.error('N8N_JOB_SEARCH_WEBHOOK_URL not set');
      return errorResponse('Job search is temporarily unavailable.', 503, corsHeaders);
    }

    // Validate webhook URL
    try {
      const parsed = new URL(n8nWebhookUrl);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch {
      console.error('N8N_JOB_SEARCH_WEBHOOK_URL is not a valid URL');
      return errorResponse('Job search is temporarily unavailable.', 503, corsHeaders);
    }

    // Call n8n with 150-second timeout (LinkedIn scraping via Apify can take 20-90s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150_000);

    let resp: Response;
    try {
      resp = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          career_title,
          alternate_titles: alternate_titles || [],
          country_codes: countries,
          work_arrangement: workArrangement,
          job_commitment: jobCommitment,
          avoid_preferences: avoidPreferences,
          location: location || '',
          // user_languages drives the scoring step's language-awareness.
          // Forwarded as-is; n8n decides how aggressively to weight it.
          user_languages: userLanguages,
          report_id: report_id || null,
          // alternate_titles pulled from enriched_jobs server-side (RLS-safe).
          // n8n's conditional alt-search path will use these when the primary
          // result count is below the threshold.
          alternate_titles_db: dbAlternateTitles,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      const isTimeout = fetchError instanceof DOMException && fetchError.name === 'AbortError';
      console.error('n8n webhook error:', fetchError);
      return errorResponse(
        isTimeout ? 'Job search timed out. Please try again.' : 'Job search failed. Please try again.',
        isTimeout ? 504 : 502,
        corsHeaders
      );
    }
    clearTimeout(timeout);

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('n8n returned error:', resp.status, errBody);
      return errorResponse('Job search failed. Please try again.', 502, corsHeaders);
    }

    const n8nResult = await resp.json();

    // Normalize: n8n should return { jobs: [...] } but handle variations
    const jobs = Array.isArray(n8nResult) ? n8nResult
      : Array.isArray(n8nResult.jobs) ? n8nResult.jobs
      : [];

    // Store in cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await supabase.from('job_search_cache').insert({
      search_query: searchQuery,
      country_code: countryNormalized,
      results: jobs,
      result_count: jobs.length,
      expires_at: expiresAt,
    });

    return new Response(JSON.stringify({
      jobs,
      total_count: jobs.length,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-jobs function:', error);
    return errorResponse('An error occurred searching for jobs. Please try again.', 500, corsHeaders);
  }
});
