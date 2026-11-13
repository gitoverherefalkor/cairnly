import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setFormalDutch } from '@/lib/formalDutch';

/**
 * Turn Encore's formal Dutch ("u") on or off once we know the user's flavor.
 * Pass null while unknown: nothing changes until there is an answer.
 */
export function useFormalDutch(isEncore: boolean | null): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (isEncore === null) return;
    setFormalDutch(i18n, isEncore);
  }, [i18n, isEncore]);
}
