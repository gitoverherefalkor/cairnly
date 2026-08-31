import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { Search, FileText, Mail } from 'lucide-react';
import { UNLOCK_LADDER, REFERRAL_DISCOUNT_PERCENT } from '@/hooks/useReferralStatus';
import { DASHBOARD_URL } from './ReportPrintDocument';
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
//
// ── The partner variant ────────────────────────────────────────────────────
//
// A white-labelled report ends on a DIFFERENT page (PARTNER_STRINGS below), for
// two reasons that are really one reason:
//
//   • The referral ladder is Cairnly's own consumer growth loop. The reader did
//     not buy this assessment; a career bureau gave it to them. "Invite six
//     friends and get your money back" is meaningless at best and, since the
//     bureau paid, faintly insulting at worst.
//   • The bureau's product is the CONVERSATION that follows. So the last page
//     hands the reader to their advisor instead of to our funnel: three things
//     to bring to that meeting, and the tools noted as a footnote rather than
//     sold as a ladder.
//
// The two blocks keep the same shape and styling as the consumer page on
// purpose, so the document's ending reads as the same object either way.

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
    whereBefore: string;
    whereLink: string;
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
    whereBefore: 'Everything lives on your dashboard at ',
    whereLink: 'cairnly.io/dashboard',
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
    whereBefore: 'Je vindt alles op je dashboard: ',
    whereLink: 'cairnly.io/dashboard',
    stepLabel: (n) => `${n} ${n === 1 ? 'aanmelding' : 'aanmeldingen'}`,
  },
};

/** The closing page for white-labelled reports. `{partner}` is substituted with
 *  the bureau's name at render time.
 *
 *  The tool names stay English in both languages: they are the product's own
 *  labels on the dashboard, and a reader looking for "Find Job Openings" will
 *  not find "Vacatures zoeken". Same call as the consumer ladder above. */
const PARTNER_STRINGS: Record<
  PrintLang,
  {
    kicker: string;
    heading: string;
    signOff: (partner: string) => string;
    nextKicker: string;
    nextHeading: string;
    nextBlurb: string;
    steps: { lead: string; body: string }[];
    toolsBefore: string;
    toolsLink: string;
    credit: (partner: string) => string;
  }
