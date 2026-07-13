import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  intakeApi,
  storePrefill,
  storeContact,
  INTAKE_SESSION_KEY,
  type IntakeMessage,
  type IntakeStage,
} from './intakeApi';

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
  sending: boolean;
  error: string | null;
  /** Starts the conversation with the visitor's first message. */
  start: (text: string, intent: string) => void;
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
    (res: { reply: string; stage: IntakeStage; prefill: Parameters<typeof storePrefill>[0] }) => {
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      if (res.stage === 'pitched') {
        setStage('pitched');
        storePrefill(res.prefill);
        if (res.prefill && typeof res.prefill.name === 'string') {
          storeContact({ firstName: res.prefill.name });
        }
      }
    },
    [],
  );

  const start = useCallback(
    (text: string, intent: string) => {
      const trimmed = text.trim();
      if (!trimmed || sessionId || starting.current) return;
      starting.current = true;
      setMessages([{ role: 'user', text: trimmed }]);
      setSending(true);
      setError(null);
      intakeApi
        .start(intent, lang, 'pill', trimmed)
        .then((res) => {
          setSessionId(res.sessionId);
          handleReply(res);
        })
        .catch(() => {
          setMessages([]);
          setError(t('intake.error'));
        })
        .finally(() => {
          setSending(false);
          starting.current = false;
        });
    },
    [sessionId, lang, t, handleReply],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || sending) return;
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
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
        sending,
        error,
        start,
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
