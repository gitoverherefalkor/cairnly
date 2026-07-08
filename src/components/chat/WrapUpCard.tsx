import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Check, AlertCircle, LayoutDashboard } from 'lucide-react';
import { useWrapUp } from '@/hooks/useWrapUp';
import { useToast } from '@/hooks/use-toast';

// WrapUpCard — closure ritual at the end of the chat.
//
// When the user clicks "All done, wrap up session", we don't route to the
// agent. Instead this card renders inline in the chat. It calls
// wrap-up-extract to distill the conversation into "Discussion Highlights"
// (4-8 bullets), shows them for the user to review, gives them a free-text
// "anything else you want flagged?" safety net, and on Save & Close
// commits the row via wrap-up-save and locks the chat.
//
// The card is its own message in the chat flow — not a modal — so it
// feels like the natural end of the conversation rather than an
// interruption.

interface SavedResponse {
  content: string;
  saved_at?: string | null;
}

interface WrapUpCardProps {
  reportId: string;
  // Called once the user has saved (or skipped) so the parent can lock
  // the chat input + show the post-wrap quick replies.
  onCompleted: () => void;
  // Bot replies the user bookmarked inline via the message-footer
  // "Save" pill. Sent verbatim to wrap-up-save and appended to the
  // chat_highlights row under a "Saved Responses" subsection.
  savedResponses?: SavedResponse[];
}

type Phase = 'loading' | 'review' | 'saving' | 'saved' | 'error';

const markdownComponents = {
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="space-y-2 list-none pl-0" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li
      className="relative pl-5 text-[0.9375rem] leading-relaxed text-gray-700 before:content-['•'] before:absolute before:left-0 before:text-atlas-teal before:font-bold"
      {...props}
    >
      {children}
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-atlas-navy" {...props}>
      {children}
    </strong>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-[0.9375rem] leading-relaxed text-gray-700 mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),
};

