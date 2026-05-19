import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { ChevronDown, MessageSquareText } from 'lucide-react';
import type { SavedChatResponse } from '@/hooks/useSavedChatResponses';

// Coach chat messages can carry light HTML — normalise it to markdown so it
// renders cleanly here (same idea as ExpandedSectionView's htmlToMarkdown).
function toMarkdown(text: string): string {
  return text
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '**$1**\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol|p|div)[^>]*>/gi, '\n')
    .trim();
}

interface SavedFromCoachProps {
  items: SavedChatResponse[];
}

/**
 * Per-section block listing the coach responses the user saved from the chat.
 * Each entry is collapsed to its short label and folds out to the verbatim
 * response. Renders nothing when the section has no saved responses.
 */
export const SavedFromCoach = ({ items }: SavedFromCoachProps) => {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-atlas-teal/20 bg-atlas-teal/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquareText className="w-4 h-4 text-atlas-teal" />
        <h4 className="text-sm font-semibold text-atlas-navy">Saved from your coach</h4>
        <span className="text-xs text-gray-500">({items.length})</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="rounded-md border border-atlas-teal/20 bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-atlas-teal/5 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-atlas-navy">
                  {item.label || 'Saved response'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 text-sm text-gray-700 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {DOMPurify.sanitize(toMarkdown(item.content))}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
