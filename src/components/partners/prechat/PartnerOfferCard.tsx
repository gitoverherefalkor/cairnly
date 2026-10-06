import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, FileText, PlayCircle } from 'lucide-react';
import { trackCtaClick } from '@/lib/analytics';
import { CALENDLY_URL, SAMPLE_ROUTE, partnerDemoLink } from '../constants';
import type { LeadState } from './usePartnerChat';
import type { OfferAction, PartnerOffer } from './partnerChatApi';

/**
 * The card under the pitch. Everything on it is decided on the server
 * (_shared/partnerOffer.ts): which offer leads, the price rows, the money
 * line. This component only words it. No checkout: the end point is free
 * credits (minted by hand), the pilot call, or a call.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Who the candidate pays. With a fixed fee the employer pays, so the candidate
 * pays nothing; when the practitioner bills by the hour or the client pays
 * them directly, the candidate pays the practitioner (never Cairnly).
 */
function candidatesKey(payment: PartnerOffer['payment']): 'candidatesNothing' | 'candidatesYou' | 'candidatesAgreed' {
  if (payment === 'fixed_fee') return 'candidatesNothing';
  if (payment === 'hourly' || payment === 'client_pays') return 'candidatesYou';
  return 'candidatesAgreed';
}

function euro(n: number, lang: string): string {
  return `€${n.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-GB')}`;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid gap-1 border-t py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4" style={{ borderColor: 'rgba(201,182,144,0.45)' }}>
    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1F8282] sm:pt-0.5">{label}</div>
    <div className="text-[14px] font-medium leading-[1.6] text-[#122E3B]">{children}</div>
  </div>
);

interface Props {
  offer: PartnerOffer;
  leadState: LeadState;
  leadChoice: OfferAction | null;
  onLead: (email: string, choice: OfferAction) => Promise<LeadState>;
}

