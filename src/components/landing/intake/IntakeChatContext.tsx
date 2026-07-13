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
 * State machine for the landing-page intake chat overlay.
 *
 * Mounted only on the homepage (inside Index.tsx). Components elsewhere
 * (LandingNav on other pages) use `useIntakeChatOptional`, which returns
 * null outside the provider so they can fall back to navigating to /payment.
 *
 * Visibility rules (agreed design):
 * - Intent pill click opens the chat, unless the visitor dismissed it (X).
 * - The Get Started CTA always opens it (explicit intent beats a dismissal).
 * - Minimize collapses to a floating "continue our chat" pill.
 */

type Visibility = 'closed' | 'open' | 'minimized';

interface IntakeChatValue {
  visibility: Visibility;
  /** True once a conversation exists (drives the floating pill after minimize). */
  hasSession: boolean;
  stage: IntakeStage;
  emailCaptured: boolean;
  messages: IntakeMessage[];
  sending: boolean;
  error: string | null;
  openFromPill: (intent: string) => void;
  openFromCta: () => void;
  openFromToken: (token: string) => void;
  minimize: () => void;
  dismiss: () => void;
  sendMessage: (text: string) => void;
  submitEmail: (email: string) => Promise<boolean>;
}

const IntakeChatContext = createContext<IntakeChatValue | null>(null);

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

  const [visibility, setVisibility] = useState<Visibility>('closed');
  const [dismissed, setDismissed] = useState(false);
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

  const startSession = useCallback(
    async (intent: string, source: 'cta' | 'pill') => {
      if (sessionId || starting.current) return;
      starting.current = true;
      setSending(true);
      setError(null);
      try {
        const res = await intakeApi.start(intent, lang, source);
        setSessionId(res.sessionId);
        setMessages([{ role: 'assistant', text: res.greeting }]);
      } catch {
        setError(t('intake.error'));
      } finally {
        setSending(false);
        starting.current = false;
      }
    },
    [sessionId, lang, t],
  );

  const openFromPill = useCallback(
    (intent: string) => {
      if (dismissed) return; // a dismissal is respected; pills only swap copy
      setVisibility('open');
      void startSession(intent, 'pill');
    },
    [dismissed, startSession],
  );

  const openFromCta = useCallback(() => {
    setVisibility('open');
    setDismissed(false); // the main CTA is explicit intent
    void startSession(localStorage.getItem('cairnly_intent') ?? 'default', 'cta');
  }, [startSession]);

  const openFromToken = useCallback(
    (token: string) => {
      setVisibility('open');
      setDismissed(false);
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
        })
        .catch(() => setError(t('intake.error')))
        .finally(() => setSending(false));
    },
    [t],
  );

  const minimize = useCallback(() => setVisibility('minimized'), []);

  const dismiss = useCallback(() => {
    setVisibility(sessionId ? 'minimized' : 'closed');
    setDismissed(true);
  }, [sessionId]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || sending) return;
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
      setSending(true);
      setError(null);
      intakeApi
        .message(sessionId, trimmed)
        .then((res) => {
          setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
          if (res.stage === 'pitched') {
            setStage('pitched');
            storePrefill(res.prefill);
            if (res.prefill?.name) storeContact({ firstName: res.prefill.name });
          }
        })
        .catch(() => {
          // Roll the optimistic user message back so they can retry it.
          setMessages((prev) => prev.slice(0, -1));
          setError(t('intake.error'));
        })
        .finally(() => setSending(false));
    },
    [sessionId, sending, t],
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

  return (
    <IntakeChatContext.Provider
      value={{
        visibility,
        hasSession: !!sessionId,
        stage,
        emailCaptured,
        messages,
        sending,
        error,
        openFromPill,
        openFromCta,
        openFromToken,
        minimize,
        dismiss,
        sendMessage,
        submitEmail,
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
