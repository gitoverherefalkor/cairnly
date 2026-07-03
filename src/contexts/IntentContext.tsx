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
  setIntent: (intent: IntentKey) => void;
}

const IntentContext = createContext<IntentContextValue>({
  intent: 'default',
  setIntent: () => {},
});

export const IntentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [intent, setIntentState] = useState<IntentKey>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (INTENT_KEYS as readonly string[]).includes(stored ?? '')
        ? (stored as IntentKey)
        : 'default';
    } catch {
      return 'default';
    }
  });

  const setIntent = (next: IntentKey) => {
    setIntentState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / blocked storage: personalization still works for this visit.
    }
  };

  return (
    <IntentContext.Provider value={{ intent, setIntent }}>{children}</IntentContext.Provider>
  );
};

export const useIntent = () => useContext(IntentContext);
