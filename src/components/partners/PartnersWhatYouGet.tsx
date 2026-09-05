import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_DASHBOARD_ROUTE, DEMO_ROUTE } from '@/demo/constants';
import { partnerDemoLink, SAMPLE_ROUTE } from './constants';

/**
 * Where each deliverable can be seen for real, in the order of
 * `whatYouGet.items`: the top 3 and the per-career detail live on Marcel's
 * dashboard, the coach in his session, the branded PDF on the specimen page.
 */
const PROOF: { to: string; labelKey: 'demoLabel' | 'sampleLabel'; id: string }[] = [
  { to: partnerDemoLink(DEMO_DASHBOARD_ROUTE), labelKey: 'demoLabel', id: 'dashboard' },
  { to: partnerDemoLink(DEMO_DASHBOARD_ROUTE), labelKey: 'demoLabel', id: 'dashboard' },
  { to: partnerDemoLink(DEMO_ROUTE), labelKey: 'demoLabel', id: 'chat' },
  { to: SAMPLE_ROUTE, labelKey: 'sampleLabel', id: 'sample' },
];

/**
 * "Wat de kandidaat krijgt" — the four deliverables as cards on cream, each
 * with the door to where a prospect can see that deliverable for real.
 */
const PartnersWhatYouGet: React.FC = () => {
  const { t } = useTranslation('partners');
  const items = tArray<string>(t, 'whatYouGet.items');

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('whatYouGet.title')}
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 md:grid-cols-2 max-w-5xl">
          {items.map((item, i) => {
            const proof = PROOF[i];
            return (
              <div
                key={i}
                className="lp-pillar-card rounded-2xl p-7 flex gap-4 items-start"
                style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
              >
                <span
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(39,161,161,0.12)' }}
                >
                  <Check size={15} strokeWidth={3} color="#1F8282" />
                </span>
                <div>
                  <p className="text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.65]">{item}</p>
                  {proof && (
                    <Link
                      to={proof.to}
                      onClick={() => trackCtaClick(`partners_whatyouget_${proof.id}`)}
                      className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#1F8282] hover:text-[#122E3B] transition-colors group"
                    >
                      {t(`whatYouGet.${proof.labelKey}`)}
                      <ArrowRight size={14} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersWhatYouGet;
