// Prepare: make sure the slots of the next two working days have mail waiting.
//
// Runs twice a working day (07:30 and 14:45, via pg_cron → outreach-prepare)
// and on the "Prepare more" button in /ops. It writes concepts, nothing else:
//   1. chases due today or on the next working day (never further ahead: the
//      chase variant depends on click data that can still change);
//   2. check-ins on parked replies that are due (always for Sjoerd to approve);
//   3. first mails for new agencies, as many as the remaining cold slots of
//      the next two working days hold.
// With the auto-approve switch on and a passing validator, chases and first
// mails are approved and queued right here (60-minute veto window). Nothing
// a human edited is ever touched.
//
// Spec: docs/superpowers/specs/2026-09-24-outreach-control-center-design.md

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { isParked } from './outreach.ts';
import { addWorkingDays, amsterdamDayStamp, nextFollowUp } from './outreachCadence.ts';
import { claudeToolCall, CRITIC_MODEL } from './outreachClaude.ts';
import { autoApproveOn, insertConcept } from './outreachConcepts.ts';
import { critique, TEMPLATE_BEOORDELING, type Beoordeling } from './outreachCritic.ts';
import {
  buildCheckInMessage,
  chaseVariant,
  CHECK_IN_SYSTEM_PROMPT,
  demoLink,
  FOLLOW_UP_TOOL,
  parseFollowUp,
  renderFollowUp,
  salutation,
  templateCheckIn,
  type CheckInInput,
  type FollowUpInput,
} from './outreachFollowUp.ts';
import {
  buildInitialMessage,
  INITIAL_SYSTEM_PROMPT,
  INITIAL_TOOL,
  initialSubject,
  parseInitial,
  renderInitial,
  type InitialInput,
} from './outreachInitial.ts';
import { dayCapacity, nextWorkingDays } from './outreachSchedule.ts';
import { MAX_WORDS, validateOutgoing, type ValidationResult } from './outreachValidate.ts';

/** Generations per run. The edge function has a wall clock; two runs a day are plenty. */
const MAX_GENERATIONS = 20;
/** Claude calls in flight at once. */
const CONCURRENCY = 4;
const COLD = ['initial', 'chase', 'checkin'];
const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };

export interface PrepareResult {
  chases: number;
  checkins: number;
  initials: number;
  capacity: number;
  skipped: string[];
}

interface Prospect {
  slug: string;
  naam: string | null;
  contactpersoon: string | null;
  to_email: string | null;
  status: string;
  tier: string | null;
  categorie: string | null;
  openingshaak: string | null;
  campaign: string | null;
  subject_variant: 'a' | 'b' | null;
  partner_slug: string | null;
  reply_dismissed_at: string | null;
  verzonden_op: string | null;
  niet_mailen_op: string | null;
  email_ongeldig_op: string | null;
}

interface Mail {
  slug: string;
  direction: 'in' | 'out';
  kind: string;
  sentiment: string | null;
  subject: string | null;
  from_email: string | null;
  to_email: string | null;
  gmail_thread_id: string;
  rfc_message_id: string | null;
  body_text: string | null;
  snippet: string | null;
  samenvatting: string | null;
  sent_at: string;
}

/** Run jobs with at most `n` at a time. */
async function pool<T>(jobs: Array<() => Promise<T>>, n: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const idx = i++;
      out[idx] = await jobs[idx]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, worker));
  return out;
}

interface Composed {
  body: string;
  validatie: ValidationResult;
  beoordeling: Beoordeling;
}

/** The approved skeleton, as is. Always passes the validator (tested), never needs the critic. */
function asTemplate(skeleton: string, check: (b: string) => ValidationResult, note?: string): Composed {
  return { body: skeleton, validatie: check(skeleton), beoordeling: { ...TEMPLATE_BEOORDELING, reasons: note ? [note] : [] } };
}

async function writeCheckIn(input: CheckInInput): Promise<string | null> {
  try {
    return parseFollowUp(await claudeToolCall(CHECK_IN_SYSTEM_PROMPT, buildCheckInMessage(input), FOLLOW_UP_TOOL, 800));
  } catch (e) {
    console.error('[prepare] check-in generation failed for', input.slug, e);
    return null;
  }
}

