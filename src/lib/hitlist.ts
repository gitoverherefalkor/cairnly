// Employer hitlist: types, labels and the pure helpers behind the Hitlist view
// in the Employers tab. The tier itself is computed in the database (view
// employer_hitlist, see supabase/migrations/20261015150000_employer_hitlist.sql)
// so the console and the future sender agree; this file only reads it.

import {
  emailDomain, isWorkEmail, normDomain, normLinkedin, underDomain,
} from '../../supabase/functions/_shared/workEmail.ts';

export { isWorkEmail, normDomain, normLinkedin, emailDomain };

export type Country = 'NL' | 'UK';
export type SizeBand = 'lt100' | '100_249' | '250_499' | '500_999' | '1000_plus';
export type CompanySource = 'linkedin' | 'news' | 'event' | 'referral' | 'other';
export type TashaLink = 'unchecked' | 'none' | 'first' | 'second';
export type RoleType = 'buyer' | 'champion' | 'other';
export type SignalKind = 'reorg' | 'new_hr_lead' | 'ld_job_ad' | 'cao_budget';
export type Tier = 'A' | 'B' | 'C';

export const SIZE_LABEL: Record<SizeBand, string> = {
  lt100: 'Under 100',
  '100_249': '100-249',
  '250_499': '250-499',
  '500_999': '500-999',
  '1000_plus': '1000+',
};
export const SIZE_BANDS = Object.keys(SIZE_LABEL) as SizeBand[];

export const SOURCE_LABEL: Record<CompanySource, string> = {
  linkedin: 'LinkedIn',
  news: 'News article',
  event: 'Event',
  referral: 'Referral',
  other: 'Other',
};

export const TASHA_LABEL: Record<TashaLink, string> = {
  unchecked: 'Not checked',
  none: 'No link',
  first: '1st degree',
  second: '2nd degree',
};

export const ROLE_LABEL: Record<RoleType, string> = {
  buyer: 'Buyer',
  champion: 'Champion',
  other: 'Other',
};

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  reorg: 'Reorg / cost-cutting / merger',
  new_hr_lead: 'New CHRO / HR director',
  ld_job_ad: 'L&D / mobility / DI job ad',
  cao_budget: 'CAO with development budget',
};

/** How long a signal counts, in months. Mirrors employer_signal_fresh_until(). */
export const SIGNAL_FRESH_MONTHS: Record<SignalKind, number> = {
  reorg: 6,
  new_hr_lead: 12,
  ld_job_ad: 6,
  cao_budget: 12,
};

/** One row of the employer_hitlist view. */
export interface HitlistRow {
  employer_id: string;
  tasha_effective: TashaLink;
  domain_suppressed: boolean;
  hard_exclusion: 'suppressed' | 'tasha_warm' | null;
  soft_exclusion: 'too_small' | 'frontline' | null;
  icp_complete: boolean;
  reorg_fresh: boolean;
  fresh_signals: number;
  all_signals: number;
  contacts: number;
  suggested_tier: Tier | null;
  effective_tier: Tier | null;
  tier_reason: string;
}

export interface EmployerSignal {
  id: string;
  employer_id: string;
  kind: SignalKind;
  signal_date: string;
  source_url: string;
  note: string | null;
  fresh_until: string;
  fresh: boolean;
}

export interface Suppression {
  id: string;
  email: string | null;
  domain: string | null;
  linkedin: string | null;
  reason: string | null;
  track: 'employer' | 'outplacement' | 'manual';
  employer_id: string | null;
  contact_id: string | null;
  prospect_slug: string | null;
  created_by: string | null;
  created_at: string;
}

/** Hitlist-relevant employer fields (the rest lives in EmployersTab). */
export interface HitlistFields {
  country: Country | null;
  size_band: SizeBand | null;
  sector: string | null;
  website: string | null;
  domain: string | null;
  source: CompanySource | null;
  source_url: string | null;
  frontline: boolean;
  tasha_link: TashaLink;
  tier_override: Tier | null;
}

// ─── Suppression, as the console shows it ────────────────────────────────────
// The server checks with outreach_is_suppressed(); this is the same rule, used
// only to put a badge on screen.

