import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChat, INTAKE_SECTION_ID } from './IntakeChatContext';
import Reveal from '../Reveal';

/** i18n seed keys per intent under intake.seeds (first message, in the visitor's voice). */
const SEED_KEY: Record<IntentKey, string> = {
  default: 'default',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

/**
 * The inline intake chat, right below the hero. Before the conversation
 * starts it shows a pre-written first message (seeded from the intent pill
 * the visitor clicked, fully editable) plus a send button; after that it
 * becomes the conversation thread with the pitch, email capture and the
 * checkout handoff.
 */
const IntakeChatSection: React.FC = () => {
  const chat = useIntakeChat();
  const { intent } = useIntent();
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef<HTMLTextAreaElement>(null);

  // The pills write the visitor's first message; a pill click replaces the
  // draft with that intent's seed (only until the conversation starts).
  useEffect(() => {
    if (!chat.started) {
      setDraft(t(`intake.seeds.${SEED_KEY[intent]}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, chat.started, t]);

  // Keep the newest message in view (thread scrolls internally).
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [chat.messages, chat.sending]);

  const submit = () => {
    if (!draft.trim() || chat.sending) return;
    if (chat.started) {
      chat.sendMessage(draft);
    } else {
      chat.start(draft, intent);
    }
    setDraft('');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || emailBusy) return;
    setEmailBusy(true);
    await chat.submitEmail(email);
    setEmailBusy(false);
  };

  const showEmailCard = chat.stage === 'pitched' && !chat.emailCaptured && !emailHidden;

  return (
    <section id={INTAKE_SECTION_ID} style={{ background: '#213F4F' }}>
      <div className="lp-container pb-16 pt-2 md:pb-20">
        <Reveal as="div">
          <div
            className="mx-auto max-w-[760px] overflow-hidden rounded-3xl border shadow-2xl"
            style={{ background: '#FBF6E8', borderColor: 'rgba(201,182,144,0.6)' }}
          >
            {/* Header */}
            <div className="px-6 py-5" style={{ background: '#122E3B' }}>
              <p
                className="text-[16px] font-bold text-[#F4ECDA]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {t('intake.title')}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/60">{t('intake.subtitle')}</p>
            </div>

            {!chat.started ? (
              /* Seed state: the visitor's first message, pre-written and editable. */
              <div className="px-5 py-5 md:px-6">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#6B7F8B]">
                  {t('intake.seedLabel')}
                </p>
                <div className="flex justify-end">
                  <div
                    className="w-full rounded-2xl px-4 py-3 md:max-w-[85%]"
                    style={{ background: '#122E3B', borderBottomRightRadius: 6 }}
                  >
                    <textarea
                      ref={seedRef}
                      value={draft}
                      maxLength={600}
                      rows={2}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#F4ECDA] outline-none placeholder:text-white/40"
                      placeholder={t('intake.seedPlaceholder')}
                    />
                  </div>
                </div>
                {chat.error && (
                  <p className="mt-2 text-[13px] font-medium" style={{ color: '#B4231F' }}>
                    {chat.error}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => navigate('/payment')}
                    className="text-[12px] text-[#6B7F8B] underline underline-offset-2"
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
                <div ref={threadRef} className="max-h-[460px] space-y-3 overflow-y-auto px-5 py-5 md:px-6">
                  {chat.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed"
                        style={
                          m.role === 'user'
                            ? { background: '#122E3B', color: '#F4ECDA', borderBottomRightRadius: 6 }
                            : { background: '#fff', color: '#122E3B', borderBottomLeftRadius: 6, border: '1px solid rgba(201,182,144,0.45)' }
                        }
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}

                  {chat.sending && (
                    <div className="flex justify-start" aria-label={t('intake.typing')}>
                      <div
                        className="flex items-center gap-1.5 rounded-2xl px-4 py-3"
                        style={{ background: '#fff', border: '1px solid rgba(201,182,144,0.45)' }}
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

                  {chat.error && (
                    <p className="px-1 text-[13px] font-medium" style={{ color: '#B4231F' }}>
                      {chat.error}
                    </p>
                  )}

                  {/* Email capture, after the pitch */}
                  {showEmailCard && (
                    <div
                      className="rounded-2xl border p-4"
                      style={{ borderColor: 'rgba(212,160,36,0.5)', background: 'rgba(212,160,36,0.08)' }}
                    >
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
                          className="min-w-0 flex-1 rounded-full border border-[#C9B690] bg-white px-4 py-2 text-[13px] text-[#122E3B] outline-none focus:border-[#D4A024]"
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
                    <p className="px-1 text-[13px] font-medium" style={{ color: '#1F8282' }}>
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
                      <p className="mt-2 text-center text-[12px] text-[#6B7F8B]">{t('intake.ctaNote')}</p>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t px-5 py-3 md:px-6" style={{ borderColor: 'rgba(201,182,144,0.45)' }}>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit();
                    }}
                  >
                    <input
                      type="text"
                      value={draft}
                      maxLength={600}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={t('intake.inputPlaceholder')}
                      className="min-w-0 flex-1 rounded-full border border-[#C9B690] bg-white px-4 py-2.5 text-[14px] text-[#122E3B] outline-none focus:border-[#D4A024]"
                    />
                    <button
                      type="submit"
                      disabled={chat.sending || !draft.trim()}
                      aria-label={t('intake.send')}
                      className="shrink-0 rounded-full p-3 text-white transition-opacity disabled:opacity-40"
                      style={{ background: '#2ABFBF' }}
                    >
                      <ArrowRight size={17} strokeWidth={2.4} />
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => navigate('/payment')}
                    className="mt-2 text-[12px] text-[#6B7F8B] underline underline-offset-2"
                  >
                    {t('intake.skip')}
                  </button>
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default IntakeChatSection;
