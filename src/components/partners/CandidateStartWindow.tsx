import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

/**
 * The candidate's start page (/p/:slug) as a still in browser chrome, the same
 * chrome as the hero's demo deck, so it reads as a web page the candidate
 * opens rather than as a poster. Used twice on /partners: in "How your
 * candidate starts", and in the hero beside the pre-chat's offer card, where
 * it shows what "your own start page" on the card looks like.
 *
 * The still shows the specimen partner "Loopbaanbureau Voorbeeld", the same
 * bureau whose logo is on the sample PDF. Re-shoot with
 * scripts/partner-capture-still.mjs after a redesign of PartnerLanding; one
 * file per language, picked by the current i18n language.
 */
const CandidateStartWindow: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, i18n } = useTranslation('partners');
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';

  return (
    <div className={`rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-[#15262F] ${className}`}>
      <div className="flex items-center gap-3 px-3.5 h-9 bg-[#1B2E38] border-b border-black/30">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
          <Lock size={11} className="shrink-0 text-white/40" />
          <span className="truncate">
            cairnly.io/p/<span className="text-white/85">{t('candidateStart.urlSlug')}</span>
          </span>
        </div>
      </div>
      <img
        src={`/images/live/partners/candidate-start-${lang}.jpg`}
        alt={t('candidateStart.imageAlt')}
        width={1800}
        height={1500}
        loading="lazy"
        className="block w-full h-auto"
      />
    </div>
  );
};

export default CandidateStartWindow;
