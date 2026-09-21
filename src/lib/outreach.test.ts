import { describe, it, expect } from 'vitest';
import {
  addWorkingDays,
  followUpDraftState,
  amsterdamDay,
  compareProspects,
  compareWorkFirst,
  followUp,
  isWarm,
  workingDaysBetween,
  type OutreachMail,
  type OutreachProspect,
} from './outreach';

const base: OutreachProspect = {
  slug: 'x',
  naam: 'X',
  tier: 'B',
  categorie: 'DO',
  contactpersoon: null,
  plaats: null,
  campaign: 'bureaus-sep26',
  to_email: null,
  status: 'nog_niet_benaderd',
  notities: null,
  updated_at: '2026-09-09T10:00:00Z',
  verzonden_op: null,
  kliks_totaal: 0,
  kliks_uniek_dagen: 0,
  eerste_klik: null,
  laatste_klik: null,
  bot_kliks: 0,
  kliks_verdacht: 0,
  kliks_bevestigd: 0,
  dagen_bevestigd: 0,
  eerste_bevestigde_klik: null,
  laatste_bevestigde_klik: null,
  demo_sessies: 0,
  momenten_max: null,
  momenten_gemiddeld: null,
  sessies_met_cta: 0,
  sessies_engaged: 0,
  partner_slug: null,
  followup_requested_at: null,
  followup_draft_id: null,
  partner_naam: null,
  codes_issued: 0,
  codes_claimed: 0,
  mails: [],
  laatste_mail_op: null,
  laatste_mail_richting: null,
  laatste_sentiment: null,
  laatste_samenvatting: null,
  concept_klaar: false,
  needs_reply: false,
};

const make = (over: Partial<OutreachProspect>): OutreachProspect => ({ ...base, ...over });

/** A row whose only click landed inside the scanner window after sending. */
const scannerOnly = (over: Partial<OutreachProspect> = {}) =>
  make({
    status: 'verzonden',
    verzonden_op: '2026-09-09T10:51:38Z',
    kliks_totaal: 1,
    laatste_klik: '2026-09-09T10:52:31Z',
    kliks_verdacht: 1,
    kliks_bevestigd: 0,
    laatste_bevestigde_klik: null,
    ...over,
  });

describe('isWarm', () => {
  it('needs a confirmed click and an early status', () => {
    expect(isWarm(make({ kliks_bevestigd: 1, status: 'verzonden' }))).toBe(true);
    expect(isWarm(make({ kliks_bevestigd: 1, status: 'nog_niet_benaderd' }))).toBe(true);
    expect(isWarm(make({ kliks_bevestigd: 1, status: 'gesprek_gepland' }))).toBe(false);
    expect(isWarm(make({ kliks_bevestigd: 0, status: 'verzonden' }))).toBe(false);
  });

  it('a click inside the scanner window does not make a row warm', () => {
    expect(isWarm(scannerOnly())).toBe(false);
  });

  it('a later click on the same bureau does', () => {
    expect(
      isWarm(scannerOnly({ kliks_totaal: 2, kliks_bevestigd: 1, laatste_bevestigde_klik: '2026-09-09T14:20:00Z' })),
    ).toBe(true);
  });
});

describe('compareProspects', () => {
  it('puts warm rows first, then latest confirmed click, then tier, then name', () => {
    const rows = [
      make({ slug: 'a-noclick', naam: 'Alpha', tier: 'A' }),
      make({ slug: 'c-noclick', naam: 'Charlie', tier: 'C' }),
      make({
        slug: 'followed-up', naam: 'Followed', tier: 'C', status: 'gesprek_gepland',
        kliks_totaal: 3, kliks_bevestigd: 3, laatste_bevestigde_klik: '2026-09-09T09:00:00Z',
      }),
      make({
        slug: 'warm-old', naam: 'Warm old', tier: 'B', status: 'verzonden',
        kliks_totaal: 1, kliks_bevestigd: 1, laatste_bevestigde_klik: '2026-09-07T09:00:00Z',
      }),
      make({
        slug: 'warm-new', naam: 'Warm new', tier: 'C', status: 'verzonden',
        kliks_totaal: 1, kliks_bevestigd: 1, laatste_bevestigde_klik: '2026-09-08T09:00:00Z',
      }),
      make({ slug: 'b-noclick', naam: 'Bravo', tier: 'B' }),
    ];
    const order = [...rows].sort(compareProspects).map((r) => r.slug);
    expect(order).toEqual(['warm-new', 'warm-old', 'followed-up', 'a-noclick', 'b-noclick', 'c-noclick']);
  });

  it('bot-only clicks do not make a row warm', () => {
    const botOnly = make({ slug: 'bots', status: 'verzonden', kliks_totaal: 0, bot_kliks: 4 });
    const quiet = make({ slug: 'quiet', tier: 'A' });
    expect([botOnly, quiet].sort(compareProspects).map((r) => r.slug)).toEqual(['quiet', 'bots']);
  });

  it('a scanner-only row does not outrank a bureau with a real click', () => {
    const scanner = scannerOnly({ slug: 'scanner', naam: 'Scanner', tier: 'A' });
    const real = make({
      slug: 'real', naam: 'Real', tier: 'C', status: 'verzonden',
      kliks_totaal: 1, kliks_bevestigd: 1, laatste_bevestigde_klik: '2026-09-09T15:00:00Z',
    });
    expect([scanner, real].sort(compareProspects).map((r) => r.slug)).toEqual(['real', 'scanner']);
  });
});

