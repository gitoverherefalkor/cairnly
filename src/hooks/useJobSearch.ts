
import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  apply_url: string;
  posted_date?: string;
  source: string;
  // Structured LinkedIn fields for result badges (null when LinkedIn omits them).
  workplace_type?: string | null; // 'Remote' | 'Hybrid' | null (on-site)
  employment_type?: string | null; // 'Full-time' | 'Part-time' | 'Contract' | …
  applicants_count?: number | null; // LinkedIn's public count, saturates at 200
  // AI-scored relevance to the recommended career (0-10) + a short reason.
  // Set by the n8n scoring step; null when scoring failed/skipped.
  match_score?: number | null;
  match_reason?: string | null;
}

export interface JobSearchResult {
  careerTitle: string;
  sectionType: string;
  jobs: JobListing[];
  totalCount: number;
  cached: boolean;
  status: 'idle' | 'searching' | 'done' | 'error';
  // Free-form failure message, EXCEPT for the sentinel LIMIT_ERROR below,
  // which the results UI swaps for its own localized "out of free searches"
  // copy instead of printing verbatim.
  error?: string;
}

// Sentinel written into JobSearchResult.error when the edge function refused
// the search because the report's 4 free searches are spent. Not user-facing
// text — JobsResults maps it to t('results.limitReached').
export const LIMIT_ERROR = 'limit';

/**
 * True when an invoke() failure is the edge function's 429
 * `{ error: 'search_limit_reached' }` refusal rather than a real fault.
 *
 * supabase-js does NOT hand a non-2xx body back as `data`: FunctionsClient
 * throws a FunctionsHttpError internally and surfaces it on `error`, so the
 * body never reaches the success branch. The Response lives on `error.context`
 * and is still unread at this point, so .json() is safe to call once.
 */
async function isSearchLimitError(err: unknown): Promise<boolean> {
  if (!(err instanceof FunctionsHttpError)) return false;
  const res = err.context as Response | undefined;
  if (!res || typeof res.json !== 'function') return false;
  try {
    const body = await res.json();
    return body?.error === 'search_limit_reached';
  } catch {
    // Non-JSON or already-consumed body — treat as a generic failure.
    return false;
  }
}

interface SearchCareer {
  careerTitle: string;
  sectionType: string;
  alternateTitles?: string[];
  // 25-40 word plain-English description of the role (from the report section's
  // Overview heading). Gives the n8n keyword generator + scorer concrete
  // context for niche careers, not just the title.
  overview?: string;
}

// Languages spoken by the user, extracted from the report payload's
// Skills & Achievements answer. Empty array for older reports — backend
// treats this as "no language gating" so legacy users see unchanged behavior.
export interface UserLanguage {
  language: string;
  proficiency: 'native' | 'fluent' | 'conversational' | 'basic';
}

// Where the user is willing to work. Maps to LinkedIn's work-type filter:
//   any            → no filter (on-site + hybrid + remote in the chosen countries)
//   remote_friendly → remote + hybrid
//   remote_only    → fully remote
export type WorkArrangement = 'any' | 'remote_friendly' | 'remote_only';

// Hours / engagement commitment. Maps to LinkedIn's job-type filter (f_JT):
//   any        → no filter
//   full_time  → F
//   part_time  → P
//   contract   → C  (covers fractional, interim, freelance, consultant gigs)
export type JobCommitment = 'any' | 'full_time' | 'part_time' | 'contract';

/**
 * Hook for searching jobs sequentially (one career at a time).
 * Returns per-career results and an overall progress state.
 */
export const useJobSearch = () => {
  const { toast } = useToast();
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);

  const searchJobs = async (
    careers: SearchCareer[],
    countryCodes: string[],
    location?: string,
    workArrangement?: WorkArrangement,
    jobCommitment?: JobCommitment,
    userLanguages?: UserLanguage[],
    reportId?: string,
    avoidPreferences?: string[],
  ) => {
    if (careers.length === 0 || countryCodes.length === 0) return;

    setIsSearching(true);

    // Initialize all results as idle
    const initialResults: JobSearchResult[] = careers.map(c => ({
      careerTitle: c.careerTitle,
      sectionType: c.sectionType,
      jobs: [],
      totalCount: 0,
      cached: false,
      status: 'idle',
    }));
    setResults(initialResults);

    // Process sequentially, one career at a time
    for (let i = 0; i < careers.length; i++) {
      setCurrentIndex(i);

      // Mark current as searching
      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'searching' } : r
      ));

      try {
        const { data, error } = await supabase.functions.invoke('search-jobs', {
          body: {
            career_title: careers[i].careerTitle,
            // Which report section this career came from. The edge function
            // writes it to user_job_searches.section_type (NOT NULL) when it
            // logs the search against the free-tier allowance.
            section_type: careers[i].sectionType,
            country_codes: countryCodes,
            work_arrangement: workArrangement || 'any',
            job_commitment: jobCommitment || 'any',
            location: location || '',
            alternate_titles: careers[i].alternateTitles || [],
            career_overview: careers[i].overview || '',
            user_languages: userLanguages || [],
            avoid_preferences: avoidPreferences || [],
            // report_id lets the n8n workflow look up enriched_jobs.alternate_titles
            // for this career when the primary search returns sparse results.
            report_id: reportId || null,
          },
        });

        if (error) throw error;

        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            jobs: data.jobs || [],
            totalCount: data.total_count || 0,
            cached: data.cached || false,
            status: 'done',
          } : r
        ));
      } catch (err) {
        // The free-tier refusal (HTTP 429) is not a fault — every remaining
        // career would be refused identically, so stop the loop instead of
        // firing N more requests we already know will bounce. Mark this
        // career AND everything still queued so nothing is left spinning on
        // an 'idle' placeholder forever.
        if (await isSearchLimitError(err)) {
          setResults(prev => prev.map((r, idx) =>
            idx >= i && r.status !== 'done'
              ? { ...r, status: 'error', error: LIMIT_ERROR }
              : r
          ));
          break;
        }

        console.error(`Job search failed for "${careers[i].careerTitle}":`, err);

        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: 'error',
            error: 'Search failed. Please try again.',
          } : r
        ));
      }
    }

    setCurrentIndex(-1);
    setIsSearching(false);
  };

  const clearResults = () => {
    setResults([]);
    setCurrentIndex(-1);
    setIsSearching(false);
  };

  // Re-seed results from a persisted snapshot (e.g. sessionStorage after a
  // page refresh) so the user doesn't lose a completed search.
  const restoreResults = (saved: JobSearchResult[]) => {
    if (Array.isArray(saved) && saved.length > 0) setResults(saved);
  };

  return {
    results,
    currentIndex,
    isSearching,
    searchJobs,
    clearResults,
    restoreResults,
  };
};
