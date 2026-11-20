import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Loader2, Circle } from 'lucide-react';
import { PASSWORD_MIN_LENGTH, type LeakStatus } from '@/lib/passwordRules';

type ItemState = 'pending' | 'ok' | 'fail' | 'checking';

interface PasswordChecklistProps {
  password: string;
  confirmPassword: string;
  leakStatus: LeakStatus;
}

const COLORS: Record<ItemState, string> = {
  pending: '#6B7F8B',
  ok: '#16803C',
  fail: '#B42318',
  checking: '#6B7F8B',
};

const Item = ({ state, label }: { state: ItemState; label: string }) => {
  const Icon = state === 'ok' ? Check : state === 'fail' ? X : state === 'checking' ? Loader2 : Circle;
  return (
    <li className="flex items-center gap-1.5" style={{ color: COLORS[state] }}>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${state === 'checking' ? 'animate-spin' : ''} ${state === 'pending' ? 'h-2.5 w-2.5 mx-0.5' : ''}`}
        strokeWidth={state === 'pending' ? 2 : 2.5}
        aria-hidden
      />
      <span>{label}</span>
    </li>
  );
};

// Live checklist under a "set a password" field. Mirrors the server rules in
// src/lib/passwordRules.ts so a password that is all green will be accepted.
const PasswordChecklist = ({ password, confirmPassword, leakStatus }: PasswordChecklistProps) => {
  const { t } = useTranslation('auth');

  const lengthState: ItemState =
    password.length >= PASSWORD_MIN_LENGTH ? 'ok' : password.length > 0 ? 'fail' : 'pending';

  const leakState: ItemState =
    leakStatus === 'safe' ? 'ok'
      : leakStatus === 'leaked' ? 'fail'
      : leakStatus === 'checking' ? 'checking'
      : 'pending';

  const leakLabel =
    leakStatus === 'leaked' ? t('passwordRules.leaked')
      : leakStatus === 'checking' ? t('passwordRules.checking')
      : leakStatus === 'unknown' ? t('passwordRules.leakUnknown')
      : t('passwordRules.notLeaked');

  const matchState: ItemState =
    confirmPassword.length === 0 ? 'pending' : confirmPassword === password ? 'ok' : 'fail';

  return (
    <ul className="mt-1.5 space-y-1 text-[11.5px] font-medium" aria-live="polite">
      <Item state={lengthState} label={t('passwordRules.minLength', { count: PASSWORD_MIN_LENGTH })} />
      <Item state={leakState} label={leakLabel} />
      <Item state={matchState} label={t('passwordRules.match')} />
    </ul>
  );
};

export default PasswordChecklist;
