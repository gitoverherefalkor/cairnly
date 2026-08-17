import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { CareerSlotIcon } from '@/components/dashboard/CareerSlotIcon';
import { UNLOCK_LADDER, REFERRAL_DISCOUNT_PERCENT } from '@/hooks/useReferralStatus';
import type { PrintLang } from './printIntros';

// Closing page: the report's sign-off, then what else the account can do.
//
// The document used to simply stop after the last section. The sign-off line is
// the one the coach already delivers at the end of the chat
// (getDreamJobsWrapUp in deliver-section/boilerplate.ts) — the same words, so
// the paper ends the way the conversation did.
//
// The unlock list is generated from UNLOCK_LADDER in useReferralStatus, which is
// the single source of truth the dashboard and the Jobs gate both read. That
// matters here more than anywhere else in this document: a printed PDF cannot be
// corrected after the fact, so a hardcoded "invite 4 friends for 25% back" would
// become a false promise the day the ladder changes. Same reason the discount
// percentage is imported rather than typed.

const STRINGS: Record<
  PrintLang,
  {
    kicker: string;
    heading: string;
    signOff: string;
    toolkitKicker: string;
    toolkitHeading: string;
    toolkitBlurb: (pct: number) => string;
    refundNote: string;
    where: string;
    stepLabel: (n: number) => string;
  }
> = {
  en: {
    kicker: 'That is the report',
    heading: 'You know where you stand.',
    signOff:
      'Revisit this report whenever you need to. You can also share it with mentors, a career advisor, or anyone else who can support your next steps.',
    toolkitKicker: 'Also on your account',
    toolkitHeading: 'Three tools, and your money back',
    toolkitBlurb: (pct) =>
      `Your assessment comes with a toolkit that opens up as you invite people. Every friend who joins gets ${pct}% off, and each one you bring advances you one step:`,
    refundNote:
      'Six friends and the assessment has cost you nothing. Refunds go back to the card you paid with.',
    where: 'Everything lives on your dashboard at cairnly.io/dashboard',
    stepLabel: (n) => `${n} ${n === 1 ? 'friend' : 'friends'}`,
  },
  nl: {
    kicker: 'Dat was het rapport',
    heading: 'Je weet waar je staat.',
    signOff:
      'Kom terug naar dit rapport wanneer je wilt. Je kunt het ook delen met mentoren, een loopbaanadviseur, of iedereen die je verdere stappen kan ondersteunen.',
    toolkitKicker: 'Ook op je account',
    toolkitHeading: 'Drie tools, en je geld terug',
    toolkitBlurb: (pct) =>
      `Bij je assessment hoort een toolkit die opengaat als je mensen uitnodigt. Elke vriend die meedoet krijgt ${pct}% korting, en elke aanmelding brengt jou een stap verder:`,
    refundNote:
      'Bij zes aanmeldingen heeft het assessment je niets gekost. Terugbetalingen gaan naar de kaart waarmee je hebt betaald.',
    where: 'Je vindt alles op je dashboard: cairnly.io/dashboard',
    stepLabel: (n) => `${n} ${n === 1 ? 'aanmelding' : 'aanmeldingen'}`,
  },
};

/** Small numbered step marker for the unlock ladder. */
const StepBadge: React.FC<{ n: number; refund: boolean }> = ({ n, refund }) => (
  <span
    style={{
      flex: '0 0 auto',
      width: 20,
      height: 20,
      borderRadius: 999,
      background: refund ? PALETTE.gold : PALETTE.tealDeep,
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 10,
    }}
  >
    {n}
  </span>
);

export const PrintClosing: React.FC<{ lang: PrintLang }> = ({ lang }) => {
  const t = STRINGS[lang];

  return (
    <div
      style={{
        breakBefore: 'page',
        pageBreakBefore: 'always',
      }}
    >
      {/* Sign-off */}
      <div
        className="print-nobreak"
        style={{
          background: `linear-gradient(150deg, ${PALETTE.canvas} 0%, ${PALETTE.canvasDeep} 100%)`,
          borderRadius: 12,
          padding: '9mm 9mm 8mm',
          color: '#fff',
          marginBottom: '8mm',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: PALETTE.goldBright,
          }}
        >
          {t.kicker}
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 25,
            lineHeight: 1.12,
            letterSpacing: '-0.03em',
            margin: '6px 0 0 0',
            color: '#fff',
          }}
        >
          {t.heading}
        </h2>
        <div
          style={{ width: 40, height: 2.5, background: PALETTE.goldBright, borderRadius: 2, margin: '12px 0 11px 0' }}
        />
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
            margin: 0,
            maxWidth: '140mm',
          }}
        >
          {t.signOff}
        </p>
      </div>

      {/* Toolkit + refund ladder */}
      <div
        className="print-nobreak"
        style={{
          background: PALETTE.creamLight,
          border: '1px solid rgba(201, 182, 144, 0.55)',
          borderRadius: 10,
          padding: '7mm 8mm',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 9.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: PALETTE.gold,
            marginBottom: 6,
          }}
        >
          {t.toolkitKicker}
        </div>
        <h3
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 19,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: PALETTE.canvasDeep,
            margin: '0 0 6px 0',
          }}
        >
          {t.toolkitHeading}
        </h3>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            lineHeight: 1.55,
            color: PALETTE.inkMuted,
            margin: '0 0 6mm 0',
            maxWidth: '150mm',
          }}
        >
          {t.toolkitBlurb(REFERRAL_DISCOUNT_PERCENT)}
        </p>

        {UNLOCK_LADDER.map((step) => {
          const refund = step.kind === 'refund';
          return (
            <div
              key={step.requiredReferrals}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '5px 0',
                borderTop: '1px solid rgba(201, 182, 144, 0.4)',
              }}
            >
              <StepBadge n={step.requiredReferrals} refund={refund} />
              {/* Tool steps carry the dashboard's own wayfinder glyph so the
                  printed list and the dashboard toolkit mark them alike. */}
              {!refund && (
                <span style={{ flex: '0 0 auto', marginTop: 2 }}>
                  <CareerSlotIcon
                    slot={step.featureKey === 'jobs' ? 'primary' : step.featureKey === 'resume' ? 'second' : 'third'}
                    size={16}
                  />
                </span>
              )}
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 12,
                    color: PALETTE.canvasDeep,
                  }}
                >
                  {step.title}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 9.5,
                    color: PALETTE.inkSoft,
                    marginLeft: 8,
                  }}
                >
                  {t.stepLabel(step.requiredReferrals)}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontFamily: FONT_BODY,
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: PALETTE.inkMuted,
                    marginTop: 1,
                  }}
                >
                  {step.description}
                </span>
              </span>
            </div>
          );
        })}

        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: PALETTE.inkMuted,
            margin: '6mm 0 0 0',
            paddingTop: '4mm',
            borderTop: `1px solid ${PALETTE.tan}`,
          }}
        >
          {t.refundNote}
        </p>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 11,
            color: PALETTE.tealDeep,
            margin: '3mm 0 0 0',
          }}
        >
          {t.where}
        </p>
      </div>
    </div>
  );
};
