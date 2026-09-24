// The first mail to a new agency: the text Sjoerd actually sent in September
// 2026, and the Claude call that personalises it.
//
// The skeleton is copied from his Sent folder (the mails to Step by Step
// Priority, Weustink & Partners and Work Solutions, 18-21 Sept 2026). What
// differed between those mails is exactly what this file lets vary: the
// opening line, built from the seed's `openingshaak`; the trajectory and the
// person the candidate meets, which follow the agency's category; and one
// sentence on why voorwerk helps this kind of bureau. Everything else is his
// wording, letter for letter.
//
// This mail can go out without a human reading it (auto-approve), so the
// model gets two sentences to write and nothing else, the parser throws out
// anything off-pattern, and a failure falls back to the plain skeleton,
// which is always sendable. Text is Dutch and leaves the building: no dashes.

import { demoLink, salutation } from './outreachFollowUp.ts';
import { PARTNERS_URL } from './outreachReply.ts';
import { aiTell } from './outreachValidate.ts';

export interface InitialInput {
  slug: string;
  bureau: string;
  contactpersoon: string | null;
  /** D = re-integratie (spoor 2), O = outplacement, DO = both. */
  categorie: string | null;
  /** One line of research from the seed; the opening line is built from it. */
  openingshaak: string | null;
  campaign: string | null;
  subjectVariant: 'a' | 'b' | null;
}

/**
 * The subject-line A/B test (outreach_subject_stats). Same strings as
 * SUBJECT_VARIANTS in src/lib/outreach.ts, which Deno cannot import.
 */
export const INITIAL_SUBJECTS = {
  a: 'Vraagje over jullie spoor 2-trajecten',
  b: 'Doen jullie het loopbaanonderzoek in spoor 2 zelf?',
} as const;

export function initialSubject(variant: 'a' | 'b' | null): string {
  return INITIAL_SUBJECTS[variant ?? 'a'];
}

/** What the "voorwerk" paragraph calls the trajectory and the professional. */
export function categoryWords(categorie: string | null): { traject: string; rol: string; rollen: string } {
  switch ((categorie ?? '').toUpperCase()) {
    case 'D':
      return { traject: 'Voor een spoor 2-traject', rol: 'arbeidsdeskundige', rollen: 'adviseurs' };
    case 'O':
      return { traject: 'Voor een outplacementtraject', rol: 'coach', rollen: 'coaches' };
    default:
      return { traject: 'Voor een outplacement- of spoor 2-traject', rol: 'adviseur', rollen: 'adviseurs' };
  }
}

/** The voorwerk sentence when the model has nothing better. From the Weustink mail. */
export const DEFAULT_BESPOKE = 'Het vervangt dat gesprek niet, het zit ervoor.';

/**
 * The mail. `personal.opening` null or empty leaves the opening line out
 * altogether, which reads fine: the Sent mails without a strong hook would
 * have been better without the forced one.
 */
