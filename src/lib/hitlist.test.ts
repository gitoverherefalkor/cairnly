import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  companySuppression, followUpCount, isWorkEmail, normDomain, normLinkedin, parseCountry, parseSize,
  parseTable, planImport, suggestRoleType, suppressionFor, type Suppression,
} from './hitlist';
import { FREE_MAIL_DOMAINS } from '../../supabase/functions/_shared/workEmail.ts';

const supp = (p: Partial<Suppression>): Suppression => ({
  id: 's', email: null, domain: null, linkedin: null, reason: null, track: 'employer',
  employer_id: null, contact_id: null, prospect_slug: null, created_by: null, created_at: '2026-10-15T00:00:00Z', ...p,
});

describe('free-mail list', () => {
  it('matches the list in the migration', () => {
    const sql = readFileSync('supabase/migrations/20261015150000_employer_hitlist.sql', 'utf8');
    const body = sql.match(/outreach_is_free_mail_domain[\s\S]*?IN \(([\s\S]*?)\);/)![1];
    const inSql = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...FREE_MAIL_DOMAINS].sort());
  });

  it('accepts work addresses only', () => {
    expect(isWorkEmail('jan@acme.nl')).toBe(true);
    expect(isWorkEmail('jan@gmail.com')).toBe(false);
    expect(isWorkEmail('Jan@Hotmail.NL')).toBe(false);
    expect(isWorkEmail('not an email')).toBe(false);
  });
});

describe('normalising', () => {
  it('reduces a website to its domain', () => {
    expect(normDomain('https://www.Acme.nl/about')).toBe('acme.nl');
    expect(normDomain('acme.co.uk')).toBe('acme.co.uk');
    expect(normDomain('Acme')).toBeNull();
  });
  it('reduces a LinkedIn link to the profile path', () => {
    expect(normLinkedin('https://nl.linkedin.com/in/Jan-Jansen/?trk=x')).toBe('/in/jan-jansen');
    expect(normLinkedin('https://www.linkedin.com/company/acme')).toBeNull();
  });
});

describe('suppression on screen', () => {
  const list = [supp({ email: 'jan@acme.nl' }), supp({ id: 'd', domain: 'big.com' }), supp({ id: 'l', linkedin: '/in/piet' })];
  it('matches person, LinkedIn, domain and subdomain', () => {
    expect(suppressionFor({ email: 'JAN@acme.nl' }, null, list)?.id).toBe('s');
    expect(suppressionFor({ linkedin_url: 'https://www.linkedin.com/in/Piet/' }, null, list)?.id).toBe('l');
    expect(suppressionFor({ email: 'x@nl.big.com' }, null, list)?.id).toBe('d');
    expect(suppressionFor({ email: null }, 'big.com', list)?.id).toBe('d');
    expect(suppressionFor({ email: 'x@notbig.com' }, null, list)).toBeNull();
    expect(companySuppression('uk.big.com', list)?.id).toBe('d');
  });
});

describe('follow-ups', () => {
  it('counts per contact', () => {
    const t = [{ contact_id: 'a', kind: 'follow_up' }, { contact_id: 'a', kind: 'reply' }, { contact_id: 'b', kind: 'follow_up' }];
    expect(followUpCount(t, 'a')).toBe(1);
  });
});

describe('role type from title', () => {
  it('spots buyers and champions', () => {
    expect(suggestRoleType('CHRO')).toBe('buyer');
    expect(suggestRoleType('HR Director Benelux')).toBe('buyer');
    expect(suggestRoleType('Directeur HR')).toBe('buyer');
    expect(suggestRoleType('Chief People Officer')).toBe('buyer');
    expect(suggestRoleType('HR Business Partner')).toBe('champion');
    expect(suggestRoleType('Adviseur duurzame inzetbaarheid')).toBe('champion');
    expect(suggestRoleType('Learning & Development lead')).toBe('champion');
    expect(suggestRoleType('Office manager')).toBe('other');
    expect(suggestRoleType('')).toBeNull();
  });
});

describe('import', () => {
  it('parses country and size', () => {
    expect(parseCountry('Nederland')).toBe('NL');
    expect(parseCountry('United Kingdom')).toBe('UK');
    expect(parseCountry('Belgium')).toBeNull();
    expect(parseSize('250-499')).toBe('250_499');
    expect(parseSize('1.200')).toBe('1000_plus');
    expect(parseSize('500+')).toBe('500_999');
    expect(parseSize('about 80')).toBe('lt100');
    expect(parseSize('big')).toBeNull();
  });

  it('reads tab, comma and semicolon pastes with quotes', () => {
    expect(parseTable('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseTable('a,b\r\n"x, y",2\n')).toEqual([['a', 'b'], ['x, y', '2']]);
    expect(parseTable('a;b\n"say ""hi""";2')).toEqual([['a', 'b'], ['say "hi"', '2']]);
  });

  it('groups contacts per company and drops what breaks the rules', () => {
    const rows = parseTable([
      'Company\tCountry\tSize\tWebsite\tSource URL\tContact name\tTitle\tEmail\tLinkedIn\tContact source',
      'Acme\tNL\t600\thttps://www.acme.nl\thttps://nos.nl/x\tJan\tHR Director\tjan@acme.nl\t\tcompany site',
      'Acme\tNL\t600\tacme.nl\t\tPiet\tHRBP\tpiet@gmail.com\thttps://linkedin.com/in/piet\t',
      'Beta\tUK\t120\t\t\tAnn\tL&D lead\tann@beta.co.uk\t\t',
      '\tNL\t\t\t\t\t\t\t\t',
      'Gamma\tFrance\t50\t\t\t\t\t\t\t',
    ].join('\n'));
    const plan = planImport(rows);
    expect(plan.companies.map((c) => c.name)).toEqual(['Acme', 'Beta', 'Gamma']);
    const acme = plan.companies[0];
    expect(acme.domain).toBe('acme.nl');
    expect(acme.size_band).toBe('500_999');
    expect(acme.source).toBe('news');
    expect(acme.contacts.map((c) => [c.name, c.role_type, c.email, c.contact_source])).toEqual([
      ['Jan', 'buyer', 'jan@acme.nl', 'company site'],
      ['Piet', 'champion', null, 'LinkedIn'],
    ]);
    // Beta is grouped by its contact's email domain; Ann has no source, so she is left out.
    expect(plan.companies[1].domain).toBe('beta.co.uk');
    expect(plan.companies[1].contacts).toEqual([]);
    expect(plan.problems.join('\n')).toMatch(/piet@gmail.com is not a work address/);
    expect(plan.problems.join('\n')).toMatch(/Ann has no contact source/);
    expect(plan.problems.join('\n')).toMatch(/Row 5: no company name/);
    expect(plan.problems.join('\n')).toMatch(/country "France"/);
  });

  it('needs a company column', () => {
    expect(planImport([['foo'], ['bar']]).problems[0]).toMatch(/No "company" column/);
  });
});
