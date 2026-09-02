import type { QuickReplyIntent } from './QuickReplies';

/**
 * Infer 'advance' / 'wrap_up' intent from free text that mirrors what a
 * QuickReply button would have sent.
 *
 * Without this, a user who TYPES "let's continue to the next section" instead
 * of clicking the pill gets routed through the slow agent path; the agent then
 * replies "click the Continue to next section button below", which the user
 * answers with the same phrase, locking the chat in a loop.
 *
 * It also catches the pill clicks themselves, because a click posts its
 * message as an ordinary user turn.
 *
 * ## Two rules that must not be broken
 *
 * 1. **Patterns are additive across languages, never substituted.** Chat
 *    transcripts are stored as plain text with no language metadata, so an
 *    English pattern removed today silently breaks every historical session.
 * 2. **Wrap-up is evaluated before advance.** The Dutch wrap-up message
 *    contains "ik ben klaar", and the Dutch kickoff contains "ik ben er klaar
 *    voor". Those are distinct strings, which `quickReplyIntent.test.ts`
 *    asserts, because getting it wrong would end the session the moment a
 *    Dutch user clicks "I'm ready".
 *
 * Keep in sync with `quickReplies` in public/locales/&#42;/chat.json.
 */
export function inferQuickReplyIntent(message: string): QuickReplyIntent | undefined {
  const lower = message.trim().toLowerCase().replace(/[!.,?]+$/, '');
  // Comma-insensitive form so "yes, let's go" matches "yes let's go".
  const normalized = lower.replace(/,/g, '');

  const looksLikeAdvance =
    lower.includes('continue to the next section') ||
    lower.includes('continue to next section') ||
    lower === 'next section' ||
    lower === 'continue' ||
    lower === 'next' ||
    lower === "let's continue" ||
    lower === 'lets continue' ||
    // Typed post-discussion confirmations. Sessions showed users type these
    // instead of clicking the Continue pill; without matching them the advance
    // routes as free text and the background WF6 (fb_unified) capture never
    // fires, so the section discussion is lost. Limited to unambiguous "move
    // on" phrasings — bare "yes"/"ok" stay with the agent, which has the
    // conversation context to judge them.
    normalized === "let's move on" ||
    normalized === 'lets move on' ||
    normalized === "yes let's move on" ||
    normalized === 'yes lets move on' ||
    normalized === "yes let's go" ||
    normalized === 'yes lets go' ||
    normalized === "yes let's continue" ||
    normalized === 'yes lets continue' ||
    normalized === 'ready for the next' ||
    normalized === 'ready for the next one' ||
    // Kickoff: clicking "I'm Ready!" auto-sends this exact phrase. Treating it
    // as an advance makes the platform deliver the first section (approach)
    // straight away instead of routing to the agent.
    lower === "i'm ready, let's begin" ||
    lower === 'im ready, lets begin' ||
    // Dutch equivalents.
    lower.includes('door naar de volgende sectie') ||
    lower === 'volgende sectie' ||
    lower === 'doorgaan' ||
    lower === 'verder' ||
    // Typed escapes seen in real sessions — e.g. a user stuck in the
    // "Ask about this role" scoping types one of these to move on. Matching
    // them advances cleanly AND skips the [About <role>] prefix.
    lower === 'ga maar door' ||
    lower === 'ga door' ||
    lower === 'ga verder' ||
    normalized === 'ja laten we doorgaan' ||
    normalized === 'laten we doorgaan' ||
    normalized === 'laten we verder gaan' ||
    lower === 'ik ben er klaar voor, laten we beginnen';

  const looksLikeWrapUp =
    lower.includes('wrap up the session') ||
    lower.includes('all done, wrap up') ||
    lower.includes("i'm all done") ||
    lower === 'wrap up' ||
    // Dutch equivalents.
    lower.includes('de sessie afronden') ||
    lower.includes('ik ben klaar') ||
    lower === 'afronden';

  if (looksLikeWrapUp) return 'wrap_up';
  if (looksLikeAdvance) return 'advance';
  return undefined;
}
