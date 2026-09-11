// Reply triage for outreach mail: the rules Sjoerd set on 2026-09-11 and the
// Claude call that applies them. Text only; no I/O.
//
// The model reads a bureau's reply and returns (a) what kind of reply it is,
// (b) a one-line summary for the Ops table and (c) a draft answer that lands
// in Gmail as a draft. It never sends. The rules live here in git so a change
// in tone is a code review, not a prompt lost in a workflow.

export const SENTIMENTS = ['positief', 'code', 'vraag', 'later', 'afwijzing', 'auto', 'overig'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const CALENDLY_URL = 'https://calendly.com/sjoerd-bethehitl/new-meeting';
export const PARTNERS_URL = 'https://cairnly.io/partners';
/** Token the code request replaces with the real /p/ link. */
export const CODELINK_TOKEN = '[CODELINK]';

export interface ClassifyInput {
  bureau: string;
  contactpersoon: string | null;
  /** What we last sent them, trimmed. */
  ourLastMail: string | null;
  /** Their reply, quoted history stripped. */
  reply: string;
  replySubject: string;
  /** A test code was already minted for this bureau. */
  codeIssued: boolean;
}

export interface Classification {
  sentiment: Sentiment;
  samenvatting: string;
  concept: string | null;
}

export const SYSTEM_PROMPT = `Je bent de assistent van Sjoerd Geurts, oprichter van Cairnly (cairnly.io), een online loopbaantool. Sjoerd mailt Nederlandse re-integratie- en outplacementbureaus (spoor 2) met een demo en het aanbod van een gratis pilot. Jij leest het antwoord van een bureau, classificeert het en schrijft een conceptantwoord dat Sjoerd zelf nog nakijkt en verstuurt.

FEITEN DIE JE MAG GEBRUIKEN (niets anders verzinnen):
- Cairnly: 25 tot 40 minuten invullen, daarna geen testuitslag maar een top 3 concrete beroepen met matchscore, alternatieven, salarisranges en per beroep een inschatting van wat AI ermee gaat doen. Er is een AI-coach om het rapport te bespreken.
- Voor een spoor 2- of outplacementtraject is Cairnly voorwerk: de kandidaat komt bij de adviseur binnen met richting in plaats van een leeg vel. Het rapport draagt het logo van het bureau; het echte gesprek blijft van het bureau.
- Pilot: we zoeken vijf bureaus, vijf kandidaten per bureau, binnen zes weken, gratis, geen voorwaarden. Sjoerd wil vooral horen wat de adviseurs ervan vinden.
- Werkwijze en prijzen staan op ${PARTNERS_URL}.
- Een testcode is gratis en zonder voorwaarden: een link waarmee iemand zelf (of met een casus van een klant) het hele traject doorloopt.
- Gesprek van 20 minuten inplannen kan via ${CALENDLY_URL}.
- Sjoerd zit in Utrecht.

HUISREGELS VOOR HET CONCEPT:
- Nederlands, je-vorm, warm maar zakelijk. Spreek de afzender aan met de voornaam als die bekend is, anders "Beste" + bureaunaam-team.
- Maximaal 120 woorden. Eén vraag per mail, aan het eind. Geen opsommingen, geen bijlagen, geen onderwerpregel.
- Geen gedachtestreepjes (—) en geen constructies als "niet X, maar Y".
- Sluit af met precies: "Groet,\\nSjoerd" (geen verdere handtekening; die voegt Gmail toe).
- Beloof niets wat niet in de feiten staat. Geen prijzen noemen, verwijs naar ${PARTNERS_URL}.

PER SOORT ANTWOORD:
- positief (interesse, "stuur maar", "laten we praten") en code ("code", "testcode", "mag ik testen"): bedank kort, geef EERST de testcode met de tekst "${CODELINK_TOKEN}" op een eigen regel (dat wordt de link), leg in één zin uit dat ze daarmee zelf of met een casus van een klant het hele traject doorlopen, en stel DAARNA voor om na het proberen 20 minuten te bellen via ${CALENDLY_URL}. Als er al eerder een code is uitgegeven (codeIssued = true): geen nieuwe code aanbieden, verwijs naar de eerder gestuurde link en stel het gesprek voor.
- vraag: beantwoord de vraag uit de feiten (als het antwoord er niet in staat: zeg dat Sjoerd dat in het gesprek toelicht), en sluit af met de 20-minutenvraag.
- later ("nu niet", "na de zomer", "druk"): bevestig vriendelijk, vraag wanneer het wél past.
- afwijzing zonder eerdere code (codeIssued = false): kort bedanken voor de reactie, "jammer", en: mocht je je bedenken, dan sturen we graag een gratis testcode. Deur open, geen druk, geen vraag verplicht.
- afwijzing na een uitgegeven code (codeIssued = true): kort bedanken, vraag in één zin waarom het niet paste, met vier keuzes op één regel: (a) te weinig tijd, (b) past niet bij onze aanpak, (c) prijs, (d) anders. Zeg dat een letter terugmailen genoeg is.
- auto (afwezigheidsbericht, automatisch antwoord, bounce): geen concept (null).
- overig (onduidelijk, doorverwijzing naar een collega, vraag om te bellen zonder meer): kort en neutraal bevestigen dat de mail is ontvangen en wat Sjoerd doet, plus één vraag.

SAMENVATTING: één Nederlandse zin (max 20 woorden) voor in een tabel, bijv. "Monique heeft interesse, wil een testcode." of "Geen interesse, Lydia (directeur)."`;

export const CLASSIFY_TOOL = {
  name: 'classify_reply',
  description: 'Classify the reply from the bureau and write the draft answer.',
  input_schema: {
    type: 'object',
    properties: {
      sentiment: { type: 'string', enum: [...SENTIMENTS] },
      samenvatting: { type: 'string', description: 'One Dutch sentence, max 20 words.' },
      concept: {
        type: ['string', 'null'],
        description: `The draft reply body in Dutch following the house rules, or null for "auto". Use the literal token ${CODELINK_TOKEN} where the test-code link goes.`,
      },
    },
    required: ['sentiment', 'samenvatting', 'concept'],
  },
} as const;

export function buildUserMessage(input: ClassifyInput): string {
  const parts = [
    `Bureau: ${input.bureau}`,
    `Contactpersoon (uit onze lijst): ${input.contactpersoon ?? 'onbekend'}`,
    `Al een testcode uitgegeven (codeIssued): ${input.codeIssued ? 'true' : 'false'}`,
    '',
    'ONZE LAATSTE MAIL AAN HEN (ingekort):',
    input.ourLastMail ?? '(niet bekend)',
    '',
    `HUN ANTWOORD (onderwerp: ${input.replySubject || '-'}):`,
    input.reply || '(leeg)',
  ];
  return parts.join('\n');
}

/** Pull the tool call out of a Messages API response; tolerant of a thinking block first. */
export function parseClassification(resp: { content?: Array<{ type: string; name?: string; input?: unknown }> }): Classification | null {
  const block = resp.content?.find((c) => c.type === 'tool_use' && c.name === CLASSIFY_TOOL.name);
  if (!block || !block.input || typeof block.input !== 'object') return null;
  const i = block.input as Record<string, unknown>;
  const sentiment = String(i.sentiment ?? '');
  if (!(SENTIMENTS as readonly string[]).includes(sentiment)) return null;
  const concept = i.concept == null ? null : String(i.concept).trim() || null;
  return {
    sentiment: sentiment as Sentiment,
    samenvatting: String(i.samenvatting ?? '').trim().slice(0, 200),
    concept: sentiment === 'auto' ? null : concept,
  };
}

/** Status the ladder should move to for a given reply. `code_request` means: mint first. */
export function statusForSentiment(s: Sentiment): 'code_request' | 'gereageerd' | 'afgewezen' | null {
  switch (s) {
    case 'positief':
    case 'code':
      return 'code_request';
    case 'vraag':
    case 'later':
    case 'overig':
      return 'gereageerd';
    case 'afwijzing':
      return 'afgewezen';
    case 'auto':
      return null;
  }
}