const PartnerOfferCard: React.FC<Props> = ({ offer, leadState, leadChoice, onLead }) => {
  const { t, i18n } = useTranslation('partners');
  const lang = (i18n.language || 'nl').slice(0, 2);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [calledWithoutEmail, setCalledWithoutEmail] = useState(false);
  const [pilotGone, setPilotGone] = useState(false);

  const links = (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
      <Link
        to={SAMPLE_ROUTE}
        onClick={() => trackCtaClick('partner-prechat-sample')}
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#1F8282] underline decoration-[#1F8282]/40 underline-offset-4 hover:text-[#122E3B]"
      >
        <FileText size={15} strokeWidth={2.2} />
        {t('prechat.offer.sample')}
      </Link>
      <Link
        to={partnerDemoLink()}
        onClick={() => trackCtaClick('partner-prechat-demo')}
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#1F8282] underline decoration-[#1F8282]/40 underline-offset-4 hover:text-[#122E3B]"
      >
        <PlayCircle size={15} strokeWidth={2.2} />
        {t('prechat.offer.demo')}
      </Link>
    </div>
  );

  const shell = 'rounded-2xl px-5 py-5 md:px-6';
  const shellStyle: React.CSSProperties = {
    background: '#FBF6E8',
    border: '1px solid rgba(201,182,144,0.7)',
    boxShadow: '0 20px 44px -24px rgba(18,46,59,0.25)',
  };

  if (offer.kind === 'consumer') {
    return (
      <div className={shell} style={shellStyle}>
        <p className="text-[14px] font-medium leading-[1.6] text-[#122E3B]">{t('prechat.offer.consumerBody')}</p>
        <Link to="/" className="lp-btn-primary mt-4" onClick={() => trackCtaClick('partner-prechat-consumer')}>
          {t('prechat.offer.consumerCta')}
          <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  if (offer.kind === 'none') {
    return (
      <div className={shell} style={shellStyle}>
        <p className="font-heading text-[16px] font-bold text-[#122E3B]">{t('prechat.offer.titleNone')}</p>
        <p className="mt-2 text-[14px] font-medium leading-[1.6] text-[#4B6373]">{t('prechat.offer.noneBody')}</p>
        {links}
      </div>
    );
  }

  // Price rows: "50 to 99 credits at €29 each, 100 to 249 at €24".
  const tierText = offer.tiers
    .map((tier, i) => {
      const vars = { from: tier.min, to: tier.max ?? '', price: euro(tier.price, lang) };
      const key = i === 0 ? (tier.max === null ? 'tierFirstOpen' : 'tierFirst') : tier.max === null ? 'tierNextOpen' : 'tierNext';
      return t(`prechat.offer.${key}`, vars);
    })
    .join(', ');

  const pilotOffered = offer.kind === 'pilot' && !pilotGone;
  const actions: OfferAction[] = pilotOffered
    ? ['pilot_call', 'free_credits']
    : offer.quietCall
      ? ['free_credits']
      : ['free_credits', 'call'];

  const act = async (choice: OfferAction) => {
    const trimmed = email.trim();
    const valid = EMAIL_RE.test(trimmed);
    trackCtaClick(`partner-prechat-${choice}`);

    if (choice === 'free_credits') {
      if (!valid) {
        setEmailError(true);
        return;
      }
      setEmailError(false);
      await onLead(trimmed, choice);
      return;
    }

    // A call: open the calendar inside the click (a window opened after an
    // await is a popup the browser blocks), then record the lead if we have
    // an address.
    if (trimmed && !valid) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    const url = trimmed ? `${CALENDLY_URL}?email=${encodeURIComponent(trimmed)}` : CALENDLY_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!trimmed) {
      setCalledWithoutEmail(true);
      return;
    }
    const result = await onLead(trimmed, choice);
    if (result === 'pilot_full') setPilotGone(true);
  };

  const done = leadState === 'done' || calledWithoutEmail;
  const doneText =
    leadChoice === 'free_credits'
      ? t('prechat.offer.doneCredits')
      : calledWithoutEmail && leadState !== 'done'
        ? t('prechat.offer.doneCallNoEmail')
        : t('prechat.offer.doneCall');

  return (
    <div className={shell} style={shellStyle}>
      <p className="mb-2 font-heading text-[16px] font-bold text-[#122E3B]">{t('prechat.offer.title')}</p>

      {offer.fit === 'mixed' && <Row label={t('prechat.offer.fit')}>{t('prechat.offer.fitMixed')}</Row>}
      <Row label={t('prechat.offer.first')}>
        {pilotOffered
          ? t('prechat.offer.pilot', { credits: offer.pilotCredits })
          : t('prechat.offer.credits', { credits: offer.freeCredits })}
      </Row>
      <Row label={pilotOffered ? t('prechat.offer.afterPilot') : t('prechat.offer.then')}>
        {tierText}. {t('prechat.offer.neverExpire')}
      </Row>
      {offer.example && (
        <Row label={t('prechat.offer.example')}>
          {t('prechat.offer.exampleBody', {
            credits: offer.example.credits,
            total: euro(offer.example.total, lang),
            per: euro(offer.example.perCredit, lang),
          })}
        </Row>
      )}
      {offer.passOn && (
        <Row label={t('prechat.offer.passOn')}>
          {t(offer.passOn.creditFrom === offer.passOn.creditTo ? 'prechat.offer.passOnSingle' : 'prechat.offer.passOnRange', {
            consumer: euro(offer.passOn.consumerPrice, lang),
            from: euro(offer.passOn.creditFrom, lang),
            to: euro(offer.passOn.creditTo, lang),
          })}
        </Row>
      )}
      <Row label={t('prechat.offer.candidates')}>{t(`prechat.offer.${candidatesKey(offer.payment)}`)}</Row>

      <div className="border-t pt-4" style={{ borderColor: 'rgba(201,182,144,0.45)' }}>
        {done ? (
          <p className="flex items-start gap-2 text-[14px] font-semibold leading-[1.6] text-[#1F8282]" role="status">
            <Check size={17} strokeWidth={2.6} className="mt-0.5 shrink-0" />
            {doneText}
          </p>
        ) : (
          <>
            <label htmlFor="partner-prechat-email" className="block text-[13px] font-semibold text-[#122E3B]">
              {t('prechat.offer.emailLabel')}
            </label>
            <input
              id="partner-prechat-email"
              type="email"
              autoComplete="email"
              value={email}
              maxLength={200}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(false);
              }}
              placeholder={t('prechat.offer.emailPlaceholder')}
              aria-invalid={emailError}
              className="mt-1.5 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[0.9375rem] text-[#1F2937] outline-none transition-colors focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10"
            />
            {emailError && <p className="mt-1.5 text-[13px] font-medium text-[#B4442F]">{t('prechat.offer.emailInvalid')}</p>}
            {pilotGone && <p className="mt-1.5 text-[13px] font-medium text-[#8A6410]">{t('prechat.offer.pilotFull')}</p>}
            {leadState === 'error' && <p className="mt-1.5 text-[13px] font-medium text-[#B4442F]">{t('prechat.offer.leadError')}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {actions.map((choice, i) => (
                <button
                  key={choice}
                  type="button"
                  disabled={leadState === 'sending'}
                  onClick={() => act(choice)}
                  className={`${i === 0 ? 'lp-btn-primary' : 'lp-btn-primary lp-btn-outline'} max-w-full !whitespace-normal text-left`}
                >
                  {t(`prechat.offer.actions.${choice}`, { credits: offer.freeCredits })}
                  {choice === 'free_credits' ? <ArrowRight size={16} strokeWidth={2.4} /> : <CalendarClock size={16} strokeWidth={2.4} />}
                </button>
              ))}
              {offer.quietCall && (
                <button
                  type="button"
                  onClick={() => act('call')}
                  className="text-[13px] font-medium text-[#4B6373] underline underline-offset-2 hover:text-[#122E3B]"
                >
                  {t('prechat.offer.quietCall')}
                </button>
              )}
            </div>
            {actions.some((a) => a !== 'free_credits') && (
              <p className="mt-2 text-[12px] text-[#6B7F8B]">{t('prechat.offer.emailOptional')}</p>
            )}
          </>
        )}
      </div>

      {links}
    </div>
  );
};

export default PartnerOfferCard;
