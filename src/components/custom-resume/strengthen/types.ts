// Frontend mirror of the Strengthen domain types.
// Source of truth: supabase/functions/resume-strengthen/strength.ts

export type IssueTarget =
  | { section: 'summary' }
  | { section: 'experience'; exp_index: number; bullet_index: number }
  | { section: 'highlights'; index: number }
  | { section: 'skills'; group: 'technical' | 'tools' | 'soft' | 'languages'; index: number };

export type StrengthIssue = {
  id: string;
  flag: 'you_had_to_be_there' | 'naked_number' | 'jargon' | 'adjective_skill';
  card_type: 'one_tap' | 'needs_input';
  impact: number;
  target: IssueTarget;
  original_text: string;
  suggested_text?: string;
  question?: string;
  example?: string;
  preview_template?: string;
  status: 'pending' | 'applied' | 'skipped';
  user_input?: string | null;
};

export type StrengthReview = {
  status: 'pending' | 'ready' | 'applying' | 'failed';
  score: number;
  score_base: number;
  score_potential: number;
  language: string;
  generated_at: string;
  status_changed_at?: string;
  error?: string;
  issues: StrengthIssue[];
};

export type Decision = { id: string; action: 'apply' | 'skip'; user_input?: string };

export type StagedDecision = { action: 'apply' | 'skip'; user_input?: string };
