// The partner audience of intake-chat: the pre-chat on /partners.
//
// Same rails as the homepage chat (server-side phase machine, canned replies
// for unedited starters, turn and token caps) with three differences:
//   - nothing feeds a survey pre-fill; the extraction becomes a lead row;
//   - the pitch is followed by an offer card computed in code
//     (_shared/partnerOffer.ts) from the chip answers and the pilot slots left;
//   - an email + a chosen offer ('lead' action) stores the lead, mails a recap
//     to the practitioner and pings Sjoerd (push + a plain mail as backup,
//     because the free credits are promised "within one working day").

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse } from '../_shared/cors.ts';
import { notifyPush } from '../_shared/opsPush.ts';
import { renderEmail, h1, paragraph, callout, fineprint, bodyRow, ctaRow, escapeHtml } from '../_shared/email-chrome.ts';
import { buildPartnerOffer, type OfferAction, type PartnerOffer } from '../_shared/partnerOffer.ts';
import { callClaude, textFrom, usedTokens, EXTRACTION_MODEL } from './claude.ts';
import type { Lang } from './prompts.ts';
import {
  type PartnerIntent,
  VALID_PARTNER_INTENTS,
  PARTNER_INTENT_LABELS,
  PARTNER_OPENER_REPLIES,
  partnerBeatsFor,
  partnerBeatLabels,
  chipAnswers,
  partnerQaSystem,
  partnerPitchSystem,
  partnerPostPitchSystem,
  partnerExtractionSystem,
  PARTNER_EXTRACTION_TOOL,
  PARTNER_CLOSE_MESSAGE,
  PITCH_SEND_OFF,
  hasContrast,
} from './partnerPrompts.ts';

const MAX_USER_TURNS = 12;
const MAX_MESSAGE_CHARS = 600;
const MAX_SESSION_TOKENS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SITE = 'https://cairnly.io';
// Mirrors src/components/partners/constants.ts (CALENDLY_URL, CONTACT_EMAIL).
const CALENDLY_URL = 'https://calendly.com/sjoerd-bethehitl/new-meeting';
const CONTACT_EMAIL = 'info@cairnly.io';
/** Where the backup lead alert goes (same inbox as the other admin alerts). */
const LEAD_ALERT_TO = 'sjoerd@falkoratlas.com';

type Db = SupabaseClient;

interface TranscriptMessage {
  role: 'assistant' | 'user';
  text: string;
  at: string;
}

export interface PartnerRow {
  id: string;
  intent: string;
  language: string;
  status: string;
  messages: TranscriptMessage[];
  extraction: Record<string, unknown> | null;
  pitch: string | null;
  email: string | null;
  user_turns: number;
  total_tokens: number;
  offer?: PartnerOffer | null;
  offer_chosen?: string | null;
  lead_status?: string | null;
}

