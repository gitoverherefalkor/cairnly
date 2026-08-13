import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThumbsDown, ArrowRight, CheckCircle, Search, Pencil, LayoutDashboard, SkipForward } from 'lucide-react';

// `intent` lets the chat container distinguish between message types that
// look the same in the chat history but mean different things to the
// platform. 'advance' is a clean "Continue to next section" click — the
// fast-path edge function can deliver the next section deterministically
// without invoking the agent. 'wrap_up' is the dream-jobs final click.
// undefined means the click should flow through the agent like a normal
// free-text message (explore-more, see-differently followups).
// 'skip_stalled' is the escape hatch offered when a section's content never
// arrived — it moves the user past the missing section instead of looping on
// "try Continue again".
export type QuickReplyIntent = 'advance' | 'wrap_up' | 'skip_stalled';

// A pill is defined by its translation key plus its non-textual traits. All
// user-visible text and the message text itself live in chat.json under
// `quickReplies.<key>`, because clicking a pill writes its `message` into the
// transcript AS THE USER'S OWN TURN. Leaving those English meant every Dutch
// session fed the coach a stream of English user turns, which is exactly the
// mixed-language context that makes the model code-switch.
//
// IMPORTANT: the message strings are pattern-matched in three places
// (ChatContainer's advance/wrap-up inference, and wrap-up-extract's
// formulaic-turn filter). Those matchers accept BOTH languages. If you add a
// language here, add its patterns there too, and never remove the English
// ones: historical transcripts are plain text with no language metadata.
interface QuickReplySpec {
  /** i18n key under `quickReplies` AND the React list key. */
  key: string;
  icon: React.ReactNode;
  variant?: 'default' | 'primary'; // Visual emphasis
  action?: 'navigate-dashboard'; // Special action instead of sending a message
  intent?: QuickReplyIntent; // Routing hint for the chat container
  /**
   * Send `quickReplies.<sendsMessageFrom>.message` on click. When absent the
   * pill focuses the input instead, using `quickReplies.<key>.placeholder`.
   */
  sendsMessageFrom?: string;
}

interface QuickRepliesProps {
  onSend: (message: string, intent?: QuickReplyIntent) => void;
  onFocusInput: (placeholder?: string) => void;
  visible: boolean;
  isLastSection?: boolean; // True when on dream jobs (final section)
  isWrappedUp?: boolean; // True after the user has sent the wrap-up message
  // True when the latest bot message is a deep-dive reply (not a fresh
  // section reveal). In that mode we show only 'Continue to next section'
  // — Explore More / I see this differently / Something else would just
  // loop the conversation. Active chat input handles free-form follow-ups.
  isDeepDive?: boolean;
  // True when we've stopped waiting for a section that never arrived. Replaces
  // the normal pills with a single way forward, so the user isn't left tapping
  // Continue against a section that is never going to load.
  isStalled?: boolean;
}

const CONTINUE: QuickReplySpec = {
  key: 'continue',
  icon: <ArrowRight size={14} />,
  intent: 'advance',
  sendsMessageFrom: 'continue',
};

const EXPLORE: QuickReplySpec = {
  key: 'explore',
  icon: <Search size={14} />,
  sendsMessageFrom: 'explore',
};

// Focus input + custom placeholder. No bot round-trip needed — user types
// their actual feedback and the bot responds to that.
const DIFFERENTLY: QuickReplySpec = {
  key: 'differently',
  icon: <ThumbsDown size={14} />,
};

const SOMETHING_ELSE: QuickReplySpec = {
  key: 'somethingElse',
  icon: <Pencil size={14} />,
};

// Standard button set for all sections except the last one.
const STANDARD_REPLIES: QuickReplySpec[] = [CONTINUE, EXPLORE, DIFFERENTLY, SOMETHING_ELSE];

// Final section (dream jobs) — "next section" becomes "wrap up".
// Explore / see-differently / something-else come first; the primary
// "wrap up" sits last so it reads as the deliberate end-of-session action.
const FINAL_REPLIES: QuickReplySpec[] = [
  EXPLORE,
  DIFFERENTLY,
  SOMETHING_ELSE,
  {
    key: 'wrapUp',
    icon: <CheckCircle size={14} />,
    variant: 'primary',
    intent: 'wrap_up',
    sendsMessageFrom: 'wrapUp',
  },
];

// Deep-dive replies (after the user asked a follow-up question and the
// bot answered) — only show 'Continue to next section'. The active chat
// input is the second 'option' for free-form follow-ups. Keeping just one
// pill prevents the explore-more / I-see-differently loop.
const MINIMAL_REPLIES: QuickReplySpec[] = [CONTINUE];