async function askInitial(
  input: InitialInput,
  rejected: { opening: string; bespoke: string; reasons: string[] } | null,
): Promise<{ opening: string; bespoke: string } | null> {
  try {
    return parseInitial(await claudeToolCall(INITIAL_SYSTEM_PROMPT, buildInitialMessage(input, rejected), INITIAL_TOOL, 600));
  } catch (e) {
    console.error('[prepare] first-mail generation failed for', input.slug, e);
    return null;
  }
}

/**
 * The first mail: the model writes the two personal sentences, the second
 * reader judges the whole mail, one rewrite with its reasons, and when it is
 * still krom (or anything fails) the mail goes out as Sjoerd's plain text.
 * A mail without a personal line is always better than one with a crooked one.
 */
async function composeInitial(input: InitialInput, check: (b: string) => ValidationResult): Promise<Composed> {
  const skeleton = renderInitial(input);
  let rejected: { opening: string; bespoke: string; reasons: string[] } | null = null;
  for (let round = 1; round <= 2; round++) {
    const personal = await askInitial(input, rejected);
    if (!personal) return asTemplate(skeleton, check, rejected ? 'Rewrite unusable, template used' : undefined);
    const body = renderInitial(input, personal);
    const validatie = check(body);
    if (!validatie.ok) return asTemplate(skeleton, check, `Model text failed the checks: ${validatie.problems[0]}`);
    const verdict = await critique({
      bureau: input.bureau,
      body,
      personal: [personal.opening, personal.bespoke].filter(Boolean),
      notitie: input.openingshaak,
    });
    if (!verdict) return asTemplate(skeleton, check, 'Critic unavailable, template used');
    if (verdict.verdict === 'goed') {
      return { body, validatie, beoordeling: { verdict: 'goed', reasons: [], rounds: round, model: CRITIC_MODEL } };
    }
    rejected = { ...personal, reasons: verdict.reasons };
  }
  return asTemplate(skeleton, check, `Personal lines rejected twice: ${rejected?.reasons.join(' / ') ?? ''}`.trim());
}

/**
 * The whole run. `onlySlug` limits it to one agency (Regenerate in /ops);
 * then capacity is ignored for that agency's first mail.
 */