export function suppressionFor(
  who: { email?: string | null; linkedin_url?: string | null },
  employerDomain: string | null,
  list: Suppression[],
): Suppression | null {
  const email = (who.email ?? '').trim().toLowerCase() || null;
  const dom = emailDomain(email);
  const li = normLinkedin(who.linkedin_url);
  for (const s of list) {
    if (s.email && email && s.email === email) return s;
    if (s.linkedin && li && s.linkedin === li) return s;
    if (s.domain && (underDomain(dom, s.domain) || underDomain(employerDomain, s.domain))) return s;
  }
  return null;
}

export function companySuppression(employerDomain: string | null, list: Suppression[]): Suppression | null {
  if (!employerDomain) return null;
  return list.find((s) => s.domain && underDomain(employerDomain, s.domain)) ?? null;
}

/** Follow-ups logged for one contact. Two is the cap. */
export const MAX_FOLLOW_UPS = 2;
export function followUpCount(touches: { contact_id: string | null; kind: string }[], contactId: string): number {
  return touches.filter((t) => t.contact_id === contactId && t.kind === 'follow_up').length;
}

// ─── Role type from a job title ──────────────────────────────────────────────

export function suggestRoleType(title: string | null | undefined): RoleType | null {
  const t = (title ?? '').toLowerCase();
  if (!t.trim()) return null;
  if (/\b(chro|cpo)\b|chief (people|human)|(hr|people|personeel|p&o)[- ]?(director|directeur)|(director|directeur|head of|hoofd) (hr|people|human resources|p&o|personeelszaken)|vp (hr|people)/.test(t)) {
    return 'buyer';
  }
  if (/hrbp|business partner|l&d|learning|development|opleiding|mobility|mobiliteit|loopbaan|career|carri[eè]re|inzetbaarheid|talent/.test(t)) {
    return 'champion';
  }
  return 'other';
}

// ─── CSV / pasted-sheet import ───────────────────────────────────────────────

/**
 * Parse pasted rows. A paste from Google Sheets or Excel is tab-separated; a
 * .csv is comma- or semicolon-separated (Dutch Excel uses ;). Quotes work the
 * usual way ("a, b" and "" for a literal quote).
 */
export function parseTable(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
  return rows;
}

/** The columns the import understands, with the header spellings it accepts. */
const COLUMNS = {
  company: ['company', 'company name', 'name', 'bedrijf', 'organisatie', 'organisation', 'organization'],
  country: ['country', 'land'],
  size: ['size', 'employees', 'employee count', 'headcount', 'medewerkers', 'fte'],
  sector: ['sector', 'industry', 'branche'],
  website: ['website', 'site', 'url', 'domain'],
  source: ['source', 'bron'],
  source_url: ['source url', 'source link', 'source_url', 'link'],
  notes: ['notes', 'note', 'notities'],
  contact_name: ['contact', 'contact name', 'contact_name', 'person'],
  contact_title: ['title', 'job title', 'contact title', 'contact_title', 'functie'],
  contact_role: ['role', 'role type', 'contact role', 'contact_role'],
  contact_email: ['email', 'e-mail', 'contact email', 'contact_email'],
  contact_linkedin: ['linkedin', 'linkedin url', 'contact linkedin', 'contact_linkedin'],
  contact_source: ['contact source', 'contact_source'],
} as const;
type Col = keyof typeof COLUMNS;

export const IMPORT_HEADER =
  'company\tcountry\tsize\tsector\twebsite\tsource\tsource url\tnotes\tcontact name\ttitle\trole\temail\tlinkedin\tcontact source';

export function parseCountry(v: string): Country | null {
  const s = v.trim().toLowerCase();
  if (['nl', 'nld', 'netherlands', 'the netherlands', 'nederland', 'holland'].includes(s)) return 'NL';
  if (['uk', 'gb', 'gbr', 'united kingdom', 'great britain', 'england', 'scotland', 'wales'].includes(s)) return 'UK';
  return null;
}

/** "250-499", "500+", "1,200", "about 80" → a band. */
export function parseSize(v: string): SizeBand | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if ((SIZE_BANDS as string[]).includes(s)) return s as SizeBand;
  const nums = (s.replace(/(\d)[.,](\d{3})/g, '$1$2').match(/\d+/g) ?? []).map(Number);
  if (nums.length === 0) return null;
  // A range counts by its lower end: "100-249" is a 100+ company.
  const n = nums[0];
  if (n < 100) return 'lt100';
  if (n < 250) return '100_249';
  if (n < 500) return '250_499';
  if (n < 1000) return '500_999';
  return '1000_plus';
}