function json(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const sanitizeLang = (input: unknown): Lang => (input === 'en' ? 'en' : 'nl'); // Dutch is the default here
const toIntent = (input: unknown): PartnerIntent =>
  VALID_PARTNER_INTENTS.includes(input as PartnerIntent) ? (input as PartnerIntent) : 'other';
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function apiMessages(row: PartnerRow, transcript: TranscriptMessage[]): { role: string; content: string }[] {
  const label = PARTNER_INTENT_LABELS[sanitizeLang(row.language)][toIntent(row.intent)];
  const context = `(The visitor opened the chat on cairnly.io/partners. The starter line they relate to: "${label}".)`;
  return [{ role: 'user', content: context }, ...transcript.map((m) => ({ role: m.role, content: m.text }))];
}

async function pilotSlotsLeft(db: Db): Promise<number> {
  const { data, error } = await db.from('partner_prechat_settings').select('pilot_slots_left').eq('id', true).maybeSingle();
  if (error) console.error('[intake-chat/partner] pilot slots read failed:', error.message);
  // Unknown = no pilot on offer: never promise a slot we cannot confirm.
  return typeof data?.pilot_slots_left === 'number' ? data.pilot_slots_left : 0;
}

async function runExtraction(row: PartnerRow, transcript: TranscriptMessage[]) {
  try {
    const resp = await callClaude({
      system: partnerExtractionSystem(),
      messages: apiMessages(row, transcript),
      maxTokens: 1500,
      model: EXTRACTION_MODEL,
      tools: [PARTNER_EXTRACTION_TOOL],
      toolChoice: { type: 'tool', name: PARTNER_EXTRACTION_TOOL.name },
    });
    const block = resp.content?.find((c) => c.type === 'tool_use');
    return { extraction: (block?.input as Record<string, unknown>) ?? null, tokens: usedTokens(resp) };
  } catch (e) {
    console.error('[intake-chat/partner] extraction failed:', e);
    return { extraction: null, tokens: 0 };
  }
}

// ── start ───────────────────────────────────────────────────────────────────

export async function startPartner(body: Record<string, unknown>, corsHeaders: Record<string, string>, db: Db): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return errorResponse('Empty message', 400, corsHeaders);
  if (text.length > MAX_MESSAGE_CHARS) return errorResponse('Message too long', 400, corsHeaders);
  const language = sanitizeLang(body.language);
  const intent = toIntent(body.intent);
  const source = body.source === 'pill' ? 'pill' : 'cta';

  // The canned reply is for an UNEDITED starter only. Checked here against the
  // seed text itself, so an edited line always gets a live reply built from
  // the visitor's own words.
  const unedited =
    intent !== 'other' &&
    (['en', 'nl'] as Lang[]).some((l) => normalize(PARTNER_INTENT_LABELS[l][intent]) === normalize(text));

  const plan = partnerBeatsFor(intent);
  if (unedited) {
    const reply = PARTNER_OPENER_REPLIES[language][intent];
    const now = new Date().toISOString();
    const messages: TranscriptMessage[] = [
      { role: 'user', text, at: now },
      { role: 'assistant', text: reply, at: now },
    ];
    const { data, error } = await db
      .from('intake_sessions')
      .insert({ audience: 'partner', intent, language, source, messages, user_turns: 1 })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[intake-chat/partner] session insert failed:', error?.message);
      return errorResponse('Could not start the conversation', 500, corsHeaders);
    }
    return json(
      {
        sessionId: data.id,
        reply,
        stage: 'chat',
        beat: 1,
        chips: plan[0].chips?.[language] ?? null,
        totalBeats: plan.length,
        beatLabels: partnerBeatLabels(intent, language),
        offer: null,
      },
      corsHeaders,
    );
  }

  const { data, error } = await db
    .from('intake_sessions')
    .insert({ audience: 'partner', intent, language, source, messages: [] })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[intake-chat/partner] session insert failed:', error?.message);
    return errorResponse('Could not start the conversation', 500, corsHeaders);
  }
  return await advancePartner(data as PartnerRow, text, corsHeaders, db, true);
}

// ── message ─────────────────────────────────────────────────────────────────

