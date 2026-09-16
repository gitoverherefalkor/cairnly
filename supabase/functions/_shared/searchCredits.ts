// Job-search credit rules. Pure logic, no Deno imports, so vitest can cover
// every branch (see vite.config.ts `test.include`).
//
// One "search" is ONE CAREER that actually reaches n8n. A press of Search can
// cover up to 3 careers, each of which is a separate search-jobs call, and
// each of those is a separate Apify LinkedIn scrape plus AI scoring. Charging
// per career is what actually tracks our cost.
//
// Cache hits are free. The Recent Searches chips deliberately re-run previous
// configs, which the 24h job_search_cache serves for nothing, so charging for
// them would bill the user for something that costs us zero.

export const FREE_SEARCH_LIMIT = 4;

export interface ChargeInput {
  /** Whether job_search_cache already had a fresh result for this signature. */
  cacheHit: boolean;
  /** True when the user has a referral or a comped tool unlock. */
  unlimited: boolean;
  /** Existing 'charged' rows in user_job_searches for THIS report. */
  chargedCount: number;
}

export interface ChargeDecision {
  /** False means: refuse the request, do not call n8n. */
  allow: boolean;
  /** True means: this run consumes one of the free searches. */
  charge: boolean;
  /** What to write to user_job_searches.search_status, or null when refused. */
  log: 'charged' | 'cached' | null;
}

export function decideSearchCharge(input: ChargeInput): ChargeDecision {
  // A cache hit costs nothing, so it is always allowed and never charged —
  // including for a user who has already exhausted their free searches.
  if (input.cacheHit) {
    return { allow: true, charge: false, log: 'cached' };
  }

  if (input.unlimited) {
    return { allow: true, charge: true, log: 'charged' };
  }

  if (input.chargedCount >= FREE_SEARCH_LIMIT) {
    return { allow: false, charge: false, log: null };
  }

  return { allow: true, charge: true, log: 'charged' };
}
