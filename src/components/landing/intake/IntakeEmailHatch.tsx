import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntakeChat } from './IntakeChatContext';

/**
 * The "not ready yet, save my spot" email escape hatch. Lives in the hero's
 * right column beneath the dashboard card once the chat is pitched (moved out
 * of the chat thread so the left column ends cleanly on the pitch). Secondary
 * by design: it must never compete with the card's checkout CTA.
 */
const IntakeEmailHatch: React.FC = () => {
  const chat = useIntakeChat();
  const { t } = useTranslation('landing');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (chat.emailCaptured) {
    return (
      <p className="mt-4 text-center text-[13px] font-medium" style={{ color: '#1F8282' }}>
        {t('intake.emailSaved')}
      </p>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    await chat.submitEmail(email);
    setBusy(false);
  };

  return (
    <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3">
      <p className="text-[12px] font-medium text-white/60">{t('intake.emailTitle')}</p>
      <form onSubmit={onSubmit} className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('intake.emailPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-atlas-teal"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg border border-white/20 px-4 py-2 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          {t('intake.emailSubmit')}
        </button>
      </form>
    </div>
  );
};

export default IntakeEmailHatch;
