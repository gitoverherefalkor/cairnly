import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  intakeApi,
  storePrefill,
  storeContact,
  INTAKE_SESSION_KEY,
  type IntakeMessage,
  type IntakeStage,
  type IntakeChips,
} from './intakeApi';

const NAME_QUESTION_ID = '11111111-1111-1111-1111-11111111111a';

/**
 * State for the inline intake chat section on the homepage (below the hero).
 *
 * The conversation opens with the VISITOR's message: the intent pills seed an
 * editable first message written in the visitor's voice, and they hit send.
 * Server-side phase machine takes it from there (5 questions -> pitch).
 *
 * Mounted only on the homepage. Shared components (nav CTAs) use
 * `useIntakeChatOptional`, which returns null outside the provider so they
 * can fall back to navigating to /payment.
 */

interface IntakeChatValue {
  /** True once a conversation exists (switches the section from seed-input to thread). */
  started: boolean;
  stage: IntakeStage;
  emailCaptured: boolean;
  messages: IntakeMessage[];
  /** Which of the 5 beats is currently being asked (null before start / after pitch). */
  beat: number | null;
  /** Answer chips for the current question (null = free text only). */
  chips: IntakeChips | null;
  sending: boolean;
  error: string | null;
  /** Starts the conversation with the visitor's first message (typed/edited). */
  start: (text: string, intent: string) => void;
  /**
   * Pill click: starts (or restarts, if nothing substantive was said yet)
   * the conversation with that pill's seed as a gold message, and reveals
   * the canned opener after a short "typing" beat.
   */
  startFromPill: (intent: string, seedText: string) => void;
  sendMessage: (text: string) => void;
  submitEmail: (email: string) => Promise<boolean>;
  /** Restores a session from a magic-link token, then scrolls to the chat. */
  openFromToken: (token: string) => void;
  /** Scrolls the chat section into view (used by the Get Started CTA). */
  focusChat: () => void;
}

const IntakeChatContext = createContext<IntakeChatValue | null>(null);

/** DOM id of the inline section; CTA clicks scroll here. */
export const INTAKE_SECTION_ID = 'intake-chat';

interface PersistedSession {
  sessionId: string;
  messages: IntakeMessage[];
  stage: IntakeStage;
  emailCaptured: boolean;
}

function loadPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(INTAKE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.sessionId === 'string' && Array.isArray(parsed?.messages)) {
      return parsed as PersistedSession;
    }
  } catch {
    // Corrupt or blocked storage: start fresh.
  }
  return null;
}

