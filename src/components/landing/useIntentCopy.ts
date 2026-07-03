import { useTranslation } from 'react-i18next';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';

/** i18n block names under `variants.` for each non-default intent. */
const VARIANT_BLOCK: Record<Exclude<IntentKey, 'default'>, string> = {
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

/**
 * Intent-aware copy lookup for landing sections.
 * `vt('hero.titleA')` resolves to `variants.<intent>.hero.titleA` when a
 * non-default intent is selected, falling back to the default key if the
 * variant string is missing — a partial translation can never blank a section.
 */
export function useIntentCopy() {
  const { t } = useTranslation('landing');
  const { intent } = useIntent();

  const vt = (key: string): string => {
    if (intent === 'default') return t(key);
    return t(`variants.${VARIANT_BLOCK[intent]}.${key}`, { defaultValue: t(key) });
  };

  return { vt, t, intent };
}
