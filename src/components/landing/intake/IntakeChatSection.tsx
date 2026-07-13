import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChat, INTAKE_SECTION_ID } from './IntakeChatContext';
import Reveal from '../Reveal';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/** i18n seed keys per intent under intake.seeds (first message, in the visitor's voice). */
const SEED_KEY: Record<IntentKey, string> = {
  default: 'default',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

const BEAT_COUNT = 5;

/** App chat design tokens (mirrors components/chat/ChatMessage.tsx). */
const ASSISTANT_BUBBLE: React.CSSProperties = {
  background: '#FDFBF2',
  borderColor: 'rgba(201, 182, 144, 0.6)',
  boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
  color: '#1F2937',
};

/**
 * The inline intake chat, flowing straight out of the hero on the app's
 * nature background (survey-bg). Chat on the left, the semi-transparent
 * cairn mark in the open space on the right. Bubbles, input and shadows
 * mirror the in-app coach chat so the pre-chat feels like the product.
 */
const IntakeChatSection: React.FC = () => {
  const chat = useIntakeChat();
  const { intent } = useIntent();
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The pills write the visitor's first message; a pill click replaces the
  // draft with that intent's seed (only until the conversation starts).
  useEffect(() => {
    if (!chat.started) {
      setDraft(t(`intake.seeds.${SEED_KEY[intent]}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, chat.started, t]);

  // Reset chip selection whenever a new question (with chips) arrives.
  useEffect(() => {
    setPicked([]);
  }, [chat.chips]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [chat.messages, chat.sending, chat.chips]);

  // Progress: the beat currently being asked. Server value when fresh,
  // derived from the transcript after a local restore.
  const userMsgCount = useMemo(
    () => chat.messages.filter((m) => m.role === 'user').length,
    [chat.messages],
  );
  const currentBeat = chat.stage === 'pitched' ? BEAT_COUNT + 1 : chat.beat ?? Math.min(userMsgCount, BEAT_COUNT);

  const submit = () => {
    if (!draft.trim() || chat.sending) return;
    if (chat.started) {
      chat.sendMessage(draft);
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

  const showEmailCard = chat.stage === 'pitched' && !chat.emailCaptured && !emailHidden;
  const showChips = chat.started && chat.stage === 'chat' && !chat.sending && !!chat.chips?.options.length;

  const beatLabel = (n: number) => t(`intake.beats.${n}`);

  return (
    <section id={INTAKE_SECTION_ID} className="survey-bg">
      <div className="lp-container py-14 md:py-16">
        <Reveal as="div">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Chat column (left) */}
            <div className="lg:col-span-8">
              {/* Section heading */}
              <div className="mb-6">
                <p
                  className="text-[17px] font-bold text-white"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {t('intake.title')}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">{t('intake.subtitle')}</p>
              </div>

              <div className="md:grid md:grid-cols-[190px_1fr] md:gap-8">
                {/* Outline rail (desktop) */}
                <div className="hidden md:block">
                  <ol className="space-y-4 border-l border-white/15 pl-5">
                    {Array.from({ length: BEAT_COUNT }, (_, i) => i + 1).map((n) => {
                      const done = currentBeat > n;
                      const active = currentBeat === n && chat.started;
                      return (
                        <li key={n} className="flex items-center gap-2.5">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
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
                          <span
                            className="text-[13px] leading-tight"
                            style={{
                              color: active ? '#fff' : done ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                              fontWeight: active ? 700 : 500,
                            }}
                          >
                            {beatLabel(n)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {chat.started && chat.stage === 'chat' && (
                    <p className="mt-5 pl-5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                      {Math.min(currentBeat, BEAT_COUNT)}/{BEAT_COUNT}
                    </p>
                  )}
                </div>

                {/* Thread column */}
                <div>
                  {!chat.started ? (
                    /* Seed state: the visitor's first message, pre-written and editable. */
                    <div>
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-white/45">
                        {t('intake.seedLabel')}
                      </p>
                      <div className="flex justify-end">
                        <div className="w-full rounded-2xl bg-atlas-teal px-4 py-3.5 md:max-w-[85%]">
                          <textarea
                            value={draft}
                            maxLength={600}
                            rows={2}
                            onChange={(e) => setDraft(e.target.value)}
                            className="w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed text-white outline-none placeholder:text-white/50"
                            placeholder={t('intake.seedPlaceholder')}
                          />
                        </div>
                      </div>
                      {chat.error && (
                        <p className="mt-2 text-[13px] font-medium text-[#F2B8AC]">{chat.error}</p>
                      )}
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
                      <div ref={threadRef} className="max-h-[480px] space-y-4 overflow-y-auto pr-1">
                        {chat.messages.map((m, i) =>
                          m.role === 'user' ? (
                            <div key={i} className="flex justify-end">
                              <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-atlas-teal px-4 py-3.5 text-[0.9375rem] leading-relaxed text-white">
                                {m.text}
                              </div>
                            </div>
                          ) : (
                            <div key={i} className="flex justify-start">
                              <div
                                className="max-w-[85%] whitespace-pre-wrap rounded-[20px] border px-5 py-4 text-[15px] leading-[1.6]"
                                style={ASSISTANT_BUBBLE}
                              >
                                {m.text}
                              </div>
                            </div>
                          ),
                        )}

                        {chat.sending && (
                          <div className="flex justify-start" aria-label={t('intake.typing')}>
                            <div
                              className="flex items-center gap-1.5 rounded-[20px] border px-5 py-4"
                              style={ASSISTANT_BUBBLE}
                            >
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

                        {/* Answer chips */}
                        {showChips && (
                          <div className="flex flex-wrap justify-end gap-2 pt-1">
                            {chat.chips!.options.map((option) => {
                              const selected = picked.includes(option);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => tapChip(option)}
                                  aria-pressed={selected}
                                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                                  style={
                                    selected
                                      ? { background: '#27A1A1', borderColor: '#27A1A1', color: '#fff' }
                                      : { borderColor: 'rgba(42,191,191,0.55)', color: '#8FD9D9', background: 'rgba(42,191,191,0.08)' }
                                  }
                                >
                                  {option}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => inputRef.current?.focus()}
                              className="rounded-full border border-dashed border-white/35 px-3.5 py-1.5 text-[13px] font-semibold text-white/55"
                            >
                              {t('intake.other')}
                            </button>
                            {chat.chips!.multi && picked.length > 0 && (
                              <button
                                type="button"
                                onClick={confirmChips}
                                className="rounded-full px-4 py-1.5 text-[13px] font-bold text-white"
                                style={{ background: '#2ABFBF' }}
                              >
                                {t('intake.chipsConfirm')}
                              </button>
                            )}
                          </div>
                        )}

                        {chat.error && (
                          <p className="px-1 text-[13px] font-medium text-[#F2B8AC]">{chat.error}</p>
                        )}

                        {/* Email capture, after the pitch */}
                        {showEmailCard && (
                          <div className="rounded-[20px] border p-4" style={ASSISTANT_BUBBLE}>
                            <p className="text-[14px] font-bold text-[#122E3B]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                              {t('intake.emailTitle')}
                            </p>
                            <p className="mt-1 text-[13px] leading-snug text-[#4B6373]">{t('intake.emailBody')}</p>
                            <form onSubmit={handleEmailSubmit} className="mt-3 flex gap-2">
                              <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('intake.emailPlaceholder')}
                                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] text-[#122E3B] outline-none focus:border-atlas-teal"
                              />
                              <button
                                type="submit"
                                disabled={emailBusy}
                                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                                style={{ background: '#2ABFBF' }}
                              >
                                {t('intake.emailSubmit')}
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => setEmailHidden(true)}
                              className="mt-2 text-[12px] text-[#6B7F8B] underline underline-offset-2"
                            >
                              {t('intake.emailLater')}
                            </button>
                          </div>
                        )}

                        {chat.emailCaptured && chat.stage === 'pitched' && (
                          <p className="px-1 text-[13px] font-medium" style={{ color: '#7FD4D4' }}>
                            {t('intake.emailSaved')}
                          </p>
                        )}

                        {/* Checkout CTA, after the pitch */}
                        {chat.stage === 'pitched' && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => navigate('/payment')}
                              className="lp-btn-primary w-full justify-center"
                              style={{ fontSize: 15, padding: '13px 22px' }}
                            >
                              {t('intake.ctaCheckout')}
                              <ArrowRight size={16} strokeWidth={2.4} />
                            </button>
                            <p className="mt-2 text-center text-[12px] text-white/50">{t('intake.ctaNote')}</p>
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
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-14 text-[0.9375rem] leading-normal text-[#1F2937] shadow-md outline-none transition-colors focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10 sm:px-5"
                          />
                          <button
                            type="submit"
                            disabled={chat.sending || !draft.trim()}
                            aria-label={t('intake.send')}
                            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md bg-atlas-teal text-white transition-opacity disabled:opacity-40"
                          >
                            <ArrowRight size={17} strokeWidth={2.4} />
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Cairn mark in the open space right of the chat */}
            <div className="hidden items-center justify-center lg:col-span-4 lg:flex">
              <img
                src={CairnSymbolInvert}
                alt=""
                aria-hidden="true"
                className="pointer-events-none w-[240px] opacity-[0.08] xl:w-[300px]"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default IntakeChatSection;
