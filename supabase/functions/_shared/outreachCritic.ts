// The second reader: does this mail read like a person wrote it?
//
// The validator (outreachValidate.ts) checks what a machine can check. This
// checks what it cannot: whether the personal sentences read naturally, hang
// together logically, stay true to the research note, and avoid the tells
// that make a mail feel generated. It exists because on 2026-09-24 the first
// prepared chases contained sentences like "Ik zag dat de demo ... is bekeken,
// gezien jullie assessment prominent in het dienstenmenu voert ..., dus je
// hebt een indruk kunnen krijgen": grammatical, validator-proof, and plainly
// written by a machine.
//
// A different, stronger model than the writer, told only to be a sceptical
// Dutch agency owner. Its verdict decides auto-approve: 'krom' never goes out
// by itself. Sjoerd sees the verdict and the reasons on the card in /ops, and
// the cockpit tracks how often the critic and Sjoerd agree before he trusts
// it with auto-approve.

import { claudeToolCall, CRITIC_MODEL } from './outreachClaude.ts';

export type Verdict = 'goed' | 'krom';

export interface Critique {
  verdict: Verdict;
  /** Short Dutch reasons, at most three. Empty when goed. */
  reasons: string[];
  /** The one sentence that gave it away, verbatim, when krom. */
  zin: string | null;
}

/** What is stored on the concept as `beoordeling`. 'template' = no model text in it at all. */
export interface Beoordeling {
  verdict: Verdict | 'template' | 'onbekend';
  reasons: string[];
  zin?: string | null;
  rounds?: number;
  model?: string;
}

export const TEMPLATE_BEOORDELING: Beoordeling = { verdict: 'template', reasons: [] };

/** Auto-approve may only pass mail the critic called good, or pure template text. */
export function mayAutoApprove(b: Beoordeling | null | undefined): boolean {
  return b?.verdict === 'goed' || b?.verdict === 'template';
}

export const CRITIC_SYSTEM_PROMPT = `Je bent eigenaar van een Nederlands re-integratie- of outplacementbureau. Je krijgt een mail van een onbekende ondernemer. Je leest kritisch, zoals iemand die elke week tientallen van zulke mails krijgt en een automatische mail van een kilometer afstand herkent.

De mail bestaat uit vaste tekst die de afzender zelf schreef, plus een of twee PERSOONLIJKE ZINNEN die per bureau verschillen. Die persoonlijke zinnen beoordeel je streng; de rest lees je alleen om te zien of het geheel loopt.

Keur de mail af ('krom') als een van deze dingen waar is:
1. Een persoonlijke zin leest niet als iets wat een mens zou typen: te lang, feiten opgestapeld, stijf of plechtig, een compliment, een marketingtoon.
2. De logica klopt niet: een verbindingswoord ("gezien", "dus", "daarom", "waardoor", "met jullie ... kan") legt een verband dat er niet is.
3. Een bewering over het BUREAU zelf (hun team, aanpak, cijfers, wat zij schreven) staat niet in de ONDERZOEKSNOTITIE, of is groter gemaakt dan daar staat. Feiten over Cairnly zelf controleer je niet; die komen van de afzender.
4. Er zitten typische AI-tekens in: woorden als "prominent", "naadloos", "cruciaal", "uniek", "waardevol", "landschap"; drie dingen op een rij; een zin die alleen bestaat om te laten zien dat er onderzoek is gedaan.
5. De persoonlijke zin sluit niet aan op de zin ervoor of erna.

Twijfel je, keur dan af: een mail zonder persoonlijke zin is altijd beter dan een mail met een kromme.

Zo klinken GOEDE persoonlijke zinnen (door de afzender zelf geschreven):
- "Ik zag dat jullie bewust landelijk werken met een klein team van negen, met een 8,5 van cliënten en een 8,7 van opdrachtgevers."
- "Ik zag dat jullie met tien coaches landelijk werken en een 9,0 scoren op zowel re-integratie als outplacement."
- "Bij een klein team scheelt dat vooral voorbereidingstijd per kandidaat."

Zo klinken KROMME (afgekeurd):
- "Ik zag dat de demo bij jullie een paar keer is bekeken, gezien jullie assessment prominent in het dienstenmenu voert naast individueel en collectief outplacement, dus je hebt een indruk kunnen krijgen." (verband klopt niet, feiten opgestapeld, "prominent")
- "Korte opvolging op mijn mail van vorige week, met jullie focus door heel Nederland op tweedespoor- en outplacementtrajecten kan die er makkelijk tussendoor zijn geschoten." (hun focus is geen reden dat een mail wegraakt)

Geef je oordeel via de tool judge_mail.`;

export const CRITIC_TOOL = {
  name: 'judge_mail',
  description: 'Give the verdict on the mail.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['goed', 'krom'] },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        description: 'At most three short Dutch reasons; empty when goed.',
      },
      zin: { type: ['string', 'null'], description: 'The worst sentence, verbatim, when krom; else null.' },
    },
    required: ['verdict', 'reasons', 'zin'],
  },
} as const;

export interface CriticInput {
  bureau: string;
  body: string;
  /** The sentences that differ per agency; the critic judges these hardest. */
  personal: string[];
  /** The research note the personal sentences were built from. */
  notitie: string | null;
}

export function buildCriticMessage(i: CriticInput): string {
  return [
    `Bureau: ${i.bureau}`,
    `ONDERZOEKSNOTITIE: ${i.notitie ?? '(geen)'}`,
    '',
    'PERSOONLIJKE ZINNEN:',
    ...(i.personal.length ? i.personal.map((p) => `- ${p}`) : ['- (geen: deze mail heeft geen persoonlijke zinnen, beoordeel het geheel)']),
    '',
    'DE HELE MAIL:',
    i.body,
  ].join('\n');
}

export function parseCritique(resp: { content?: Array<{ type: string; name?: string; input?: unknown }> }): Critique | null {
  const block = resp.content?.find((c) => c.type === 'tool_use' && c.name === CRITIC_TOOL.name);
  if (!block?.input || typeof block.input !== 'object') return null;
  const i = block.input as Record<string, unknown>;
  const verdict = i.verdict === 'goed' || i.verdict === 'krom' ? i.verdict : null;
  if (!verdict) return null;
  const reasons = Array.isArray(i.reasons) ? i.reasons.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 3) : [];
  const zin = typeof i.zin === 'string' && i.zin.trim() ? i.zin.trim() : null;
  return { verdict, reasons: verdict === 'goed' ? [] : reasons, zin: verdict === 'goed' ? null : zin };
}

/** One critic call. Null when the model is unavailable or answered off-pattern. */
export async function critique(input: CriticInput): Promise<Critique | null> {
  try {
    const resp = await claudeToolCall(CRITIC_SYSTEM_PROMPT, buildCriticMessage(input), CRITIC_TOOL, 1500, CRITIC_MODEL);
    return parseCritique(resp);
  } catch (e) {
    console.error('[critic] unavailable', e);
    return null;
  }
}
