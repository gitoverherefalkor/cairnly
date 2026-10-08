import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  computeStats,
  dueFollowUps,
  personLabel,
  suggestFollowUp,
  type EmployerContact,
  type EmployerLite,
  type EmployerTouch,
} from './employerOutreach';

let n = 0;
const touch = (p: Partial<EmployerTouch>): EmployerTouch => ({
  id: `t${++n}`,
  employer_id: 'e1',
  contact_id: null,
  channel: 'linkedin',
  kind: 'first_contact',
  event_id: null,
  touched_on: '2026-10-08',
  note: null,
  created_by: 'natasha@cairnly.io',
  created_at: '2026-10-08T10:00:00Z',
  ...p,
});

const emp = (p: Partial<EmployerLite>): EmployerLite => ({
  id: 'e1', name: 'Acme', status: 'lead', follow_up_on: null, ...p,
});

describe('working days', () => {
  it('skips the weekend', () => {
    // Thursday 8 Oct + 3 working days = Tuesday 13 Oct
    expect(addWorkingDays('2026-10-08', 3)).toBe('2026-10-13');
    // Friday + 1 = Monday
    expect(addWorkingDays('2026-10-09', 1)).toBe('2026-10-12');
  });

  it('suggests a shorter chase after an event and next day after a reply', () => {
    expect(suggestFollowUp('first_contact', 'event', '2026-10-08')).toBe('2026-10-13');
    expect(suggestFollowUp('first_contact', 'linkedin', '2026-10-08')).toBe('2026-10-15');
    expect(suggestFollowUp('reply', 'email', '2026-10-09')).toBe('2026-10-12');
  });
});

describe('computeStats', () => {
  const today = '2026-10-08';

  it('counts touches in the period only', () => {
    const s = computeStats(
      [touch({}), touch({ kind: 'follow_up' }), touch({ touched_on: '2026-09-01' })],
      [], [], [emp({})], 7, today,
    );
    expect(s.totals.first_contact).toBe(1);
    expect(s.totals.follow_up).toBe(1);
  });

  it('credits a reply to the channel of first contact, even when it came by mail', () => {
    const s = computeStats(
      [
        touch({ employer_id: 'e1', channel: 'event', touched_on: '2026-10-05' }),
        touch({ employer_id: 'e1', channel: 'email', kind: 'reply', touched_on: '2026-10-07' }),
        touch({ employer_id: 'e2', channel: 'event', touched_on: '2026-10-05' }),
      ],
      [], [], [emp({}), emp({ id: 'e2' })], 7, today,
    );
    const ev = s.channels.find((c) => c.channel === 'event')!;
    expect(ev.reached).toBe(2);
    expect(ev.replied).toBe(1);
  });

  it('does not count a reply from before the first contact', () => {
    const s = computeStats(
      [
        touch({ kind: 'reply', touched_on: '2026-10-02' }),
        touch({ touched_on: '2026-10-05' }),
      ],
      [], [], [emp({})], 7, today,
    );
    expect(s.channels.find((c) => c.channel === 'linkedin')!.replied).toBe(0);
  });

  it('builds the LinkedIn funnel from stage stamps', () => {
    const c = (p: Partial<EmployerContact>): EmployerContact => ({
      id: 'c', employer_id: 'e1', name: 'X', role: null, email: null, linkedin_url: null,
      linkedin_stage: 'none', invite_sent_at: null, connected_at: null, conversation_at: null, ...p,
    });
    const s = computeStats([], [
      c({ invite_sent_at: '2026-10-06T09:00:00Z', connected_at: '2026-10-07T09:00:00Z' }),
      c({ invite_sent_at: '2026-10-06T09:00:00Z' }),
    ], [], [], 7, today);
    expect(s.linkedin.invited).toBe(2);
    expect(s.linkedin.connected).toBe(1);
    expect(s.linkedin.acceptRate).toBe(0.5);
  });

  it('counts events over the whole log with trials and customers', () => {
    const event = { id: 'ev1', name: 'HR Live', event_date: '2026-06-01' };
    const s = computeStats(
      [
        touch({ employer_id: 'e1', channel: 'event', event_id: 'ev1', contact_id: 'c1', touched_on: '2026-06-01' }),
        touch({ employer_id: 'e1', channel: 'event', event_id: 'ev1', contact_id: 'c2', touched_on: '2026-06-01' }),
        touch({ employer_id: 'e2', channel: 'event', event_id: 'ev1', touched_on: '2026-06-01' }),
      ],
      [], [event],
      [emp({ trial_issued: 1, status: 'customer' }), emp({ id: 'e2' })],
      7, today,
    );
    expect(s.events[0]).toMatchObject({ people: 3, employers: 2, trials: 1, customers: 1 });
  });
});

describe('dueFollowUps', () => {
  it('lists open, due employers, most overdue first', () => {
    const due = dueFollowUps([
      emp({ id: 'a', follow_up_on: '2026-10-08' }),
      emp({ id: 'b', follow_up_on: '2026-10-01' }),
      emp({ id: 'c', follow_up_on: '2026-10-20' }),
      emp({ id: 'd', follow_up_on: '2026-10-01', status: 'lost' }),
    ], '2026-10-08');
    expect(due.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

it('turns an email into a first name', () => {
  expect(personLabel('natasha@cairnly.io')).toBe('Natasha');
});
