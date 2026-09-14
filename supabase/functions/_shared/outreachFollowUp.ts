// The follow-up mail: the templates Sjoerd approved, and the Claude call that
// fits one to a single agency.
//
// Three skeletons, because three situations. An agency that opened the demo
// gets asked what it thought; an agency that never opened it gets the mail
// once more with a different hook; an agency that ignored two mails gets a
// short goodbye that leaves the door open. The model may adapt the salutation
// and the opening line and nothing else, so what Sjoerd reads in the Drafts
// folder is what he signed off on here.
//
// Text is Dutch and leaves this building, so no em-dashes anywhere.

import { CALENDLY_URL, PARTNERS_URL } from './outreachReply.ts';

export interface FollowUpInput {
  slug: string;
  bureau: string;
  contactpersoon: string | null;
  /** 1 = first chase, 2 = last chase. */
  step: 1 | 2;
  /** Confirmed, human clicks on the demo link. Scanner hits are not in here. */
  clicks: number;
  /** The bespoke hook from the seed, the same one that opened the first mail. */
  openingshaak: string | null;
  /** utm_campaign, so the demo link in the chase attributes to the same batch. */
  campaign: string | null;
  /** A test code already went out; do not offer a second one. */
  codeIssued: boolean;
}

const SITE = 'https://cairnly.io';

/** The demo link for this agency, carrying the slug so a click still lands on their row. */
export function demoLink(slug: string, campaign: string | null): string {
  const params = new URLSearchParams({
    p: 'partners',
    persona: 'marcel',
    utm_source: 'outreach',
    utm_medium: 'email',
    utm_campaign: campaign ?? 'bureaus-sep26',
    utm_content: slug,
  });
  return `${SITE}/demo?${params.toString()}`;
}

/**
 * "Mark" from "Mark de Vries", or null when the seed does not hold a usable
 * first name. Initials are a null: the seed is full of entries like
 * "K. Dalm; Clemens van Gemert", and "Beste K." is worse than no name at all.
 */