// A section never arrived. Offer the way past it (and keep "try again" for
// the case where the upstream workflow catches up on its own).
const STALLED_REPLIES: QuickReplySpec[] = [
  {
    key: 'skip',
    icon: <SkipForward size={14} />,
    variant: 'primary',
    intent: 'skip_stalled',
    sendsMessageFrom: 'skip',
  },
  {
    // Deliberately sends the same message as Continue: this is a retry of the
    // advance, only the label differs.
    key: 'retry',
    icon: <ArrowRight size={14} />,
    intent: 'advance',
    sendsMessageFrom: 'continue',
  },
];

// Pitfall P2 guard. i18n runs with `useSuspense: false` and loads namespaces
// async, so before the chat namespace arrives `t('a.b.c')` returns the KEY
// STRING, not the text. For a label that is a cosmetic flash that self-corrects
// on the next render. For the strings below it is not: they get SENT, so a
// mistimed click would post "quickReplies.continue.message" into the transcript
// and hand the coach garbage. Passing the English text as i18next's
// `defaultValue` makes that impossible, and keeps the English path working even
// if the namespace never loads at all.
const SENT_TEXT_FALLBACK: Record<string, string> = {
  'quickReplies.continue.message': "Looks good, let's continue to the next section",
  'quickReplies.explore.message': "I'd like to explore this section a bit more",
  'quickReplies.wrapUp.message': "Looks good, I'm all done! Let's wrap up the session.",
  'quickReplies.skip.message': "Let's skip that section and continue",
  'quickReplies.differently.placeholder': 'Tell me how you see it…',
  'quickReplies.somethingElse.placeholder': "Let me know what's on your mind…",
};

// Post-wrap-up — only option is to leave
const POST_WRAP_REPLIES: QuickReplySpec[] = [
  {
    key: 'exitDashboard',
    icon: <LayoutDashboard size={14} />,
    variant: 'primary',
    action: 'navigate-dashboard',
  },
];

export const QuickReplies: React.FC<QuickRepliesProps> = ({ onSend, onFocusInput, visible, isLastSection = false, isWrappedUp = false, isDeepDive = false, isStalled = false }) => {
  const { t } = useTranslation('chat');
  const replies = isWrappedUp
    ? POST_WRAP_REPLIES
    // Checked before everything else: when a section is stuck, none of the
    // normal options (explore, disagree, continue) can do anything useful.
    : isStalled
      ? STALLED_REPLIES
      : isLastSection
        // On the final section the "wrap up" pill is ALWAYS offered, so the
        // session is always closable. It used to be withheld until every dream
        // card had been opened, but that gate never fired for users with a
        // single dream job (the "all cards opened" signal only exists for
        // multi-card deliveries), leaving them with no way to reach the
        // dashboard. Opening your own dream job is expected, not enforced.
        ? FINAL_REPLIES
        : isDeepDive
          ? MINIMAL_REPLIES
          : STANDARD_REPLIES;
  const [show, setShow] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Appear with a slight delay after the bot message renders
  useEffect(() => {
    if (!visible) {
      setShow(false);
      setClicked(false);
      return;
    }

    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!show || clicked) return null;

  const handleClick = (reply: QuickReplySpec) => {
    if (reply.action === 'navigate-dashboard') {
      window.location.href = '/dashboard';
      return;
    }

    setClicked(true);

    if (reply.sendsMessageFrom) {
      const key = `quickReplies.${reply.sendsMessageFrom}.message`;
      onSend(t(key, { defaultValue: SENT_TEXT_FALLBACK[key] ?? '' }), reply.intent);
    } else {
      // No message → focus the input so user can type freely. If a custom
      // placeholder is configured, pass it through so the chat input shows
      // an inviting prompt ("Tell me how you see it…").
      const key = `quickReplies.${reply.key}.placeholder`;
      onFocusInput(t(key, { defaultValue: SENT_TEXT_FALLBACK[key] ?? '' }));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {replies.map((reply) => {
        const isPrimary = reply.variant === 'primary';
        return (
          <button
            key={reply.key}
            onClick={() => handleClick(reply)}
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 px-3.5 py-2.5 sm:py-2 text-sm font-medium rounded-full
              transition-all duration-150 shadow-sm hover:shadow
              ${isPrimary
                ? 'border border-atlas-teal bg-atlas-teal/10 text-atlas-teal hover:bg-atlas-teal hover:text-white active:bg-atlas-teal/90'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-atlas-teal hover:text-atlas-teal hover:bg-atlas-teal/5 active:bg-atlas-teal/10'
              }`}
          >
            {reply.icon}
            <span className="sm:hidden">{t(`quickReplies.${reply.key}.mobile`)}</span>
            <span className="hidden sm:inline">{t(`quickReplies.${reply.key}.label`)}</span>
          </button>
        );
      })}
    </div>
  );
};
