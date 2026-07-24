import React, { useEffect, useState } from 'react';
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
} from '@/lib/countryToRegion';

interface Props {
  /** The stored answer — one of the region-band strings (or empty). */
  value: string | null;
  /** Sets the answer. We always hand back a region-band string, never a key. */
  onChange: (region: string) => void;
  /** Used to scope the restore hint so questions don't collide. */
  questionId: string;
}

// The answer only carries the region band, which several countries share, so a
// broad-European band can't tell us which country they picked on a
// back-navigation. We remember the exact option key here (best-effort) so the
// picker restores their actual choice; the answer sent to n8n is unaffected.
const hintKey = (qid: string) => `region_pick_${qid}`;

/**
 * A friendly country picker that stores the cost-of-living region band n8n
 * expects. Pre-fills from the checkout country (overridable), splits US/UK by
 * area inline, and falls back to a EUR estimate for markets we can't price.
 */
export const CountryRegionSelect: React.FC<Props> = ({ value, onChange, questionId }) => {
  const [selectedKey, setSelectedKey] = useState<string>('');

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
          <SelectValue placeholder="Select your country…" />
        </SelectTrigger>
        <SelectContent>
          {REGION_OPTIONS.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {confirmOnly && (
        <p className="text-sm text-atlas-teal mt-2">
          Currently set to: {value}. Pick a country above to change it.
        </p>
      )}

      {selected?.key === 'elsewhere' && (
        <p className="text-xs text-gray-500 mt-2">
          We don't have salary data for your market yet, so estimates will use Europe (EUR) as a rough reference.
        </p>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Pick where you want to build your career — it sets which market's salary estimates you'll see.
      </p>
    </div>
  );
};

export default CountryRegionSelect;
