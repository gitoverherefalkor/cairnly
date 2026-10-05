import { supabase } from '@/integrations/supabase/client';
// Type-only: erased at build time, so the browser never loads the edge file.
// One definition of the offer card's shape, shared with the server.
import type { PartnerOffer, OfferAction } from '../../../../supabase/functions/_shared/partnerOffer.ts';

export type { PartnerOffer, OfferAction };

/**
 * Thin client for the partner audience of the intake-chat edge function.
 * Same function as the homepage chat, `audience: 'partner'` on start; the
 * session remembers its audience after that. Nothing here touches the
 * consumer chat's localStorage keys (survey pre-fill, checkout contact).
 */

export interface PartnerMessage {
  role: 'assistant' | 'user';
  text: string;
  /** The unedited starter line, rendered gold. */
  seeded?: boolean;
}

export interface PartnerChips {
  options: string[];
  multi: boolean;
  max?: number;
}

export type PartnerStage = 'chat' | 'pitched';

interface MessageResponse {
  reply: string;
  stage: PartnerStage;
  beat: number | null;
  chips: PartnerChips | null;
  offer: PartnerOffer | null;
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

export const partnerChatApi = {
  start: (intent: string, language: string, text: string, source: 'pill' | 'cta') =>
    invoke<StartResponse>({ action: 'start', audience: 'partner', intent, language, text, source }),
  message: (sessionId: string, text: string) => invoke<MessageResponse>({ action: 'message', sessionId, text }),
  lead: (sessionId: string, email: string, choice: OfferAction) =>
    invoke<{ ok: boolean; reason?: string }>({ action: 'lead', sessionId, email, choice }),
};

/** Its own key: never the consumer chat's `cairnly_intake_session`. */
export const PARTNER_CHAT_SESSION_KEY = 'cairnly_partner_chat_session';
