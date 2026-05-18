import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Square, Settings2, Loader2, Bookmark } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';

interface MessageVoiceButtonProps {
  messageId: string;
  text: string;
  // Bookmark state for the parent's "save this verbatim to dashboard"
  // mechanic. Optional so messages outside the saveable set (e.g.
  // welcome card, historical bubbles where the feature wasn't enabled)
  // simply don't get the icon.
  bookmarkable?: boolean;
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
}

export const MessageVoiceButton: React.FC<MessageVoiceButtonProps> = ({
  messageId,
  text,
  bookmarkable = false,
  bookmarked = false,
  onBookmarkToggle,
}) => {
  const {
    isSupported,
    speakingId,
    loadingId,
    speak,
    stop,
    readAll,
    setReadAll,
  } = useTTS();

  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!isSupported) return null;

  const isThisSpeaking = speakingId === messageId;
  const isThisLoading = loadingId === messageId;
  const isActive = isThisSpeaking || isThisLoading;

  const handleToggle = () => {
    if (isActive) {
      stop();
    } else {
      speak(text, messageId);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs"
    >
      <button
        type="button"
        onClick={handleToggle}
        title={isActive ? 'Stop' : 'Read aloud'}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
          isActive
            ? 'bg-atlas-teal/10 text-atlas-teal'
            : 'text-gray-500 hover:text-atlas-teal hover:bg-atlas-teal/5'
        }`}
      >
        {isThisLoading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isThisSpeaking ? (
          <Square size={13} fill="currentColor" />
        ) : (
          <Volume2 size={14} />
        )}
        <span className="font-medium">
          {isThisLoading ? 'Loading…' : isThisSpeaking ? 'Stop' : 'Read aloud'}
        </span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          title="Voice settings"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-400 hover:text-atlas-teal hover:bg-atlas-teal/5 transition-colors"
        >
          <Settings2 size={13} />
          <span>Settings</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-20">
            <button
              type="button"
              onClick={() => setReadAll(!readAll)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-left"
            >
              <span className="text-sm text-atlas-navy">
                Read all new responses
              </span>
              <span
                className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors ${
                  readAll ? 'bg-atlas-teal' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                    readAll ? 'translate-x-[14px]' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        )}
      </div>

      {bookmarkable && onBookmarkToggle && (
        <button
          type="button"
          onClick={onBookmarkToggle}
          title={
            bookmarked
              ? 'Saved to your report — click to unsave'
              : 'Save this response to your report'
          }
          aria-pressed={bookmarked}
          className={`ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            bookmarked
              ? 'bg-atlas-teal/10 text-atlas-teal'
              : 'text-gray-500 hover:text-atlas-teal hover:bg-atlas-teal/5'
          }`}
        >
          <Bookmark size={13} fill={bookmarked ? 'currentColor' : 'none'} />
          <span className="font-medium">{bookmarked ? 'Saved' : 'Save'}</span>
        </button>
      )}
    </div>
  );
};