export async function runPrepare(
  db: SupabaseClient,
  now = new Date(),
  onlySlug?: string,
  opts: { regenerate?: boolean } = {},
): Promise<PrepareResult> {
  const [prospectsRes, mailsRes, statsRes, liveRes, declinedRes] = await Promise.all([
    db
      .from('outreach_prospects')
      .select(
        'slug, naam, contactpersoon, to_email, status, tier, categorie, openingshaak, campaign, subject_variant, partner_slug, reply_dismissed_at, verzonden_op, niet_mailen_op, email_ongeldig_op',
      ),
    db
      .from('outreach_mails')
      .select('slug, direction, kind, sentiment, subject, from_email, to_email, gmail_thread_id, rfc_message_id, body_text, snippet, samenvatting, sent_at')
      .not('slug', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(5000),
    db.from('outreach_prospect_stats').select('slug, kliks_bevestigd, dagen_bevestigd'),
    db.from('outreach_concepts').select('slug, soort, step').in('status', ['voorstel', 'ingepland']),
    // What Sjoerd threw away or marked as not needed stays away: prepare
    // must not write the same mail again the next morning. Regenerate is the
    // explicit way back.
    db.from('outreach_concepts').select('slug, soort, step').in('status', ['weggegooid', 'geen_antwoord']),
  ]);
  for (const r of [prospectsRes, mailsRes, statsRes, liveRes, declinedRes]) if (r.error) throw r.error;

  const autoOn = await autoApproveOn(db);
  const skipped: string[] = [];
  const mailsBySlug = new Map<string, Mail[]>();
  for (const m of (mailsRes.data ?? []) as Mail[]) {
    const list = mailsBySlug.get(m.slug) ?? [];
    list.push(m); // newest first
    mailsBySlug.set(m.slug, list);
  }
  const stats = new Map((statsRes.data ?? []).map((s) => [s.slug as string, s]));
  const live = new Set((liveRes.data ?? []).map((c) => `${c.slug}|${c.soort}|${c.step ?? 0}`));
  if (!opts.regenerate) {
    for (const c of declinedRes.data ?? []) live.add(`${c.slug}|${c.soort}|${c.step ?? 0}`);
  }
  let liveCold = (liveRes.data ?? []).filter((c) => COLD.includes(c.soort as string)).length;

  const prospects = ((prospectsRes.data ?? []) as Prospect[]).filter((p) => !onlySlug || p.slug === onlySlug);
  const blocked = (p: Prospect) => Boolean(p.niet_mailen_op || p.email_ongeldig_op);

  const today = amsterdamDayStamp(now);
  const horizon = addWorkingDays(today, 1);

  // ── 1 + 2. Chases and check-ins that are due ───────────────────────────────
  const followJobs: Array<() => Promise<'chase' | 'checkin' | null>> = [];
  for (const p of prospects) {
    if (blocked(p)) continue;
    const mails = mailsBySlug.get(p.slug) ?? [];
    const latest = mails[0] ?? null;
    const theyWroteLast = latest !== null && latest.direction === 'in' && latest.sentiment !== 'auto';
    const parked = isParked(p.reply_dismissed_at, latest as never);
    const lastOut = mails.find((m) => m.direction === 'out') ?? null;
    const fu = nextFollowUp({
      status: p.status,
      lastOutAt: lastOut?.sent_at ?? null,
      verzondenOp: p.verzonden_op,
      theyWroteLast,
      parkedAt: parked ? p.reply_dismissed_at : null,
    });
    if (!fu || fu.dueDay > horizon) continue;
    const soort = fu.kind;
    const step = soort === 'chase' ? fu.step : 0;
    if (live.has(`${p.slug}|${soort}|${step}`)) continue;
    const bureau = p.naam ?? p.slug;
    const s = stats.get(p.slug);
    const clicks = Number(s?.kliks_bevestigd ?? 0);
    const clickDays = Number(s?.dagen_bevestigd ?? 0);
    // UTC midnight of the Amsterdam due day: before any send window opens that day.
    const dueAt = new Date(fu.dueDay).toISOString();

    if (soort === 'checkin') {
      if (!latest?.from_email) {
        skipped.push(`${p.slug}: check-in without a reply address`);
        continue;
      }
      followJobs.push(async () => {
        const input: CheckInInput = {
          slug: p.slug,
          bureau,
          replierName: null,
          theirReply: latest.body_text ?? latest.snippet,
          summary: latest.samenvatting,
          codeIssued: Boolean(p.partner_slug),
        };
        const skeleton = templateCheckIn(input);
        const check = (b: string) => validateOutgoing(b, { soort: 'checkin', expectedSalutation: null, maxWords: MAX_WORDS.checkin });
        // A check-in may refer to what they wrote, so the model stays; it is
        // never auto-approved, and the critic's verdict is there for Sjoerd.
        const modelText = await writeCheckIn(input);
        let chosen: Composed = asTemplate(skeleton, check);
        if (modelText && check(modelText).ok) {
          const verdict = await critique({ bureau, body: modelText, personal: [modelText.split('\n\n')[1] ?? ''].filter(Boolean), notitie: latest.samenvatting });
          chosen = verdict?.verdict === 'goed'
            ? { body: modelText, validatie: check(modelText), beoordeling: { verdict: 'goed', reasons: [], rounds: 1, model: CRITIC_MODEL } }
            : asTemplate(skeleton, check, verdict ? `Personal line rejected: ${verdict.reasons.join(' / ')}` : 'Critic unavailable, template used');
        }
        const subject = latest.subject ?? 'Vraagje over jullie spoor 2-trajecten';
        const id = await insertConcept(
          db,
          {
            slug: p.slug,
            soort: 'checkin',
            to_email: latest.from_email!,
            subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
            body: chosen.body,
            skeleton,
            variant: 'checkin',
            basis: { status: p.status, parkedAt: p.reply_dismissed_at, lastInAt: latest.sent_at, dueAt },
            thread_id: latest.gmail_thread_id,
            in_reply_to: latest.rfc_message_id,
            references_hdr: latest.rfc_message_id,
            validatie: chosen.validatie,
            beoordeling: chosen.beoordeling,
          },
          // A check-in follows a real conversation: always Sjoerd's call.
          { autoApprove: false },
        );
        return id ? 'checkin' : null;
      });
      continue;
    }

    const to = p.to_email ?? lastOut?.to_email ?? null;
    if (!to || !lastOut) {
      skipped.push(`${p.slug}: chase without an address or a first mail`);
      continue;
    }
    const firstOut = [...mails].reverse().find((m) => m.direction === 'out') ?? lastOut;
    followJobs.push(async () => {
      const input: FollowUpInput = {
        slug: p.slug,
        bureau,
        contactpersoon: p.contactpersoon,
        step: fu.step,
        clicks,
        clickDays,
        openingshaak: p.openingshaak,
        campaign: p.campaign,
        codeIssued: Boolean(p.partner_slug),
      };
      const skeleton = renderFollowUp(input);
      const variant = chaseVariant(input);
      const check = (b: string) =>
        validateOutgoing(b, {
          soort: 'chase',
          expectedSalutation: salutation(input),
          demoLink: variant === 'quiet' ? demoLink(p.slug, p.campaign) : null,
          maxWords: MAX_WORDS.chase,
        });
      // Chases are Sjoerd's approved text, nothing personal woven in: the
      // hook already did its work in the first mail, and weaving it into a
      // template sentence is exactly what read as machine-made (2026-09-24).
      const chosen = asTemplate(skeleton, check);
      const subject = firstOut.subject ?? 'Vraagje over jullie spoor 2-trajecten';
      const id = await insertConcept(
        db,
        {
          slug: p.slug,
          soort: 'chase',
          step: fu.step,
          to_email: to,
          subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
          body: chosen.body,
          skeleton,
          variant,
          basis: { status: p.status, clicks, clickDays, lastOutAt: lastOut.sent_at, dueAt },
          thread_id: lastOut.gmail_thread_id,
          in_reply_to: lastOut.rfc_message_id,
          references_hdr: lastOut.rfc_message_id,
          validatie: chosen.validatie,
          beoordeling: chosen.beoordeling,
        },
        { autoApprove: autoOn },
      );
      return id ? 'chase' : null;
    });
  }

  const followResults = await pool(followJobs.slice(0, MAX_GENERATIONS), CONCURRENCY);
  const chases = followResults.filter((r) => r === 'chase').length;
  const checkins = followResults.filter((r) => r === 'checkin').length;
  liveCold += chases + checkins;

  // ── 3. First mails for the slots that are left ─────────────────────────────
  const capacity = nextWorkingDays(now, 2).reduce((sum, d) => sum + dayCapacity(d), 0);
  const free = onlySlug ? 1 : Math.max(0, capacity - liveCold);
  const budget = Math.min(free, MAX_GENERATIONS - followJobs.length);

  const candidates = prospects
    .filter((p) => p.status === 'nog_niet_benaderd' && p.to_email && !blocked(p) && !live.has(`${p.slug}|initial|0`))
    .sort((a, b) => {
      const warm = Number(Number(stats.get(b.slug)?.kliks_bevestigd ?? 0) > 0) - Number(Number(stats.get(a.slug)?.kliks_bevestigd ?? 0) > 0);
      if (warm) return warm;
      const tier = (TIER_ORDER[a.tier ?? ''] ?? 9) - (TIER_ORDER[b.tier ?? ''] ?? 9);
      if (tier) return tier;
      return (a.naam ?? a.slug).localeCompare(b.naam ?? b.slug);
    })
    .slice(0, Math.max(0, budget));

  const initialResults = await pool(
    candidates.map((p) => async () => {
      const input: InitialInput = {
        slug: p.slug,
        bureau: p.naam ?? p.slug,
        contactpersoon: p.contactpersoon,
        categorie: p.categorie,
        openingshaak: p.openingshaak,
        campaign: p.campaign,
        subjectVariant: p.subject_variant,
      };
      const skeleton = renderInitial(input);
      const check = (b: string) =>
        validateOutgoing(b, {
          soort: 'initial',
          expectedSalutation: salutation(input),
          demoLink: demoLink(p.slug, p.campaign),
          maxWords: MAX_WORDS.initial,
        });
      const chosen = await composeInitial(input, check);
      const id = await insertConcept(
        db,
        {
          slug: p.slug,
          soort: 'initial',
          to_email: p.to_email!,
          subject: initialSubject(p.subject_variant),
          body: chosen.body,
          skeleton,
          variant: p.subject_variant ?? 'a',
          basis: { status: 'nog_niet_benaderd' },
          validatie: chosen.validatie,
          beoordeling: chosen.beoordeling,
        },
        { autoApprove: autoOn },
      );
      return id !== null;
    }),
    CONCURRENCY,
  );

  if (followJobs.length > MAX_GENERATIONS) skipped.push(`${followJobs.length - MAX_GENERATIONS} follow-ups left for the next run`);

  return { chases, checkins, initials: initialResults.filter(Boolean).length, capacity, skipped };
}
