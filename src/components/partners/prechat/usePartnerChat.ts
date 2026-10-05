import { useCallback, useEffect, useRef, useState } from 'react';
import {
  partnerChatApi,
  PARTNER_CHAT_SESSION_KEY,
  type OfferAction,
  type PartnerChips,
  type PartnerMessage,
  type PartnerOffer,
  type PartnerStage,
} from './partnerChatApi';

/**
 * State for the /partners pre-chat. One component uses it, so a hook rather
 * than a context. Persisted under its own localStorage key so a reload keeps
 * the conversation and the offer card; it never writes the consumer chat's
 * survey pre-fill or checkout contact.
 */

interface Persisted {
  sessionId: string;
  messages: PartnerMessage[];
  stage: PartnerStage;
  intent: string | null;
  beat: number | null;
  chips: PartnerChips | null;
  totalBeats: number;
  beatLabels: string[];
  offer: PartnerOffer | null;
  leadChoice: OfferAction | null;
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(PARTNER_CHAT_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.sessionId === 'string' && Array.isArray(p?.messages) ? (p as Persisted) : null;
  } catch {
    return null;
  }
}

export type LeadState = 'idle' | 'sending' | 'done' | 'pilot_full' | 'error';

export function usePartnerChat(lang: 'en' | 'nl') {
  const restored = useRef<Persisted | null>(load());
  const [sessionId, setSessionId] = useState<string | null>(restored.current?.sessionId ?? null);
  const [messages, setMessages] = useState<PartnerMessage[]>(restored.current?.messages ?? []);
  const [stage, setStage] = useState<PartnerStage>(restored.current?.stage ?? 'chat');
  const [intent, setIntent] = useState<string | null>(restored.current?.intent ?? null);
  const [beat, setBeat] = useState<number | null>(restored.current?.beat ?? null);
  const [chips, setChips] = useState<PartnerChips | null>(restored.current?.chips ?? null);
  const [totalBeats, setTotalBeats] = useState<number>(restored.current?.totalBeats ?? 4);
  const [beatLabels, setBeatLabels] = useState<string[]>(restored.current?.beatLabels ?? []);
  const [offer, setOffer] = useState<PartnerOffer | null>(restored.current?.offer ?? null);
  const [leadChoice, setLeadChoice] = useState<OfferAction | null>(restored.current?.leadChoice ?? null);
  const [leadState, setLeadState] = useState<LeadState>(restored.current?.leadChoice ? 'done' : 'idle');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const starting = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(
        PARTNER_CHAT_SESSION_KEY,
        JSON.stringify({ sessionId, messages, stage, intent, beat, chips, totalBeats, beatLabels, offer, leadChoice } satisfies Persisted),
      );
    } catch {
      // Private mode: the conversation just won't survive a reload.
    }
  }, [sessionId, messages, stage, intent, beat, chips, totalBeats, beatLabels, offer, leadChoice]);

  const applyReply = useCallback(
    (res: { reply: string; stage: PartnerStage; beat?: number | null; chips?: PartnerChips | null; offer?: PartnerOffer | null }) => {
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      setBeat(res.beat ?? null);
      setChips(res.chips ?? null);
      if (res.stage === 'pitched') {
        setStage('pitched');
        if (res.offer) setOffer(res.offer);
      }
    },
    [],
  );

  const start = useCallback(
    (text: string, conversationIntent: string, seeded: boolean) => {
      const trimmed = text.trim();
      if (!trimmed || starting.current || sessionId) return;
      starting.current = true;
      setIntent(conversationIntent);
      setMessages([{ role: 'user', text: trimmed, seeded }]);
      setSending(true);
      setError(false);
      // An unedited starter comes back instantly (canned on the server); hold
      // the typing dots a moment so it reads as a reply, not a paste.
      const revealDelay = seeded ? 1200 : 0;
      const startedAt = Date.now();
      partnerChatApi
        .start(conversationIntent, lang, trimmed, seeded ? 'pill' : 'cta')
        .then((res) => {
          setTimeout(() => {
            setSessionId(res.sessionId);
            setTotalBeats(res.totalBeats ?? 4);
            setBeatLabels(res.beatLabels ?? []);
            applyReply(res);
            setSending(false);
            starting.current = false;
          }, Math.max(0, revealDelay - (Date.now() - startedAt)));
        })
        .catch(() => {
          setMessages([]);
          setIntent(null);
          setError(true);
          setSending(false);
          starting.current = false;
        });
    },
    [lang, sessionId, applyReply],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || sending) return;
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
      setChips(null);
      setSending(true);
      setError(false);
      partnerChatApi
        .message(sessionId, trimmed)
        .then(applyReply)
        .catch(() => {
          setMessages((prev) => prev.slice(0, -1));
          setError(true);
        })
        .finally(() => setSending(false));
    },
    [sessionId, sending, applyReply],
  );

  const submitLead = useCallback(
    async (email: string, choice: OfferAction): Promise<LeadState> => {
      if (!sessionId) return 'error';
      setLeadState('sending');
      try {
        const res = await partnerChatApi.lead(sessionId, email, choice);
        const next: LeadState = res.ok ? 'done' : res.reason === 'pilot_full' ? 'pilot_full' : 'error';
        setLeadState(next);
        if (res.ok) setLeadChoice(choice);
        return next;
      } catch {
        setLeadState('error');
        return 'error';
      }
    },
    [sessionId],
  );

  const reset = useCallback(() => {
    if (starting.current) return;
    setSessionId(null);
    setMessages([]);
    setStage('chat');
    setIntent(null);
    setBeat(null);
    setChips(null);
    setOffer(null);
    setLeadChoice(null);
    setLeadState('idle');
    setError(false);
    try {
      localStorage.removeItem(PARTNER_CHAT_SESSION_KEY);
    } catch {
      // Best effort.
    }
  }, []);

  return {
    started: !!sessionId || messages.length > 0,
    sessionId,
    messages,
    stage,
    intent,
    beat,
    chips,
    totalBeats,
    beatLabels,
    offer,
    leadChoice,
    leadState,
    sending,
    error,
    start,
    sendMessage,
    submitLead,
    reset,
  };
}
