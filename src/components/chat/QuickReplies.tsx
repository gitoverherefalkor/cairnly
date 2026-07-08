import React, { useState, useEffect } from 'react';
import { ThumbsDown, ArrowRight, CheckCircle, Search, Pencil, LayoutDashboard } from 'lucide-react';

// `intent` lets the chat container distinguish between message types that
// look the same in the chat history but mean different things to the
// platform. 'advance' is a clean "Continue to next section" click — the
// fast-path edge function can deliver the next section deterministically
// without invoking the agent. 'wrap_up' is the dream-jobs final click.
// undefined means the click should flow through the agent like a normal
// free-text message (explore-more, see-differently followups).
export type QuickReplyIntent = 'advance' | 'wrap_up';

interface QuickReply {
  label: string;
  mobileLabel: string; // Shorter label for small screens
  message: string; // Text sent as a chat message (empty = focus input instead)
  icon: React.ReactNode;
  variant?: 'default' | 'primary'; // Visual emphasis
  action?: 'navigate-dashboard'; // Special action instead of sending a message
  intent?: QuickReplyIntent; // Routing hint for the chat container
  // When set, focusing the input also sets this as the placeholder so the
  // user knows what kind of feedback we're inviting.
  inputPlaceholder?: string;
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
  // True once the user has opened all dream-job cards. On the final section
  // the wrap-up option is withheld until this is true, so a deep-dive reply
  // (e.g. after "Ask about this role") can't offer "wrap up" before the user
  // has actually seen every dream card.
  wrapUpReady?: boolean;
}

// Standard button set for all sections except the last one.
const STANDARD_REPLIES: QuickReply[] = [
  {
    label: 'Continue to next section',
    mobileLabel: 'Next section',
    message: 'Looks good, let\'s continue to the next section',
    icon: <ArrowRight size={14} />,
    intent: 'advance',
  },
  {
    label: 'I\'d like to explore this more',
    mobileLabel: 'Explore more',
    message: 'I\'d like to explore this section a bit more',
    icon: <Search size={14} />,
  },
  {
    // Focus input + custom placeholder. No bot round-trip needed —
    // user types their actual feedback and the bot responds to that.
    label: 'I see this differently',
    mobileLabel: 'I disagree',
    message: '',
    icon: <ThumbsDown size={14} />,
    inputPlaceholder: 'Tell me how you see it…',
  },
  {
    label: 'Something else',
    mobileLabel: 'Something else',
    message: '',
    icon: <Pencil size={14} />,
    inputPlaceholder: "Let me know what's on your mind…",
  },
];

// Final section (dream jobs) — "next section" becomes "wrap up"
const FINAL_REPLIES: QuickReply[] = [
  {
    label: 'All done, wrap up session',
    mobileLabel: 'Wrap up',
    message: 'Looks good, I\'m all done! Let\'s wrap up the session.',
    icon: <CheckCircle size={14} />,
    variant: 'primary',
    intent: 'wrap_up',
  },
  {
    label: 'I\'d like to explore this more',
    mobileLabel: 'Explore more',
    message: 'I\'d like to explore this section a bit more',
    icon: <Search size={14} />,
  },
  {
    label: 'I see this differently',
    mobileLabel: 'I disagree',
    message: '',
    icon: <ThumbsDown size={14} />,
    inputPlaceholder: 'Tell me how you see it…',
  },
  {
    label: 'Something else',
    mobileLabel: 'Something else',
    message: '',
    icon: <Pencil size={14} />,
    inputPlaceholder: "Let me know what's on your mind…",
  },
];

// Deep-dive replies (after the user asked a follow-up question and the
// bot answered) — only show 'Continue to next section'. The active chat
// input is the second 'option' for free-form follow-ups. Keeping just one
// pill prevents the explore-more / I-see-differently loop.
const MINIMAL_REPLIES: QuickReply[] = [
  {
    label: 'Continue to next section',
    mobileLabel: 'Next section',
    message: 'Looks good, let\'s continue to the next section',
    icon: <ArrowRight size={14} />,
    intent: 'advance',
  },
];

// Post-wrap-up — only option is to leave
const POST_WRAP_REPLIES: QuickReply[] = [
  {
    label: 'Exit to Dashboard',
    mobileLabel: 'Exit to Dashboard',
    message: '',
    icon: <LayoutDashboard size={14} />,
    variant: 'primary',
    action: 'navigate-dashboard',
  },
];

export const QuickReplies: React.FC<QuickRepliesProps> = ({ onSend, onFocusInput, visible, isLastSection = false, isWrappedUp = false, isDeepDive = false, wrapUpReady = false }) => {
  const replies = isWrappedUp
    ? POST_WRAP_REPLIES
    : isLastSection
      // On the final section, only offer "wrap up" once every dream card has
      // been opened. Until then, drop the wrap-up pill so a deep-dive reply
      // can't let the user finish before seeing all cards.
      ? (wrapUpReady ? FINAL_REPLIES : FINAL_REPLIES.filter((r) => r.intent !== 'wrap_up'))
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

  const handleClick = (reply: QuickReply) => {
    if (reply.action === 'navigate-dashboard') {
      window.location.href = '/dashboard';
      return;
    }

    setClicked(true);

    if (reply.message) {
      onSend(reply.message, reply.intent);
    } else {
      // No message → focus the input so user can type freely. If a custom
      // placeholder is configured, pass it through so the chat input shows
      // an inviting prompt ("Tell me how you see it…").
      onFocusInput(reply.inputPlaceholder);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {replies.map((reply) => {
        const isPrimary = reply.variant === 'primary';
        return (
          <button
            key={reply.label}
            onClick={() => handleClick(reply)}
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 px-3.5 py-2.5 sm:py-2 text-sm font-medium rounded-full
              transition-all duration-150 shadow-sm hover:shadow
              ${isPrimary
                ? 'border border-atlas-teal bg-atlas-teal/10 text-atlas-teal hover:bg-atlas-teal hover:text-white active:bg-atlas-teal/90'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-atlas-teal hover:text-atlas-teal hover:bg-atlas-teal/5 active:bg-atlas-teal/10'
              }`}
          >
            {reply.icon}
            <span className="sm:hidden">{reply.mobileLabel}</span>
            <span className="hidden sm:inline">{reply.label}</span>
          </button>
        );
      })}
    </div>
  );
};