export function parseSource(v: string): CompanySource | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (s.includes('linkedin')) return 'linkedin';
  if (/news|nieuws|article|artikel|fd\b|nos\b/.test(s)) return 'news';
  if (/event|congres|beurs|conference/.test(s)) return 'event';
  if (/referr|tip|via /.test(s)) return 'referral';
  return 'other';
}

export interface ImportContact {
  name: string;
  title: string | null;
  role_type: RoleType | null;
  email: string | null;
  linkedin_url: string | null;
  contact_source: string | null;
}

export interface ImportCompany {
  key: string;
  name: string;
  country: Country | null;
  size_band: SizeBand | null;
  sector: string | null;
  website: string | null;
  domain: string | null;
  source: CompanySource | null;
  source_url: string | null;
  notes: string | null;
  contacts: ImportContact[];
}

export interface ImportPlan {
  companies: ImportCompany[];
  /** One line per row or cell that was skipped or is likely wrong. */
  problems: string[];
}

/**
 * Turn pasted rows (first row = headers) into companies with their contacts.
 * One row per contact; repeat the company columns on each. Rows are grouped by
 * domain (from the website, else the contact's work email), else by name.
 */
export function planImport(rows: string[][]): ImportPlan {
  const problems: string[] = [];
  if (rows.length < 2) return { companies: [], problems: ['Paste a header row and at least one company.'] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {} as Record<Col, number>;
  for (const col of Object.keys(COLUMNS) as Col[]) {
    idx[col] = header.findIndex((h) => (COLUMNS[col] as readonly string[]).includes(h));
  }
  if (idx.company < 0) {
    return { companies: [], problems: ['No "company" column found. Start with the header row (see the example).'] };
  }
  const get = (r: string[], c: Col) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');

  const byKey = new Map<string, ImportCompany>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = get(r, 'company');
    if (!name) { problems.push(`Row ${line}: no company name, skipped.`); return; }

    const rawEmail = get(r, 'contact_email').toLowerCase();
    const email = rawEmail && isWorkEmail(rawEmail) ? rawEmail : null;
    if (rawEmail && !email) problems.push(`Row ${line}: ${rawEmail} is not a work address, left out.`);

    const website = get(r, 'website') || null;
    const domain = normDomain(website) ?? emailDomain(email);
    const key = domain ?? `name:${name.toLowerCase()}`;

    let co = byKey.get(key);
    if (!co) {
      const countryRaw = get(r, 'country');
      const sizeRaw = get(r, 'size');
      const country = countryRaw ? parseCountry(countryRaw) : null;
      const size_band = sizeRaw ? parseSize(sizeRaw) : null;
      if (countryRaw && !country) problems.push(`Row ${line}: country "${countryRaw}" not recognised (NL or UK).`);
      if (sizeRaw && !size_band) problems.push(`Row ${line}: size "${sizeRaw}" not recognised.`);
      const sourceUrl = get(r, 'source_url');
      co = {
        key,
        name: name.slice(0, 80),
        country,
        size_band,
        sector: get(r, 'sector') || null,
        website,
        domain,
        source: parseSource(get(r, 'source')) ?? (/linkedin\.com/i.test(sourceUrl) ? 'linkedin' : sourceUrl ? 'news' : null),
        source_url: /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
        notes: get(r, 'notes') || null,
        contacts: [],
      };
      byKey.set(key, co);
    }

    const contactName = get(r, 'contact_name');
    const linkedin = get(r, 'contact_linkedin');
    if (contactName || email || linkedin) {
      if (!contactName) { problems.push(`Row ${line}: contact without a name, left out.`); return; }
      const title = get(r, 'contact_title') || null;
      const roleRaw = get(r, 'contact_role').toLowerCase();
      const role_type: RoleType | null =
        roleRaw === 'buyer' || roleRaw === 'champion' || roleRaw === 'other' ? roleRaw : suggestRoleType(title);
      const contact_source = get(r, 'contact_source') || (linkedin ? 'LinkedIn' : null);
      if (!contact_source) {
        problems.push(`Row ${line}: ${contactName} has no contact source (add a "contact source" column), left out.`);
        return;
      }
      co.contacts.push({
        name: contactName.slice(0, 120),
        title,
        role_type,
        email,
        linkedin_url: normLinkedin(linkedin) ? linkedin : null,
        contact_source,
      });
    }
  });

  return { companies: [...byKey.values()], problems };
}
