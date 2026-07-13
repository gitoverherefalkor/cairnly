import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown, MessageCircle, X } from 'lucide-react';
import { useIntakeChat } from './IntakeChatContext';

/**
 * The intake chat overlay: a right-side panel on desktop, full-screen sheet
 * on mobile (same portal pattern as ScreenshotSlot, same z-ladder as the
 * mobile nav drawer). Minimized state renders a floating pill instead.
 */
const IntakeChatOverlay: React.FC = () => {
  const chat = useIntakeChat();
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = chat.visibility === 'open';

  // Keep the newest message in view.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages, chat.sending, open]);

  // Lock body scroll on mobile only; on desktop the site stays browsable.
  useEffect(() => {
    if (open && window.matchMedia('(max-width: 767px)').matches) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  useEffect(() => {
    if (open && !chat.sending) inputRef.current?.focus();
  }, [open, chat.sending]);

  if (chat.visibility === 'closed') return null;

  if (chat.visibility === 'minimized') {
    if (!chat.hasSession) return null;
    return createPortal(
      <button
        type="button"
        onClick={chat.openFromCta}
        className="fixed bottom-5 right-5 z-[390] flex items-center gap-2 rounded-full border border-[#D4A024] px-4 py-2.5 text-[13px] font-semibold text-[#F4ECDA] shadow-lg transition-transform hover:-translate-y-0.5"
        style={{ background: '#122E3B' }}
      >
        <MessageCircle size={15} strokeWidth={2.2} className="text-[#D4A024]" />
        {t('intake.continuePill')}
      </button>,
      document.body,
    );
  }

  const send = () => {
    if (!draft.trim() || chat.sending) return;
    chat.sendMessage(draft);
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

  return createPortal(
    <div className="fixed inset-0 z-[400] md:pointer-events-none">
      {/* Mobile-only dim backdrop; desktop keeps the page visible and usable. */}
      <div
        className="absolute inset-0 md:hidden"
        style={{ background: 'rgba(10,18,23,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={chat.minimize}
      />
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 flex w-full flex-col shadow-2xl md:w-[420px]"
        style={{ background: '#FBF6E8' }}
        role="dialog"
        aria-label={t('intake.title')}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4" style={{ background: '#122E3B' }}>
          <div>
            <p
              className="text-[15px] font-bold text-[#F4ECDA]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {t('intake.title')}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/60">{t('intake.subtitle')}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={chat.minimize}
              aria-label={t('intake.minimize')}
              className="rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
            >
              <ChevronDown size={18} />
            </button>
            <button
              type="button"
              onClick={chat.dismiss}
              aria-label={t('intake.close')}
              className="rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
              <button type="button" onClick={() => navigate('/payment')} className="lp-btn-primary w-full justify-center" style={{ fontSize: 15, padding: '13px 22px' }}>
                {t('intake.ctaCheckout')}
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
              <p className="mt-2 text-center text-[12px] text-[#6B7F8B]">{t('intake.ctaNote')}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'rgba(201,182,144,0.45)' }}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
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
      </div>
    </div>,
    document.body,
  );
};

export default IntakeChatOverlay;