export const WrapUpCard: React.FC<WrapUpCardProps> = ({ reportId, onCompleted, savedResponses = [] }) => {
  const { extractHighlights, saveHighlights } = useWrapUp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [highlights, setHighlights] = useState<string>('');
  const [addendum, setAddendum] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fire the extract on mount. If it fails, the user can retry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await extractHighlights(reportId);
        if (cancelled) return;
        setHighlights(result);
        setPhase('review');
      } catch (err) {
        if (cancelled) return;
        console.error('[WrapUpCard] extract failed:', err);
        setErrorMsg('Could not generate highlights. You can still save with just your own notes below, or try again.');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const retryExtract = async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const result = await extractHighlights(reportId);
      setHighlights(result);
      setPhase('review');
    } catch (err) {
      console.error('[WrapUpCard] retry failed:', err);
      setErrorMsg('Still no luck. You can save with just your own notes below.');
      setPhase('error');
    }
  };

  const handleSave = async () => {
    // If the extract failed, save with addendum-only content. Otherwise
    // use the extracted highlights plus optional addendum.
    const body = highlights.trim() || (addendum.trim()
      ? '_(No highlights extracted — see your notes below.)_'
      : '');
    if (!body && !addendum.trim()) {
      toast({
        title: 'Nothing to save',
        description: 'Add a note below or try regenerating the highlights.',
        variant: 'destructive',
      });
      return;
    }

    setPhase('saving');
    try {
      await saveHighlights(
        reportId,
        body,
        addendum.trim() || null,
        savedResponses,
      );
      setPhase('saved');
      toast({
        title: 'Saved',
        description: 'Your discussion highlights are now part of your report.',
      });
      // Send the user straight to the dashboard. They already clicked
      // Save & Close — making them click another "Open Dashboard" pill is
      // pure friction. The Career Signature, Career Map and Personality
      // Radar all live on the dashboard, so that's where the reward is.
      // The QuickReplies "Exit to Dashboard" pill remains as a fallback
      // for users who refresh the chat after wrap-up has already
      // completed (since WrapUpCard is transient, not persisted in chat
      // history).
      onCompleted();
      navigate('/dashboard', { state: { fromChat: true } });
    } catch (err) {
      console.error('[WrapUpCard] save failed:', err);
      toast({
        title: 'Save failed',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      setPhase('review');
    }
  };

  return (
    <>
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] bg-white border border-atlas-teal/30 rounded-2xl overflow-hidden shadow-sm">
        {/* Tinted header */}
        <div className="bg-atlas-teal/5 px-4 py-3.5 border-b border-atlas-teal/15">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-atlas-teal" />
            <span className="text-xs font-semibold text-atlas-teal uppercase tracking-wider">
              Wrapping up
            </span>
          </div>
          <h3 className="text-base font-bold text-atlas-navy font-heading">
            Here's what we captured from our conversation
          </h3>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            Your conversation won't be saved word-for-word. These highlights
            {savedResponses.length > 0
              ? `, plus the ${savedResponses.length} ${savedResponses.length === 1 ? 'reply' : 'replies'} you kept,`
              : ''}{' '}
            are saved to your report when you hit <strong>Save &amp; Close</strong>{' '}
            below. Want a specific reply preserved in full? Click{' '}
            <strong>Keep</strong> on it before closing.
          </p>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {phase === 'loading' && (
            <div className="flex items-center gap-2.5 py-2">
              <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
                <span className="block w-[3px] bg-atlas-teal rounded-sm h-1.5 animate-bar-pulse" />
                <span className="block w-[3px] bg-atlas-teal rounded-sm h-2.5 animate-bar-pulse [animation-delay:0.15s]" />
                <span className="block w-[3px] bg-atlas-teal rounded-sm h-3.5 animate-bar-pulse [animation-delay:0.3s]" />
                <span className="block w-[3px] bg-atlas-teal rounded-sm h-2 animate-bar-pulse [animation-delay:0.45s]" />
              </div>
              <span className="text-[0.8125rem] text-gray-500 italic">
                Reviewing the conversation
              </span>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex gap-2 items-start text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                <button
                  type="button"
                  onClick={retryExtract}
                  className="mt-1.5 text-xs font-semibold text-atlas-teal hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'saving' || phase === 'saved') && highlights && (
            <div className="mb-4">
              {/* Subtle subtitle so the bullet list doesn't begin abruptly
                  right after the descriptive paragraph above. */}
              <p className="text-xs font-semibold text-atlas-teal uppercase tracking-wider mb-2">
                Specific strategies from our conversation
              </p>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {highlights}
              </ReactMarkdown>
            </div>
          )}

          {/* Last-chance input — always visible, even on error.
              Copy avoids the word "question" because nothing answers
              this in chat: it's a one-way note that lands in the
              report alongside the highlights. The helper text below
              the textarea makes that explicit so users don't expect
              a reply. */}
          {phase !== 'saved' && (
            <div className="mt-2">
              <label
                htmlFor="wrap-up-addendum"
                className="block text-sm font-semibold text-atlas-navy mb-1.5"
              >
                Anything else you want flagged?
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  Optional
                </span>
              </label>
              <textarea
                id="wrap-up-addendum"
                value={addendum}
                onChange={(e) => setAddendum(e.target.value)}
                placeholder="A specific takeaway, a note for future-you, or anything we didn't capture..."
                rows={3}
                disabled={phase === 'saving'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-atlas-teal focus:ring-1 focus:ring-atlas-teal outline-none resize-none disabled:opacity-60"
                maxLength={4000}
              />
              <p className="mt-1.5 text-xs text-gray-500 leading-snug">
                This is a one-way note that gets saved with your report.
                It won't be answered here, the chat closes after Save.
              </p>
            </div>
          )}

          {/* Footer actions. The teaser to the left of the button hints
              at what's waiting on the dashboard — pulls the user through
              the close ritual instead of leaving the click feeling
              administrative. */}
          {phase !== 'saved' && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-atlas-teal italic">
                Save to unlock your dashboard.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={phase === 'loading' || phase === 'saving'}
                className="ask-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-atlas-teal text-atlas-teal text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'saving' ? (
                  <>Saving…</>
                ) : (
                  <>
                    <Check size={14} />
                    Save &amp; Close
                  </>
                )}
              </button>
            </div>
          )}

          {phase === 'saved' && (
            <div className="flex gap-2 items-center text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>
                Saved to your report. Take a moment with your Career
                Signature below, then exit to your dashboard.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Career Signature is rendered BELOW the wrap-up card (outside this
          flex row) so it gets full message-width instead of being squeezed
          into the leftover horizontal space. See the Fragment below. */}
    </div>

    {/* Post-save state intentionally unmounts immediately — handleSave
        navigates to /dashboard the moment the save succeeds. The 'saved'
        confirmation banner inside the card flashes briefly during the
        navigation but the user lands on the dashboard within ~100ms.
        The QuickReplies "Exit to Dashboard" pill outside this card is
        the persistent fallback for refresh / re-entry after the wrap-up
        has already completed. */}
    </>
  );
};
