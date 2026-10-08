import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

/**
 * The employer-paid notice on the first screen of a company-sponsored
 * assessment (a seat code, access_codes.employer_code_kind = 'seat').
 *
 * The /employers page quotes this line word for word ("What your employee
 * sees"), so the wording lives in survey.json as `sponsored.notice` and must
 * stay identical to employers.json `employeeSees.quote` in both languages.
 * Change one, change the other.
 *
 * It is on the first screen on purpose: an assessment people suspect HR reads
 * is one they answer strategically, so the reassurance has to come before the
 * first question, not in a privacy page nobody opens.
 */
export const SponsoredNotice: React.FC = () => {
  const { t } = useTranslation('survey');
  // Solid gold with dark text (2026-10-08): the first thing on the page,
  // impossible to read past, not a quiet glass card among the others.
  return (
    <div
      className="w-full flex items-center gap-3.5 rounded-2xl mb-7"
      style={{
        maxWidth: 640,
        background: 'linear-gradient(135deg, #F2C75A 0%, #E2AE33 100%)',
        border: '1px solid rgba(255, 236, 180, 0.7)',
        boxShadow: '0 14px 34px -14px rgba(226, 174, 51, 0.65)',
        padding: '16px 20px',
      }}
      role="note"
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: '#122E3B' }}
        aria-hidden="true"
      >
        <Lock className="h-4 w-4" style={{ color: '#F2C75A' }} />
      </span>
      <p className="m-0 text-[15px] md:text-[15.5px] leading-snug" style={{ color: '#122E3B', fontWeight: 600 }}>
        {t('sponsored.notice')}
      </p>
    </div>
  );
};