> = {
  en: {
    kicker: 'That is the report',
    heading: 'You know where you stand.',
    signOff: (partner) =>
      `This report is yours. Take it with you to the conversation with your advisor at ${partner}: everything you have read here is the starting point for that conversation, not the conclusion.`,
    nextKicker: 'Before your next conversation',
    nextHeading: 'How to get the most out of it',
    nextBlurb:
      'The report points out directions. What it cannot do is think them through with you. That is where your advisor starts. Three things that will sharpen that conversation:',
    steps: [
      {
        lead: 'Mark what landed immediately.',
        body: 'Which recommendation felt like confirmation of something you already knew?',
      },
      {
        lead: 'Mark what you disagree with.',
        body: 'The places where the report grates are often more valuable than the places where it fits. Just say so.',
      },
      {
        lead: 'Write down the question that stayed open.',
        body: 'One thing you still do not know after reading it. That is where the conversation begins.',
      },
    ],
    toolsBefore:
      'Three tools are also waiting on your account: Find Job Openings (live vacancies for your recommended directions), Tailor Your Resume and Tailor Cover Letters. You will find everything on your dashboard: ',
    toolsLink: 'cairnly.io/dashboard',
    credit: (partner) =>
      `This assessment was offered to you by ${partner}. Cairnly is a product of Human in the Loop B.V.`,
  },
  nl: {
    kicker: 'Dat was het rapport',
    heading: 'Je weet waar je staat.',
    signOff: (partner) =>
      `Dit rapport is van jou. Neem het mee naar je gesprek met je begeleider bij ${partner}: alles wat je hier las is daar het startpunt, niet de conclusie.`,
    nextKicker: 'Voor je volgende gesprek',
    nextHeading: 'Zo haal je er het meeste uit',
    nextBlurb:
      'Het rapport wijst richtingen aan. Wat het niet kan, is ze met je doorleven. Dat is waar je begeleider begint. Drie dingen die dat gesprek scherper maken:',
    steps: [
      {
        lead: 'Markeer wat meteen raak was.',
        body: 'Welke aanbeveling voelde als een bevestiging van iets dat je eigenlijk al wist?',
      },
      {
        lead: 'Markeer waar je het niet mee eens bent.',
        body: 'De plekken waar het rapport wringt zijn vaak waardevoller dan de plekken waar het klopt. Zeg het er gewoon bij.',
      },
      {
        lead: 'Noteer de vraag die bleef liggen.',
        body: 'Eén ding dat je na het lezen nog steeds niet weet. Daar begint het gesprek.',
      },
    ],
    toolsBefore:
      'Op je account staan ook drie tools voor je klaar: Find Job Openings (live vacatures bij je aanbevolen richtingen), Tailor Your Resume en Tailor Cover Letters. Je vindt alles op je dashboard: ',
    toolsLink: 'cairnly.io/dashboard',
    credit: (partner) =>
      `Dit assessment werd je aangeboden door ${partner}. Cairnly is een product van Human in the Loop B.V.`,
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

// ── Shared block chrome ─────────────────────────────────────────────────────
// Both endings are the same two objects: a dark gradient panel carrying the
// sign-off, and a cream panel carrying whatever comes next. Kept as shared
// pieces rather than duplicated JSX so the partner page cannot drift away from
// the consumer one visually — only its contents differ.

const SignOffPanel: React.FC<{ kicker: string; heading: string; body: string }> = ({
  kicker,
  heading,
  body,
}) => (
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
      {kicker}
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
      {heading}
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
      {body}
    </p>
  </div>
);

const CreamPanel: React.FC<{
  kicker: string;
  heading: string;
  blurb: string;
  children: React.ReactNode;
}> = ({ kicker, heading, blurb, children }) => (
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
      {kicker}
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
      {heading}
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
      {blurb}
    </p>
    {children}
  </div>
);

/** The white-label ending: hand the reader to their advisor, not to our funnel. */
const PartnerClosing: React.FC<{ lang: PrintLang; partnerName: string }> = ({ lang, partnerName }) => {
  const t = PARTNER_STRINGS[lang];

  return (
    <>
      <SignOffPanel kicker={t.kicker} heading={t.heading} body={t.signOff(partnerName)} />

      <CreamPanel kicker={t.nextKicker} heading={t.nextHeading} blurb={t.nextBlurb}>
        {t.steps.map((step, i) => (
          <div
            key={step.lead}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '6px 0',
              borderTop: '1px solid rgba(201, 182, 144, 0.4)',
            }}
          >
            <StepBadge n={i + 1} refund={false} />
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 12,
                  color: PALETTE.canvasDeep,
                }}
              >
                {step.lead}
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
                {step.body}
              </span>
            </span>
          </div>
        ))}

        {/* The toolkit as a footnote rather than a ladder: it exists, it is on
            the account, and it is not what this page is asking for. */}
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
          {t.toolsBefore}
          <a
            href={DASHBOARD_URL}
            style={{ color: PALETTE.tealDeep, textDecoration: 'underline', fontWeight: 600 }}
          >
            {t.toolsLink}
          </a>
        </p>
      </CreamPanel>

      {/* Credit line, outside the panel and deliberately quiet: it is a
          colophon, not a claim the page is making. */}
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 8.5,
          lineHeight: 1.5,
          color: PALETTE.inkSoft,
          margin: '5mm 0 0 0',
        }}
      >
        {t.credit(partnerName)}
      </p>
    </>
  );
};

/** The consumer ending: the referral ladder and the refund promise. */
const ConsumerClosing: React.FC<{ lang: PrintLang }> = ({ lang }) => {
  const t = STRINGS[lang];

  return (
    <>
      <SignOffPanel kicker={t.kicker} heading={t.heading} body={t.signOff} />

      <CreamPanel
        kicker={t.toolkitKicker}
        heading={t.toolkitHeading}
        blurb={t.toolkitBlurb(REFERRAL_DISCOUNT_PERCENT)}
      >
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
              {/* An icon for the TOOL, not a career slot. The wayfinder glyphs
                  mean "career match 1/2/3" and all three read alike, so on a
                  list of three different tools they said nothing. */}
              {!refund && (
                <span style={{ flex: '0 0 auto', marginTop: 2, color: PALETTE.tealDeep, display: 'inline-flex' }}>
                  {step.featureKey === 'jobs' ? (
                    <Search size={14} />
                  ) : step.featureKey === 'resume' ? (
                    <FileText size={14} />
                  ) : (
                    <Mail size={14} />
                  )}
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
            color: PALETTE.canvasDeep,
            margin: '3mm 0 0 0',
          }}
        >
          {t.whereBefore}
          {/* A real href — this is the one action the closing page asks for, so
              it should be clickable rather than a printed address. */}
          <a
            href={DASHBOARD_URL}
            style={{ color: PALETTE.tealDeep, textDecoration: 'underline' }}
          >
            {t.whereLink}
          </a>
        </p>
      </CreamPanel>
    </>
  );
};

export const PrintClosing: React.FC<{
  lang: PrintLang;
  /** The bureau's name on a white-labelled report; null for a direct customer.
   *  Its presence is what selects the ending — see the note at the top. */
  partnerName?: string | null;
}> = ({ lang, partnerName }) => (
  <div
    style={{
      breakBefore: 'page',
      pageBreakBefore: 'always',
    }}
  >
    {partnerName ? <PartnerClosing lang={lang} partnerName={partnerName} /> : <ConsumerClosing lang={lang} />}
  </div>
);