export const IntakeChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation('landing');
  const persisted = useRef<PersistedSession | null>(loadPersisted());

  const [sessionId, setSessionId] = useState<string | null>(persisted.current?.sessionId ?? null);
  const [messages, setMessages] = useState<IntakeMessage[]>(persisted.current?.messages ?? []);
  const [stage, setStage] = useState<IntakeStage>(persisted.current?.stage ?? 'chat');
  const [emailCaptured, setEmailCaptured] = useState(persisted.current?.emailCaptured ?? false);
  const [beat, setBeat] = useState<number | null>(null);
  const [chips, setChips] = useState<IntakeChips | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starting = useRef(false);

  const lang = (i18n.language || 'en').slice(0, 2) === 'nl' ? 'nl' : 'en';

  // Persist the conversation so it survives reloads and the Stripe round-trip.
  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(
        INTAKE_SESSION_KEY,
        JSON.stringify({ sessionId, messages, stage, emailCaptured } satisfies PersistedSession),
      );
    } catch {
      // Best effort.
    }
  }, [sessionId, messages, stage, emailCaptured]);

  const focusChat = useCallback(() => {
    document.getElementById(INTAKE_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleReply = useCallback(
    (res: {
      reply: string;
      stage: IntakeStage;
      beat?: number | null;
      chips?: IntakeChips | null;
      prefill: Parameters<typeof storePrefill>[0];
    }) => {
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      setBeat(res.beat ?? null);
      setChips(res.chips ?? null);
      if (res.stage === 'pitched') {
        setStage('pitched');
        storePrefill(res.prefill);
        const name = res.prefill?.[NAME_QUESTION_ID];
        if (typeof name === 'string') storeContact({ firstName: name });
      }
    },
    [],
  );

  const startConversation = useCallback(
    (text: string, intent: string, seeded: boolean) => {
      const trimmed = text.trim();
      if (!trimmed || starting.current) return;
      starting.current = true;
      setSessionId(null);
      setStage('chat');
      setEmailCaptured(false);
      setMessages([{ role: 'user', text: trimmed, seeded }]);
      setChips(null);
      setBeat(null);
      setSending(true);
      setError(null);
      // Seeded openers come back instantly (canned server-side); hold the
      // typing indicator for a beat so the reply feels generated, not pasted.
      const revealDelay = seeded ? 1400 : 0;
      const startedAt = Date.now();
      intakeApi
        .start(intent, lang, seeded ? 'pill' : 'cta', trimmed, seeded)
        .then((res) => {
          const wait = Math.max(0, revealDelay - (Date.now() - startedAt));
          setTimeout(() => {
            setSessionId(res.sessionId);
            handleReply(res);
            setSending(false);
            starting.current = false;
          }, wait);
        })
        .catch(() => {
          setMessages([]);
          setError(t('intake.error'));
          setSending(false);
          starting.current = false;
        });
    },
    [lang, t, handleReply],
  );

  const start = useCallback(
    (text: string, intent: string) => {
      if (sessionId) return;
      startConversation(text, intent, false);
    },
    [sessionId, startConversation],
  );

  const startFromPill = useCallback(
    (intent: string, seedText: string) => {
      // Pills own the pre-pitch conversation: a click restarts it with the
      // new angle. Once the pitch has been delivered (real value on screen),
      // pill clicks leave the conversation alone.
      if (stage === 'pitched') return;
      if (starting.current || sending) return;
      startConversation(seedText, intent, true);
    },
    [stage, sending, startConversation],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || sending) return;
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
      setChips(null);
      setSending(true);
      setError(null);
      intakeApi
        .message(sessionId, trimmed)
        .then(handleReply)
        .catch(() => {
          // Roll the optimistic user message back so they can retry it.
          setMessages((prev) => prev.slice(0, -1));
          setError(t('intake.error'));
        })
        .finally(() => setSending(false));
    },
    [sessionId, sending, t, handleReply],
  );

  const submitEmail = useCallback(
    async (email: string): Promise<boolean> => {
      if (!sessionId) return false;
      try {
        await intakeApi.email(sessionId, email.trim().toLowerCase());
        setEmailCaptured(true);
        storeContact({ email: email.trim().toLowerCase() });
        return true;
      } catch {
        setError(t('intake.error'));
        return false;
      }
    },
    [sessionId, t],
  );

  const openFromToken = useCallback(
    (token: string) => {
      setSending(true);
      setError(null);
      intakeApi
        .resume(token)
        .then((res) => {
          setSessionId(res.sessionId);
          setMessages(res.messages);
          setStage(res.stage);
          setEmailCaptured(res.emailCaptured);
          setBeat(res.beat ?? null);
          setChips(res.chips ?? null);
          storePrefill(res.prefill);
          storeContact(res.contact);
          // Let the section render the restored thread, then scroll to it.
          setTimeout(focusChat, 150);
        })
        .catch(() => setError(t('intake.error')))
        .finally(() => setSending(false));
    },
    [t, focusChat],
  );

  return (
    <IntakeChatContext.Provider
      value={{
        started: !!sessionId,
        stage,
        emailCaptured,
        messages,
        beat,
        chips,
        sending,
        error,
        start,
        startFromPill,
        sendMessage,
        submitEmail,
        openFromToken,
        focusChat,
      }}
    >
      {children}
    </IntakeChatContext.Provider>
  );
};

export const useIntakeChat = (): IntakeChatValue => {
  const ctx = useContext(IntakeChatContext);
  if (!ctx) throw new Error('useIntakeChat must be used inside IntakeChatProvider');
  return ctx;
};

/** Null outside the provider: lets shared components (nav, CTAs) fall back to /payment. */
export const useIntakeChatOptional = (): IntakeChatValue | null => useContext(IntakeChatContext);
