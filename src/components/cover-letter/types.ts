// Shared types for the Cover Letter feature.
//
// CoverLetterRow comes straight from the Supabase-generated table types —
// run `supabase gen types typescript` (or the MCP equivalent) after any
// `cover_letters` schema change to keep it in sync.

import type { Tables } from '@/integrations/supabase/types';
import type { CoverLetterJson } from '../custom-resume/types';

export type CoverLetterStatus = 'processing' | 'completed' | 'failed';

// Generated Row has `letter_json: Json | null` and `status: string`. We
// narrow both: letter_json's shape is a contract owned by the cover-letter
// flow, and status is constrained by a DB CHECK constraint that the
// generated types don't reflect.
export type CoverLetterRow = Omit<Tables<'cover_letters'>, 'letter_json' | 'status'> & {
  letter_json: CoverLetterJson | null;
  status: CoverLetterStatus;
};

// Re-export so the modal can import everything from one place.
export type { CoverLetterJson } from '../custom-resume/types';
