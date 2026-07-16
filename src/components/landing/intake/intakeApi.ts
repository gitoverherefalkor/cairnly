import { supabase } from '@/integrations/supabase/client';

/**
 * Thin client for the intake-chat edge function (anonymous landing-page
 * intake conversation). All conversation control lives server-side; the
 * frontend only renders what comes back.
 */

export interface IntakeMessage {
  role: 'assistant' | 'user';
  text: string;
  /** True for the pill-seeded opening message (rendered gold, tied to the pill). */
  seeded?: boolean;
}

/** Survey pre-fill payload, keyed by question UUID (server-validated). */
export type IntakePrefill = Record<string, unknown>;

export type IntakeStage = 'chat' | 'pitched';

/** Answer chips shown under the agent's question. */
export interface IntakeChips {
  options: string[];
  multi: boolean;
  max?: number;
}

interface MessageResponse {
  reply: string;
  stage: IntakeStage;
  /** Which of the 5 beats the agent just asked (null once pitched). */
  beat: number | null;
  chips: IntakeChips | null;
  prefill: IntakePrefill | null;
  closed?: boolean;
}

interface StartResponse extends MessageResponse {
  sessionId: string;
  totalBeats: number;
  beatLabels: string[];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('intake-chat', { body });
  if (error) throw new Error(error.message || 'intake-chat failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const intakeApi = {
  start: (intent: string, language: string, source: 'cta' | 'pill', text: string, seeded: boolean) =>
    invoke<StartResponse>({ action: 'start', intent, language, source, text, seeded }),
  message: (sessionId: string, text: string) =>
    invoke<MessageResponse>({ action: 'message', sessionId, text }),
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
  try {
    // Merge with what's already stored: the name arrives at pitch time and
    // the email later, and neither write may wipe the other.
    let existing: { email?: string | null; firstName?: string | null } = {};
    try {
      existing = JSON.parse(localStorage.getItem(INTAKE_CONTACT_KEY) ?? '{}');
    } catch {
      existing = {};
    }
    const merged = {
      email: contact.email ?? existing.email ?? null,
      firstName: contact.firstName ?? existing.firstName ?? null,
    };
    if (!merged.email && !merged.firstName) return;
    localStorage.setItem(INTAKE_CONTACT_KEY, JSON.stringify(merged));
  } catch {
    // Private mode: best effort only.
  }
}
