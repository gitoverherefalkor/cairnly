import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, Mic } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  isSidebarCollapsed?: boolean;
}

const MIN_HEIGHT = 56;
const MAX_HEIGHT = 212; // 8 lines

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  onSend,
  onTypingChange,
  disabled = false,
  placeholder = 'Type here',
  isSidebarCollapsed = false,
}, ref) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input via shared hook
  const { isListening, isSupported: hasSpeechRecognition, toggleListening, stopListening } =
    useSpeechRecognition({
      onTranscript: setText,
      existingText: text,
    });

  // Expose focus method so quick replies can focus the input
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Notify parent when user starts/stops typing (drives quick-reply visibility)
  useEffect(() => {
    onTypingChange?.(text.trim().length > 0);
  }, [text, onTypingChange]);

  // Auto-resize textarea on content change
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    // Auto-stop mic when sending
    if (isListening) {
      stopListening();
    }

    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sidebarWidth = isSidebarCollapsed ? '80px' : '320px';

  return (
    <>
      {/* Inline style to apply symmetric sidebar offset on desktop, so the
          input stays centered on the page (sidebar lives on the left). */}
      <style>{`
        .chat-input-root { left: 0; right: 0; }
        @media (min-width: 768px) {
          .chat-input-root { left: ${sidebarWidth}; right: ${sidebarWidth}; }
        }
      `}</style>
      <div className="chat-input-root fixed bottom-0 z-30">
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
          <div className="max-w-[800px] mx-auto relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 sm:px-5 pr-[88px] sm:pr-[104px] py-3 sm:py-4 text-sm sm:text-[0.9375rem] leading-normal font-sans resize-none overflow-y-hidden shadow-md focus:outline-none focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
            />

            {/* Buttons container — vertically centered against the textarea.
                Tried bottom-anchoring earlier but it visually drifted off-center
                at the default single-line height. Center is the better default. */}
            <div className="absolute right-2 sm:right-3 top-[calc(50%-3px)] -translate-y-1/2 flex items-center gap-1">
              {/* Mic button — only show if browser supports speech recognition */}
              {hasSpeechRecognition && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={disabled}
                  title={isListening ? 'Stop recording' : 'Voice input'}
                  className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-50 animate-mic-pulse'
                      : 'text-gray-400 hover:text-atlas-teal hover:bg-atlas-teal/5'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Mic size={18} className="sm:hidden" />
                  <Mic size={20} className="hidden sm:block" />
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || !text.trim()}
                title="Send message"
                className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-atlas-teal rounded-md text-white transition-all hover:bg-atlas-teal/90 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} className="sm:hidden" />
                <Send size={18} className="hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

ChatInput.displayName = 'ChatInput';
