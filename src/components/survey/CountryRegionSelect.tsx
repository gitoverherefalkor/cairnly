import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  REGION_OPTIONS,
  KEY_TO_OPTION,
  keyForCheckoutCountry,
  keyForRegion,
  type RegionOption,
} from '@/lib/countryToRegion';

interface Props {
  /** The stored answer — one of the region-band strings (or empty). */
  value: string | null;
  /** Sets the answer. We always hand back a region-band string, never a key. */
  onChange: (region: string) => void;
  /** Used to scope the restore hint so questions don't collide. */
  questionId: string;
  /**
   * Free-text country/city captured when the user picks "Elsewhere". Stored as
   * a sidecar response (`__elsewhere_location`), NOT as the answer, because the
   * answer has to stay one of the exact band strings n8n expects.
   */
  elsewhereLocation?: string;
  onElsewhereLocationChange?: (value: string) => void;
}

// The answer only carries the region band, which several countries share, so a
// broad-European band can't tell us which country they picked on a
// back-navigation. We remember the exact option key here (best-effort) so the
// picker restores their actual choice; the answer sent to n8n is unaffected.
const hintKey = (qid: string) => `region_pick_${qid}`;

// Non-country option keys → survey.json regionPicker.* keys. The plain
// two-letter keys are ISO region codes, localized for free via Intl.DisplayNames.
const TIER_LABEL_KEY: Record<string, string> = {
  'uk-london': 'ukLondon',
  'uk-other': 'ukOther',
  'us-high': 'usHigh',
  'us-avg': 'usAvg',
  'us-low': 'usLow',
  elsewhere: 'elsewhere',
};

/**
 * A friendly country picker that stores the cost-of-living region band n8n
 * expects. Pre-fills from the checkout country (overridable), splits US/UK by
 * area inline, and falls back to a EUR estimate for markets we can't price.
 * Country names localize automatically via Intl.DisplayNames; the area tiers
 * and helper copy come from the survey.json regionPicker strings.
 */
export const CountryRegionSelect: React.FC<Props> = ({
  value,
  onChange,
  questionId,
  elsewhereLocation,
  onElsewhereLocationChange,
}) => {
  const { t, i18n } = useTranslation('survey');
  const lang = i18n.language || 'en';
  const [selectedKey, setSelectedKey] = useState<string>('');

  const displayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return null;
    }
  }, [lang]);

  const labelFor = (o: RegionOption): string => {
    if (/^[A-Z]{2}$/.test(o.key)) {
      return displayNames?.of(o.key) ?? o.label; // localized country name
    }
    const k = TIER_LABEL_KEY[o.key];
    return k ? t(`regionPicker.${k}`) : o.label;
  };

  // Resolve what to show once on mount: exact remembered key → reverse the
  // stored band → pre-fill from the checkout country.
  useEffect(() => {
    let hinted: string | null = null;
    try {
      hinted = localStorage.getItem(hintKey(questionId));
    } catch {
      /* storage blocked — fall through */
    }

    if (hinted && KEY_TO_OPTION[hinted] && (!value || KEY_TO_OPTION[hinted].region === value)) {
      setSelectedKey(hinted);
      if (!value) onChange(KEY_TO_OPTION[hinted].region);
      return;
    }

    if (value) {
      setSelectedKey(keyForRegion(value) ?? '');
      return;
    }

    // No answer yet — pre-fill from where they paid from (still overridable).
    let country: string | null = null;
    try {
      country = localStorage.getItem('payment_country');
    } catch {
      /* ignore */
    }
    const k = keyForCheckoutCountry(country);
    if (k) {
      setSelectedKey(k);
      onChange(KEY_TO_OPTION[k].region);
      try {
        localStorage.setItem(hintKey(questionId), k);
      } catch {
        /* ignore */
      }
    }
    // Run once per question; value/onChange intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const pick = (key: string) => {
    setSelectedKey(key);
    onChange(KEY_TO_OPTION[key].region);
    try {
      localStorage.setItem(hintKey(questionId), key);
    } catch {
      /* ignore */
    }
  };

  const selected = selectedKey ? KEY_TO_OPTION[selectedKey] : undefined;
  // Answer set, but we couldn't reverse it to a specific country (a broad
  // European band or AUS/NZ) and have no hint — confirm it's set so the field
  // doesn't read as unanswered.
  const confirmOnly = !selected && !!value;

  return (
    <div>
      <Select value={selectedKey} onValueChange={pick}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('regionPicker.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {REGION_OPTIONS.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {labelFor(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {confirmOnly && (
        <p className="text-sm text-atlas-teal mt-2">
          {t('regionPicker.confirmSet', { region: value })}
        </p>
      )}

      {/* "Elsewhere" is the only honest answer for markets we can't price yet
          (checkout sells to Japan, China and India, none of which have a salary
          band). Asking where they actually are costs the user one line and
          tells us which market to build next; without it the answer is stored
          as the European band and is indistinguishable from a Dutch user, so we
          cannot even count how often this path is taken. Optional on purpose:
          it informs our roadmap, it is not needed to finish the survey. */}
      {selected?.key === 'elsewhere' && (
        <div className="mt-2">
          <p className="text-xs text-gray-500">{t('regionPicker.elsewhereNote')}</p>
          <label
            htmlFor={`elsewhere-location-${questionId}`}
            className="block text-sm font-medium text-gray-700 mt-3 mb-1"
          >
            {t('regionPicker.elsewhereWhereLabel')}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              {t('regionPicker.elsewhereOptional')}
            </span>
          </label>
          <input
            id={`elsewhere-location-${questionId}`}
            type="text"
            value={elsewhereLocation ?? ''}
            onChange={(e) => onElsewhereLocationChange?.(e.target.value)}
            // No example countries on purpose. Any country we name here is one
            // of two things: a market we already price (so it belongs in the
            // dropdown, not in this field's placeholder) or one we intend to
            // add, at which point the example silently becomes wrong. The label
            // above already says exactly what to type.
            maxLength={120}
            // text-sm to match the survey's other secondary inputs; text-base
            // is reserved for primary answer boxes and made this optional
            // sidecar field shout louder than the question above it.
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 outline-none focus:border-atlas-teal focus:ring-1 focus:ring-atlas-teal"
          />
        </div>
      )}
    </div>
  );
};

export default CountryRegionSelect;