export async function advancePartner(
  row: PartnerRow,
  text: string,
  corsHeaders: Record<string, string>,
  db: Db,
  includeSessionId = false,
): Promise<Response> {
  const lang = sanitizeLang(row.language);
  const intent = toIntent(row.intent);
  const plan = partnerBeatsFor(intent);
  const userTurns = row.user_turns + 1;

  if (userTurns > MAX_USER_TURNS || row.total_tokens > MAX_SESSION_TOKENS) {
    return json(
      { reply: PARTNER_CLOSE_MESSAGE[lang], stage: row.status === 'active' ? 'chat' : 'pitched', closed: true, offer: row.offer ?? null },
      corsHeaders,
    );
  }

  const transcript: TranscriptMessage[] = [...row.messages, { role: 'user', text, at: new Date().toISOString() }];
  let reply: string;
  let stage: 'chat' | 'pitched' = row.status === 'active' ? 'chat' : 'pitched';
  let beat: number | null = null;
  let chips = null;
  let tokens = 0;
  let extraction = row.extraction;
  let pitch = row.pitch;
  let offer: PartnerOffer | null = row.offer ?? null;

  // Answers tapped so far. A practice whose clients come mostly from
  // healthcare, education or production gets the honest close right away:
  // the remaining questions could not change an offer that is not there.
  const tapped = chipAnswers(intent, transcript.filter((m) => m.role === 'user').map((m) => m.text));
  const notFit = tapped.clientGroup === 'not_fit';

  try {
    if (row.status === 'active' && userTurns <= plan.length && !notFit) {
      const resp = await callClaude({
        system: partnerQaSystem(lang, userTurns, intent),
        messages: apiMessages(row, transcript),
        maxTokens: 800,
        thinking: { type: 'between_tools' },
        effort: 'low',
      });
      reply = textFrom(resp);
      tokens = usedTokens(resp);
      beat = userTurns;
      chips = plan[userTurns - 1].chips?.[lang] ?? null;
    } else if (row.status === 'active') {
      // The pitch must know the offer (it points at it), so the offer comes
      // first. Tapped chips give the answers directly; when the visitor typed
      // any of the three instead, the extraction maps it before the pitch
      // (slower, but the card must be right). All tapped: extraction runs in
      // parallel with the pitch, as on the homepage.
      const answers = { ...tapped };
      const slots = await pilotSlotsLeft(db);
      const complete = notFit || !!(answers.clientGroup && answers.payment && answers.volume);

      let extractionPromise: Promise<{ extraction: Record<string, unknown> | null; tokens: number }>;
      let jobSeeker = false;
      if (!complete) {
        const first = await runExtraction(row, transcript);
        extractionPromise = Promise.resolve(first);
        const x = first.extraction ?? {};
        answers.clientGroup ??= (x.client_group as typeof answers.clientGroup) ?? null;
        answers.payment ??= (x.payment as typeof answers.payment) ?? null;
        answers.volume ??= (x.volume as typeof answers.volume) ?? null;
        jobSeeker = x.visitor_type === 'job_seeker';
      } else {
        extractionPromise = runExtraction(row, transcript);
      }

      offer = buildPartnerOffer({ ...answers, jobSeeker, pilotSlotsLeft: slots });

      const pitchSystem = partnerPitchSystem(lang, intent, offer);
      const pitchResp = await callClaude({
        system: pitchSystem,
        messages: apiMessages(row, transcript),
        maxTokens: 3000,
        thinking: { type: 'between_tools' },
        effort: 'medium',
      });
      reply = textFrom(pitchResp).trim();
      tokens = usedTokens(pitchResp);

      // The contrast template survives the prompt rule often enough that it
      // is checked here; one rewrite, then whatever comes back stands.
      if (hasContrast(reply)) {
        const retry = await callClaude({
          system: pitchSystem,
          messages: [
            ...apiMessages(row, transcript),
            { role: 'assistant', content: reply },
            {
              role: 'user',
              content:
                '(Internal check, not from the visitor: this draft uses a contrast construction such as ", not X", ", niet X", "geen X", "instead of" or "in plaats van". Rewrite the same message with every such phrase removed; keep the same shape and limits. Output only the message.)',
            },
          ],
          maxTokens: 3000,
          thinking: { type: 'between_tools' },
          effort: 'low',
        }).catch(() => null);
        const rewritten = retry ? textFrom(retry).trim() : '';
        if (retry) tokens += usedTokens(retry);
        if (rewritten) reply = rewritten;
      }
      if (reply && (offer.kind === 'pilot' || offer.kind === 'credits')) {
        reply = `${reply}\n\n${PITCH_SEND_OFF[lang][offer.kind]}`;
      }
      pitch = reply;
      stage = 'pitched';

      const x = await extractionPromise;
      tokens += x.tokens;
      if (x.extraction) extraction = x.extraction;
    } else {
      const resp = await callClaude({
        system: partnerPostPitchSystem(lang, offer),
        messages: apiMessages(row, transcript),
        maxTokens: 800,
        thinking: { type: 'between_tools' },
        effort: 'low',
      });
      reply = textFrom(resp);
      tokens = usedTokens(resp);
    }
  } catch (e) {
    console.error('[intake-chat/partner] message handling failed:', e);
    return errorResponse('The conversation hiccuped, please try again', 502, corsHeaders);
  }

  if (!reply) return errorResponse('The conversation hiccuped, please try again', 502, corsHeaders);

  transcript.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
  const { error: updateError } = await db
    .from('intake_sessions')
    .update({
      messages: transcript,
      user_turns: userTurns,
      total_tokens: row.total_tokens + tokens,
      status: stage === 'pitched' && row.status === 'active' ? 'pitched' : row.status,
      pitch,
      extraction,
      offer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (updateError) console.error('[intake-chat/partner] session update failed:', updateError.message);

  return json(
    {
      ...(includeSessionId ? { sessionId: row.id, totalBeats: plan.length, beatLabels: partnerBeatLabels(intent, lang) } : {}),
      reply,
      stage,
      beat,
      chips,
      offer: stage === 'pitched' ? offer : null,
    },
    corsHeaders,
  );
}

// ── lead ────────────────────────────────────────────────────────────────────

const PUSH_LABELS: Record<string, Record<string, string>> = {
  practice_type: { agency: 'agency', independent_coach: 'independent coach', test_adviser: 'test-using adviser', other: 'other practice' },
  payment: { fixed_fee: 'fixed fee', hourly: 'by the hour', client_pays: 'client pays', mixed: 'mixed payment' },
  volume: { lt10: '<10 a year', '10_49': '10 to 49 a year', '50_199': '50 to 199 a year', '200_plus': '200+ a year' },
  client_group: { office: 'office workers', leadership: 'leadership', mixed: 'mixed clients', not_fit: 'healthcare/education/production' },
};
const CHOICE_LABEL: Record<OfferAction, string> = {
  pilot_call: 'Pilot call',
  free_credits: 'Asked for 3 free credits',
  call: 'Wants a call',
};

function leadLine(row: PartnerRow, choice: OfferAction): string {
  const x = row.extraction ?? {};
  const o = row.offer;
  const parts = [
    PUSH_LABELS.practice_type[String(x.practice_type)],
    PUSH_LABELS.payment[String(o?.payment ?? x.payment)],
    PUSH_LABELS.volume[String(o?.volume ?? x.volume)],
    PUSH_LABELS.client_group[String(o?.clientGroup ?? x.client_group)],
  ].filter(Boolean);
  return `${parts.join(', ') || 'partner'}. ${CHOICE_LABEL[choice]}.`;
}

/** The pitch's light markdown (bold + "- " bullets) as email HTML. */
function pitchHtml(pitch: string): string {
  const bold = (s: string) => escapeHtml(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return pitch
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const b = l.match(/^[-•]\s+(.*)$/);
      return paragraph(b ? `&#8226;&nbsp; ${bold(b[1])}` : bold(l), { size: 14.5, mb: 10 });
    })
    .join('');
}

const RECAP_COPY: Record<Lang, {
  subject: Record<OfferAction, string>;
  heading: Record<OfferAction, string>;
  next: Record<OfferAction, string>;
  calendarCta: string;
  fromChat: string;
  links: (sample: string, demo: string) => string;
  footer: string;
}> = {
  en: {
    subject: {
      free_credits: 'Your 3 free Cairnly credits are on their way',
      pilot_call: 'The Cairnly pilot: 20 minutes to talk it through',
      call: '20 minutes about Cairnly',
    },
    heading: {
      free_credits: 'Your free credits are on their way',
      pilot_call: 'Let us talk about the pilot',
      call: 'Let us talk',
    },
    next: {
      free_credits:
        'Thanks for your interest. Sjoerd sends your three codes by email within one working day. Each code is one full assessment, so you can run it on yourself first and see exactly what a candidate gets.',
      pilot_call:
        "Thanks. If you haven't picked a time yet, the button below opens Sjoerd's calendar. The pilot is 10 free credits for your agency, no strings attached. What we ask back is your advisers' honest opinion.",
      call: "Thanks. If you haven't picked a time yet, the button below opens Sjoerd's calendar for 20 minutes.",
    },
    calendarCta: 'Pick a time',
    fromChat: 'From your conversation',
    links: (sample, demo) =>
      `See for yourself: <a href="${sample}">the sample report</a> (white-labelled, as your candidates would get it) and <a href="${demo}">a recorded session</a>.`,
    footer: 'You receive this because you left your email in the chat on cairnly.io/partners. Reply to this mail to reach Sjoerd directly.',
  },
  nl: {
    subject: {
      free_credits: 'Je 3 gratis Cairnly-credits komen eraan',
      pilot_call: 'De Cairnly-pilot: 20 minuten om het door te nemen',
      call: '20 minuten over Cairnly',
    },
    heading: {
      free_credits: 'Je gratis credits komen eraan',
      pilot_call: 'Laten we het over de pilot hebben',
      call: 'Laten we even praten',
    },
    next: {
      free_credits:
        'Dank voor je interesse. Sjoerd mailt je binnen één werkdag drie codes. Elke code is één volledig assessment, dus je kunt het eerst op jezelf uitproberen en precies zien wat een kandidaat krijgt.',
      pilot_call:
        'Dank je. Heb je nog geen tijd gekozen, dan opent de knop hieronder de agenda van Sjoerd. De pilot is 10 gratis credits voor je bureau, zonder voorwaarden. Wat wij terugvragen is een eerlijke mening van je adviseurs.',
      call: 'Dank je. Heb je nog geen tijd gekozen, dan opent de knop hieronder de agenda van Sjoerd voor 20 minuten.',
    },
    calendarCta: 'Kies een tijd',
    fromChat: 'Uit jullie gesprek',
    links: (sample, demo) =>
      `Zelf kijken: <a href="${sample}">het voorbeeldrapport</a> (met het logo van een bureau, zoals je kandidaten het krijgen) en <a href="${demo}">een opgenomen sessie</a>.`,
    footer: 'Je krijgt deze mail omdat je je e-mailadres achterliet in de chat op cairnly.io/partners. Beantwoord deze mail om Sjoerd direct te bereiken.',
  },
};

async function sendMail(payload: Record<string, unknown>): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.error('[intake-chat/partner] RESEND_API_KEY missing, mail not sent');
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error('[intake-chat/partner] mail failed:', r.status, (await r.text()).slice(0, 300));
}

