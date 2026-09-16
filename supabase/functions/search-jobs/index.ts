
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, checkRateLimit, errorResponse, getAuthenticatedUser } from "../_shared/cors.ts";
import { decideSearchCharge, FREE_SEARCH_LIMIT } from "../_shared/searchCredits.ts";

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

  // Until now this function had verify_jwt = false AND no in-function auth
  // check, so anyone with the URL could trigger paid Apify scrapes. The
  // referral gate lived only in React and protected nothing here. Auth is also
  // a hard requirement for the per-user free-tier cap below.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const userId = authed.userId;

  try {
    const body = await req.json();
    const { career_title, location, alternate_titles, work_arrangement, job_commitment, report_id } = body;
    // 25-40 word plain-English description of the role from the report section's
    // Overview heading. Forwarded to n8n's keyword generator + scorer so they
    // have concrete context for niche careers.
    const careerOverview: string = typeof body.career_overview === 'string'
      ? body.career_overview.slice(0, 600)
      : '';

    // Which report section this career came from. user_job_searches.section_type
    // is NOT NULL, and section_type was only added to the request body alongside
    // the free tier, so read it defensively: an older client (a tab open across
    // the deploy) falls back to 'unknown' instead of failing the ledger insert,
    // which would silently hand out an uncounted search.
    const sectionType: string = typeof body.section_type === 'string' && body.section_type
      ? body.section_type
      : 'unknown';

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

    // The free-tier cap is counted per report, so report_id is now required and
    // must belong to the caller. Without this check a user could spend someone
    // else's allowance, or dodge their own by borrowing a stranger's report id.
    if (!report_id) {
      return errorResponse('report_id is required', 400, corsHeaders);
    }
    const { data: ownedReport } = await supabase
      .from('reports')
      .select('id')
      .eq('id', report_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!ownedReport) {
      return errorResponse('Report not found', 404, corsHeaders);
    }

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
    // v12: keyword generator now sees alt titles too (informs the primary search keyword) (2026-05-26).
    // v13: keyword generator + scorer now receive the report's Overview blurb for the career (2026-05-26).
    // v14: LinkedIn AI-search fallout — per-URL result cap (alt titles no longer starved),
    //      scorer enforces work arrangement + job commitment, real salary parsing (2026-08-10).
    // v15: 30-day f_TPR window on every search URL + applicant count surfaced
    //      and used as a tiebreak (2026-08-10).
    const SEARCH_LOGIC_VERSION = 'v15';

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

    const cacheHit = !!cached;

    // --- Free-tier gate ---------------------------------------------------
    // Unlimited if the user earned a referral or we comped them the tools.
    // Mirrors useReferralStatus.ts, where the 'jobs' tool unlocks at
    // max(referralCount, comp_tool_unlocks) >= 1.
    // comp_tool_unlocks is service-role-writable only as of 20260916110000.
    const [{ count: referralCount }, { data: profileRow }] = await Promise.all([
      supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', userId),
      supabase.from('profiles').select('comp_tool_unlocks').eq('id', userId).maybeSingle(),
    ]);
    const unlimited = (referralCount ?? 0) >= 1 || (profileRow?.comp_tool_unlocks ?? 0) >= 1;

    // How much of this report's allowance is already spent. Only searches that
    // actually reached n8n ('charged') count — cache hits cost us nothing.
    const { count: chargedCount } = await supabase
      .from('user_job_searches')
      .select('id', { count: 'exact', head: true })
      .eq('report_id', report_id)
      .eq('search_status', 'charged');

    const decision = decideSearchCharge({
      cacheHit,
      unlimited,
      chargedCount: chargedCount ?? 0,
    });

    if (!decision.allow) {
      // 429, not 402: the frontend branches on the `error` string, and 402
      // trips payment-required handling in some proxies.
      return new Response(
        JSON.stringify({
          error: 'search_limit_reached',
          used: chargedCount ?? 0,
          limit: FREE_SEARCH_LIMIT,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (cached) {
      // Free: job_search_cache answered, so no Apify scrape and no AI scoring
      // happened. Logged anyway ('cached' never counts against the cap) so the
      // user's search history is complete.
      const { error: cachedLedgerError } = await supabase.from('user_job_searches').insert({
        user_id: userId,
        report_id,
        career_title,
        section_type: sectionType,
        country_code: countryNormalized,
        location: location || null,
        search_status: 'cached',
      });
      if (cachedLedgerError) {
        console.error('user_job_searches insert (cached) failed:', cachedLedgerError);
      }

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
          career_overview: careerOverview,
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

    // Burn the credit only now. Every failure path above — missing/invalid
    // webhook URL, the 150s timeout, any fetch error, a non-2xx from n8n —
    // returns before this line, so a search that produced nothing never costs
    // the user one of their four.
    const { error: ledgerError } = await supabase.from('user_job_searches').insert({
      user_id: userId,
      report_id,
      career_title,
      section_type: sectionType,
      country_code: countryNormalized,
      location: location || null,
      search_status: decision.log,
    });
    if (ledgerError) {
      console.error('user_job_searches insert (charged) failed:', ledgerError);
    }

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
