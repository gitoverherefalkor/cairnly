import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCountry, peekCountry } from '@/lib/analytics';
import { pickCurrency, type EmployerCurrency } from './pricing';

/**
 * A ?currency= pin is remembered for the tab, so a UK prospect who arrives on
 * /employers?currency=gbp and clicks around the site still sees pounds when
 * they come back to the page.
 */
const OVERRIDE_KEY = 'cairnly_employer_currency';

function readOverride(param: string | null): string | null {
  try {
    if (param === 'gbp' || param === 'eur') {
      sessionStorage.setItem(OVERRIDE_KEY, param);
      return param;
    }
    return sessionStorage.getItem(OVERRIDE_KEY);
  } catch {
    return param;
  }
}

/**
 * Pounds for UK visitors, euros for everyone else (rules: pickCurrency).
 *
 * First paint uses what is already known: a URL pin, or the country cached
 * earlier this session. A first-time visitor gets euros until /api/geo answers
 * (one fast same-origin call, shared with analytics), then pounds if they are
 * in the UK. The pricing itself sits well below the fold, so the swap is
 * rarely seen; only the hero pill can change in view.
 */
export function useEmployerCurrency(): EmployerCurrency {
  const [params] = useSearchParams();
  const param = params.get('currency')?.toLowerCase() ?? null;
  const override = readOverride(param);
  const [country, setCountry] = useState<string | null | undefined>(() => peekCountry());

  useEffect(() => {
    if (override || country !== undefined) return;
    let live = true;
    void getCountry().then((c) => { if (live) setCountry(c); });
    return () => { live = false; };
  }, [override, country]);

  return pickCurrency(override, country ?? null);
}
