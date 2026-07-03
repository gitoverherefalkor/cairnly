import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { useIntentCopy } from './useIntentCopy';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

const REPORT_URL = 'https://www.cairnly.io/journal/career-uncertainty-report';

const WhyWeBuiltThis: React.FC = () => {
  const { t } = useTranslation('landing');
  const { vt, intent } = useIntentCopy();

  return (
    <section
      id="about"
      className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
    >
      <div className="absolute right-[-20px] md:right-[20px] top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.09]">
        <img src={CairnSymbolInvert} alt="" className="w-[210px] md:w-[270px] h-auto" />
      </div>
      <div className="lp-container relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <Reveal className="lg:col-span-7">
            <div className="lp-eyebrow text-[#D4A024] mb-6">{t('whyBuilt.eyebrow')}</div>
            <h2
              className="font-heading font-bold leading-[1.1]"
              style={{ fontSize: 'clamp(28px, 3.5vw, 52px)', letterSpacing: '-0.015em' }}
            >
              {t('whyBuilt.titleA')}{' '}
              <br />
              {t('whyBuilt.titleB')} <span className="lp-text-gold-grad">{t('whyBuilt.titleHighlight')}</span>{t('whyBuilt.titleC')}
            </h2>
            <div className="mt-10 space-y-6 text-lg text-white/75 font-medium leading-relaxed">
              {/* p1 flexes with the visitor's intent; p2 is universal */}
              <p key={intent} className="lp-intent-fade">{vt('whyBuilt.p1')}</p>
              <p>{t('whyBuilt.p2')}</p>
            </div>
            <div className="mt-12 flex items-center gap-3 text-white/40">
              <div className="h-px w-12 bg-white/20" />
              <span className="text-[12px] uppercase tracking-[0.22em] font-bold">
                {t('whyBuilt.signature')}
              </span>
            </div>
          </Reveal>

          {/* Report teaser card */}
          <Reveal className="lg:col-span-5">
            <a
              href={REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] p-7 md:p-8 backdrop-blur-sm transition-all duration-300 hover:border-[#D4A024]/45 hover:bg-white/[0.07] hover:-translate-y-1"
            >
              {/* Soft gold glow on hover */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#D4A024]/0 blur-3xl transition-all duration-500 group-hover:bg-[#D4A024]/20" />
              <div className="relative">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D4A024]/12 px-3 py-1.5 text-[#E6C36A]">
                  <FileText size={14} strokeWidth={2} />
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.2em]">
                    {t('whyBuilt.report.eyebrow')}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-[22px] leading-snug text-white">
                  {t('whyBuilt.report.title')}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                  {t('whyBuilt.report.desc')}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-white transition-colors group-hover:text-[#E6C36A]">
                  {t('whyBuilt.report.cta')}
                  <ArrowRight size={15} strokeWidth={2.2} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default WhyWeBuiltThis;
