import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { ArrowRight, Check, ChevronDown, Pencil } from 'lucide-react';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChat, INTAKE_SECTION_ID } from './IntakeChatContext';

/**
 * Renders `**bold**` markers the agent uses to emphasize a phrase (same
 * convention as the survey's own choice labels, see QuestionRenderer.tsx).
 * Sanitized: only <strong>/<br> survive.
 */
function formatEmphasis(text: string): { __html: string } {
  const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  return { __html: DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'br'] }) };
}

/** i18n seed keys per intent under intake.seeds (first message, in the visitor's voice). */
const SEED_KEY: Record<IntentKey, string> = {
  default: 'default',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

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
  const { intent } = useIntent();
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The pills write the visitor's first message; a pill click replaces the
  // draft with that intent's seed (only until the conversation starts).
  useEffect(() => {
    if (!chat.started) {
      setDraft(t(`intake.seeds.${SEED_KEY[intent]}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, chat.started, t]);

  // The seed textarea and the thread input share `draft`; when a pill
  // auto-starts the conversation, clear it so the seed doesn't linger.
  useEffect(() => {
    if (chat.started) setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.started]);

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
  // stable height instead of growing an inner scrollbar.
  const hiddenMessages = showHistory ? [] : chat.messages.slice(0, -2);
  const visibleMessages = showHistory ? chat.messages : chat.messages.slice(-2);

  const submit = () => {
    if (!draft.trim() || chat.sending) return;
    if (chat.started) {
      chat.sendMessage(draft);
    } else if (draft.trim() === t(`intake.seeds.${SEED_KEY[intent]}`)) {
      // Unedited pill seed: same gold treatment + canned opener as a pill click.
      chat.startFromPill(intent, draft);
    } else {
      chat.start(draft, intent);
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || emailBusy) return;
    setEmailBusy(true);
    await chat.submitEmail(email);
    setEmailBusy(false);
  };

  const showEmailCard = chat.stage === 'pitched' && !chat.emailCaptured;
  const showChips = chat.started && chat.stage === 'chat' && !chat.sending && !!chat.chips?.options.length;

  return (
    <div id={INTAKE_SECTION_ID} ref={panelRef} className="relative z-10">
      {/* Header: title + horizontal beat stepper */}
      <div className="mb-5">
        <p className="text-[17px] font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t('intake.title')}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-white/60">{t('intake.subtitle')}</p>
        <div className="mt-3 flex items-center gap-2">
          {Array.from({ length: totalBeats }, (_, i) => i + 1).map((n) => {
            const done = currentBeat > n;
            const active = currentBeat === n && chat.started;
            return (
              <span
                key={n}
                className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold"
                style={
                  done
                    ? { background: '#2AA1A1', borderColor: '#2AA1A1', color: '#fff' }
                    : active
                      ? { borderColor: '#D4A024', color: '#D4A024', background: 'rgba(212,160,36,0.15)' }
                      : { borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.45)' }
                }
              >
                {done ? <Check size={11} strokeWidth={3} /> : n}
              </span>
            );
          })}
          {chat.started && currentBeat <= totalBeats && chat.beatLabels[currentBeat - 1] && (
            <span className="ml-1.5 text-[12px] font-semibold text-white/70">
              {chat.beatLabels[currentBeat - 1]}
            </span>
          )}
        </div>
      </div>

      {!chat.started ? (
        /* Seed state: the visitor's first message, pre-written and editable.
           Gold, matching the selected pill: this message IS the pill speaking. */
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-white/45">
            {t('intake.seedLabel')}
          </p>
          <div className="flex justify-end">
            <div className="w-full rounded-2xl px-4 py-3.5" style={{ background: '#D4A024' }}>
              <textarea
                value={draft}
                maxLength={600}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full resize-none bg-transparent text-[0.9375rem] font-medium leading-relaxed text-[#122E3B] outline-none placeholder:text-[#122E3B]/50"
                placeholder={t('intake.seedPlaceholder')}
              />
            </div>
          </div>
          {chat.error && <p className="mt-2 text-[13px] font-medium text-[#F2B8AC]">{chat.error}</p>}
          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/payment')}
              className="text-[12px] text-white/50 underline underline-offset-2"
            >
              {t('intake.skip')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={chat.sending || !draft.trim()}
              className="lp-btn-primary disabled:opacity-50"
              style={{ fontSize: 15, padding: '12px 24px' }}
            >
              {t('intake.send')}
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : (
        /* Conversation state */
        <>
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
            {showHistory && chat.messages.length > 2 && (
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
                    className="max-w-[92%] rounded-[20px] border px-4 py-3.5 text-[14px] leading-[1.6]"
                    style={ASSISTANT_BUBBLE}
                    dangerouslySetInnerHTML={formatEmphasis(m.text)}
                  >
                  </div>
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

            {/* After the pitch: the checkout CTA now lives on the report
                deliverables card (right column / below on mobile), so this
                is just the demoted save-by-email escape hatch. */}
            {chat.stage === 'pitched' && (
              <div className="space-y-3 pt-1">
                {showEmailCard && (
                  <div className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5">
                    <p className="text-[12px] font-medium text-white/60">{t('intake.emailTitle')}</p>
                    <form onSubmit={handleEmailSubmit} className="mt-2 flex gap-2">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('intake.emailPlaceholder')}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-atlas-teal"
                      />
                      <button
                        type="submit"
                        disabled={emailBusy}
                        className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
                      >
                        {t('intake.emailSubmit')}
                      </button>
                    </form>
                  </div>
                )}

                {chat.emailCaptured && (
                  <p className="text-[13px] font-medium" style={{ color: '#7FD4D4' }}>
                    {t('intake.emailSaved')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Input (app chat style) */}
          <div className="mt-4">
            <form
              className="relative"
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
                placeholder={t('intake.inputPlaceholder')}
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
            {/* Once pitched, the report card's CTA is the checkout path;
                this early "skip the chat" escape hatch would be redundant. */}
            {chat.stage !== 'pitched' && (
              <button
                type="button"
                onClick={() => navigate('/payment')}
                className="mt-2 text-[12px] text-white/50 underline underline-offset-2"
              >
                {t('intake.skip')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default IntakeChatPanel;
