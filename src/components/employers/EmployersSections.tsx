import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  ClipboardList,
  FileText,
  GitMerge,
  KeyRound,
  Lock,
  Mail,
  MessagesSquare,
  Plus,
  Quote,
  Shuffle,
  Sprout,
  UsersRound,
  Hand,
  EyeOff,
  BarChart3,
  Package,
  Shield,
  FileSignature,
} from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import DemoStage from '@/components/landing/demo/DemoStage';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import { CareerScoreCard } from '@/components/chat/CareerScoreCard';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';
import { CALENDLY_URL, CONTACT_EMAIL, EMPLOYER_DEMO_PERSONA, employerReportLink } from './constants';

/*
 * The /employers page, section by section (copy v2, 2026-09-25). Same
 * surfaces as /partners (dark teal-navy, cream body, #F4ECDA for the money)
 * so it reads as part of the site.
 *
 * B2C safety rule for everything in here: a consumer who lands on this page
 * must read "my employer pays, the result is mine". Every section says that
 * at least once. "Exit", "manage out", "underperformer" and "redundancy" never
 * appear; the outreach angle lives in the outreach only.
 */

const H2_STYLE: React.CSSProperties = { fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' };
const CARD_STYLE: React.CSSProperties = { background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' };
const GLASS_STYLE: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const BODY = 'text-[16px] md:text-[17px] text-[#4B6373] font-medium leading-[1.7]';

/** In-page anchor of the trial block; the hero's first CTA scrolls to it. */
const TRIAL_ID = 'trial';

const Eyebrow: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div className={`lp-eyebrow mb-5 ${dark ? 'text-[#D4A024]' : 'text-[#1F8282]'}`}>{children}</div>
);

const IconDot: React.FC<{ icon: React.ElementType; gold?: boolean; size?: 'sm' | 'md' }> = ({ icon: Icon, gold, size = 'md' }) => (
  <span
    className={`shrink-0 rounded-full flex items-center justify-center ${size === 'sm' ? 'w-6 h-6 mt-0.5' : 'w-10 h-10'}`}
    style={{ background: gold ? 'rgba(212,160,36,0.14)' : 'rgba(39,161,161,0.12)' }}
  >
    <Icon size={size === 'sm' ? 13 : 18} strokeWidth={size === 'sm' ? 3 : 2.2} color={gold ? '#A87A12' : '#1F8282'} />
  </span>
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

const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/* ------------------------------------------------------------------ Hero */

/**
 * Words left, Emma's deck right (chat + dashboard): the tech-sector persona,
 * pinned. The first CTA scrolls to the trial block rather than opening a
 * mail straight away, so the visitor reads the offer before committing.
 */
export const EmployersHero: React.FC = () => {
  const { t } = useTranslation('employers');
  const pills = tArray<string>(t, 'hero.pills');

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
                <p className="mt-7 text-base md:text-lg text-white/70 font-medium leading-relaxed">{t('hero.body')}</p>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <a
                    href={`#${TRIAL_ID}`}
                    onClick={() => trackCtaClick('employers_hero_trial')}
                    className="lp-btn-primary lp-btn-gold"
                  >
                    {t('hero.trialCta')}
                    <ArrowDown size={18} strokeWidth={2.4} />
                  </a>
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackCtaClick('employers_hero_talk')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-[15px] font-bold text-white/85 transition-colors hover:border-white hover:text-white"
                  >
                    {t('hero.talkCta')}
                    <CalendarClock size={16} strokeWidth={2.4} />
                  </a>
                </div>
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
          <ul className="rounded-2xl px-5 py-4 flex flex-wrap items-center justify-center gap-2.5" style={GLASS_STYLE}>
            {pills.map((pill, i) => (
              <li
                key={pill}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[13px] md:text-[14px] font-semibold text-white/85"
              >
                {i === 2 ? (
                  <Lock size={13} strokeWidth={2.6} className="text-[#D4A024]" />
                ) : (
                  <Check size={13} strokeWidth={3} className="text-[#4FC3C3]" />
                )}
                {pill}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
};

/* ----------------------------------------------------------- Why + stats */

interface Stat {
  value: string;
  label: string;
  source: string;
}

export const EmployersWhy: React.FC = () => {
  const { t } = useTranslation('employers');
  const stats = tArray<Stat>(t, 'stats');

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
          <p className={`mt-8 ${BODY}`}>{t('why.p1')}</p>
        </Reveal>

        {/* The stats band: dark glass tiles, the same idiom as the hero pills. */}
        <Reveal className="mt-12 max-w-6xl">
          <div className="rounded-3xl bg-[#213F4F] p-3 md:p-4 grid gap-3 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.value} className="rounded-2xl p-6 md:p-7" style={GLASS_STYLE}>
                <p className="font-heading font-bold text-[#E6C36A] leading-none" style={{ fontSize: 'clamp(34px, 3.6vw, 48px)' }}>
                  {s.value}
                </p>
                <p className="mt-3 text-[15px] text-white/85 font-medium leading-[1.55]">{s.label}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">{s.source}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-12 max-w-3xl">
          <p className={BODY}>{t('why.p2')}</p>
        </Reveal>
      </div>
    </section>
  );
};

/** Same shape as the dashboard's pills (CareerScoreCard), for facts that
 *  have no pill of their own in the product. */
const FactPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="inline-flex items-center gap-2.5 rounded-full border border-atlas-teal/30 bg-white px-3 py-1.5 shadow-sm">
    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
    <span className="text-xs font-semibold text-[#122E3B]">{value}</span>
  </div>
);

/** Great Britain + Northern Ireland, simplified from coastline coordinates.
 *  An outline rather than a flag, so the UK note reads as a market, not a
 *  language option. */
const UkOutline: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="-2 -2 61 91" className={className} aria-hidden="true">
    <g fill="rgba(39,161,161,0.14)" stroke="#1F8282" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M13.9 86.0 L16.8 87.1 L23.0 83.0 L25.9 84.5 L29.6 79.7 L32.8 81.5 L38.9 79.2 L42.4 79.4 L48.5 79.4 L52.7 77.6 L55.0 75.4 L55.5 72.9 L51.1 71.7 L53.1 69.7 L54.5 67.2 L57.3 61.9 L54.6 57.4 L49.9 57.2 L48.2 58.7 L49.1 55.2 L47.7 50.9 L46.6 45.5 L43.5 41.8 L40.1 39.7 L38.7 36.7 L35.4 29.0 L31.9 26.2 L32.1 23.9 L30.2 22.2 L35.0 15.3 L36.7 11.7 L35.4 9.8 L25.0 10.2 L25.1 8.1 L29.2 2.3 L29.4 0.3 L27.5 0.0 L18.0 0.5 L16.3 7.7 L13.4 13.7 L11.0 19.7 L14.5 24.7 L13.4 33.7 L20.0 32.1 L18.8 40.3 L26.7 37.2 L25.9 41.7 L30.2 46.0 L29.3 52.7 L20.3 52.7 L19.5 58.7 L23.2 62.7 L16.3 67.9 L17.4 69.7 L22.6 71.2 L28.5 72.2 L31.4 71.7 L26.7 74.7 L20.7 76.5 L17.4 82.5Z" />
      <path d="M13.4 38.2 L11.3 34.5 L4.6 35.7 L0.0 41.7 L2.9 44.7 L8.7 46.2 L11.6 46.2 L15.1 43.2 L15.4 40.7 L12.8 40.2Z" />
    </g>
  </svg>
);

/* ------------------------------------------------------------ How it works */

const STEP_ICONS = [ClipboardList, MessagesSquare, FileText];

export const EmployersHow: React.FC = () => {
  const { t } = useTranslation('employers');
  const steps = tArray<{ title: string; body: string }>(t, 'how.steps');
  const perRole = tArray<{ label: string; value: string }>(t, 'how.perRole');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('how.eyebrow')}</Eyebrow>
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-10" style={H2_STYLE}>
            {t('how.title')}
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 md:grid-cols-3 max-w-6xl">
          {steps.map((step, i) => (
            <div key={step.title} className="lp-pillar-card rounded-2xl p-7" style={CARD_STYLE}>
              <div className="flex items-center justify-between">
                <IconDot icon={STEP_ICONS[i] ?? FileText} />
                <span className="font-heading font-bold text-[13px] tracking-[0.18em] text-[#C9B690]">0{i + 1}</span>
              </div>
              <p className="mt-5 font-heading font-bold text-[#122E3B] text-[18px]">{step.title}</p>
              <p className="mt-2 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{step.body}</p>
            </div>
          ))}
        </Reveal>

        {/* The real per-career pills the dashboard renders (match, AI impact,
            Move), plus the per-role facts that have no pill in the product,
            drawn in the same pill style so the row reads as one set. */}
        <Reveal className="mt-6 max-w-6xl">
          <div className="rounded-2xl px-6 py-5 flex flex-wrap items-center gap-x-4 gap-y-3" style={CARD_STYLE}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1F8282]">{t('how.perRoleLabel')}</p>
            <div className="flex flex-wrap items-center gap-1.5 [&>div]:m-0">
              <CareerScoreCard score={84} aiImpact="High" move="Ready now" />
              {perRole.map((pill) => (
                <FactPill key={pill.label} label={pill.label} value={pill.value} />
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-8 max-w-3xl">
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#1F8282]">{t('how.languages')}</p>
            <Link
              to={employerReportLink}
              onClick={() => trackCtaClick('employers_how_report')}
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#1F8282] hover:text-[#122E3B] transition-colors group"
            >
              {t('how.reportCta')}
              <ArrowRight size={15} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------- What your employee sees */

/**
 * Only rendered while SHOW_EMPLOYEE_SCREEN_QUOTE is true (see constants.ts):
 * the quote claims to be the start screen word for word.
 */
export const EmployersEmployeeSees: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('employeeSees.eyebrow')}</Eyebrow>
          <p className={BODY}>{t('employeeSees.intro')}</p>
          <figure className="mt-7 relative rounded-2xl bg-[#213F4F] text-white p-8 md:p-10 overflow-hidden">
            <Quote size={36} strokeWidth={2} className="text-[#D4A024] opacity-60" />
            <blockquote
              className="mt-4 font-heading font-semibold leading-[1.45]"
              style={{ fontSize: 'clamp(19px, 2vw, 25px)' }}
            >
              {t('employeeSees.quote')}
            </blockquote>
          </figure>
          <p className={`mt-7 ${BODY}`}>{t('employeeSees.why')}</p>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------ Built to pass the council */

const COUNCIL_ICONS = [Hand, UsersRound, EyeOff];
const TRUST_ICONS = [Lock, Shield, FileSignature];

/**
 * The page's central promise as its own block. The third card is the dark
 * one on purpose: "the employer sees nothing" is what the employee reading
 * over the employer's shoulder needs to find.
 */
export const EmployersCouncil: React.FC = () => {
  const { t } = useTranslation('employers');
  const items = tArray<{ title: string; body: string }>(t, 'council.items');
  const trust = tArray<{ title: string; detail: string }>(t, 'council.trust');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-5" style={H2_STYLE}>
            {t('council.eyebrow')}
          </h2>
          <p className={BODY}>{t('council.intro')}</p>
        </Reveal>

        <Reveal className="mt-10 grid gap-5 md:grid-cols-3 max-w-6xl">
          {items.map((item, i) => {
            const Icon = COUNCIL_ICONS[i] ?? Check;
            const dark = i === items.length - 1;
            return (
              <div
                key={item.title}
                className={`relative rounded-2xl p-7 overflow-hidden ${dark ? 'bg-[#213F4F] text-white' : ''}`}
                style={dark ? undefined : CARD_STYLE}
              >
                {dark && (
                  <img
                    src={CairnSymbolInvert}
                    alt=""
                    aria-hidden="true"
                    className="absolute -right-5 -bottom-5 w-[110px] h-auto opacity-[0.07] pointer-events-none"
                  />
                )}
                <span
                  className="relative w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(39,161,161,0.12)' }}
                >
                  <Icon size={18} strokeWidth={2.2} color={dark ? '#D4A024' : '#1F8282'} />
                </span>
                <p className={`relative mt-5 font-heading font-bold text-[18px] ${dark ? 'text-white' : 'text-[#122E3B]'}`}>
                  {item.title}
                </p>
                <p className={`relative mt-2 text-[15px] font-medium leading-[1.65] ${dark ? 'text-white/80' : 'text-[#4B6373]'}`}>
                  {item.body}
                </p>
              </div>
            );
          })}
        </Reveal>

        {/* Same idiom as the trust bar above the nav (LandingNav): icon, bold
            claim, muted detail, dot separators. */}
        <Reveal className="mt-6 max-w-6xl">
          <ul className="rounded-2xl bg-[#1A1A1A] text-white/75 px-6 py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] md:text-[13px] font-medium tracking-wide">
            {trust.map((item, i) => {
              const Icon = TRUST_ICONS[i] ?? Shield;
              return (
                <React.Fragment key={item.title}>
                  {i > 0 && (
                    <li aria-hidden="true" className="hidden md:block text-white/20">
                      ·
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Icon size={15} strokeWidth={2} className="text-[#D4A024] shrink-0" />
                    <span>
                      <strong className="text-white font-semibold">{item.title}</strong> · {item.detail}
                    </span>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------- What you get */

const GET_ICONS = [KeyRound, Package, BarChart3];

export const EmployersGet: React.FC = () => {
  const { t } = useTranslation('employers');
  const items = tArray<{ title: string; body: string }>(t, 'get.items');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-10" style={H2_STYLE}>
            {t('get.eyebrow')}
          </h2>
        </Reveal>
        <Reveal className="grid gap-5 md:grid-cols-3 max-w-6xl">
          {items.map((item, i) => (
            <div key={item.title} className="lp-pillar-card rounded-2xl p-7" style={CARD_STYLE}>
              <IconDot icon={GET_ICONS[i] ?? Check} />
              <p className="mt-5 font-heading font-bold text-[#122E3B] text-[17px]">{item.title}</p>
              <p className="mt-1.5 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{item.body}</p>
            </div>
          ))}
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
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('fits.eyebrow')}</Eyebrow>
        </Reveal>
        <Reveal className="grid gap-5 sm:grid-cols-2 max-w-5xl">
          {items.map((item, i) => (
            <div key={item.title} className="lp-pillar-card rounded-2xl p-7 flex gap-4 items-start" style={CARD_STYLE}>
              <IconDot icon={FIT_ICONS[i] ?? Briefcase} gold />
              <div>
                <p className="font-heading font-bold text-[#122E3B] text-[17px]">{item.title}</p>
                <p className="mt-1.5 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{item.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
        <Reveal className="mt-8 max-w-3xl">
          <div className="rounded-2xl px-6 py-5 flex gap-5 items-center" style={{ background: 'rgba(39,161,161,0.07)' }}>
            <UkOutline className="shrink-0 w-12 md:w-14 h-auto" />
            <p className="text-[15px] text-[#4B6373] font-medium leading-[1.7]">
              <strong className="text-[#122E3B] font-bold">{t('fits.ukTitle')}:</strong> {t('fits.uk')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ Pricing */

interface CompareRow {
  label: string;
  price: string;
  highlight?: boolean;
}

interface PriceRow {
  credits: string;
  price: string;
}

/**
 * Cost next to what the buyer already pays, then the price itself. The full
 * ladder is the /partners one, read from the partners namespace so prices
 * live in one place; it sits in a <details> because the copy leads with the
 * two ends and a worked example. If employers get their own ladder, give this
 * namespace its own rows and update `pricing.examples` with it.
 */
export const EmployersPricing: React.FC = () => {
  const { t } = useTranslation(['employers', 'partners']);
  const compare = tArray<CompareRow>(t, 'employers:pricing.compare');
  const tiers = tArray<PriceRow>(t, 'partners:pricing.rows');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('employers:pricing.eyebrow')}</Eyebrow>
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8" style={H2_STYLE}>
            {t('employers:pricing.title')}
          </h2>
        </Reveal>

        <Reveal className="max-w-2xl">
          <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
            <p className="px-6 pt-4 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4B6373]/80">
              {t('employers:pricing.compareCaption')}
            </p>
            {compare.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 px-6 py-4"
                style={
                  row.highlight
                    ? { background: '#213F4F' }
                    : { borderTop: '1px solid rgba(201, 182, 144, 0.45)' }
                }
              >
                <span className={`text-[15px] font-semibold ${row.highlight ? 'text-white' : 'text-[#122E3B]'}`}>{row.label}</span>
                <span
                  className={`text-[15px] md:text-[17px] font-bold whitespace-nowrap ${row.highlight ? 'text-[#E6C36A]' : 'text-[#4B6373]'}`}
                >
                  {row.price}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-8 max-w-3xl space-y-6">
          <p className={BODY}>{t('employers:pricing.compareNote')}</p>
          <p className={BODY}>
            <strong className="text-[#122E3B] font-bold">{t('employers:pricing.pricingTitle')}</strong>{' '}
            {t('employers:pricing.pricingBody')}
          </p>
          <p className="text-[#122E3B] font-semibold text-[16px] md:text-[17px] leading-[1.6]">{t('employers:pricing.examples')}</p>

          <details className="lp-faq max-w-2xl">
            <summary>
              {t('employers:pricing.tiersToggle')}
              <Plus className="lp-chev" size={20} strokeWidth={2.4} color="#27A1A1" />
            </summary>
            <div className="mt-2 rounded-2xl overflow-hidden" style={CARD_STYLE}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: 'rgba(39,161,161,0.07)' }}>
                      <th scope="col" className="text-left font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-3.5">
                        {t('employers:pricing.colEmployees')}
                      </th>
                      <th scope="col" className="text-right font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-3.5 whitespace-nowrap">
                        {t('employers:pricing.colPrice')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((row, i) => (
                      <tr key={row.credits} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(201, 182, 144, 0.45)' }}>
                        <td className="px-6 py-3.5 text-[15px] font-semibold text-[#122E3B] whitespace-nowrap">{row.credits}</td>
                        <td className="px-6 py-3.5 text-[15px] font-semibold text-[#1F8282] text-right whitespace-nowrap">{row.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </Reveal>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------- Trial */

/** The page's one real ask: dark canvas, gold button, like the partner pilot. */
export const EmployersTrial: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <section id={TRIAL_ID} className="relative bg-[#213F4F] text-white py-20 md:py-28 overflow-hidden scroll-mt-24">
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
            <a href={mailto(t('trial.mailSubject'))} onClick={() => trackCtaClick('employers_trial_code')} className="lp-btn-primary lp-btn-gold">
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
          <div className={`space-y-5 ${BODY}`}>
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
          <div className="mt-8 flex items-center gap-3 text-[#4B6373]/70">
            <div className="h-px w-12 bg-[#4B6373]/30" />
            <span className="text-[12px] uppercase tracking-[0.22em] font-bold">{t('about.signature')}</span>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <BookLink id="employers_about_book" label={t('about.bookCta')} />
            <a
              href={mailto(t('about.mailSubject'))}
              onClick={() => trackCtaClick('employers_about_mail')}
              className="inline-flex items-center gap-2 rounded-full border border-[#122E3B]/25 px-6 py-3.5 text-[15px] font-bold text-[#122E3B] transition-colors hover:border-[#122E3B]"
            >
              {t('about.emailCta')}
              <Mail size={16} strokeWidth={2.4} />
            </a>
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
