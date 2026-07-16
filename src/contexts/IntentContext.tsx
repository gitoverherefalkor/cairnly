import React, { createContext, useContext, useState } from 'react';

/**
 * Visitor intent for the landing page ("why are you here?").
 * Selected via the chips in the hero; swaps the framing copy
 * (hero + whyBuilt.p1 + WhoFor bullet order) to the matching variant.
 * Persisted so a returning visitor keeps their framing.
 */
export const INTENT_KEYS = [
  'default',
  'good-at-it',
  'ai-worried',
  'life-changed',
  'understand-myself',
] as const;

export type IntentKey = (typeof INTENT_KEYS)[number];

const STORAGE_KEY = 'cairnly_intent';

interface IntentContextValue {
  intent: IntentKey;
  /**
   * Whether the visitor actually chose a pill. At rest `intent` is 'default'
   * purely as a copy fallback; no pill may render as selected and the hero
   * shows the neutral resting copy until this flips true.
   */
  picked: boolean;
  setIntent: (intent: IntentKey) => void;
}

const IntentContext = createContext<IntentContextValue>({
  intent: 'default',
  picked: false,
  setIntent: () => {},
});

export const IntentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{ intent: IntentKey; picked: boolean }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Restore the picked framing only while an intake conversation exists
      // (same key intakeApi persists under); otherwise a fresh visit starts
      // at the neutral resting state instead of last visit's pill forever.
      const hasSession = !!localStorage.getItem('cairnly_intake_session');
      if (hasSession && (INTENT_KEYS as readonly string[]).includes(stored ?? '')) {
        return { intent: stored as IntentKey, picked: true };
      }
    } catch {
      // fall through to the unpicked resting state
    }
    return { intent: 'default', picked: false };
  });

  const setIntent = (next: IntentKey) => {
    setState({ intent: next, picked: true });
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / blocked storage: personalization still works for this visit.
    }
  };

  return (
    <IntentContext.Provider value={{ intent: state.intent, picked: state.picked, setIntent }}>
      {children}
    </IntentContext.Provider>
  );
};

export const useIntent = () => useContext(IntentContext);
