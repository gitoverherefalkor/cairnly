// "Coaching responses you saved" — surfaces the chat responses a user
// bookmarked (the Save button in the coach chat) so they can revisit them
// from the dashboard. Reads from `saved_chat_responses` via
// useSavedChatResponses; renders nothing when the user hasn't saved any.
//
// Rendered once per report chapter ('about-you' and 'career') and placed
// directly under that chapter's report sections, so saved notes sit with the
// content they relate to. Each instance filters to its own chapter and renders
// nothing when that chapter has no saved responses.
//
// Self-contained on purpose: it owns its own light markdown rendering rather
// than importing from DashboardV4 (which renders this component) to avoid a
// circular import.

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Bookmark, ChevronDown, X } from 'lucide-react';
import { useSavedChatResponses } from '@/hooks/useSavedChatResponses';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from './dashboardV2Shared';

// Friendly label for the section a response was saved from. Falls back to a
// generic tag when the section is unknown (null/legacy rows).
const SECTION_LABELS: Record<string, string> = {
  approach: 'Your Approach',
  strengths: 'Your Strengths',
  development: 'Development Areas',
  values: 'Your Values',
  top_career_1: 'Primary Career Match',
  top_career_2: 'Second Career Match',
  top_career_3: 'Third Career Match',
  runner_ups: 'Runner-up Careers',
  outside_box: 'Outside-the-Box',
  dream_jobs: 'Dream-Job Analysis',
  init_summary: 'Overview',
  executive_summary: 'Executive Summary',
};

function sectionLabel(sectionType: string | null): string {
  if (!sectionType) return 'Coaching note';
  return SECTION_LABELS[sectionType] ?? 'Coaching note';
}

// Which report chapter a saved response belongs to. Career responses are the
// career-suggestion section types; everything else (personality sections,
// plus null/unknown as a catch-all) belongs to the "about you" chapter.
type Chapter = 'about-you' | 'career';
const CAREER_SECTION_TYPES = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

function inChapter(sectionType: string | null, chapter: Chapter): boolean {
  const isCareer = sectionType ? CAREER_SECTION_TYPES.has(sectionType) : false;
  return chapter === 'career' ? isCareer : !isCareer;
}

// Minimal HTML → Markdown so saved content (which may contain the <h5>/<strong>
// tags the agent sometimes emits) renders through one ReactMarkdown pipeline.
function htmlToMarkdown(text: string): string {
  return text
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n**$1**\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The stored chat_highlights content bundles three parts: the auto-summary
// bullets, a "Saved Responses" block (the replies the user Kept — already shown
// as their own rows in this card), and an "Also flagged by you" note. For the
// wrap-up-summary row we drop the Saved-Responses block to avoid duplicating
// those rows, keeping the summary bullets + the user's flagged note.
function summaryOnly(content: string): string {
  const savedIdx = content.search(/\n*#{3,5}\s*Saved Responses/i);
  if (savedIdx === -1) return content.trim();
  const before = content.slice(0, savedIdx).trim();
  const flagged = content.match(/\n*#{3,5}\s*Also flagged by you[\s\S]*$/i);
  return (flagged ? `${before}\n\n${flagged[0].trim()}` : before).trim();
}

// Plain-text snippet for the collapsed state: strip HTML + light markdown
// tokens, collapse whitespace, then truncate.
function toSnippet(content: string, max = 150): string {
  const plain = content
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

const MD_COMPONENTS = {
  p: ({ ...props }) => (
    <p
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.82)',
        margin: '0 0 10px 0',
      }}
      {...props}
    />
  ),
  strong: ({ ...props }) => <strong style={{ color: '#fff', fontWeight: 700 }} {...props} />,
  li: ({ ...props }) => (
    <li
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.82)',
        marginBottom: 4,
      }}
      {...props}
    />
  ),
  ul: ({ ...props }) => <ul style={{ margin: '0 0 10px 0', paddingLeft: 20 }} {...props} />,
  ol: ({ ...props }) => <ol style={{ margin: '0 0 10px 0', paddingLeft: 20 }} {...props} />,
};

interface V4SavedResponsesProps {
  reportId: string;
  chapter: Chapter;
  // Raw chat_highlights section content. When present, a "Chat wrap-up summary"
  // row is shown at the top of this card. Only passed to one instance so the
  // conversation-wide summary appears once.
  wrapUpSummary?: string | null;
}

const WRAP_UP_ID = '__wrap_up_summary__';

export const V4SavedResponses: React.FC<V4SavedResponsesProps> = ({
  reportId,
  chapter,
  wrapUpSummary = null,
}) => {
  const { savedResponses, removeSavedResponse } = useSavedChatResponses(reportId);
  const [openId, setOpenId] = useState<string | null>(null);

  const saved = savedResponses.filter((r) => inChapter(r.section_type, chapter));

  const summaryContent = wrapUpSummary?.trim() ? summaryOnly(wrapUpSummary) : '';
  // Combined rows: the conversation-wide wrap-up summary first (when present),
  // then the individually-kept replies for this chapter.
  const items = [
    ...(summaryContent
      ? [{ id: WRAP_UP_ID, section_type: null, content: summaryContent }]
      : []),
    ...saved,
  ];

  // Nothing to show in this chapter → render nothing (no empty placeholder).
  if (items.length === 0) return null;

  return (
    <section style={{ marginTop: 16, marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h4
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 19,
            letterSpacing: '-0.015em',
            color: '#fff',
            margin: 0,
          }}
        >
          Coaching responses you saved
        </h4>
      </div>

      <div
        style={{
          background: 'rgba(18, 46, 59, 0.62)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
        }}
      >
        {items.map((item, i) => {
          const isOpen = openId === item.id;
          const isLast = i === items.length - 1;
          const isSummary = item.id === WRAP_UP_ID;
          return (
            <div
              key={item.id}
              style={{
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 24px' }}>
                <Bookmark
                  size={16}
                  color={PALETTE.teal}
                  fill={PALETTE.teal}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />

                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: PALETTE.goldBright,
                      marginBottom: 6,
                    }}
                  >
                    {isSummary ? 'Chat wrap-up summary' : sectionLabel(item.section_type)}
                  </div>
                  {!isOpen && (
                    <div
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {toSnippet(item.content)}
                    </div>
                  )}
                  {isOpen && (
                    <div style={{ marginTop: 4 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                        {DOMPurify.sanitize(htmlToMarkdown(item.content))}
                      </ReactMarkdown>
                    </div>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.55)',
                      padding: 4,
                      display: 'inline-flex',
                      transition: 'transform 200ms ease',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <ChevronDown size={18} />
                  </button>
                  {/* The wrap-up summary is a report section, not a removable
                      saved reply — no delete affordance for it. */}
                  {!isSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isOpen) setOpenId(null);
                        removeSavedResponse(item.id);
                      }}
                      aria-label="Remove from saved"
                      title="Remove from saved"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.45)',
                        padding: 4,
                        display: 'inline-flex',
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
