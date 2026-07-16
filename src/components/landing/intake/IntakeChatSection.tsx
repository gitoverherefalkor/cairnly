import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { ArrowRight, Check, ChevronDown, Pencil } from 'lucide-react';
import { useIntakeChat, INTAKE_SECTION_ID } from './IntakeChatContext';

/**
 * Renders the agent's light markdown for chat bubbles: `**bold**` emphasis
 * (same convention as the survey's choice labels) plus `- ` bullet lists,
 * which the pitch uses for its "threads." Sanitized to a small tag set; the
 * bubble styles ul/li/p via arbitrary child selectors.
 */
function formatRichText(text: string): { __html: string } {
  const bold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const out: string[] = [];
  let inList = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${bold(bullet[1])}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (line.trim()) out.push(`<p>${bold(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return { __html: DOMPurify.sanitize(out.join(''), { ALLOWED_TAGS: ['strong', 'br', 'ul', 'li', 'p'] }) };
}

/** Tailwind child-selector styling for the sanitized rich-text HTML above. */
const RICH_TEXT_CLASSES =
  '[&_p]:m-0 [&_p:not(:first-child)]:mt-3 ' +
  '[&_ul]:my-2.5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 ' +
  "[&_li]:relative [&_li]:pl-4 [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.6em] [&_li]:before:h-1.5 [&_li]:before:w-1.5 [&_li]:before:rounded-full [&_li]:before:bg-[#27A1A1]";

/** App chat design tokens (mirrors components/chat/ChatMessage.tsx). */
const ASSISTANT_BUBBLE: React.CSSProperties = {
  background: '#FDFBF2',
  borderColor: 'rgba(201, 182, 144, 0.6)',
  boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
  color: '#1F2937',
};

/**
 * The intake chat panel, living in the hero's right column (the pills sit
 * directly left of it, so pill -> gold message -> reply reads as one motion).
 * Bubbles, options and input mirror the in-app coach chat. The thread never
 * scrolls internally: older messages collapse behind an expander so the
 * panel stays roughly one exchange tall.
 */
const IntakeChatPanel: React.FC = () => {
  const chat = useIntakeChat();
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A pill auto-starts the conversation; clear any half-typed custom draft
  // so it doesn't linger in the input.
  useEffect(() => {
    if (chat.started) setDraft('');
  }, [chat.started]);

  // "Something else" (and any focus request) pulls the cursor into the input.
  useEffect(() => {
    if (chat.focusInputNonce > 0) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [chat.focusInputNonce]);

  // Reset chip selection whenever a new question (with options) arrives.
  useEffect(() => {
    setPicked([]);
  }, [chat.chips]);

  // Progress: the beat currently being asked. Server value when fresh,
  // derived from the transcript after a local restore.
  const userMsgCount = useMemo(
    () => chat.messages.filter((m) => m.role === 'user').length,
    [chat.messages],
  );
  const totalBeats = chat.totalBeats;
  const currentBeat = chat.stage === 'pitched' ? totalBeats + 1 : chat.beat ?? Math.min(userMsgCount, totalBeats);

  // Collapse everything except the latest exchange; the panel keeps a
  // stable height instead of growing an inner scrollbar. Once the pitch has
  // landed, only the pitch bubble remains and the history stays sealed: the
  // closing screen is pitch + screenshot + package card, nothing else.
  const pitchedView = chat.stage === 'pitched';
  const hiddenMessages = pitchedView || showHistory ? [] : chat.messages.slice(0, -2);
  const visibleMessages = pitchedView
    ? chat.messages.slice(-1)
    : showHistory
      ? chat.messages
      : chat.messages.slice(-2);

  const submit = () => {
    if (!draft.trim() || chat.sending) return;
    if (chat.started) {
      chat.sendMessage(draft);
    } else {
      // Resting-state input = the "in your own words" route: a custom
      // conversation the model reads directly (no preset archetype).
      chat.start(draft, 'other');
    }
    setDraft('');
  };

  const tapChip = (option: string) => {
    if (chat.sending) return;
    if (!chat.chips?.multi) {
      chat.sendMessage(option);
      return;
    }
    setPicked((prev) => {
      if (prev.includes(option)) return prev.filter((o) => o !== option);
      const max = chat.chips?.max ?? 3;
      return prev.length >= max ? prev : [...prev, option];
    });
  };

  const confirmChips = () => {
    if (picked.length === 0 || chat.sending) return;
    chat.sendMessage(picked.join('; '));
  };

  const showChips = chat.started && chat.stage === 'chat' && !chat.sending && !!chat.chips?.options.length;

  return (
    <div id={INTAKE_SECTION_ID} ref={panelRef} className="relative z-10">
      {/* Header: one-line promise; numbered stepper circles were dropped in
          favour of a light "check-in" line (less form, same finiteness cue) */}
      <div className="mb-5">
        <p className="text-[17px] font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t('intake.title')}
        </p>
        {chat.started && chat.stage === 'chat' && (
          <p className="mt-2 text-[12px] font-semibold text-white/60">
            {t('intake.checkin')} · {Math.min(currentBeat, totalBeats)}/{totalBeats}
            {currentBeat <= totalBeats && chat.beatLabels[currentBeat - 1] && (
              <span className="text-white/80"> · {chat.beatLabels[currentBeat - 1]}</span>
            )}
          </p>
        )}
      </div>

      <>
        {/* Resting state: nothing is preloaded here. Preset pills launch the
            chat themselves; this input is the "in your own words" route (also
            where the "Something else" pill drops the cursor). */}
        {/* At rest the agent ASKS the question, making the pills above read
            as its answer options (and the input as the own-words answer). */}
        {!chat.started && (
          <div className="flex justify-start">
            <div
              className="max-w-[92%] rounded-[20px] border px-4 py-3.5 text-[14px] leading-[1.6]"
              style={{
                ...ASSISTANT_BUBBLE,
                // Resting invite sits directly on the hero photo: a touch of
                // transparency keeps it part of the scene until the chat starts.
                background: 'rgba(253, 251, 242, 0.86)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              {t('intake.restingInvite')}
            </div>
          </div>
        )}
        {chat.started && (
          <div className="space-y-3">
            {/* Collapsed history expander */}
            {hiddenMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white/50 transition-colors hover:text-white/80"
              >
                <ChevronDown size={13} />
                {t('intake.earlier', { count: hiddenMessages.length })}
              </button>
            )}
            {!pitchedView && showHistory && chat.messages.length > 2 && (
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white/50 transition-colors hover:text-white/80"
              >
                <ChevronDown size={13} className="rotate-180" />
                {t('intake.collapse')}
              </button>
            )}

            {visibleMessages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed"
                    style={
                      m.seeded
                        ? { background: '#D4A024', color: '#122E3B', fontWeight: 500 }
                        : { background: '#27A1A1', color: '#fff' }
                    }
                  >
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div
                    className={`max-w-[92%] rounded-[20px] border px-4 py-3.5 text-[14px] leading-[1.6] ${RICH_TEXT_CLASSES}`}
                    style={ASSISTANT_BUBBLE}
                    dangerouslySetInnerHTML={formatRichText(m.text)}
                  />

                </div>
              ),
            )}

            {chat.sending && (
              <div className="flex justify-start" aria-label={t('intake.typing')}>
                <div className="flex items-center gap-1.5 rounded-[20px] border px-5 py-4" style={ASSISTANT_BUBBLE}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full"
                      style={{ background: '#D4A024', animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Answer options: numbered list panel, app-chat style, compact */}
            {showChips && (
              <div className="flex justify-start">
                <div
                  className="w-full overflow-hidden rounded-[16px] border"
                  style={{ background: '#FDFBF2', borderColor: 'rgba(39,161,161,0.35)', boxShadow: '0 20px 44px -20px rgba(0,0,0,0.4)' }}
                >
                  {/* Subtle pick-limit hint for multi-select; becomes a live
                      counter once they start choosing. */}
                  {chat.chips!.multi && (
                    <div
                      className="border-b px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7F8B]"
                      style={{ borderColor: 'rgba(201,182,144,0.35)', background: 'rgba(39,161,161,0.04)' }}
                    >
                      {picked.length > 0
                        ? t('intake.pickCounter', { count: picked.length, max: chat.chips!.max ?? picked.length })
                        : t('intake.pickHint', { max: chat.chips!.max ?? 1 })}
                    </div>
                  )}
                  {chat.chips!.options.map((option, idx) => {
                    const selected = picked.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => tapChip(option)}
                        aria-pressed={selected}
                        className="flex w-full items-center gap-2.5 border-b px-3.5 py-2 text-left transition-colors hover:bg-atlas-teal/5"
                        style={{
                          borderColor: 'rgba(201,182,144,0.35)',
                          background: selected ? 'rgba(39,161,161,0.10)' : undefined,
                        }}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={
                            selected
                              ? { background: '#27A1A1', color: '#fff' }
                              : { background: 'rgba(39,161,161,0.12)', color: '#1F8282' }
                          }
                        >
                          {selected ? <Check size={12} strokeWidth={3} /> : idx + 1}
                        </span>
                        <span className="truncate text-[13px] leading-snug text-[#1F2937]">{option}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.focus()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-atlas-teal/5"
                  >
                    <Pencil size={13} className="ml-1 shrink-0 text-[#6B7F8B]" />
                    <span className="text-[13px] text-[#6B7F8B]">{t('intake.other')}</span>
                  </button>
                  {chat.chips!.multi && picked.length > 0 && (
                    <button
                      type="button"
                      onClick={confirmChips}
                      className="w-full py-2 text-center text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                      style={{ background: '#27A1A1' }}
                    >
                      {t('intake.chipsConfirm')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {chat.error && <p className="px-1 text-[13px] font-medium text-[#F2B8AC]">{chat.error}</p>}
          </div>
        )}

        {/* Input (app chat style). Present in the resting state (the custom
            "own words" route) and during Q&A; steps away once pitched, when the
            dashboard card's CTA is the next step. */}
        {chat.stage !== 'pitched' && (
          <div className="mt-4">
              <form
                className="relative max-w-[92%]"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  maxLength={600}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={chat.started ? t('intake.inputPlaceholder') : t('intake.restingPlaceholder')}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-14 text-[0.9375rem] leading-normal text-[#1F2937] shadow-md outline-none transition-colors focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10"
                />
                <button
                  type="submit"
                  disabled={chat.sending || !draft.trim()}
                  aria-label={t('intake.send')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-atlas-teal text-white transition-opacity disabled:opacity-40"
                >
                  <ArrowRight size={16} strokeWidth={2.4} />
                </button>
              </form>
              <button
                type="button"
                onClick={() => navigate('/payment')}
                className="mt-2 text-[12px] text-white/50 underline underline-offset-2"
              >
                {t('intake.skip')}
              </button>
            </div>
        )}
      </>
    </div>
  );
};

export default IntakeChatPanel;
