import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIntent, INTENT_KEYS, type IntentKey } from '@/contexts/IntentContext';

const VISITOR_KEY = 'cairnly_visitor_id';

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Fire-and-forget: a failed log must never block the UI. */
function logPick(intentKey: string, locale: string, freeText?: string) {
  supabase
    .from('intent_picks')
    .insert({
      intent_key: intentKey,
      free_text: freeText ?? null,
      locale,
      visitor_id: getVisitorId(),
      source: 'chip',
    })
    .then(({ error }) => {
      if (error) console.warn('intent pick log failed:', error.message);
    });
}

/** i18n label keys per intent under intentChips.labels */
const LABEL_KEY: Record<IntentKey, string> = {
  default: 'default',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

const IntentChips: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const { intent, setIntent } = useIntent();
  // 'idle' → other input closed, 'open' → typing, 'thanked' → submitted
  const [otherState, setOtherState] = useState<'idle' | 'open' | 'thanked'>('idle');
  const [otherText, setOtherText] = useState('');

  const pick = (key: IntentKey) => {
    if (key !== intent) logPick(key, i18n.language);
    setIntent(key);
    if (otherState === 'open') setOtherState('idle');
  };

  const submitOther = () => {
    const text = otherText.trim().slice(0, 280);
    if (!text) return;
    logPick('other', i18n.language, text);
    setOtherState('thanked');
    setOtherText('');
  };

  const chipBase =
    'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 cursor-pointer';
  const chipSelected = 'bg-[#D4A024] border-[#D4A024] text-[#122E3B]';
  const chipIdle = 'border-white/25 text-white/65 hover:border-[#D4A024]/60 hover:text-white';

  return (
    <div className="mt-10">
      <p className="text-[11px] font-heading font-bold tracking-[0.2em] uppercase text-white/40 mb-3">
        {t('intentChips.prompt')}
      </p>
      <div className="flex flex-wrap gap-2">
        {INTENT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pick(key)}
            aria-pressed={intent === key}
            className={`${chipBase} ${intent === key ? chipSelected : chipIdle}`}
          >
            {t(`intentChips.labels.${LABEL_KEY[key]}`)}
          </button>
        ))}
        {otherState !== 'thanked' && (
          <button
            type="button"
            onClick={() => setOtherState(otherState === 'open' ? 'idle' : 'open')}
            className={`${chipBase} ${otherState === 'open' ? 'border-white/50 text-white' : chipIdle}`}
          >
            {t('intentChips.other.label')}
          </button>
        )}
      </div>

      {otherState === 'open' && (
        <form
          className="mt-3 flex items-center gap-2 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            submitOther();
          }}
        >
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            maxLength={280}
            autoFocus
            placeholder={t('intentChips.other.placeholder')}
            className="flex-1 rounded-full bg-white/10 border border-white/25 px-4 py-2 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-[#D4A024]/70"
          />
          <button
            type="submit"
            aria-label={t('intentChips.other.submit')}
            className="rounded-full bg-[#D4A024] text-[#122E3B] p-2.5 hover:brightness-110 transition"
          >
            <Send size={14} strokeWidth={2.4} />
          </button>
        </form>
      )}

      {otherState === 'thanked' && (
        <p className="mt-3 text-[13px] text-[#E6C36A] font-medium">{t('intentChips.other.thanks')}</p>
      )}
    </div>
  );
};

export default IntentChips;