export function firstName(contactpersoon: string | null): string | null {
  const raw = (contactpersoon ?? '').trim();
  if (!raw) return null;
  const first = raw.split(/[\s,;/&]+/)[0];
  if (!first || first.length < 2) return null;
  if (first.includes('.')) return null; // "K.", "J.W."
  if (!/^[\p{L}'’-]+$/u.test(first)) return null;
  return first;
}

/**
 * The agency as you would say it out loud. "Bureau VolZin B.V." is how the
 * Chamber of Commerce writes it; "Beste team van Bureau VolZin," is how a mail
 * reads. Drops a trailing legal form and a trailing abbreviation in brackets.
 */
export function agencyName(naam: string): string {
  const trimmed = naam
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[\s,]+(b\.?\s?v\.?|n\.?\s?v\.?|v\.?o\.?f\.?)\.?\s*$/i, '')
    .trim();
  return trimmed || naam;
}

/** "Beste Mark," or "Beste team van Bureau VolZin," */
export function salutation(input: Pick<FollowUpInput, 'contactpersoon' | 'bureau'>): string {
  const name = firstName(input.contactpersoon);
  return name ? `Beste ${name},` : `Beste team van ${agencyName(input.bureau)},`;
}

// ─── The approved skeletons ──────────────────────────────────────────────────

/** Chase 1, they opened the demo. */
export function templateClicked(input: FollowUpInput): string {
  const seen = input.clicks > 1
    ? 'Ik zag dat de demo bij jullie een paar keer is bekeken, dus je hebt een indruk kunnen krijgen.'
    : 'Ik zag dat de demo bij jullie is geopend, dus je hebt een indruk kunnen krijgen.';
  const code = input.codeIssued
    ? 'De testcode die ik je stuurde blijft gewoon geldig, ook als je er later pas aan toekomt.'
    : 'Wil je het zelf uitproberen met een eigen casus, dan stuur ik je een gratis testcode, zonder voorwaarden. Eén regel terug is genoeg.';
  return [
    salutation(input),
    '',
    `Korte opvolging op mijn mail van vorige week. ${seen}`,
    '',
    'Mag ik vragen wat je ervan vond? Ook als het niet bij jullie kandidaten past, hoor ik dat graag. Daar heb ik meer aan dan aan een beleefd ja.',
    '',
    code,
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

/** Chase 1, the mail was never opened. Different hook, lower threshold. */
export function templateQuiet(input: FollowUpInput): string {
  return [
    salutation(input),
    '',
    'Korte opvolging op mijn mail van vorige week. Die kan er makkelijk tussendoor zijn geschoten, dus hierbij nog één keer, en dan laat ik het rusten.',
    '',
    'De vraag die erachter zit: doen jullie het loopbaanonderzoek in spoor 2 helemaal zelf, of zou het schelen als een kandidaat al met richting bij de adviseur binnenkomt?',
    '',
    `In twee minuten zie je wat ik bedoel, geen login nodig: ${demoLink(input.slug, input.campaign)}`,
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

/** Chase 2, for either kind. Short, no pressure, door open. */
export function templateLast(input: FollowUpInput): string {
  return [
    salutation(input),
    '',
    'Dit is de laatste keer dat ik je hierover mail, beloofd.',
    '',
    'Als het nu niet uitkomt of niet bij jullie past, is dat helemaal goed. Eén woord terug en ik laat het rusten.',
    '',
    'Mocht je er later toch naar willen kijken: de demo blijft staan en een testcode is gratis.',
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

/**
 * The draft as it looks without the model: correct, a little generic. Used as
 * the skeleton in the prompt, and as the actual draft when Claude is down. A
 * template in the Drafts folder beats no draft at all.
 */
export function renderFollowUp(input: FollowUpInput): string {
  if (input.step === 2) return templateLast(input);
  return input.clicks > 0 ? templateClicked(input) : templateQuiet(input);
}

// ─── The model pass ──────────────────────────────────────────────────────────

export const FOLLOW_UP_SYSTEM_PROMPT = `Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly (cairnly.io). Sjoerd mailde Nederlandse re-integratie- en outplacementbureaus (spoor 2) met een demo en het aanbod van een gratis pilot. Ze hebben niet geantwoord. Jij schrijft de opvolgmail die Sjoerd nakijkt en zelf verstuurt.

Je krijgt een SKELET dat Sjoerd heeft goedgekeurd. Dat skelet is de mail. Jouw werk is klein en precies:
- Neem de zinnen van het skelet letterlijk over, in dezelfde volgorde.
- Je mag ALLEEN de aanhef en de openingszin aanpassen, en alleen als de aanleiding uit het bureau-profiel dat echt beter maakt. Verwerk de openingshaak hooguit in één korte bijzin, nooit als losse alinea.
- Verzin geen nieuwe beloftes, geen prijzen, geen cijfers, geen namen van klanten.
- Laat de slotzin en de ondertekening exact staan.

HUISREGELS: Nederlands, je-vorm, warm maar zakelijk. Maximaal 120 woorden. Stel precies één vraag aan de lezer (een vraagteken in een link telt niet mee). Geen opsommingen, geen onderwerpregel, geen bijlagen. Geen gedachtestreepjes (—) en geen constructies als "niet X, maar Y". Eindig met "Groet," en op de volgende regel "Sjoerd", zonder verdere handtekening.

FEITEN die je mag gebruiken als de mail erom vraagt: Cairnly is 25 tot 40 minuten invullen en levert een top 3 concrete beroepen met matchscore, alternatieven, salarisranges en per beroep een inschatting van wat AI ermee gaat doen. Voor spoor 2 is het voorwerk: de kandidaat komt met richting bij de adviseur binnen in plaats van met een leeg vel. Het rapport draagt het logo van het bureau. Pilot: vijf bureaus, vijf kandidaten per bureau, zes weken, gratis. Werkwijze en prijzen staan op ${PARTNERS_URL}. Een gesprek van 20 minuten plannen kan via ${CALENDLY_URL}.`;

export const FOLLOW_UP_TOOL = {
  name: 'write_follow_up',
  description: 'Return the follow-up mail body, based on the approved skeleton.',
  input_schema: {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        description: 'The Dutch mail body, salutation through signature. No subject line.',
      },
    },
    required: ['body'],
  },
} as const;

export function buildFollowUpMessage(input: FollowUpInput): string {
  const opened = input.clicks > 0
    ? `Ja, ${input.clicks} keer (bevestigde opens, geen scanners)`
    : 'Nee, de demo is nooit geopend';
  return [
    `Bureau: ${input.bureau}`,
    `Contactpersoon: ${input.contactpersoon ?? 'onbekend'}`,
    `Demo bekeken: ${opened}`,
    `Al een gratis testcode gestuurd: ${input.codeIssued ? 'ja' : 'nee'}`,
    `Dit is opvolging ${input.step} van maximaal 2`,
    `Openingshaak uit de eerste mail: ${input.openingshaak ?? 'geen'}`,
    '',
    'SKELET (neem dit over, pas hooguit de aanhef en de openingszin aan):',
    renderFollowUp(input),
  ].join('\n');
}

/** Pull the tool call out of a Messages API response; tolerant of a thinking block first. */
export function parseFollowUp(
  resp: { content?: Array<{ type: string; name?: string; input?: unknown }> },
): string | null {
  const block = resp.content?.find((c) => c.type === 'tool_use' && c.name === FOLLOW_UP_TOOL.name);
  if (!block?.input || typeof block.input !== 'object') return null;
  const body = String((block.input as Record<string, unknown>).body ?? '').trim();
  // A body that lost the signature is a broken generation, not a style choice.
  if (!body || !/Sjoerd\s*$/.test(body)) return null;
  return body;
}
