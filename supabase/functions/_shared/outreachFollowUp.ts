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
  /**
   * On how many separate days those clicks fell. The scanner filter only
   * covers the two minutes after sending, and enterprise mail security
   * imitates a real browser, so a single click is weak evidence that a PERSON
   * looked. Clicks spread over two days are not something a scanner produces.
   */
  clickDays: number;
  /** The bespoke hook from the seed, the same one that opened the first mail. */
  openingshaak: string | null;
  /** utm_campaign, so the demo link in the chase attributes to the same batch. */
  campaign: string | null;
  /** A test code already went out; do not offer a second one. */
  codeIssued: boolean;
}

const SITE = 'https://cairnly.io';

/**
 * Brad Gentry's verdict, mailed 16 September 2026 and used with his permission.
 *
 * The Career Anchors sentence is in here on purpose and it is the reason this
 * quote belongs in a mail to Dutch agencies: Schein's model is standard
 * material here, sold and taught as "de loopbaanankers van Schein", so the
 * reader knows exactly what is being ranked below what. The Dutch lead-in
 * carries the 25 years so the English does not have to repeat them, and the
 * ellipsis marks the clause left out of his first sentence.
 *
 * Quoted in English on purpose: a translated testimonial is a sentence he
 * never wrote.
 */
const COACH_QUOTE =
  'Een loopbaancoach met 25 jaar ervaring schreef me dit over Cairnly: "by far the best career tool I have come across... Career Anchors was always my go to process, but this has taken career planning to another level."';

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

/**
 * Chase 1, the demo was opened.
 *
 * The mail only CLAIMS to have seen that when the evidence can carry it. A
 * single confirmed click is not proof a person looked: the scanner filter
 * only rules out the first two minutes after sending, and enterprise mail
 * security spoofs a real browser user agent, so a late scanner hit passes as
 * human. That used to be caught by Sjoerd reading the draft; now that chases
 * send themselves, a wrong claim would go out unread. Clicks on two different
 * days, or more than one click, are beyond what a scanner does.
 *
 * With thin evidence the observation is simply left out. The rest of the mail
 * works fine without it, and a question that does not presume anything is
 * always safe to send.
 */
