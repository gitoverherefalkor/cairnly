import { supabase } from '@/integrations/supabase/client';

/**
 * Thin client for the intake-chat edge function (anonymous landing-page
 * intake conversation). All conversation control lives server-side; the
 * frontend only renders what comes back.
 */

export interface IntakeMessage {
  role: 'assistant' | 'user';
  text: string;
}

/** Mapper-compatible survey pre-fill fields (safe subset). */
export interface IntakePrefill {
  name?: string;
  goals?: string;
  years_experience?: number;
  study_subject?: string;
}

export type IntakeStage = 'chat' | 'pitched';

interface StartResponse {
  sessionId: string;
  greeting: string;
  stage: IntakeStage;
}

interface MessageResponse {
  reply: string;
  stage: IntakeStage;
  prefill: IntakePrefill | null;
  closed?: boolean;
}

interface ResumeResponse {
  sessionId: string;
  messages: IntakeMessage[];
  stage: IntakeStage;
  emailCaptured: boolean;
  intent: string;
  language: string;
  prefill: IntakePrefill | null;
  contact: { email: string | null; firstName: string | null };
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('intake-chat', { body });
  if (error) throw new Error(error.message || 'intake-chat failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const intakeApi = {
  start: (intent: string, language: string, source: 'cta' | 'pill') =>
    invoke<StartResponse>({ action: 'start', intent, language, source }),
  message: (sessionId: string, text: string) =>
    invoke<MessageResponse>({ action: 'message', sessionId, text }),
  email: (sessionId: string, email: string) =>
    invoke<{ ok: boolean }>({ action: 'email', sessionId, email }),
  resume: (token: string) => invoke<ResumeResponse>({ action: 'resume', token }),
};

// ── localStorage keys shared with the survey pre-fill + checkout ────────────

/** Field-name-keyed pre-fill payload, merged by useAIResumePreFill. */
export const INTAKE_PREFILL_KEY = 'intake_prefill_data';
/** { email, firstName } for pre-filling the checkout form. */
export const INTAKE_CONTACT_KEY = 'cairnly_intake_contact';
/** Persisted chat state so the conversation survives reloads. */
export const INTAKE_SESSION_KEY = 'cairnly_intake_session';

export function storePrefill(prefill: IntakePrefill | null): void {
  if (!prefill) return;
  try {
    localStorage.setItem(INTAKE_PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    // Private mode: pre-fill is a bonus, the funnel continues without it.
  }
}

export function storeContact(contact: { email?: string | null; firstName?: string | null }): void {
  const cleaned = {
    email: contact.email ?? null,
    firstName: contact.firstName ?? null,
  };
  if (!cleaned.email && !cleaned.firstName) return;
  try {
    localStorage.setItem(INTAKE_CONTACT_KEY, JSON.stringify(cleaned));
  } catch {
    // Same: best effort only.
  }
}
