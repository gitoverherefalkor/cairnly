import { describe, it, expect } from 'vitest';
import {
  buildEmployerEmail,
  firstNameFor,
  formatExpiry,
  pickEmailLang,
  EMPLOYER_SUPPORT_EMAIL,
  type EmployerEmailInput,
} from './employerEmails.ts';

const LINK_A = 'https://cairnly.io/auth?flow=signup&code=ACME-7M4R-QW2T-NJHD&lang=en';
const LINK_B = 'https://cairnly.io/auth?flow=signup&code=ACME-X3PC-9KFD-V2HM&lang=en';

const base: EmployerEmailInput = {
  lang: 'en',
  kind: 'trial',
  company: 'Acme B.V.',
  contactName: 'Jane de Vries',
  contactEmail: 'jane@acme.nl',
  links: [LINK_A],
  expiresOn: '2026-12-17',
};

describe('formatExpiry', () => {
  it('writes the date out in each language', () => {
    expect(formatExpiry('2026-12-17', 'en')).toBe('17 December 2026');
    expect(formatExpiry('2026-12-17', 'nl')).toBe('17 december 2026');
    expect(formatExpiry('2027-01-05T23:59:00', 'en')).toBe('5 January 2027');
  });
  it('returns null for no date or nonsense', () => {
    expect(formatExpiry(null, 'en')).toBeNull();
    expect(formatExpiry('soon', 'nl')).toBeNull();
    expect(formatExpiry('2026-13-01', 'en')).toBeNull();
  });
});

describe('firstNameFor', () => {
  it('takes the first word', () => {
    expect(firstNameFor('Jane de Vries', 'jane@acme.nl')).toBe('Jane');
  });
  it('has no name when it is empty or just the email local part', () => {
    expect(firstNameFor('', 'hr@acme.nl')).toBeNull();
    expect(firstNameFor(null, 'hr@acme.nl')).toBeNull();
    expect(firstNameFor('hr', 'hr@acme.nl')).toBeNull();
  });
});

describe('trial email', () => {
  it('English: subject, greeting, link, expiry and support line', () => {
    const m = buildEmployerEmail(base);
    expect(m.subject).toBe('Your Cairnly trial link');
    expect(m.html).toContain('Hi Jane,');
    expect(m.html).toContain('Your Cairnly trial is ready');
    expect(m.html).toContain('rolling it out at Acme B.V.');
    expect(m.html).toContain('Start your trial');
    expect(m.html).toContain('valid until 17 December 2026');
    expect(m.html).toContain(EMPLOYER_SUPPORT_EMAIL);
    expect(m.text).toContain(LINK_A);
    expect(m.text).toContain('Questions or need a hand?');
  });

  it('Dutch: uses the approved wording, including the edited heading and intro', () => {
    const m = buildEmployerEmail({ ...base, lang: 'nl' });
    expect(m.subject).toBe('Je Cairnly trial-link');
    expect(m.html).toContain('Hoi Jane,');
    expect(m.html).toContain('Je Cairnly trial staat klaar');
    expect(m.html).toContain('Hier is je persoonlijke link voor Cairnly');
    expect(m.html).toContain('Wat de trial je geeft');
    expect(m.html).toContain('Start je trial');
    expect(m.html).toContain('geldig tot 17 december 2026');
    expect(m.html).toContain(EMPLOYER_SUPPORT_EMAIL);
  });

  it('puts the link in the button and the fallback block with & escaped', () => {
    const m = buildEmployerEmail(base);
    expect(m.html).toContain('href="https://cairnly.io/auth?flow=signup&amp;code=ACME-7M4R-QW2T-NJHD&amp;lang=en"');
    expect(m.html).not.toContain('signup&code=');
  });

  it('says the link does not expire when there is no expiry date', () => {
    expect(buildEmployerEmail({ ...base, expiresOn: null }).html).toContain('does not expire');
    expect(buildEmployerEmail({ ...base, lang: 'nl', expiresOn: null }).html).toContain('verloopt niet');
  });

  it('greets without a name when the contact has none', () => {
    expect(buildEmployerEmail({ ...base, contactName: null }).html).toContain('Hi,');
    expect(buildEmployerEmail({ ...base, lang: 'nl', contactName: 'hr', contactEmail: 'hr@acme.nl' }).html).toContain('Hoi,');
  });
});

