import React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Building2, Compass, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

/** One icon per audience, in the order of `whoFor.audiences`. */
const AUDIENCE_ICONS: LucideIcon[] = [Building2, Compass, Briefcase];

/**
 * "Voor wie": the lead text on the left in three paragraphs (who, what it is
 * built for, where it sits in a practice), and the three audiences as small
 * cards on the right, so a skimming reader finds themselves without reading
 * the paragraph. Warm-paper surface (#ECE4D2), like the sections around it.
 */
const PartnersWhoFor: React.FC = () => {
  const { t } = useTranslation('partners');
  const paragraphs = tArray<string>(t, 'whoFor.paragraphs');
  const audiences = tArray<string>(t, 'whoFor.audiences');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('whoFor.title')}
          </h2>
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7 space-y-5">
              {paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-[#122E3B] font-medium leading-[1.6]"
                  style={{ fontSize: 'clamp(18px, 1.9vw, 23px)', letterSpacing: '-0.008em' }}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="lg:col-span-4 lg:col-start-9 flex flex-col gap-3">
              {audiences.map((audience, i) => {
                const Icon = AUDIENCE_ICONS[i] ?? Briefcase;
                return (
                  <li
                    key={audience}
                    className="flex items-center gap-3.5 rounded-2xl px-5 py-4"
                    style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
                  >
                    <span
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(39,161,161,0.12)' }}
                    >
                      <Icon size={18} strokeWidth={2.2} color="#1F8282" />
                    </span>
                    <span className="font-heading font-bold text-[#122E3B] text-[16px] md:text-[17px] leading-snug">
                      {audience}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersWhoFor;
