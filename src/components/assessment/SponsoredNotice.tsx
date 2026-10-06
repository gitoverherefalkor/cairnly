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
  return (
    <div
      className="w-full flex items-start gap-3 rounded-2xl mb-7"
      style={{
        maxWidth: 640,
        background: 'rgba(18, 46, 59, 0.55)',
        border: '1px solid rgba(239, 190, 72, 0.38)',
        padding: '14px 18px',
      }}
      role="note"
    >
      <Lock className="h-4 w-4 mt-[3px] flex-shrink-0" style={{ color: '#EFBE48' }} aria-hidden="true" />
      <p className="m-0 text-[14.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>
        {t('sponsored.notice')}
      </p>
    </div>
  );
};
