// Employer emails: the trial link for the HR contact, and the batch of seat
// links for their people. Built on the shared Cairnly chrome
// (email-chrome.ts), sent by ops-employers right after a mint.
//
// One template, always the same: a short intro on what the link gives, the
// expiry, natasha@cairnly.io for questions, then the link or links. Only the
// contact's first name, the company, the expiry, the language and the links
// change per send. The wording was approved by Sjoerd in a Claude Doc on
// 2026-11-17; change it there first, not here.
//
// Pure functions, no Deno or network calls, so vitest covers them
// (employerEmails.test.ts).

import {
  renderEmail,
  bodyRow,
  ctaRow,
  h1,
  paragraph,
  callout,
  bullet,
  escapeHtml,
} from './email-chrome.ts';

export type EmployerEmailLang = 'en' | 'nl';
export type EmployerEmailKind = 'trial' | 'seat';

/** Where questions go, and where replies to these emails land. */
export const EMPLOYER_SUPPORT_EMAIL = 'natasha@cairnly.io';

export interface EmployerEmailInput {
  lang: EmployerEmailLang;
  kind: EmployerEmailKind;
  company: string;
  /** Full name of the contact as stored; the greeting uses the first word. */
  contactName: string | null;
  contactEmail: string;
  /** Signup links: exactly one for a trial, one per seat otherwise. */
  links: string[];
  /** yyyy-mm-dd the codes stop working (inclusive), or null for no expiry. */
  expiresOn: string | null;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const MONTHS: Record<EmployerEmailLang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
};