describe('seat email', () => {
  const seats: EmployerEmailInput = { ...base, kind: 'seat', links: [LINK_A, LINK_B], expiresOn: '2027-01-31' };

  it('English: company in subject, count, expiry and every link', () => {
    const m = buildEmployerEmail(seats);
    expect(m.subject).toBe('Your Cairnly access links for Acme B.V.');
    expect(m.html).toContain('You have 2 links, valid until 31 January 2027.');
    expect(m.html).toContain('paid for by Acme B.V.');
    expect(m.html).toContain('ACME-7M4R-QW2T-NJHD');
    expect(m.html).toContain('ACME-X3PC-9KFD-V2HM');
    expect(m.text).toContain(`1. ${LINK_A}`);
    expect(m.text).toContain(`2. ${LINK_B}`);
    expect(m.html).toContain(EMPLOYER_SUPPORT_EMAIL);
  });

  it('Dutch: approved wording', () => {
    const m = buildEmployerEmail({ ...seats, lang: 'nl' });
    expect(m.subject).toBe('Je Cairnly-toegangslinks voor Acme B.V.');
    expect(m.html).toContain('Je hebt 2 links, geldig tot 31 januari 2027.');
    expect(m.html).toContain('Zo gebruik je ze');
  });

  it('switches the expiry line when the batch has no expiry', () => {
    expect(buildEmployerEmail({ ...seats, expiresOn: null }).html).toContain('You have 2 links. These links do not expire.');
    expect(buildEmployerEmail({ ...seats, lang: 'nl', expiresOn: null }).html).toContain('Je hebt 2 links. Deze links verlopen niet.');
  });

  it('uses the singular for one link', () => {
    const m = buildEmployerEmail({ ...seats, links: [LINK_A] });
    expect(m.html).toContain('You have 1 link,');
  });

  it('lists every link of a big batch', () => {
    const links = Array.from({ length: 500 }, (_, i) => `https://cairnly.io/auth?code=ACME-${i}`);
    const m = buildEmployerEmail({ ...seats, links });
    expect(m.text).toContain('500. https://cairnly.io/auth?code=ACME-499');
    expect(m.html).toContain('You have 500 links');
  });
});

describe('no "proef" anywhere in the Dutch emails', () => {
  it('trial and seat emails, subject, html and text', () => {
    const nl = { ...base, lang: 'nl' as const };
    for (const m of [
      buildEmployerEmail(nl),
      buildEmployerEmail({ ...nl, kind: 'seat', links: [LINK_A, LINK_B] }),
      buildEmployerEmail({ ...nl, kind: 'seat', links: [], seatGroups: [{ lang: 'nl', links: [LINK_A] }, { lang: 'en', links: [LINK_B] }] }),
    ]) {
      expect(m.subject.toLowerCase()).not.toContain('proef');
      expect(m.html.toLowerCase()).not.toContain('proef');
      expect(m.text.toLowerCase()).not.toContain('proef');
    }
  });
});

describe('seats in several languages go out as ONE email', () => {
  const NL1 = 'https://cairnly.io/auth?flow=signup&code=ACME-AAAA-AAAA-AAA1&lang=nl';
  const NL2 = 'https://cairnly.io/auth?flow=signup&code=ACME-AAAA-AAAA-AAA2&lang=nl';
  const EN1 = 'https://cairnly.io/auth?flow=signup&code=ACME-BBBB-BBBB-BBB1&lang=en';
  const mixed: EmployerEmailInput = {
    ...base,
    lang: 'nl',
    kind: 'seat',
    links: [],
    expiresOn: '2027-01-31',
    seatGroups: [{ lang: 'nl', links: [NL1, NL2] }, { lang: 'en', links: [EN1] }],
  };

  it('has every link of both batches, a total count and a heading per batch', () => {
    const m = buildEmployerEmail(mixed);
    for (const url of [NL1, NL2, EN1]) expect(m.text).toContain(url);
    expect(m.html).toContain('Je hebt 3 links, geldig tot 31 januari 2027.');
    expect(m.html).toContain('Nederlandse versie (NL): 2 links');
    expect(m.html).toContain('Engelse versie (EN): 1 link');
    expect(m.text).toContain('Nederlandse versie (NL): 2 links');
    expect(m.text).toContain('Engelse versie (EN): 1 link');
  });

  it('English email: headings in English', () => {
    const m = buildEmployerEmail({ ...mixed, lang: 'en' });
    expect(m.html).toContain('You have 3 links, valid until 31 January 2027.');
    expect(m.html).toContain('Dutch version (NL): 2 links');
    expect(m.html).toContain('English version (EN): 1 link');
  });

  it('a single batch keeps the plain layout, with no batch heading', () => {
    const m = buildEmployerEmail({ ...mixed, seatGroups: [{ lang: 'nl', links: [NL1, NL2] }] });
    expect(m.html).not.toContain('Nederlandse versie');
    expect(m.html).toContain('Je hebt 2 links');
  });

  it('writes the email in the language of the biggest batch, Dutch on a tie', () => {
    expect(pickEmailLang([{ lang: 'nl', links: [NL1, NL2] }, { lang: 'en', links: [EN1] }])).toBe('nl');
    expect(pickEmailLang([{ lang: 'nl', links: [NL1] }, { lang: 'en', links: [EN1, EN1] }])).toBe('en');
    expect(pickEmailLang([{ lang: 'en', links: [EN1] }, { lang: 'nl', links: [NL1] }])).toBe('nl');
  });
});

describe('company names that end in a full stop', () => {
  it('does not double the full stop at the end of a sentence', () => {
    const trial = buildEmployerEmail(base);
    expect(trial.html).toContain('rolling it out at Acme B.V.</p>');
    expect(trial.html).not.toContain('B.V..');
    const seat = buildEmployerEmail({ ...base, kind: 'seat' });
    expect(seat.html).toContain('paid for by Acme B.V.</p>');
    expect(seat.html).not.toContain('B.V..');
    expect(seat.text).not.toContain('B.V..');
    expect(buildEmployerEmail({ ...base, lang: 'nl', kind: 'seat' }).html).not.toContain('B.V..');
  });
});

describe('safety', () => {
  it('escapes a hostile company name and keeps the subject on one line', () => {
    const m = buildEmployerEmail({ ...base, kind: 'seat', company: 'Evil <script>x</script>\nBcc: a@b.c' });
    expect(m.html).not.toContain('<script>');
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});
