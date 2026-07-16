import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useIntent, INTENT_KEYS, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChatOptional } from './intake/IntakeChatContext';

/** i18n seed keys per intent under intake.seeds (mirrors IntakeChatSection). */
const INTAKE_SEED_KEY: Record<IntentKey, string> = {
  default: 'default',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

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
function logPick(intentKey: string, locale: string) {
  supabase
    .from('intent_picks')
    .insert({
      intent_key: intentKey,
      free_text: null,
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
  const { intent, picked, setIntent } = useIntent();
  const intakeChat = useIntakeChatOptional();
  // True while the visitor is on the "Something else" (own-words) route. Local
  // to the chips: it de-highlights the preset pills without changing `intent`
  // (so the hero headline copy stays put, per design).
  const [somethingElse, setSomethingElse] = useState(false);

  const pick = (key: IntentKey) => {
    if (!picked || key !== intent || somethingElse) logPick(key, i18n.language);
    setSomethingElse(false);
    setIntent(key);
    // Launch that preset's chat below the hero (canned opener + options).
    intakeChat?.startFromPill(key, t(`intake.seeds.${INTAKE_SEED_KEY[key]}`));
  };

  const pickSomethingElse = () => {
    logPick('other', i18n.language);
    setSomethingElse(true);
    // Clear any preset pre-chat and drop the cursor into the chat input; the
    // visitor writes their own opening, which starts a custom conversation.
    intakeChat?.reset();
    intakeChat?.requestInputFocus();
  };

  const chipBase =
    'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 cursor-pointer';
  const chipSelected = 'bg-[#D4A024] border-[#D4A024] text-[#122E3B]';
  const chipIdle = 'border-white/25 text-white/65 hover:border-[#D4A024]/60 hover:text-white';

  return (
    <div>
      {/* "What brings you here?" lives in the hero eyebrow above the pills. */}
      <div className="flex flex-wrap gap-2">
        {INTENT_KEYS.map((key) => {
          const active = picked && !somethingElse && intent === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={active}
              className={`${chipBase} ${active ? chipSelected : chipIdle}`}
            >
              {t(`intentChips.labels.${LABEL_KEY[key]}`)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={pickSomethingElse}
          aria-pressed={somethingElse}
          className={`${chipBase} ${somethingElse ? chipSelected : chipIdle}`}
        >
          {t('intentChips.other.label')}
        </button>
      </div>
    </div>
  );
};

export default IntentChips;