/** "2026-12-17" → "17 December 2026" / "17 december 2026". Null when not a date. */
export function formatExpiry(iso: string | null, lang: EmployerEmailLang): string | null {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = MONTHS[lang][Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/**
 * First name for the greeting, or null when we do not really have one.
 * The Ops form fills a missing contact name with the email's local part
 * ("hr" for hr@acme.nl), and greeting someone as "Hi hr," is worse than "Hi,".
 */
export function firstNameFor(name: string | null | undefined, email: string): string | null {
  const full = (name ?? '').trim();
  if (!full) return null;
  const local = email.split('@')[0].trim().toLowerCase();
  if (full.toLowerCase() === local) return null;
  return full.split(/\s+/)[0] || null;
}

/** Subjects are one line; a pasted newline must never reach a header. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

/**
 * "…at Acme B.V.. Each link…" → one full stop: a company name can end in one,
 * and the sentence adds its own. Only exactly two dots followed by a space or
 * the end; "..." is left alone.
 */
const tidy = (s: string) => s.replace(/([^.])\.\.(?=\s|$)/g, '$1.');

// ─── Copy ───────────────────────────────────────────────────────────────────
// English is the source. Dutch: casual je-form, no em-dashes, brand terms in
// English (see LOCALIZATION_PLAYBOOK.md).

interface Copy {
  hi: (name: string | null) => string;
  trial: {
    subject: string;
    preheader: (date: string | null) => string;
    heading: string;
    intro: (company: string) => string;
    eyebrow: string;
    bullets: string[];
    cta: string;
    linkHint: string;
    validity: (date: string | null) => string;
  };
  seat: {
    subject: (company: string) => string;
    preheader: (n: number, date: string | null) => string;
    heading: string;
    intro: (company: string) => string;
    eyebrow: string;
    bullets: (company: string) => string[];
    howTo: string;
    howToBody: (n: number, date: string | null) => string;
  };
  support: string;
  signoff: string;
}

const COPY: Record<EmployerEmailLang, Copy> = {
  en: {
    hi: (n) => (n ? `Hi ${n},` : 'Hi,'),
    trial: {
      subject: 'Your Cairnly trial link',
      preheader: (d) => (d ? `Try Cairnly yourself. Your link is valid until ${d}.` : 'Try Cairnly yourself.'),
      heading: 'Your Cairnly trial is ready',
      intro: (c) => `Here is your personal trial link for Cairnly, so you can try it yourself before rolling it out at ${c}.`,
      eyebrow: 'What the trial gives you',
      bullets: [
        'The full Cairnly career assessment',
        'Your personality profile and a detailed career recommendations report',
        'A chat with the Cairnly coach to talk through your results',
      ],
      cta: 'Start your trial',
      linkHint: 'If the button does not work, copy this link into your browser:',
      validity: (d) => (d ? `This link is for one person and is valid until ${d}.` : 'This link is for one person and does not expire.'),
    },
    seat: {
      subject: (c) => `Your Cairnly access links for ${c}`,
      preheader: (n, d) => `${n} personal ${n === 1 ? 'link' : 'links'} for your team${d ? `, valid until ${d}` : ''}.`,
      heading: 'Your Cairnly access links are ready',
      intro: (c) => `Below are the personal access links for your team at ${c}. Each link gives one person the full Cairnly experience, paid for by ${c}.`,
      eyebrow: 'What the seats give your people',
      bullets: (c) => [
        'The full Cairnly career assessment and a detailed career recommendations report',
        'A chat with the Cairnly coach to talk through their results',
        `Everything paid for by ${c} (the first screen tells them so)`,
        'Privacy: you only see how many links were used, never who used them or what they answered',
      ],
      howTo: 'How to use them',
      howToBody: (n, d) =>
        `Send one link to each person. A link works for one person only, so please do not share one link with several colleagues. You have ${n} ${n === 1 ? 'link' : 'links'}${d ? `, valid until ${d}` : '. These links do not expire'}.`,
    },
    support: `Questions or need a hand? Email ${EMPLOYER_SUPPORT_EMAIL}.`,
    signoff: 'The Cairnly team',
  },
  nl: {
    hi: (n) => (n ? `Hoi ${n},` : 'Hoi,'),
    trial: {
      subject: 'Je Cairnly-proeflink',
      preheader: (d) => (d ? `Probeer Cairnly zelf uit. Je link is geldig tot ${d}.` : 'Probeer Cairnly zelf uit.'),
      heading: 'Je Cairnly trial staat klaar',
      intro: (c) => `Hier is je persoonlijke link voor Cairnly, zodat je het zelf kunt uitproberen voordat je het bij ${c} uitrolt.`,
      eyebrow: 'Wat de proef je geeft',
      bullets: [
        'Het volledige Cairnly loopbaanassessment',
        'Je persoonlijkheidsprofiel en een uitgebreid rapport met loopbaanadvies',
        'Een gesprek met de Cairnly coach om je resultaten door te nemen',
      ],
      cta: 'Start je proef',
      linkHint: 'Werkt de knop niet? Kopieer dan deze link in je browser:',
      validity: (d) => (d ? `Deze link is voor één persoon en geldig tot ${d}.` : 'Deze link is voor één persoon en verloopt niet.'),
    },
    seat: {
      subject: (c) => `Je Cairnly-toegangslinks voor ${c}`,
      preheader: (n, d) => `${n} ${n === 1 ? 'persoonlijke link' : 'persoonlijke links'} voor je team${d ? `, geldig tot ${d}` : ''}.`,
      heading: 'Je Cairnly-toegangslinks staan klaar',
      intro: (c) => `Hieronder staan de persoonlijke toegangslinks voor je team bij ${c}. Met elke link krijgt één persoon de volledige Cairnly-ervaring, betaald door ${c}.`,
      eyebrow: 'Wat de seats je mensen geven',
      bullets: (c) => [
        'Het volledige Cairnly loopbaanassessment en een uitgebreid rapport met loopbaanadvies',
        'Een gesprek met de Cairnly coach om de resultaten door te nemen',
        `Alles betaald door ${c} (het eerste scherm vertelt ze dat)`,
        'Privacy: jij ziet alleen hoeveel links zijn gebruikt, nooit wie ze gebruikte of wat er is ingevuld',
      ],
      howTo: 'Zo gebruik je ze',
      howToBody: (n, d) =>
        `Stuur elke persoon één link. Een link werkt voor één persoon, dus deel een link niet met meerdere collega's. Je hebt ${n} ${n === 1 ? 'link' : 'links'}${d ? `, geldig tot ${d}` : '. Deze links verlopen niet'}.`,
    },
    support: `Vragen of hulp nodig? Mail ${EMPLOYER_SUPPORT_EMAIL}.`,
    signoff: 'Het Cairnly-team',
  },
};

// ─── HTML pieces ────────────────────────────────────────────────────────────

const FONT = `'Inter','Segoe UI',Arial,sans-serif`;
const MONO = `'SFMono-Regular',Menlo,Consolas,'Courier New',monospace`;

/** A full-width cream row for content that sits between body and footer. */
const plainRow = (inner: string, paddingTop = 0) =>
  `<tr><td style="padding:${paddingTop}px 48px 8px;background-color:#ECE4D2;font-family:${FONT};" class="px-mob">${inner}</td></tr>`;

const linkBlock = (url: string) =>
  `<p style="margin:0 0 8px 0;padding:12px 14px;background-color:#F6EFD8;border:1px solid #DCCFAE;border-radius:8px;font-size:12px;line-height:1.5;word-break:break-all;font-family:${MONO};"><a href="${escapeHtml(url)}" style="color:#1F8282;text-decoration:none;">${escapeHtml(url)}</a></p>`;

const bulletsTable = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((b) => bullet(escapeHtml(b))).join('')}</table>`;

/** The Cairnly sign-off plus the support line, closing every email. */
const closing = (c: Copy) =>
  plainRow(
    paragraph(escapeHtml(c.support), { size: 14, mb: 14 }) +
      paragraph(escapeHtml(c.signoff), { size: 14, mb: 0, weight: 600 }),
    8,
  ) + `<tr><td style="height:24px;font-size:0;line-height:0;background-color:#ECE4D2;">&nbsp;</td></tr>`;

// ─── Builders ───────────────────────────────────────────────────────────────

function buildTrial(input: EmployerEmailInput, c: Copy, date: string | null): BuiltEmail {
  const t = c.trial;
  const company = oneLine(input.company);
  const link = input.links[0] ?? '';
  const greeting = c.hi(firstNameFor(input.contactName, input.contactEmail));

  const bodyHtml =
    bodyRow(h1(escapeHtml(t.heading)) + paragraph(escapeHtml(greeting)) + paragraph(escapeHtml(tidy(t.intro(company))))) +
    plainRow(callout(escapeHtml(t.eyebrow), bulletsTable(t.bullets))) +
    ctaRow(escapeHtml(t.cta), escapeHtml(link)) +
    plainRow(paragraph(escapeHtml(t.linkHint), { size: 13, color: '#6B7480', mb: 8 }) + linkBlock(link)) +
    plainRow(paragraph(escapeHtml(t.validity(date)), { size: 14, mb: 6 }), 12) +
    closing(c);

  const html = renderEmail({
    title: escapeHtml(t.subject),
    preheader: escapeHtml(t.preheader(date)),
    bodyHtml,
    footer: 'generic',
  });

  const text = [
    greeting,
    '',
    tidy(t.intro(company)),
    '',
    t.eyebrow,
    ...t.bullets.map((b) => `- ${b}`),
    '',
    t.cta + ':',
    link,
    '',
    t.validity(date),
    '',
    c.support,
    '',
    c.signoff,
  ].join('\n');

  return { subject: t.subject, html, text };
}

function buildSeats(input: EmployerEmailInput, c: Copy, date: string | null): BuiltEmail {
  const s = c.seat;
  const company = oneLine(input.company);
  const n = input.links.length;
  const greeting = c.hi(firstNameFor(input.contactName, input.contactEmail));
  const subject = s.subject(company);

  const linkRows = input.links
    .map(
      (url, i) =>
        `<tr><td style="padding:6px 10px 6px 0;vertical-align:top;color:#6B7480;font-size:13px;font-family:${FONT};white-space:nowrap;">${i + 1}.</td>` +
        `<td style="padding:6px 0;font-size:12px;line-height:1.5;word-break:break-all;font-family:${MONO};"><a href="${escapeHtml(url)}" style="color:#1F8282;text-decoration:none;">${escapeHtml(url)}</a></td></tr>`,
    )
    .join('');

  const bodyHtml =
    bodyRow(h1(escapeHtml(s.heading)) + paragraph(escapeHtml(greeting)) + paragraph(escapeHtml(tidy(s.intro(company))))) +
    plainRow(callout(escapeHtml(s.eyebrow), bulletsTable(s.bullets(company)))) +
    plainRow(
      paragraph(escapeHtml(s.howTo), { size: 15, weight: 700, mb: 8, color: '#122E3B' }) +
        paragraph(escapeHtml(s.howToBody(n, date)), { size: 15, mb: 14 }) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6EFD8;border:1px solid #DCCFAE;border-radius:8px;"><tr><td style="padding:10px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${linkRows}</table></td></tr></table>`,
      12,
    ) +
    closing(c);

  const html = renderEmail({
    title: escapeHtml(subject),
    preheader: escapeHtml(s.preheader(n, date)),
    bodyHtml,
    footer: 'generic',
  });

  const text = [
    greeting,
    '',
    tidy(s.intro(company)),
    '',
    s.eyebrow,
    ...s.bullets(company).map((b) => `- ${b}`),
    '',
    s.howTo,
    s.howToBody(n, date),
    '',
    ...input.links.map((url, i) => `${i + 1}. ${url}`),
    '',
    c.support,
    '',
    c.signoff,
  ].join('\n');

  return { subject: oneLine(subject), html, text };
}

/** Build the subject, HTML and plain-text body for one employer email. */
export function buildEmployerEmail(input: EmployerEmailInput): BuiltEmail {
  const c = COPY[input.lang];
  const date = formatExpiry(input.expiresOn, input.lang);
  return input.kind === 'trial' ? buildTrial(input, c, date) : buildSeats(input, c, date);
}
