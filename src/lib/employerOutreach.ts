// Employer outreach: types and the stats the Employers tab shows.
//
// Everything is logged by hand (see supabase/migrations/20261008120000_employer_outreach.sql),
// so the numbers are only as good as the log. Pure functions, so they can be
// tested without a browser.

export type Channel = 'linkedin' | 'event' | 'email' | 'phone' | 'other';
export type TouchKind = 'first_contact' | 'follow_up' | 'reply' | 'meeting';
export type LinkedinStage = 'none' | 'invite_sent' | 'connected' | 'in_conversation';
export type EmployerStatus = 'lead' | 'trial_sent' | 'in_talks' | 'customer' | 'lost';

export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn',
  event: 'Event',
  email: 'Email',
  phone: 'Phone',
  other: 'Other',
};

export const KIND_LABEL: Record<TouchKind, string> = {
  first_contact: 'First contact',
  follow_up: 'Follow-up',
  reply: 'They replied',
  meeting: 'Meeting / call',
};

export const STAGE_LABEL: Record<LinkedinStage, string> = {
  none: 'Not on LinkedIn yet',
  invite_sent: 'Invite sent',
  connected: 'Connected',
  in_conversation: 'In conversation',
};

/** Statuses where nobody needs chasing any more. */
export const CLOSED_STATUSES: EmployerStatus[] = ['customer', 'lost'];

export interface EmployerContact {
  id: string;
  employer_id: string;
  name: string;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  linkedin_stage: LinkedinStage;
  invite_sent_at: string | null;
  connected_at: string | null;
  conversation_at: string | null;
}

export interface EmployerEvent {
  id: string;
  name: string;
  event_date: string | null;
}

export interface EmployerTouch {
  id: string;
  employer_id: string;
  contact_id: string | null;
  channel: Channel;
  kind: TouchKind;
  event_id: string | null;
  touched_on: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** The slice of an employer the stats need. */
export interface EmployerLite {
  id: string;
  name: string;
  status: EmployerStatus;
  follow_up_on: string | null;
  trial_issued?: number;
}

// ─── Dates (yyyy-mm-dd strings, local calendar) ──────────────────────────────

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

/** `n` working days (Mon-Fri) after `day`. */
export function addWorkingDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  let left = n;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const wd = date.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return ymd(date);
}

/**
 * The follow-up date the log form suggests. After reaching out: 5 working days
 * (3 after an event, while they still remember you). After a reply: the next
 * working day, the ball is in our court. After a meeting: 5 working days.
 */
