// The homepage hero's mini replay: a short excerpt of each persona's real
// coaching session, played bubble by bubble in the faux browser window.
//
// The ids point at chat_messages rows in src/demo/fixtures/<persona>.json;
// the text comes from the same fixture (and translation sidecar) the /demo
// replay uses, so the hero can never drift from the demo. Picked by hand on
// 2026-09-03 for a moment where the visitor pushes back and the coach holds
// the line; heroReplay.test.ts guards that every id still exists after a
// re-freeze.
import type { DemoPersonaId } from './loadFixture';

export const HERO_REPLAY: Record<DemoPersonaId, string[]> = {
  emma: [
    'fb789360-a463-4084-8e83-10d2d932552c', // "the scope without storytelling authority line is uncomfortably accurate"
    '147e5928-f110-4995-847f-902ac5953fa7', // coach: obvious in hindsight, invisible while living it
    '7df25995-f7d2-40bd-aa96-a1b7897ede0e', // the AI angle: the tools write a serviceable launch email now
    '3c731878-bb33-4987-bc37-ee4bda6c88dc', // coach: AI generates the artifact, cannot sit in the room and notice
    'f402c2e4-bd80-4d55-9f09-c2a8e47e2774', // "the late scramble isn't me"
    '0586dfa8-8950-4b43-894e-f22c9d713de1', // coach: an important distinction, opposite places
  ],
  marcel: [
    '9d835698-ec7b-4d09-b687-1382b17908a9', // "die zin over de afstand ... komt wel even binnen"
    '4185cb2e-07c8-4007-86b5-f163f983c0ce', // coach: op papier een stap hoger
    'c2332dbd-6048-4ee7-b1ff-09fd78f56b79', // informele loopbaancoaching die collega's al bij je zoeken
    '6ab8b532-bcff-4f02-aefc-f6d40e76526b', // coach: dat detail is veelzeggend
    '8f02d60d-d935-4bde-a144-98b5ac7949a4', // "confrontatie vermijden vind ik te groot klinken"
    'd8863a4c-777c-4113-a094-0b8abd399c6f', // coach: kiezen wanneer is een strategie
  ],
};

/**
 * The first paragraph of a chat message as plain text, cut on a word
 * boundary at `max` characters. Section deliveries open with a sentence and
 * then a markdown body; the hero only ever shows the sentence.
 */
export function excerptText(content: string, max = 220): string {
  const firstBlock = content.replace(/\r/g, '').trim().split(/\n\s*\n/)[0] ?? '';
  const text = firstBlock
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-{3,}\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  const kept = at > max * 0.6 ? cut.slice(0, at) : cut;
  return `${kept.replace(/[,;:]$/, '')}…`;
}