export function renderInitial(
  input: InitialInput,
  personal: { opening?: string | null; bespoke?: string | null } = {},
): string {
  const w = categoryWords(input.categorie);
  const opening = personal.opening?.trim() || null;
  const bespoke = personal.bespoke?.trim() || DEFAULT_BESPOKE;
  return [
    salutation(input),
    '',
    ...(opening ? [opening, ''] : []),
    'Ik ben Sjoerd Geurts, oprichter van Cairnly in Utrecht. De afgelopen twee jaar heb ik een online tool gebouwd die mensen helpt een loopbaanswitch te maken: 25 tot 40 minuten invullen, en er komt geen testuitslag uit maar een top 3 concrete beroepen met matchscore, alternatieven, salarisranges en per beroep een inschatting van wat AI ermee gaat doen.',
    '',
    'In plaats van dat verder uit te leggen: hier is een demo, geen login nodig.',
    '',
    `[Bekijk Marcels sessie (2 minuten)](${demoLink(input.slug, input.campaign)})`,
    '',
    'Marcel, 41, teamleider klantenservice bij een verzekeraar, wil dichter bij de inhoud werken. Je ziet het gesprek met de AI-coach, de harde eis (woensdag thuis) die in de matches wordt meegewogen, en het rapport dat eruit komt. Fictieve kandidaat, echte output.',
    '',
    'Wil je hem echt aan de tand voelen met je eigen antwoorden of met een casus van een klant: reageer met "code" en ik stuur er een, gratis, geen voorwaarden. Daar leer ik zelf ook het meest van.',
    '',
    `${w.traject} is Cairnly voorwerk: de kandidaat komt bij jullie ${w.rol} binnen met richting in plaats van met een leeg vel. ${bespoke} Het rapport draagt jullie logo, het echte gesprek blijft van jullie. Werkwijze en prijzen staan open en bloot op [cairnly.io/partners](${PARTNERS_URL}).`,
    '',
    `We zoeken vijf bureaus voor een gratis pilot: vijf kandidaten per bureau, binnen zes weken. Geen voorwaarden, ik wil vooral horen wat jullie ${w.rollen} ervan vinden. Is dat 20 minuten waard?`,
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

// ─── The model pass ──────────────────────────────────────────────────────────

export const INITIAL_SYSTEM_PROMPT = `Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly (cairnly.io), een online loopbaantool. Sjoerd mailt Nederlandse re-integratie- en outplacementbureaus voor het eerst. De mail zelf staat vast. Jij schrijft precies twee zinnen die de mail persoonlijk maken, en verder niets.

1. OPENING: één zin die begint met "Ik zag dat jullie" en één of twee concrete feiten over dit bureau noemt, uitsluitend uit de ONDERZOEKSNOTITIE. Maximaal 22 woorden. Zo schreef de afzender ze zelf: "Ik zag dat jullie bewust landelijk werken met een klein team van negen, met een 8,5 van cliënten en een 8,7 van opdrachtgevers." / "Ik zag dat jullie met tien coaches landelijk werken en een 9,0 scoren op zowel re-integratie als outplacement." Staat er in de notitie niets concreets over het bureau zelf (bijvoorbeeld alleen "website niet bereikbaar" of een algemene omschrijving als "biedt re-integratie en outplacement"), geef dan een lege string. Een lege opening is beter dan een vage of geforceerde. Noem nooit dat een website onbereikbaar was.
2. VOORWERK: één zin, maximaal 16 woorden, over wat voorwerk voor precies dit soort bureau scheelt. Zo schreef de afzender ze: "Bij een klein team scheelt dat vooral voorbereidingstijd per kandidaat." / "Het vervangt jullie Scan&Plan niet, het zit ervoor." Gebruik alleen wat in de notitie staat.

Zo NIET (afgekeurd, omdat ze niet klinken als een mens): "Ik zag dat jullie assessment prominent in het dienstenmenu voert naast individueel en collectief outplacement." (opgestapeld, stijf) / "Gezien jullie focus op heel Nederland scheelt dat reistijd." (verband dat er niet is).

HUISREGELS: Nederlands, je-vorm, gewoon en direct, zoals je een collega mailt. Geen verbindingswoorden die een reden suggereren ("gezien", "aangezien", "dus", "daarom", "waardoor", "hierdoor"). Geen opsomming van drie dingen. Geen gedachtestreepjes (— of –). Geen constructies als "niet X, maar Y". Geen cijfers, namen of methodes die niet in de notitie staan. Geen complimenten en geen marketingwoorden ("indrukwekkend", "mooi", "prominent", "uniek", "waardevol"). Geen vragen.`;

export const INITIAL_TOOL = {
  name: 'write_first_mail',
  description: 'Return the two personal sentences for the first mail.',
  input_schema: {
    type: 'object',
    properties: {
      opening: { type: 'string', description: 'One Dutch sentence starting with "Ik zag dat jullie", or an empty string.' },
      bespoke: { type: 'string', description: 'One Dutch sentence of at most 20 words on what voorwerk saves this agency.' },
    },
    required: ['opening', 'bespoke'],
  },
} as const;

/**
 * The model's input. `rejected` carries the critic's reasons from an earlier
 * attempt, so the second try knows what read as krom.
 */
export function buildInitialMessage(
  input: InitialInput,
  rejected?: { opening: string; bespoke: string; reasons: string[] } | null,
): string {
  const w = categoryWords(input.categorie);
  const lines = [
    `Bureau: ${input.bureau}`,
    `Soort trajecten: ${w.traject.replace(/^Voor een /, '')}`,
    `ONDERZOEKSNOTITIE: ${input.openingshaak ?? '(geen)'}`,
  ];
  if (rejected) {
    lines.push(
      '',
      'Je vorige poging werd afgekeurd door een kritische lezer:',
      `OPENING was: ${rejected.opening || '(leeg)'}`,
      `VOORWERK was: ${rejected.bespoke}`,
      `Reden: ${rejected.reasons.join(' / ') || 'leest niet natuurlijk'}`,
      'Schrijf beide zinnen opnieuw, eenvoudiger. Twijfel je over de opening, geef dan een lege string.',
    );
  }
  return lines.join('\n');
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const DASH = /[—–]/;
const NOT_BUT = /\bniet\b[^.?!]{1,60},\s*maar\b/i;
/** Connectors that invent a reason; in the Sept 2026 chases they were the tell. */
const FAKE_BECAUSE = /\b(gezien|aangezien|dus|daarom|waardoor|hierdoor)\b/i;

/** The two sentences, or null when the model strayed from the pattern. */
export function parseInitial(
  resp: { content?: Array<{ type: string; name?: string; input?: unknown }> },
): { opening: string; bespoke: string } | null {
  const block = resp.content?.find((c) => c.type === 'tool_use' && c.name === INITIAL_TOOL.name);
  if (!block?.input || typeof block.input !== 'object') return null;
  const i = block.input as Record<string, unknown>;
  const opening = String(i.opening ?? '').trim();
  const bespoke = String(i.bespoke ?? '').trim();
  if (!bespoke || words(bespoke) > 16) return null;
  if (opening && (!opening.startsWith('Ik zag dat jullie') || words(opening) > 22)) return null;
  for (const s of [opening, bespoke]) {
    if (DASH.test(s) || NOT_BUT.test(s) || FAKE_BECAUSE.test(s) || aiTell(s) || s.includes('?') || s.includes('\n')) return null;
  }
  return { opening, bespoke };
}
