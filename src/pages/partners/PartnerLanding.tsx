import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2 } from 'lucide-react';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { trackCtaClick } from '@/lib/analytics';
import { partnerSignupPath, readPartnerLang } from '@/lib/partnerLinks';
import { CONTACT_EMAIL } from '@/components/partners/constants';

/**
 * /p/:slug — the branded page a partner's candidate lands on.
 *
 * White-label light: the bureau's logo and name appear here, once, above a
 * short explanation and a single "Start" button. The button hands over to the
 * ordinary Cairnly signup (/auth?flow=signup&code=…) with the candidate's code
 * pre-filled, so everything after this page is the normal product. The other
 * branded moment is the PDF report; nothing in between carries the logo, by
 * design (see partners/README.md).
 *
 * ONE dynamic route for every partner, resolved by slug through the anonymous
 * partner-public function. Not a per-partner page and not a flavor fork like
 * /starter or /encore.
 *
 * Language comes from ?lang= on the link (the site-wide detector reads it), so
 * the bureau decides what their candidate sees; the switcher is the fallback.
 */

interface PublicPartner {
  slug: string;
  name: string;
  logo_data_uri: string | null;
  powered_by_text: string | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; partner: PublicPartner }
  | { kind: 'missing' };

async function fetchPartner(slug: string): Promise<PublicPartner | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${base}/functions/v1/partner-public?slug=${encodeURIComponent(slug)}`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`partner-public ${r.status}`);
  const body = await r.json();
  return (body?.partner as PublicPartner) ?? null;
}

const PartnerLanding: React.FC = () => {
  const { t } = useTranslation('partners');
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('code') ?? '').trim();
  const lang = readPartnerLang(searchParams.get('lang'));
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchPartner(slug)
      .then((partner) => {
        if (cancelled) return;
        setState(partner ? { kind: 'ready', partner } : { kind: 'missing' });
      })
      .catch((e) => {
        // A transient outage reads the same as a bad link to the candidate;
        // either way the fix is "ask your advisor", so one screen serves both.
        console.error('[partner-landing]', e);
        if (!cancelled) setState({ kind: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const partnerName = state.kind === 'ready' ? state.partner.name : '';
  const steps = t('landing.steps', { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen survey-bg relative text-white">
      <Seo
        title={partnerName ? t('landing.seo.title', { partner: partnerName }) : t('landing.title')}
        path={`/p/${slug}`}
        noindex
      />

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher className="text-white/70 hover:text-white hover:bg-white/10" />
      </div>

      <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-12">
        <main className="w-full flex flex-col items-center flex-1">
          {state.kind === 'loading' && (
            <div className="flex items-center gap-3 text-white/70 mt-24" role="status">
              <Loader2 className="animate-spin" size={20} />
              <span>{t('landing.loading')}</span>
            </div>
          )}

          {state.kind === 'missing' && (
            <div className="max-w-md w-full text-center mt-16">
              <h1
                className="font-heading text-white text-[28px] sm:text-[34px]"
                style={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                {t('landing.notFound.title')}
              </h1>
              <p className="mt-4 text-white/75 leading-relaxed">
                {t('landing.notFound.body', { email: CONTACT_EMAIL })}
              </p>
              <Link to="/" className="lp-btn-primary mt-8">
                {t('landing.notFound.cta')}
                <ArrowRight size={18} strokeWidth={2.4} />
              </Link>
            </div>
          )}

          {state.kind === 'ready' && (
            <>
              {/* The partner's moment: logo on a light plate (most logos are
                  drawn for white paper), or the name in display type when
                  there is no logo yet. */}
              {state.partner.logo_data_uri ? (
                <div className="bg-white rounded-2xl px-8 py-5 shadow-lg mb-5">
                  <img
                    src={state.partner.logo_data_uri}
                    alt={state.partner.name}
                    className="h-12 sm:h-16 w-auto max-w-[260px] object-contain"
                  />
                </div>
              ) : (
                <div
                  className="font-heading text-white text-[26px] sm:text-[32px] mb-3 text-center"
                  style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
                >
                  {state.partner.name}
                </div>
              )}

              <p className="text-white/70 text-sm font-medium mb-8">
                {t('landing.partnership', { partner: state.partner.name })}
              </p>

              <span
                className="font-heading uppercase text-[11px] mb-3"
                style={{ color: '#EFBE48', letterSpacing: '0.24em', fontWeight: 700 }}
              >
                {t('landing.eyebrow')}
              </span>

              <h1
                className="font-heading text-center text-white text-[28px] sm:text-[36px] m-0 max-w-xl"
                style={{ fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}
              >
                {t('landing.title')}
              </h1>

              <div
                className="w-full mt-8 rounded-3xl p-7 sm:p-9 shadow-2xl"
                style={{ maxWidth: 560, background: '#ECE4D2', color: '#122E3B' }}
              >
                <p className="leading-relaxed text-[15px] sm:text-base m-0">
                  {t('landing.body', { partner: state.partner.name })}
                </p>

                <ol className="mt-6 space-y-3 p-0 m-0 list-none">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="flex-none w-7 h-7 rounded-full inline-flex items-center justify-center text-[13px] text-white"
                        style={{ background: '#27A1A1', fontWeight: 700 }}
                      >
                        {i + 1}
                      </span>
                      <span className="leading-snug pt-1 text-[15px]">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex flex-col items-start gap-3">
                  <Link
                    to={partnerSignupPath(code, lang)}
                    onClick={() => trackCtaClick('partner_landing_start')}
                    className="lp-btn-primary"
                  >
                    {t('landing.cta')}
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </Link>
                  <p className="text-[13px] m-0 leading-snug" style={{ color: '#122E3B', opacity: 0.7 }}>
                    {code ? t('landing.codeReady') : t('landing.codeMissing')}
                  </p>
                </div>

                <p
                  className="mt-6 pt-5 text-[13px] leading-snug m-0"
                  style={{ borderTop: '1px solid rgba(18,46,59,0.12)', color: '#122E3B', opacity: 0.7 }}
                >
                  {t('landing.privacy')}
                </p>
              </div>
            </>
          )}
        </main>

        {/* The credit line: small, honest, at the bottom. Overridable per
            partner through powered_by_text, same field the PDF reads. */}
        {state.kind === 'ready' && (
          <footer className="mt-10 flex flex-col items-center gap-2 text-white/55 text-xs">
            <span>{state.partner.powered_by_text || t('landing.poweredBy')}</span>
            <a href="/" className="inline-flex opacity-80 hover:opacity-100">
              <img src="/logos/cairnly-logo-white.png" alt="Cairnly" className="h-7 w-auto" />
            </a>
          </footer>
        )}
      </div>
    </div>
  );
};

export default PartnerLanding;
