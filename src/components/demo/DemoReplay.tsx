import React, { useCallback, useMemo, useState } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { ReportSection } from '@/hooks/useReportSections';
import type { DemoMessage } from '@/demo/types';
import { DemoAnnotation, type ResolvedAnnotation } from './DemoAnnotation';

interface DemoReplayProps {
  messages: DemoMessage[];
  sections: ReportSection[];
  savedMessageIds: string[];
  annotations: ResolvedAnnotation[];
  // message id → canonical section index, for the chapter scroll-spy.
  sectionIndexByMessage: Record<string, number>;
  // Highlight ring on one message (page-owned, shared with the header chips,
  // the sidebar and the welcome card's jump).
  flashId: string | null;
  onFlash: (messageId: string) => void;
}

/** DOM id of a message wrapper; sidebar, header chips and jumps target it. */
export const messageDomId = (id: string) => `demo-msg-${id}`;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

// The two career-card pills write recognisable user turns. "Ask about this
// role" prefixes the typed question with "[Over <role>]" / "[About <role>]";
// the Move pill auto-sends buildFeasibilityQuestion(), which opens with a
// fixed sentence in either language.
const SCOPED_TURN = /^\[(over|about)\s+(.+?)\]/i;
const FEASIBILITY_TURN = /^(hoe realistisch is de overstap|how realistic is the move)/i;

/**
 * The thin replay container: maps a frozen transcript onto the real
 * ChatMessage component. Deliberately NOT ChatContainer (that one is welded
 * to live sessions, n8n and the input box). Per-message props mirror
 * ChatMessages.tsx so the replay keeps the beats that make the product feel
 * alive: the "via <pill>" tag on typed turns, the answered choice card, the
 * Keep badges, the score pills, the career-card pills and the comparison
 * radar.
 *
 * What is different from a live chat, on purpose:
 *  - every section is fully revealed (no chevron pacing gating the scroll);
 *  - multi-card sections stay collapsed-but-clickable;
 *  - nothing can reach n8n: the career-card pills ("Ask about this role",
 *    the Move pill) and "Explain this comparison" jump to the turn where
 *    the persona actually used that control, so a click shows what the
 *    control does instead of doing nothing.
 */
export const DemoReplay: React.FC<DemoReplayProps> = ({
  messages,
  sections,
  savedMessageIds,
  annotations,
  sectionIndexByMessage,
  flashId,
  onFlash,
}) => {
  // Keep state is local and starts from what the persona actually kept.
  // Toggling is harmless (nothing is persisted) and shows the mechanic.
  const [kept, setKept] = useState<Set<string>>(() => new Set(savedMessageIds));
  const savedSet = useMemo(() => new Set(savedMessageIds), [savedMessageIds]);
  // Explanations added locally via the comparison card, keyed by the message
  // they were requested from. Rendered right after that message.
  const [inserted, setInserted] = useState<Record<string, DemoMessage>>({});

  const toggleKept = useCallback((id: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rendered = useMemo(() => {
    const out: DemoMessage[] = [];
    for (const m of messages) {
      out.push(m);
      const extra = inserted[m.id];
      if (extra) out.push(extra);
    }
    return out;
  }, [messages, inserted]);

  const userTurns = useMemo(() => messages.filter((m) => m.sender === 'user'), [messages]);

  // "Ask about this role" → the [Over <role>] turn for that role if the
  // persona asked one, otherwise the first scoped turn in the session.
  const handleAskAboutRole = useCallback(
    (roleTitle: string) => {
      const wanted = norm(roleTitle);
      const scoped = userTurns.filter((m) => SCOPED_TURN.test(m.content));
      const exact = scoped.find((m) => norm(m.content.match(SCOPED_TURN)?.[2] ?? '') === wanted);
      const target = exact ?? scoped[0];
      if (target) onFlash(target.id);
    },
    [userTurns, onFlash],
  );

  // Chip sends only reach us from the Move pill in the replay (follow-up
  // option chips are never interactive here). Prefer the persona's own
  // feasibility question for this role, else any feasibility question.
  const handleChipSend = useCallback(
    (message: string) => {
      const wanted = norm(message);
      const feasibility = userTurns.filter((m) => FEASIBILITY_TURN.test(m.content));
      const exact = feasibility.find((m) => norm(m.content) === wanted);
      const target = exact ?? feasibility[0];
      if (target) onFlash(target.id);
    },
    [userTurns, onFlash],
  );

  const handleExplain = useCallback(
    (fromId: string, content: string) => {
      const existing = rendered.find((m) => m.sender === 'bot' && norm(m.content) === norm(content));
      if (existing) {
        onFlash(existing.id);
        return;
      }
      const id = `${fromId}-explain`;
      setInserted((prev) =>
        prev[fromId] ? prev : { ...prev, [fromId]: { id, sender: 'bot', content, created_at: '' } },
      );
      window.setTimeout(() => onFlash(id), 80);
    },
    [rendered, onFlash],
  );

  const annotationsByMessage = useMemo(() => {
    const map: Record<string, ResolvedAnnotation[]> = {};
    for (const a of annotations) (map[a.messageId] ??= []).push(a);
    return map;
  }, [annotations]);

  // The one-time "tap each card to open it" hint goes on the first
  // multi-card message, as it would in a live first session.
  const firstMultiCardId = useMemo(
    () =>
      rendered.find((m) => m.sender === 'bot' && (m.content.match(/^### /gm) || []).length >= 2)?.id ??
      null,
    [rendered],
  );

  return (
    <div>
      {rendered.map((msg, idx, arr) => {
        const isBot = msg.sender === 'bot';
        const headingCount = isBot ? (msg.content.match(/^### /gm) || []).length : 0;
        const isSectionReveal = headingCount >= 1;
        const isMultiCard = headingCount >= 2;
        const next = arr[idx + 1];
        const notes = annotationsByMessage[msg.id] ?? [];
        const sectionIndex = sectionIndexByMessage[msg.id];
        return (
          <div
            key={msg.id}
            id={messageDomId(msg.id)}
            data-demo-section-index={sectionIndex ?? undefined}
            className={`relative scroll-mt-[156px] sm:scroll-mt-[136px] rounded-[22px] transition-shadow duration-500 ${
              flashId === msg.id ? 'ring-2 ring-[#D4A024]' : ''
            }`}
          >
            {notes
              .filter((a) => a.placement === 'top')
              .map((a) => (
                <DemoAnnotation key={a.key} annotation={a} />
              ))}
            <ChatMessage
              messageId={msg.id}
              content={msg.content}
              sender={msg.sender}
              quickReplyKey={msg.metadata?.quick_reply ?? null}
              followUpAnsweredBy={isBot && next?.sender === 'user' ? next.content : null}
              defaultAllCollapsed={isMultiCard}
              showOpenCardsHint={isMultiCard && msg.id === firstMultiCardId}
              sections={sections}
              isLatestBotMessage={false}
              forceFullReveal
              onAskAboutRole={isBot ? handleAskAboutRole : undefined}
              onChipSend={isBot ? handleChipSend : undefined}
              onComparisonExplain={isBot ? (content) => handleExplain(msg.id, content) : undefined}
              bookmarkable={isBot && !isSectionReveal && savedSet.has(msg.id)}
              bookmarked={kept.has(msg.id)}
              onBookmarkToggle={toggleKept}
              alreadyInReport={isSectionReveal}
            />
            {notes
              .filter((a) => a.placement === 'bottom')
              .map((a) => (
                <DemoAnnotation key={a.key} annotation={a} />
              ))}
          </div>
        );
      })}
    </div>
  );
};