export function suggestFollowUp(kind: TouchKind, channel: Channel, today: string): string {
  if (kind === 'reply') return addWorkingDays(today, 1);
  if (kind === 'meeting') return addWorkingDays(today, 5);
  return addWorkingDays(today, channel === 'event' ? 3 : 5);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export type Period = 7 | 30 | 90;

export interface ChannelRow {
  channel: Channel;
  firstContacts: number;
  followUps: number;
  replies: number;
  meetings: number;
  /** Employers first reached on this channel in the period. */
  reached: number;
  /** Of those, how many replied at any point on or after that first contact. */
  replied: number;
}

export interface EventRow {
  event: EmployerEvent;
  /** Distinct people met (a touch without a contact counts as one person). */
  people: number;
  employers: number;
  replied: number;
  trials: number;
  customers: number;
}

export interface OutreachStats {
  totals: Record<TouchKind, number>;
  channels: ChannelRow[];
  linkedin: { invited: number; connected: number; conversations: number; acceptRate: number | null };
  events: EventRow[];
  byPerson: { who: string; count: number }[];
}

const CHANNELS: Channel[] = ['linkedin', 'event', 'email', 'phone', 'other'];

/** "natasha@cairnly.io" → "Natasha". */
export function personLabel(email: string | null): string {
  if (!email) return 'Unknown';
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function computeStats(
  touches: EmployerTouch[],
  contacts: EmployerContact[],
  events: EmployerEvent[],
  employers: EmployerLite[],
  period: Period,
  today: string,
): OutreachStats {
  const from = addDays(today, -(period - 1));
  const inPeriod = touches.filter((t) => t.touched_on >= from && t.touched_on <= today);

  const totals: Record<TouchKind, number> = { first_contact: 0, follow_up: 0, reply: 0, meeting: 0 };
  for (const t of inPeriod) totals[t.kind]++;

  // Earliest reply per employer, to tell whether a first contact got an answer.
  const replyDates = new Map<string, string[]>();
  for (const t of touches) {
    if (t.kind !== 'reply' && t.kind !== 'meeting') continue;
    const list = replyDates.get(t.employer_id) ?? [];
    list.push(t.touched_on);
    replyDates.set(t.employer_id, list);
  }
  const repliedSince = (employerId: string, day: string) =>
    (replyDates.get(employerId) ?? []).some((d) => d >= day);

  const channels: ChannelRow[] = CHANNELS.map((channel) => {
    const own = inPeriod.filter((t) => t.channel === channel);
    // First contact per employer on this channel within the period.
    const firstBy = new Map<string, string>();
    for (const t of own) {
      if (t.kind !== 'first_contact') continue;
      const prev = firstBy.get(t.employer_id);
      if (!prev || t.touched_on < prev) firstBy.set(t.employer_id, t.touched_on);
    }
    let replied = 0;
    for (const [emp, day] of firstBy) if (repliedSince(emp, day)) replied++;
    return {
      channel,
      firstContacts: own.filter((t) => t.kind === 'first_contact').length,
      followUps: own.filter((t) => t.kind === 'follow_up').length,
      replies: own.filter((t) => t.kind === 'reply').length,
      meetings: own.filter((t) => t.kind === 'meeting').length,
      reached: firstBy.size,
      replied,
    };
  }).filter((r) => r.firstContacts + r.followUps + r.replies + r.meetings > 0);

  const stampIn = (iso: string | null) => {
    if (!iso) return false;
    const day = ymd(new Date(iso));
    return day >= from && day <= today;
  };
  const everInvited = contacts.filter((c) => c.invite_sent_at).length;
  const everConnected = contacts.filter((c) => c.invite_sent_at && c.connected_at).length;
  const linkedin = {
    invited: contacts.filter((c) => stampIn(c.invite_sent_at)).length,
    connected: contacts.filter((c) => stampIn(c.connected_at)).length,
    conversations: contacts.filter((c) => stampIn(c.conversation_at)).length,
    acceptRate: everInvited > 0 ? everConnected / everInvited : null,
  };

  // Events are counted over the whole log, not the period: an event's value
  // shows in the weeks after it, so cutting it off at "last 7 days" hides it.
  const empById = new Map(employers.map((e) => [e.id, e]));
  const eventRows: EventRow[] = events.map((event) => {
    const at = touches.filter((t) => t.event_id === event.id);
    const people = new Set(at.map((t) => t.contact_id ?? `touch:${t.id}`));
    const firstAt = new Map<string, string>();
    for (const t of at) {
      const prev = firstAt.get(t.employer_id);
      if (!prev || t.touched_on < prev) firstAt.set(t.employer_id, t.touched_on);
    }
    let replied = 0;
    let trials = 0;
    let customers = 0;
    for (const [emp, day] of firstAt) {
      if (repliedSince(emp, day)) replied++;
      const e = empById.get(emp);
      if ((e?.trial_issued ?? 0) > 0) trials++;
      if (e?.status === 'customer') customers++;
    }
    return { event, people: people.size, employers: firstAt.size, replied, trials, customers };
  });

  const who = new Map<string, number>();
  for (const t of inPeriod) {
    const k = personLabel(t.created_by);
    who.set(k, (who.get(k) ?? 0) + 1);
  }

  return {
    totals,
    channels,
    linkedin,
    events: eventRows,
    byPerson: [...who].map(([w, count]) => ({ who: w, count })).sort((a, b) => b.count - a.count),
  };
}

/** Open employers whose follow-up date is today or earlier, most overdue first. */
export function dueFollowUps<E extends EmployerLite>(employers: E[], today: string): E[] {
  return employers
    .filter((e) => e.follow_up_on && e.follow_up_on <= today && !CLOSED_STATUSES.includes(e.status))
    .sort((a, b) => (a.follow_up_on! < b.follow_up_on! ? -1 : 1));
}

// ─── Google Calendar ─────────────────────────────────────────────────────────

/**
 * A Google Calendar "new event" link, pre-filled, as an all-day event on `day`.
 * No integration or OAuth: it opens the viewer's own calendar and they click
 * Save. `account` (the signed-in Ops email) picks the right Google account when
 * the browser is signed into more than one, e.g. a work and a personal one.
 */
export function googleCalendarUrl(opts: { title: string; day: string; details?: string; account?: string | null }): string {
  const start = opts.day.replace(/-/g, '');
  const end = addDays(opts.day, 1).replace(/-/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: opts.title, dates: `${start}/${end}` });
  if (opts.details) p.set('details', opts.details);
  if (opts.account) p.set('authuser', opts.account);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** What goes in the follow-up event: who to chase, and what happened last. */
export function followUpDetails(
  contacts: Pick<EmployerContact, 'name' | 'role' | 'email' | 'linkedin_url'>[],
  last: Pick<EmployerTouch, 'kind' | 'channel' | 'touched_on' | 'note'> | undefined,
): string {
  const lines: string[] = [];
  for (const c of contacts) {
    lines.push([c.name, c.role, c.email, c.linkedin_url].filter(Boolean).join(' · '));
  }
  if (last) {
    lines.push('');
    lines.push(`Last: ${KIND_LABEL[last.kind]} via ${CHANNEL_LABEL[last.channel]} on ${last.touched_on}${last.note ? `, ${last.note}` : ''}`);
  }
  lines.push('');
  lines.push('Log it afterwards: https://cairnly.io/ops (Employers)');
  return lines.join('\n');
}