async function afterLead(db: Db, row: PartnerRow, email: string, choice: OfferAction): Promise<void> {
  const lang = sanitizeLang(row.language);

  // Follow-up questions after the pitch (e.g. "do my advisers see results?")
  // belong in the lead summary too: re-read the whole conversation.
  const pitchIndex = row.messages.findIndex((m) => m.role === 'assistant' && m.text === row.pitch);
  if (pitchIndex >= 0 && pitchIndex < row.messages.length - 1) {
    const { extraction } = await runExtraction(row, row.messages);
    if (extraction) {
      row.extraction = extraction;
      await db.from('intake_sessions').update({ extraction }).eq('id', row.id);
    }
  }

  const c = RECAP_COPY[lang];
  const sample = `${SITE}/partners/sample-report?lang=${lang}`;
  const demo = `${SITE}/demo?p=partners&persona=marcel&lang=${lang}`;
  const body =
    bodyRow(
      h1(c.heading[choice]) +
        paragraph(c.next[choice]) +
        (row.pitch ? callout(c.fromChat, pitchHtml(row.pitch)) : '') +
        paragraph(c.links(sample, demo), { size: 15 }),
    ) +
    (choice === 'free_credits' ? '' : ctaRow(c.calendarCta, `${CALENDLY_URL}?email=${encodeURIComponent(email)}`)) +
    bodyRow(fineprint(c.footer));

  const line = leadLine(row, choice);
  const summary = typeof row.extraction?.summary === 'string' ? row.extraction.summary : '';

  await Promise.allSettled([
    sendMail({
      from: 'Cairnly <no-reply@cairnly.io>',
      to: [email],
      reply_to: CONTACT_EMAIL,
      subject: c.subject[choice],
      html: renderEmail({ title: c.subject[choice], preheader: c.next[choice].slice(0, 90), bodyHtml: body }),
    }),
    sendMail({
      from: 'Cairnly <no-reply@cairnly.io>',
      to: [LEAD_ALERT_TO],
      subject: `[Cairnly] New partner lead: ${CHOICE_LABEL[choice]}`,
      text: `${email}\n${line}\n\n${summary}\n\n${SITE}/ops (Partners tab, Pre-chat leads)`,
    }),
    notifyPush(db as unknown as Parameters<typeof notifyPush>[0], 'partner_lead', row.id, {
      title: 'New partner lead',
      body: line,
      url: `${SITE}/ops`,
      tag: `partner-lead-${row.id.slice(0, 8)}`,
    }),
  ]);
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

export async function handlePartnerLead(body: Record<string, unknown>, corsHeaders: Record<string, string>, db: Db): Promise<Response> {
  const sessionId = String(body.sessionId ?? '');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const choice = body.choice as OfferAction;
  if (!UUID_RE.test(sessionId)) return errorResponse('Unknown session', 404, corsHeaders);
  if (!EMAIL_RE.test(email) || email.length > 200) return errorResponse('Invalid email', 400, corsHeaders);
  if (!['pilot_call', 'free_credits', 'call'].includes(choice)) return errorResponse('Unknown offer', 400, corsHeaders);

  const { data, error } = await db
    .from('intake_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('audience', 'partner')
    .maybeSingle();
  if (error || !data) return errorResponse('Unknown session', 404, corsHeaders);
  const row = data as PartnerRow;
  if (row.status === 'active' || !row.offer) return errorResponse('No offer yet', 409, corsHeaders);

  // Only what the card offered. The pilot is re-checked: the card may have
  // been on screen while the last slot went.
  const offered = [row.offer.primary, row.offer.secondary, 'call'];
  if (!offered.includes(choice)) return errorResponse('Not on offer', 409, corsHeaders);
  if (choice === 'pilot_call' && (await pilotSlotsLeft(db)) <= 0) {
    return json({ ok: false, reason: 'pilot_full' }, corsHeaders); // 200: invoke() hides bodies of non-2xx
  }

  // Same email + same choice again (a double click, a reload): no second mail.
  if (row.email === email && row.offer_chosen === choice) return json({ ok: true, choice }, corsHeaders);

  const { error: updateError } = await db
    .from('intake_sessions')
    .update({
      email,
      offer_chosen: choice,
      lead_status: row.lead_status ?? 'new',
      lead_at: new Date().toISOString(),
      status: 'email_captured',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (updateError) {
    console.error('[intake-chat/partner] lead update failed:', updateError.message);
    return errorResponse('Could not save your email', 500, corsHeaders);
  }

  const work = afterLead(db, { ...row, email }, email, choice).catch((e) =>
    console.error('[intake-chat/partner] after-lead work failed:', e),
  );
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
  else await work;

  return json({ ok: true, choice }, corsHeaders);
}
