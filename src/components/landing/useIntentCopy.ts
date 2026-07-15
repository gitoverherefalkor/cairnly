import { useTranslation } from 'react-i18next';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';

/** i18n block names under `variants.` for each intent (once actually picked). */
const VARIANT_BLOCK: Record<IntentKey, string> = {
  // The "I chose my path at 16" pill has its own variant block; the BASE
  // hero keys hold the neutral resting copy shown before any pill is picked.
  default: 'chose16',
  'good-at-it': 'goodAtIt',
  'ai-worried': 'aiWorried',
  'life-changed': 'lifeChanged',
  'understand-myself': 'understandMyself',
};

/**
 * Intent-aware copy lookup for landing sections.
 * Before any pill is picked, `vt('hero.titleA')` resolves to the base key
 * (the resting copy). After a pick it resolves to
 * `variants.<intent>.hero.titleA`, falling back to the base key if the
 * variant string is missing — a partial translation can never blank a section.
 */
export function useIntentCopy() {
  const { t } = useTranslation('landing');
  const { intent, picked } = useIntent();

  const vt = (key: string): string => {
    if (!picked) return t(key);
    return t(`variants.${VARIANT_BLOCK[intent]}.${key}`, { defaultValue: t(key) });
  };

  return { vt, t, intent, picked };
}