export function templateClicked(input: FollowUpInput): string {
  const solide = input.clicks > 1 || input.clickDays > 1;
  const seen = !solide
    ? 'Korte opvolging op mijn mail van vorige week.'
    : input.clicks > 1
      ? 'Ik zag dat de demo bij jullie een paar keer is bekeken, dus je hebt een indruk kunnen krijgen.'
      : 'Ik zag dat de demo bij jullie is geopend, dus je hebt een indruk kunnen krijgen.';
  const code = input.codeIssued
    ? 'De testcode die ik je stuurde blijft gewoon geldig, ook als je er later pas aan toekomt.'
    : 'Wil je het zelf uitproberen met een eigen casus, dan stuur ik je een gratis testcode, zonder voorwaarden. Eén regel terug is genoeg.';
  return [
    salutation(input),
    '',
    solide ? `Korte opvolging op mijn mail van vorige week. ${seen}` : seen,
    '',
    COACH_QUOTE,
    '',
    'Mag ik vragen wat je ervan vond? Ook als het niet bij jullie kandidaten past, hoor ik dat graag!',
    '',
    code,
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

/**
 * Chase 1, nobody clicked the demo. Note that this is the only thing we know:
 * clicks are demo-link clicks, there is no open tracking, so a quiet agency
 * may well have read the first mail and shrugged.
 *
 * Two links, because the two objections are different. The demo is the low
 * threshold and stays the main one. The partner page is for the reader whose
 * question is not "what is it" but "what does this cost me and who runs it",
 * and that reader was never going to click a demo first.
 */
export function templateQuiet(input: FollowUpInput): string {
  return [
    salutation(input),
    '',
    'Korte opvolging op mijn mail van vorige week. Die kan er makkelijk tussendoor zijn geschoten, dus hierbij nog één keer, en dan laat ik het rusten.',
    '',
    COACH_QUOTE,
    '',
    'De vraag die erachter zit: doen jullie het loopbaanonderzoek in spoor 2 helemaal zelf, of zou het schelen als een kandidaat al met richting bij de adviseur binnenkomt?',
    '',
    `In twee minuten zie je wat ik bedoel in deze [demo van een sessie](${demoLink(input.slug, input.campaign)}), geen login nodig.`,
    `Werkwijze en tarieven voor bureaus staan op [onze partnerpagina](${PARTNERS_URL}).`,
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

/**
 * Which of those texts renderFollowUp picks, as a name. Stored on the concept
 * and checked again at send time: a chase written as "quiet" must not leave
 * after they clicked, and "clicked" must not become a claim of "seen".
 */
export function chaseVariant(i: Pick<FollowUpInput, 'step' | 'clicks' | 'clickDays'>): string {
  if (i.step === 2) return 'goodbye';
  if (i.clicks === 0) return 'quiet';
  return i.clicks > 1 || i.clickDays > 1 ? 'clicked_seen' : 'clicked';
}

// ─── The model pass ──────────────────────────────────────────────────────────

export const FOLLOW_UP_SYSTEM_PROMPT = `Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly (cairnly.io). Sjoerd mailde Nederlandse re-integratie- en outplacementbureaus (spoor 2) met een demo en het aanbod van een gratis pilot. Ze hebben niet geantwoord. Jij schrijft de opvolgmail die Sjoerd nakijkt en zelf verstuurt.

Je krijgt een SKELET dat Sjoerd heeft goedgekeurd. Dat skelet is de mail. Jouw werk is klein en precies:
- Neem de zinnen van het skelet letterlijk over, in dezelfde volgorde.
- Je mag ALLEEN de aanhef en de openingszin aanpassen, en alleen als de aanleiding uit het bureau-profiel dat echt beter maakt. Verwerk de openingshaak hooguit in één korte bijzin, nooit als losse alinea.
- Verzin geen nieuwe beloftes, geen prijzen, geen cijfers, geen namen van klanten.
- Laat de slotzin en de ondertekening exact staan.
- Links staan in het skelet als [tekst](url). Neem die vorm letterlijk over, inclusief de blokhaken en de haakjes. Verander de linktekst niet, verander de url niet, en maak er geen kale url van.
- Het citaat van de loopbaancoach staat tussen aanhalingstekens en blijft Engels en woordelijk. Niet vertalen, niet inkorten, niet herschrijven.

HUISREGELS: Nederlands, je-vorm, warm maar zakelijk. Maximaal 120 woorden, het citaat van de loopbaancoach niet meegeteld. Stel precies één vraag aan de lezer (een vraagteken in een link telt niet mee). Geen opsommingen, geen onderwerpregel, geen bijlagen. Geen gedachtestreepjes (—) en geen constructies als "niet X, maar Y". Eindig met "Groet," en op de volgende regel "Sjoerd", zonder verdere handtekening.

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
    ? `Ja, ${input.clicks} keer op ${input.clickDays} ${input.clickDays === 1 ? 'dag' : 'dagen'}` +
      (input.clicks > 1 || input.clickDays > 1
        ? ' (solide bewijs dat een mens keek)'
        : ' (\u00e9\u00e9n klik op \u00e9\u00e9n dag: kan nog een scanner zijn, dus NIET beweren dat je het zag)')
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

// ─── The check-in ────────────────────────────────────────────────────────────
//
// A different mail from a chase. The chase goes to someone who never answered;
// the check-in goes to someone who DID answer, with "I'll pass it on" or "we'll
// get back to you", and then went quiet. So it may refer to what they said,
// it goes to the person who replied rather than the seed contact, and it is
// never queued for sending: like every reply, a human reads it first.

export interface CheckInInput {
  slug: string;
  bureau: string;
  /** The person who replied, as far as we can tell. Often not the seed contact. */
  replierName: string | null;
  /** What they wrote, cut to the part they typed. The model reads it for tone and names. */
  theirReply: string | null;
  /** The classifier's one-line summary of that reply. */
  summary: string | null;
  codeIssued: boolean;
}

/**
 * The approved skeleton. One question, no pitch: they already know what
 * Cairnly is, the only thing we do not know is where it landed.
 */
export function templateCheckIn(input: CheckInInput): string {
  const name = firstName(input.replierName);
  const code = input.codeIssued
    ? 'De testcode die ik je stuurde blijft gewoon geldig, ook als jullie er later pas aan toekomen.'
    : 'Willen jullie het eerst zelf proberen met een eigen casus, dan stuur ik graag een gratis testcode, zonder voorwaarden.';
  return [
    name ? `Hoi ${name},` : `Beste team van ${agencyName(input.bureau)},`,
    '',
    'Een tijdje terug gaf je aan dat je mijn vraag over Cairnly intern zou bespreken. Ik ben benieuwd: is het al ter sprake gekomen?',
    '',
    'Geen haast, en als het nu niet speelt hoor ik dat ook graag. Dan weet ik waar ik sta.',
    '',
    code,
    '',
    'Groet,',
    'Sjoerd',
  ].join('\n');
}

export const CHECK_IN_SYSTEM_PROMPT = `Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly (cairnly.io). Sjoerd mailde een Nederlands re-integratie- of outplacementbureau over Cairnly. Iemand van dat bureau antwoordde dat ze erop terug zouden komen (bijvoorbeeld: "ik leg het intern neer, mijn collega's nemen contact op"). Daarna bleef het stil. Jij schrijft een korte, vriendelijke check-in die Sjoerd nakijkt en zelf verstuurt.

Je krijgt een SKELET dat Sjoerd heeft goedgekeurd, plus hun laatste mail. Dat skelet is de mail. Jouw werk is klein en precies:
- Neem de zinnen van het skelet over, in dezelfde volgorde.
- De aanhef: spreek de persoon aan die de laatste mail schreef, met de voornaam waarmee die zelf ondertekende. Is die naam niet duidelijk, laat de aanhef van het skelet staan.
- De eerste zin mag je laten aansluiten op wat zij echt schreven (bijvoorbeeld "met je collega's bespreken" in plaats van "intern bespreken"). Citeer ze niet letterlijk en maak hun toezegging niet groter dan die was.
- Verzin geen nieuwe beloftes, geen prijzen, geen cijfers, geen namen van klanten, en geen nieuwe pitch.
- Laat de slotzin en de ondertekening exact staan.

HUISREGELS: Nederlands, je-vorm, warm maar zakelijk. Maximaal 80 woorden. Stel precies één vraag. Geen opsommingen, geen onderwerpregel, geen bijlagen. Geen gedachtestreepjes (—) en geen constructies als "niet X, maar Y". Eindig met "Groet," en op de volgende regel "Sjoerd", zonder verdere handtekening.`;

export function buildCheckInMessage(input: CheckInInput): string {
  return [
    `Bureau: ${input.bureau}`,
    `Naam van wie antwoordde (uit het afzenderadres, kan leeg zijn): ${input.replierName ?? 'onbekend'}`,
    `Samenvatting van hun antwoord: ${input.summary ?? 'geen'}`,
    `Al een gratis testcode gestuurd: ${input.codeIssued ? 'ja' : 'nee'}`,
    '',
    'HUN LAATSTE MAIL (alleen om op aan te sluiten, niet citeren):',
    input.theirReply ?? '(niet beschikbaar)',
    '',
    'SKELET (neem dit over, pas hooguit de aanhef en de eerste zin aan):',
    templateCheckIn(input),
  ].join('\n');
}
