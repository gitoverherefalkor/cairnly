// Hook for communicating with the n8n chat agent via the Supabase
// `chat-proxy` edge function. We no longer hit n8n directly from the
// browser — the n8n webhook URL is server-side only, and the proxy
// authenticates the user JWT + rate-limits before forwarding.

import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';

interface WebhookMetadata {
  report_id: string;
  first_name: string;
  country: string;
  /**
   * Optional override. If not provided, the hook injects `i18n.language`
   * automatically so n8n WF5 can respond in the user's language.
   * See LOCALIZATION_PLAN.md Phase 2.
   */
  preferred_language?: string;
  /**
   * Section context so WF5 (the coach) knows where the user is and whether any
   * career section has been revealed yet. Gates career-related follow-up
   * suggestions on personality sections. Set by ChatContainer.sectionMetadata().
   */
  current_section?: string | null;
  careers_revealed?: boolean;
  /**
   * Survey-sourced context for the coach's SESSION DATA header. Both come from
   * the report's survey responses (extracted in Chat.tsx):
   * - assessment_purpose: why the user took the assessment (Q "primary goal(s)
   *   for completing this questionnaire").
   * - goal_alignment: their raw short- and long-term career goals, so WF5 can
   *   reason about goal fit. (Previously always [undefined] — never wired.)
   */
  assessment_purpose?: string;
  goal_alignment?: string;
}

interface PreviousMessage {
  id: string;
  kwargs: { content: string };
}

interface PreviousSessionResponse {
  data?: PreviousMessage[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/chat-proxy`;
const TIMEOUT_MS = 120_000; // 2 minutes — these AI responses can take a while

async function buildHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  // chat-proxy requires a real user JWT — anon key won't work.
  if (!token) {
    throw new Error('Not signed in — cannot call chat-proxy without a user session');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

export function useN8nWebhook() {

  // Send a chat message to n8n (via chat-proxy) and get the bot response
  const sendMessage = async (
    sessionId: string,
    message: string,
    metadata: WebhookMetadata
  ): Promise<string> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const headers = await buildHeaders();
      const enrichedMetadata = {
        ...metadata,
        preferred_language: metadata.preferred_language || i18n.language || 'en',
      };
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers,
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify({
          action: 'sendMessage',
          'n8n-chat/sessionId': sessionId,
          chatInput: message,
          metadata: enrichedMetadata,
        }),
      });

      if (!res.ok) {
        throw new Error(`chat-proxy returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // Match n8n's response parsing: try output, text, message, then stringify
      const text = data.output ?? data.text ?? data.message ?? '';
      if (text === '' && Object.keys(data).length > 0) {
        return JSON.stringify(data, null, 2);
      }
      return text;
    } finally {
      clearTimeout(timeout);
    }
  };

  // Load messages from a previous session (for migration from n8n widget)
  const loadPreviousSession = async (
    sessionId: string,
    metadata: WebhookMetadata
  ): Promise<Array<{ sender: 'user' | 'bot'; content: string }>> => {
    try {
      const headers = await buildHeaders();
      const enrichedMetadata = {
        ...metadata,
        preferred_language: metadata.preferred_language || i18n.language || 'en',
      };
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers,
        mode: 'cors',
        body: JSON.stringify({
          action: 'loadPreviousSession',
          'n8n-chat/sessionId': sessionId,
          metadata: enrichedMetadata,
        }),
      });

      if (!res.ok) return [];

      const data: PreviousSessionResponse = await res.json();
      if (!data.data || !Array.isArray(data.data)) return [];

      return data.data.map((msg) => ({
        sender: msg.id.includes('HumanMessage') ? 'user' as const : 'bot' as const,
        content: msg.kwargs.content,
      }));
    } catch {
      // If loading previous session fails, just start fresh
      return [];
    }
  };

  return { sendMessage, loadPreviousSession };
}
