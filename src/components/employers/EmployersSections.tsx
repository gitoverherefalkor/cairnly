import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  EyeOff,
  GitMerge,
  KeyRound,
  Lock,
  MessagesSquare,
  Plus,
  Shuffle,
  Sprout,
  FileText,
  ClipboardList,
} from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import DemoStage from '@/components/landing/demo/DemoStage';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import { CareerScoreCard } from '@/components/chat/CareerScoreCard';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';
import { CALENDLY_URL, CONTACT_EMAIL, EMPLOYER_DEMO_PERSONA, employerAssessmentLink } from './constants';

/*
 * The /employers page, section by section. Same surfaces as /partners (dark
 * teal-navy hero, cream body, #F4ECDA for the money section) so it reads as
 * part of the site.
 *
 * B2C safety rule for everything in here: a consumer who lands on this page
 * must read "my employer pays, the result is mine". Every section says that
 * at least once. "Exit", "manage out", "underperformer" and "redundancy" never
 * appear; the outreach angle lives in the outreach only.
 */

const H2_STYLE: React.CSSProperties = { fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' };
const CARD_STYLE: React.CSSProperties = { background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' };

const Eyebrow: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div className={`lp-eyebrow mb-5 ${dark ? 'text-[#D4A024]' : 'text-[#1F8282]'}`}>{children}</div>
);

const BookLink: React.FC<{ id: string; label: string }> = ({ id, label }) => (
  <a
    href={CALENDLY_URL}
    target="_blank"
    rel="noopener noreferrer"
    onClick={() => trackCtaClick(id)}
    className="lp-btn-primary lp-btn-gold"
  >
    {label}
    <CalendarClock size={18} strokeWidth={2.4} />
  </a>
);

/* ------------------------------------------------------------------ Hero */

/**
 * Words left, Emma's deck right (chat + dashboard): the tech-sector persona,
 * pinned. The ownership line under the CTAs is the B2C safety line in its
 * shortest form, visible before anyone scrolls.
 */
export const EmployersHero: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section className="relative bg-[#213F4F] text-white pt-16 md:pt-24 pb-20 md:pb-24 overflow-hidden">
      <div
        className="absolute -top-64 -right-64 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.15)', filter: 'blur(120px)' }}
      />
      <div className="lp-container relative z-10">
        <HeroPersonaProvider fixed={EMPLOYER_DEMO_PERSONA}>
          <div className="grid items-center lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-12">
            <div className="lg:col-span-6">
              <Reveal as="div">
                <Eyebrow dark>{t('hero.eyebrow')}</Eyebrow>
                <h1
                  className="font-heading font-bold leading-[1.15] text-white"
                  style={{ fontSize: 'clamp(28px, 3.4vw, 48px)', letterSpacing: '-0.015em' }}
                >
                  {t('hero.title')}
                </h1>
                <p className="mt-7 text-base md:text-lg text-white/70 font-medium leading-relaxed">
                  {t('hero.body')}
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <BookLink id="employers_hero_talk" label={t('hero.talkCta')} />
                  <Link
                    to={employerAssessmentLink}
                    onClick={() => trackCtaClick('employers_hero_assessment')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-[15px] font-bold text-white/85 transition-colors hover:border-white hover:text-white"
                  >
                    {t('hero.assessmentCta')}
                    <ArrowRight size={16} strokeWidth={2.4} />
                  </Link>
                </div>
                <p className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-white/55">
                  <Lock size={14} strokeWidth={2.4} className="text-[#4FC3C3]" />
                  {t('hero.ownershipNote')}
                </p>
              </Reveal>
            </div>
            <div className="lg:col-span-6">
              <Reveal as="div">
                <DemoStage screens={['chat', 'dashboard']} showToggle={false} step={30} />
              </Reveal>
            </div>
          </div>
        </HeroPersonaProvider>

        <Reveal as="div" className="mt-14 md:mt-16">
          <div
            className="rounded-2xl px-6 py-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">{t('hero.pillsLabel')}</p>
            <div className="flex justify-center">
              <CareerScoreCard score={84} aiImpact="High" move="Ready now" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------- Why */

export const EmployersWhy: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('why.eyebrow')}</Eyebrow>
          <p
            className="text-[#122E3B] font-semibold leading-[1.5]"
            style={{ fontSize: 'clamp(20px, 2.2vw, 28px)', letterSpacing: '-0.01em' }}
          >
            {t('why.lead')}
          </p>
          <div className="mt-8 space-y-5 text-[16px] md:text-[17px] text-[#4B6373] font-medium leading-[1.7]">
            <p>{t('why.p1')}</p>
            <p>{t('why.p2')}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------ How it works */

const STEP_ICONS = [ClipboardList, MessagesSquare, FileText];

export const EmployersHow: React.FC = () => {
  const { t } = useTranslation('employers');
  const steps = tArray<{ title: string; body: string }>(t, 'how.steps');

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('how.eyebrow')}</Eyebrow>
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-10" style={H2_STYLE}>
            {t('how.title')}
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 md:grid-cols-3 max-w-6xl">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? FileText;
            return (
              <div key={step.title} className="lp-pillar-card rounded-2xl p-7" style={CARD_STYLE}>
                <div className="flex items-center justify-between">
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(39,161,161,0.12)' }}
                  >
                    <Icon size={18} strokeWidth={2.2} color="#1F8282" />
                  </span>
                  <span className="font-heading font-bold text-[13px] tracking-[0.18em] text-[#C9B690]">
                    0{i + 1}
                  </span>
                </div>
                <p className="mt-5 font-heading font-bold text-[#122E3B] text-[18px]">{step.title}</p>
                <p className="mt-2 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{step.body}</p>
              </div>
            );
          })}
        </Reveal>

        <Reveal className="mt-8 max-w-3xl">
          <p className="text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.7]">{t('how.after')}</p>
          <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1F8282]">
            {t('how.languages')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------ What you get / don't */

/**
 * The page's central promise as a picture: two columns, the right one
 * deliberately the stronger card (dark) because "you never see the report"
 * is what the employee reading over the employer's shoulder needs to see.
 */
export const EmployersSplit: React.FC = () => {
  const { t } = useTranslation('employers');
  const get = tArray<string>(t, 'split.get');
  const dont = tArray<string>(t, 'split.dont');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('split.eyebrow')}</Eyebrow>
        </Reveal>

        <Reveal className="grid gap-5 md:grid-cols-2 max-w-5xl">
          <div className="rounded-2xl p-7 md:p-8" style={CARD_STYLE}>
            <div className="flex items-center gap-3">
              <KeyRound size={20} strokeWidth={2.2} color="#1F8282" />
              <h2 className="font-heading font-bold text-[#122E3B] text-[20px] md:text-[22px]">{t('split.getTitle')}</h2>
            </div>
            <ul className="mt-6 space-y-3.5">
              {get.map((line) => (
                <li key={line} className="flex gap-3 items-start text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.55]">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: 'rgba(39,161,161,0.12)' }}
                  >
                    <Check size={13} strokeWidth={3} color="#1F8282" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-7 md:p-8 bg-[#213F4F] text-white relative overflow-hidden">
            <img
              src={CairnSymbolInvert}
              alt=""
              aria-hidden="true"
              className="absolute -right-6 -bottom-6 w-[140px] h-auto opacity-[0.07] pointer-events-none"
            />
            <div className="relative flex items-center gap-3">
              <EyeOff size={20} strokeWidth={2.2} color="#D4A024" />
              <h2 className="font-heading font-bold text-white text-[20px] md:text-[22px]">{t('split.dontTitle')}</h2>
            </div>
            <ul className="relative mt-6 space-y-3.5">
              {dont.map((line) => (
                <li key={line} className="flex gap-3 items-start text-[15px] md:text-base text-white/85 font-medium leading-[1.55]">
                  <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 bg-white/10">
                    <Lock size={12} strokeWidth={2.6} color="#D4A024" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal className="mt-10 max-w-3xl space-y-4 text-[16px] md:text-[17px] text-[#4B6373] font-medium leading-[1.7]">
          <p className="text-[#122E3B] font-semibold">{t('split.why')}</p>
          <p>{t('split.feedback')}</p>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------ Where it fits */

const FIT_ICONS = [Sprout, Shuffle, GitMerge, Briefcase];

export const EmployersFits: React.FC = () => {
  const { t } = useTranslation('employers');
  const items = tArray<{ title: string; body: string }>(t, 'fits.items');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('fits.eyebrow')}</Eyebrow>
        </Reveal>
        <Reveal className="grid gap-5 sm:grid-cols-2 max-w-5xl">
          {items.map((item, i) => {
            const Icon = FIT_ICONS[i] ?? Briefcase;
            return (
              <div key={item.title} className="lp-pillar-card rounded-2xl p-7 flex gap-4 items-start" style={CARD_STYLE}>
                <span
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(212,160,36,0.14)' }}
                >
                  <Icon size={18} strokeWidth={2.2} color="#A87A12" />
                </span>
                <div>
                  <p className="font-heading font-bold text-[#122E3B] text-[17px]">{item.title}</p>
                  <p className="mt-1.5 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{item.body}</p>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ Pricing */

interface PriceRow {
  credits: string;
  price: string;
}

/**
 * Same credit ladder as /partners, read from the partners namespace so the
 * prices live in one place. If employers ever get their own ladder, give this
 * namespace its own `pricing.rows` and read that instead.
 */
export const EmployersPricing: React.FC = () => {
  const { t } = useTranslation(['employers', 'partners']);
  const rows = tArray<PriceRow>(t, 'partners:pricing.rows');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('employers:pricing.eyebrow')}</Eyebrow>
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-6" style={H2_STYLE}>
            {t('employers:pricing.title')}
          </h2>
          <p className="text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.7]">
            {t('employers:pricing.intro')}
          </p>
        </Reveal>

        <Reveal className="mt-10 max-w-2xl">
          <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: 'rgba(39,161,161,0.07)' }}>
                    <th scope="col" className="text-left font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-4">
                      {t('employers:pricing.colEmployees')}
                    </th>
                    <th scope="col" className="text-right font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-4 whitespace-nowrap">
                      {t('employers:pricing.colPrice')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.credits} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(201, 182, 144, 0.45)' }}>
                      <td className="px-6 py-4 text-[15px] font-semibold text-[#122E3B] whitespace-nowrap">{row.credits}</td>
                      <td className="px-6 py-4 text-[15px] font-semibold text-[#1F8282] text-right whitespace-nowrap">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------- Trial */

/** The page's one real ask: dark canvas, gold button, like the partner pilot. */
export const EmployersTrial: React.FC = () => {
  const { t } = useTranslation('employers');
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('trial.mailSubject'))}`;

  return (
    <section className="relative bg-[#213F4F] text-white py-20 md:py-28 overflow-hidden">
      <div
        className="absolute -bottom-72 -left-52 w-[760px] h-[760px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.12)', filter: 'blur(120px)' }}
      />
      <div className="lp-container relative z-10">
        <Reveal className="max-w-3xl">
          <h2 className="font-heading font-bold text-white leading-[1.15]" style={H2_STYLE}>
            {t('trial.title')}
          </h2>
          <p className="mt-7 text-base md:text-lg text-white/70 font-medium leading-relaxed">{t('trial.body')}</p>
          <div className="mt-10">
            <a href={mailto} onClick={() => trackCtaClick('employers_trial_code')} className="lp-btn-primary lp-btn-gold">
              {t('trial.cta')}
              <KeyRound size={18} strokeWidth={2.4} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------- About */

export const EmployersAbout: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('about.eyebrow')}</Eyebrow>
          <div className="space-y-5 text-[16px] md:text-[17px] text-[#4B6373] font-medium leading-[1.7]">
            <p>{t('about.p1')}</p>
            <p>
              {t('about.p2Before')}
              <Link
                to="/partners"
                onClick={() => trackCtaClick('employers_about_partners')}
                className="text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282]"
              >
                {t('about.p2Link')}
              </Link>
              {t('about.p2After')}
            </p>
          </div>
          <div className="mt-9">
            <BookLink id="employers_about_book" label={t('about.cta')} />
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* --------------------------------------------------------------------- FAQ */

export const EmployersFAQ: React.FC = () => {
  const { t } = useTranslation('employers');
  const items = tArray<{ q: string; a: string }>(t, 'faq.items');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8" style={H2_STYLE}>
            {t('faq.title')}
          </h2>
          {items.map((item, i) => (
            <details key={item.q} className="lp-faq" open={i === 0}>
              <summary>
                {item.q}
                <Plus className="lp-chev" size={20} strokeWidth={2.4} color="#27A1A1" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

/* ----------------------------------------------------------------- Closing */

export const EmployersClosing: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section className="pb-20 md:pb-24" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <div className="lp-chapter-rule mb-8">
            <span className="lp-chapter-rule__dot" />
          </div>
          <p className="text-[13px] text-[#4B6373]/80 font-medium leading-[1.7]">{t('closing.body')}</p>
        </Reveal>
      </div>
    </section>
  );
};