describe('needs_reply', () => {
  it('sorts a bureau that wrote back above a warm click', () => {
    const replied = make({ slug: 'r', needs_reply: true });
    const warm = make({ slug: 'w', kliks_bevestigd: 2, laatste_bevestigde_klik: '2026-09-10T10:00:00Z', status: 'verzonden' });
    expect([warm, replied].sort(compareProspects).map((p) => p.slug)).toEqual(['r', 'w']);
  });
});

// ─── Follow-up cadence ───────────────────────────────────────────────────────

/** Amsterdam noon on a given day, which is what a real send looks like. */
const at = (ymd: string, hhmm = '12:00') => `${ymd}T${hhmm}:00+02:00`;

const outMail = (sent_at: string): OutreachMail => ({
  id: sent_at,
  direction: 'out',
  kind: 'eerste',
  from_email: 'sjoerd@cairnly.io',
  to_email: 'info@x.nl',
  subject: 'Vraagje',
  snippet: null,
  sent_at,
  sentiment: null,
  samenvatting: null,
  draft_id: null,
  status_voor: null,
  status_na: null,
});

describe('working-day arithmetic', () => {
  it('skips weekends when adding days', () => {
    // Wed 9 Sep 2026 + 4 working days = Tue 15 Sep (Sat/Sun do not count).
    expect(addWorkingDays(amsterdamDay(at('2026-09-09')), 4)).toBe(Date.parse('2026-09-15T00:00:00Z'));
    // Fri 11 Sep + 4 = Thu 17 Sep.
    expect(addWorkingDays(amsterdamDay(at('2026-09-11')), 4)).toBe(Date.parse('2026-09-17T00:00:00Z'));
  });

  it('counts working days between two days', () => {
    const fri = amsterdamDay(at('2026-09-11'));
    const mon = amsterdamDay(at('2026-09-14'));
    expect(workingDaysBetween(fri, mon)).toBe(1);
    expect(workingDaysBetween(mon, fri)).toBe(0);
  });

  it('reads a late-evening send as that calendar day in Amsterdam', () => {
    // 23:50 Amsterdam on 9 Sep is 21:50 UTC, still the 9th where Sjoerd sits.
    expect(amsterdamDay('2026-09-09T21:50:00Z')).toBe(Date.parse('2026-09-09T00:00:00Z'));
  });
});

describe('followUp', () => {
  const sentWed = make({ status: 'verzonden', mails: [outMail(at('2026-09-09'))], verzonden_op: at('2026-09-09') });

  it('is not due before the fourth working day', () => {
    const f = followUp(sentWed, new Date(at('2026-09-14')));
    expect(f?.step).toBe(1);
    expect(f?.due).toBe(false);
    expect(f?.daysLate).toBe(-1);
  });

  it('comes due on the fourth working day and then counts late days', () => {
    expect(followUp(sentWed, new Date(at('2026-09-15')))?.due).toBe(true);
    expect(followUp(sentWed, new Date(at('2026-09-15')))?.daysLate).toBe(0);
    expect(followUp(sentWed, new Date(at('2026-09-17')))?.daysLate).toBe(2);
  });

  it('waits six working days for the second chase, measured from the first chase', () => {
    const chased = make({
      status: 'opvolging_1',
      mails: [outMail(at('2026-09-15')), outMail(at('2026-09-09'))],
      verzonden_op: at('2026-09-09'),
    });
    expect(followUp(chased, new Date(at('2026-09-22')))?.due).toBe(false);
    const due = followUp(chased, new Date(at('2026-09-23')));
    expect(due?.step).toBe(2);
    expect(due?.due).toBe(true);
  });

  it('stays quiet when they wrote last, when both chases are done, and when the deal moved on', () => {
    expect(followUp(make({ ...sentWed, needs_reply: true }), new Date(at('2026-09-30')))).toBeNull();
    expect(followUp(make({ ...sentWed, status: 'opvolging_2' }), new Date(at('2026-09-30')))).toBeNull();
    expect(followUp(make({ ...sentWed, status: 'afgewezen' }), new Date(at('2026-09-30')))).toBeNull();
    expect(followUp(make({ ...sentWed, status: 'gesprek_gepland' }), new Date(at('2026-09-30')))).toBeNull();
    expect(followUp(make({ status: 'verzonden' }), new Date(at('2026-09-30')))).toBeNull();
  });
});

describe('compareWorkFirst', () => {
  const now = new Date(at('2026-09-17'));
  it('puts a reply above an overdue chase, and the oldest chase on top of the rest', () => {
    const replied = make({ slug: 'replied', needs_reply: true });
    const lateWed = make({ slug: 'wed', status: 'verzonden', mails: [outMail(at('2026-09-09'))] });
    const dueFri = make({ slug: 'fri', status: 'verzonden', mails: [outMail(at('2026-09-11'))] });
    const quiet = make({ slug: 'quiet', status: 'afgewezen' });
    const order = [quiet, dueFri, lateWed, replied].sort((a, b) => compareWorkFirst(a, b, now));
    expect(order.map((p) => p.slug)).toEqual(['replied', 'wed', 'fri', 'quiet']);
  });
});

describe('followUpDraftState', () => {
  it('reads the two columns as one state', () => {
    expect(followUpDraftState(make({}))).toBe('none');
    expect(followUpDraftState(make({ followup_requested_at: '2026-09-15T08:00:00Z' }))).toBe('queued');
    expect(
      followUpDraftState(make({ followup_requested_at: '2026-09-15T08:00:00Z', followup_draft_id: 'r-123' })),
    ).toBe('ready');
  });
});
