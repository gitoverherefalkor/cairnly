import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';

// Two waiting modes with honest copy:
// - 'delivery': platform is reading report_sections + writing into chat. ~200ms,
//   so most users never see this. Single line, no rotation.
// - 'agent':    LLM (WF5.3) is composing a reply. 3-30s. Rotate through generic
//   honest lines, then escalate after 6s with a "still thinking" reassurance.
// - 'preparing': the user reached the career chapter before WF4 finished
//   writing the career sections. We poll the DB and show an honest "still
//   putting them together" line until the content lands.
type LoadingMode = 'delivery' | 'agent' | 'preparing';

// Copy lives in the `chat` locale files (ui.thinking / ui.thinkingLate). The
// rotation length is derived from the translated array, so a language may carry
// a different number of lines without touching this file.
const AGENT_MESSAGES_FALLBACK = [
  "I'm thinking",
  'Reading the conversation',
  'Composing your reply',
] as const;

interface TypingIndicatorProps {
  isVisible: boolean;
  // Defaults to 'agent' so callers that don't yet plumb the mode still get
  // sensible (honest) output instead of the older theatre messages.
  mode?: LoadingMode;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isVisible,
  mode = 'agent',
}) => {
  const { t } = useTranslation('chat');
  const agentMessages = (() => {
    const v = t('ui.thinking', { returnObjects: true });
    return Array.isArray(v) && v.length > 0 ? (v as string[]) : [...AGENT_MESSAGES_FALLBACK];
  })();
  const [messageIndex, setMessageIndex] = useState(0);
  const [isLate, setIsLate] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  // Reset + start the timers when the indicator becomes visible. Cleared on
  // hide so each new wait starts from "I'm thinking" / 0s.
  useEffect(() => {
    if (!isVisible) {
      setMessageIndex(0);
      setIsLate(false);
      startedAtRef.current = null;
      return;
    }
    if (mode !== 'agent') return;

    // Always start a fresh wait from "I'm thinking" at 0s. Without this, a
    // previous turn's `isLate=true` can leak into the next turn if isVisible
    // doesn't actually flip false between them (e.g. mode transitions while
    // staying visible), making "Still thinking" appear within ~1s of submit.
    setMessageIndex(0);
    setIsLate(false);
    startedAtRef.current = Date.now();

    const rotateInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % agentMessages.length);
    }, 3000);

    const lateTimeout = setTimeout(() => setIsLate(true), 6000);

    return () => {
      clearInterval(rotateInterval);
      clearTimeout(lateTimeout);
    };
  }, [isVisible, mode]);

  if (!isVisible) return null;

  const text =
    mode === 'delivery'
      ? t('ui.loadingSection')
      : mode === 'preparing'
        ? t('ui.preparingMatches')
        : isLate
          ? t('ui.thinkingLate')
          : agentMessages[messageIndex % agentMessages.length];

  return (
    <div className="flex items-center gap-2.5 py-2 px-1 max-w-[320px]">
      <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
        <span className="block w-[3px] bg-atlas-teal rounded-sm h-1.5 animate-bar-pulse" />
        <span className="block w-[3px] bg-atlas-teal rounded-sm h-2.5 animate-bar-pulse [animation-delay:0.15s]" />
        <span className="block w-[3px] bg-atlas-teal rounded-sm h-3.5 animate-bar-pulse [animation-delay:0.3s]" />
        <span className="block w-[3px] bg-atlas-teal rounded-sm h-2 animate-bar-pulse [animation-delay:0.45s]" />
      </div>
      <span className="text-[0.8125rem] text-gray-500 italic animate-text-fade">
        {text}
      </span>
    </div>
  );
};
