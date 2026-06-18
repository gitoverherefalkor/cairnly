import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { ChevronDown, MessageCircle, Pencil, RotateCw, Route } from 'lucide-react';
import { ALL_SECTIONS } from './ReportSidebar';
import type { ReportSection } from '@/hooks/useReportSections';
import {
  CareerScoreCard,
  extractAIImpact,
  extractFeasibility,
  AIImpactBadge,
  leadingAIImpactLevel,
} from './CareerScoreCard';
import { iconForSubsection } from './subsectionIcons';
import { MessageVoiceButton } from './MessageVoiceButton';
import { CareerComparisonCard } from './CareerComparisonCard';
import { useTTS } from '@/contexts/TTSContext';

interface ChatMessageProps {
  // Stable id for the message — used to drive TTS state (which message is
  // currently speaking) so per-message buttons don't get out of sync.
  messageId?: string;
  content: string;
  sender: 'user' | 'bot';
  onSectionDetected?: (sectionIndex: number) => void;
  onAllBlocksOpened?: () => void;
  defaultAllCollapsed?: boolean;
  // Career sections from the user's report. Used to lookup match scores
  // for headings that appear inside this message.
  sections?: ReportSection[];
  // True only for the most recent bot message. When true, big section-reveal
  // messages (multiple ## sub-headers) get a sequential reveal pattern
  // instead of dumping all the text at once. Historical messages render flat.
  isLatestBotMessage?: boolean;
  // Used by 'follow-up with options' messages — clicking an option chip
  // sends it back as a user message (or focuses input for free-text).
  onChipSend?: (message: string) => void;
  onChipFocusInput?: (placeholder?: string) => void;
  // Forwarded to SequentialSubsections so the parent can lock the chat
  // input + quick replies until all sub-sections have been revealed.
  onSequentialRevealStateChange?: (revealed: number, total: number) => void;
  // Click handler for the per-card "Ask about this role" button in
  // CollapsibleCareerBlocks. The chat container scopes the next user
  // message to the named role.
  onAskAboutRole?: (roleTitle: string) => void;
  // True when this user message's agent call failed. ChatMessage renders
  // a small retry icon to the right of the bubble that calls onRetry.
  // Bot messages ignore both fields.
  failed?: boolean;
  onRetry?: (messageId: string) => void;
  // Bookmark mechanic: bot messages within the saveable window get a
  // "Save" button in the footer. Marked messages are appended verbatim
  // to the chat_highlights row at wrap-up time. State lives in the
  // ChatContainer (with localStorage persistence) so refreshes don't
  // drop the user's selections.
  bookmarkable?: boolean;
  bookmarked?: boolean;
  onBookmarkToggle?: (messageId: string) => void;
  // True for report sections delivered from Supabase (already in the report).
  // Disables the Save button and shows an "In report" explainer instead.
  alreadyInReport?: boolean;
  // Thumbs-up "I'm impressed" feedback, stored in content_feedback to learn
  // from. State lives in ChatContainer (loaded from + written to the DB).
  liked?: boolean;
  onLikeToggle?: (messageId: string, text: string) => void;
  // Posts the pre-written comparison explanation into the chat as a bot
  // message. Supplied by ChatContainer; only used by Career 2/3 messages.
  onComparisonExplain?: (content: string) => void;
}

interface ChipOption {
  display: string;  // What's shown in the chip
  message: string;  // What's sent if the chip is clicked
  isFreeText: boolean; // true → focus input instead of sending
}

// Detect if a bot message is a 'follow-up with options' — i.e. an intro
// line + a bullet list of bold-leading items. These appear when the user
// clicks 'Explore more' or 'I see this differently' and the bot offers
// specific topics to dig into. We render the bullets as clickable chips
// (Claude-style multiple choice) instead of a plain bullet list, so the
// user can click to drill in (or use the 'Something else' chip / type
// freely) without facing the same generic Quick Replies again.
function detectFollowUpOptions(markdown: string): {
  intro: string;
  options: ChipOption[];
} | null {
  // Section reveals always have a ### title — those aren't follow-ups.
  if (/^### /m.test(markdown)) return null;

  const lines = markdown.split('\n');
  // Bullets in either of two shapes the WF5.3 prompt produces:
  //   - **Title** - description           (bold lead, em-dash or hyphen)
  //   - **All bold!**                     (whole bullet bold — "Something else…")
  //   - Plain sentence as a single line   (current prompt example uses this)
  // Capture group 1+2: bold-lead form. Group 3: plain bullet.
  const bulletRegex = /^\s*-\s*(?:\*\*(.+?)\*\*\s*(.*)|(.+))$/;

  const introLines: string[] = [];
  const trailingLines: string[] = [];
  const options: ChipOption[] = [];
  let seenBullet = false;

  for (const line of lines) {
    const m = line.match(bulletRegex);
    if (m) {
      seenBullet = true;
      let title: string;
      let display: string;
      if (m[1] !== undefined) {
        title = m[1].trim().replace(/[!?.]+$/, '');
        const rawDesc = (m[2] || '').replace(/^\s*-\s*/, '').trim();
        display = rawDesc ? `${title} — ${rawDesc}` : title;
      } else {
        const plain = (m[3] || '').trim();
        title = plain.replace(/[!?.]+$/, '');
        display = plain;
      }
      const isFreeText = /something else|let me know|on your mind/i.test(display);
      options.push({ display, message: title, isFreeText });
    } else if (!seenBullet && line.trim()) {
      introLines.push(line);
    } else if (seenBullet && line.trim()) {
      trailingLines.push(line.trim());
    }
  }

  if (options.length < 2) return null;

  // Ensure a free-text "Something else" option always exists. The WF5.3
  // agent is told to add one, but sometimes writes it as a trailing line
  // instead of a bullet — the bullet parser misses that, so it would only
  // ever be read aloud by TTS, never shown as a clickable chip. If we find
  // such a trailing line, reuse the agent's wording; otherwise add a
  // generic one.
  if (!options.some((o) => o.isFreeText)) {
    const trailingFreeText = trailingLines.find((l) =>
      /something else|let me know|on your mind/i.test(l),
    );
    const display = (trailingFreeText ?? 'Something else, type below')
      .replace(/^\s*-\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
    options.push({ display, message: 'Something else', isFreeText: true });
  }

  return { intro: introLines.join('\n').trim(), options };
}

// Section types that have a meaningful score column we want to surface.
const SCORED_SECTION_TYPES = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
]);

// Map report_sections.section_type -> position in ALL_SECTIONS. Used as a
// fallback in section detection: if a heading text doesn't match any
// altTitle (because the agent skipped the boilerplate "Career 1:" prefix
// or chapter intro), we try matching the heading against report_sections
// titles directly. The matched row's section_type tells us which canonical
// section we're on. Keeps progress tracking accurate even when the agent
// drops boilerplate.
const SECTION_TYPE_TO_INDEX: Record<string, number> = {
  top_career_1: 5,
  top_career_2: 6,
  top_career_3: 7,
  runner_ups: 8,
  outside_box: 9,
  dream_jobs: 10,
};

// Strip basic HTML tags + bold markers from a heading-style string and lowercase it.
function normalizeTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Match a chat heading text against the report_sections.title field.
// Heading shape: "Chief People Officer". DB title shape:
// "<h3><strong>Chief People Officer</strong></h3>". We compare normalized forms.
function findSectionByTitle(
  sections: ReportSection[] | undefined,
  headingText: string
): ReportSection | null {
  if (!sections || sections.length === 0) return null;
  const norm = normalizeTitle(headingText);
  if (!norm) return null;

  for (const s of sections) {
    if (!SCORED_SECTION_TYPES.has(s.section_type)) continue;
    if (!s.title) continue;
    const sectionTitle = normalizeTitle(s.title);
    if (!sectionTitle) continue;
    if (sectionTitle === norm) return s;
    if (norm.includes(sectionTitle) || sectionTitle.includes(norm)) return s;
  }
  return null;
}

interface CareerBlock {
  title: string;  // The ### heading text (bold markers stripped)
  body: string;   // Everything after the heading line
}

interface SplitContent {
  intro: string;
  blocks: CareerBlock[];
}

// Convert HTML tags the agent sometimes sends to markdown equivalents.
// The agent's actual output convention (verified from live content):
//   ### Section Title         (h3 — main section heading)
//   ##### Sub-Header          (h5 — teal sub-headers inside sections)
// We mirror that convention when converting from HTML so the splitter
// downstream finds the right boundaries. Newlines around each heading
// ensure they land on their own line for ^# regex matching.
function htmlToMarkdown(text: string): string {
  let result = text;
  result = result.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n### $1\n');
  result = result.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n### $1\n');
  result = result.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  result = result.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n##### $1\n');
  result = result.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
  // Convert inline tags
  result = result.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  result = result.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  // Auto-bold numbered section headings ("1. Personality & Energy Fit",
  // "2. The Executive Version Suggestion", etc.) for legacy dream-job
  // content where the WF4 Parse Dream node stripped the **...** markers
  // before storing. Pattern: line starts with N., a space, then a
  // capitalized phrase, and is followed by a blank line or a bullet —
  // distinguishing it from inline numbered lists.
  result = result.replace(
    /^(\d+\.\s+[A-Z][^\n]{0,120})$(?=\n\s*\n|\n\s*[-*])/gm,
    '**$1**',
  );
  return result;
}

// Split a message into an intro + career blocks, based on ### headings.
// Only meaningful when a message contains 2+ ### sections (e.g. runner_ups,
// outside_box, dream_jobs). Single-### messages are returned as-is.
//
// Uses matchAll over a global, multi-line regex rather than `split(lookahead)`.
// The split-lookahead approach was producing inconsistent results when the
// body contained interleaved `---` separators between cards (specifically
// the doubled `---\n---` pattern outside_box rows produce — one from each
// row's trailing horizontal rule plus one from the wrap join). The matchAll
// approach is position-based and immune to whatever the body looks like
// between headings.
function splitIntoCareerBlocks(markdown: string): SplitContent {
  const headerRegex = /^### (.+)$/gm;
  const matches = [...markdown.matchAll(headerRegex)];

  if (matches.length === 0) {
    return { intro: markdown.trim(), blocks: [] };
  }

  const introRaw = markdown.slice(0, matches[0].index ?? 0);
  const intro = introRaw.replace(/\n?\s*---\s*$/, '').trim();

  const blocks: CareerBlock[] = matches.map((match, idx) => {
    const headerEnd = (match.index ?? 0) + match[0].length;
    const nextStart = idx + 1 < matches.length
      ? matches[idx + 1].index ?? markdown.length
      : markdown.length;

    const title = match[1].replace(/\*\*/g, '').trim();
    const rawBody = markdown.slice(headerEnd, nextStart);
    // Strip leading newlines + any --- separators that bracket each card body
    const body = rawBody
      .replace(/^\s*\n/, '')
      .replace(/^\s*---\s*\n?/, '')
      .replace(/\n?\s*---\s*$/, '')
      .replace(/\n?\s*---\s*$/, '') // a second pass — outside_box rows produce doubled ---
      .trim();

    return { title, body };
  });

  return { intro, blocks };
}

interface H2Subsection {
  title: string;
  body: string;
}

// Split a section-reveal message into a preamble (### section title + intro)
// plus an array of ##### sub-sections. Powers the sequential reveal so the
// user sees one sub-section at a time.
//
// Agent's actual format (verified from production content):
//   ### Section Title
//   intro paragraph
//   ##### Sub-Header One
//   body
//   ##### Sub-Header Two
//   body
function splitIntoH2Subsections(markdown: string): {
  preamble: string;
  subsections: H2Subsection[];
} {
  const parts = markdown.split(/(?=^##### )/m);
  const preamble = (parts[0] || '').trim();
  const subsections = parts.slice(1).map((part) => {
    const firstNewline = part.indexOf('\n');
    const titleLine = firstNewline >= 0 ? part.slice(0, firstNewline) : part;
    const title = titleLine
      .replace(/^#####\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
    const body = firstNewline >= 0 ? part.slice(firstNewline + 1).trim() : '';
    return { title, body };
  });
  return { preamble, subsections };
}

// Pull the section-delivery intro and outro out of a bot message so they can
// be rendered as visually distinct panels (lighter background, extra spacing).
// The platform's `deliver-section` always wraps the body in two `---` rules:
//
//   intro
//   ---
//   body
//   ---
//   outro
//
// Either side can be empty (top_career_2/3 have no intro; dream_jobs has no
// outro). When the message doesn't fit the pattern (discussion replies),
// returns null so callers fall back to plain rendering.
export function extractIntroOutro(markdown: string): {
  intro: string | null;
  body: string;
  outro: string | null;
} | null {
  const lines = markdown.split('\n');
  const sepIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') sepIdx.push(i);
  }
  if (sepIdx.length === 0) return null;

  if (sepIdx.length >= 2) {
    const first = sepIdx[0];
    const last = sepIdx[sepIdx.length - 1];
    return {
      intro: lines.slice(0, first).join('\n').trim() || null,
      body: lines.slice(first + 1, last).join('\n').trim(),
      outro: lines.slice(last + 1).join('\n').trim() || null,
    };
  }
  // Single separator — intro + body, no outro (e.g. dream_jobs)
  const sep = sepIdx[0];
  return {
    intro: lines.slice(0, sep).join('\n').trim() || null,
    body: lines.slice(sep + 1).join('\n').trim(),
    outro: null,
  };
}

// Check if a heading matches any section in ALL_SECTIONS
function findSectionIndex(headingText: string): number {
  const normalized = headingText.toLowerCase().trim();
  return ALL_SECTIONS.findIndex((section) => {
    if (normalized.includes(section.title.toLowerCase())) return true;
    if (section.altTitles?.some((alt) => normalized.includes(alt.toLowerCase()))) return true;
    if (normalized.includes(section.id.replace(/-/g, ' '))) return true;
    return false;
  });
}

// Flatten react-markdown children (strings + nested elements like <strong>)
// down to plain text — used to inspect a paragraph's leading content.
function childrenToText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => {
      if (typeof c === 'string') return c;
      if (typeof c === 'number') return String(c);
      if (React.isValidElement(c)) {
        return childrenToText((c.props as { children?: React.ReactNode }).children);
      }
      return '';
    })
    .join('');
}

// Custom components for react-markdown to style headings with atlas colors.
// The agent emits a mix of heading levels (## for sub-sections like
// "Personality and Interaction Style", ### for main section titles, etc.),
// so we style every level rather than only the ones we expect.
const markdownComponents = {
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="text-lg font-semibold text-atlas-teal mt-6 mb-2 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    // Display-weight, tightly tracked title that anchors each coach card.
    // scroll-mt-[120px] keeps the sticky page navbar from covering the heading
    // when the user clicks a sidebar section to scroll here.
    <h3
      className="text-[28px] mt-8 mb-4 font-heading first:mt-0 scroll-mt-[120px]"
      style={{
        color: '#122E3B',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.15,
        textWrap: 'pretty' as any,
      }}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className="text-lg font-semibold text-atlas-blue mt-6 mb-2 first:mt-0"
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    // The agent uses ##### for the teal sub-headers inside section reveals
    // ('Personality and Interaction Style', 'The practical stuff', etc).
    // This is what users actually see — give it the prominent styling, and
    // prefix a matching icon when the header is a known standardized one.
    const text = React.Children.toArray(children)
      .map((c) => (typeof c === 'string' ? c : ''))
      .join('')
      .trim();
    const Icon = iconForSubsection(text);
    return (
      <h5
        className="font-heading uppercase mt-7 mb-3 first:mt-0 flex items-center gap-2"
        style={{
          color: '#1F8282',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.24em',
        }}
        {...props}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />}
        <span>{children}</span>
      </h5>
    );
  },
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
    // The "How AI will impact this role" body leads with the rating, e.g.
    // "Transforming (High Impact): ...". Surface it as a colour-coded
    // severity badge so the impact still lands once the header pill has
    // scrolled out of view. (Feasibility lives in the header CareerScoreCard,
    // not here — it sits high enough in the section to not need re-surfacing.)
    const aiLevel = leadingAIImpactLevel(childrenToText(children));
    return (
      <>
        {aiLevel && (
          <div className="mb-2">
            <AIImpactBadge level={aiLevel} />
          </div>
        )}
        <p className="mb-2 last:mb-0" {...props}>
          {children}
        </p>
      </>
    );
  },
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-5 mb-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-5 mb-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
};

// Builds the question auto-sent by the "Can I get there from here?" pill.
// Names the role inline so the agent has context without the [About <role>]
// prefix (that prefix is only applied to free-text turns, not chip sends),
// and explicitly asks for the transition/reskilling angle so the reply
// covers feasibility of the jump, not just the role itself.
export function buildFeasibilityQuestion(roleTitle: string): string {
  return `How realistic is the move into ${roleTitle} from where I am now, and what would I need to learn or reskill to get there?`;
}

// Renders a section-reveal message with sequential sub-section disclosure.
// Initial render: preamble (h3 + intro) + first h2 sub-section + a chevron
// that previews the NAME of the next sub-section. Click → next reveals,
// chevron updates to the one after. Repeat until all are visible.
//
// Once revealed, sub-sections stay visible (no auto-collapse). Only applied
// when this message is the latest bot message — historical messages render
// flat so users don't have to re-click through content they've already read.
const SequentialSubsections: React.FC<{
  preamble: string;
  subsections: H2Subsection[];
  // Called on mount and on every reveal so the parent can lock the chat
  // input + quick replies until everything's been read.
  onRevealStateChange?: (revealed: number, total: number) => void;
  // Career sections from the report so the preamble's h3 (career title)
  // can be enriched with a match-score gauge + AI-impact badge.
  sections?: ReportSection[];
  // Full sanitized message body — used to extract the AI Impact rating,
  // which can appear in any subsection rather than only in the preamble.
  fullBody?: string;
  // When true (TTS is reading this message), reveal every sub-section
  // immediately so the audio narration matches what's visible on screen.
  forceFullReveal?: boolean;
  // Boilerplate intro extracted from the message body. Rendered as a
  // tinted panel above the section content. Always visible.
  intro?: string | null;
  // Boilerplate outro extracted from the message body. Rendered as a
  // tinted panel below the last subsection. Hidden until all
  // subsections have been revealed, so the user doesn't see the
  // wrap-up before they've read the section.
  outro?: string | null;
  // When set, render an "Ask about this role" pill below the last
  // subsection (after all are revealed). Career title is parsed from
  // the preamble's ### heading so the chat container can scope the
  // next user message to that role.
  onAskAboutRole?: (roleTitle: string) => void;
  // When set, render a sibling "Can I get there from here?" pill that
  // auto-sends a transition/reskilling question for this role.
  onAskFeasibility?: (roleTitle: string) => void;
  // Career-comparison card. Rendered alongside the "Ask about this role"
  // pill once every subsection (incl. "Alignment with your ambitions")
  // has been revealed.
  comparisonSlot?: React.ReactNode;
}> = ({ preamble, subsections, onRevealStateChange, sections, fullBody, forceFullReveal, intro, outro, onAskAboutRole, onAskFeasibility, comparisonSlot }) => {
  // revealedCount = number of sub-sections currently visible. Starts at 1
  // so the user sees the preamble + first h2 + first body on first render.
  const [revealedCount, setRevealedCount] = useState(1);
  // Ref attached to the most recently revealed sub-section so we can scroll
  // it into view when the user clicks the chevron — otherwise newly revealed
  // text appears below the fold and the user has to manually scroll.
  const lastRevealedRef = useRef<HTMLDivElement | null>(null);
  const prevRevealedRef = useRef(revealedCount);

  // Notify parent whenever revealed count changes (incl. mount).
  useEffect(() => {
    onRevealStateChange?.(revealedCount, subsections.length);
  }, [revealedCount, subsections.length, onRevealStateChange]);

  // When TTS starts narrating this message, expand every remaining
  // sub-section so what the user hears matches what they see.
  useEffect(() => {
    if (forceFullReveal && revealedCount < subsections.length) {
      setRevealedCount(subsections.length);
    }
  }, [forceFullReveal, revealedCount, subsections.length]);

  // Scroll the newly revealed sub-section to the top of the viewport when
  // revealedCount grows. Skipped on initial mount so first render doesn't
  // jump the page.
  useEffect(() => {
    if (revealedCount > prevRevealedRef.current && lastRevealedRef.current) {
      lastRevealedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevRevealedRef.current = revealedCount;
  }, [revealedCount]);

  // Custom h3 for the preamble: looks up the career title in `sections` and
  // renders a CareerScoreCard right under the heading. AI Impact is parsed
  // from the entire message body since the rating phrase often lives in a
  // later sub-section rather than the preamble.
  const preambleComponents = React.useMemo(() => {
    if (!sections || sections.length === 0) return markdownComponents;
    return {
      ...markdownComponents,
      h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const headingText = React.Children.toArray(children)
          .flatMap((c: any) => {
            if (typeof c === 'string') return [c];
            // Markdown wraps emphasized titles in <strong>, so the actual
            // text sits one level deeper. Recurse one step to recover it.
            const inner = c?.props?.children;
            if (typeof inner === 'string') return [inner];
            if (Array.isArray(inner)) return inner.filter((x) => typeof x === 'string');
            return [];
          })
          .join('')
          .trim();
        const section = findSectionByTitle(sections, headingText);
        const score = section?.score != null ? Number(section.score) : null;
        const aiImpact = extractAIImpact(fullBody || preamble);
        const feasibility = extractFeasibility(fullBody || preamble);
        return (
          <>
            <h3
              className="text-[28px] mt-8 mb-4 font-heading first:mt-0"
              style={{
                color: '#122E3B',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                textWrap: 'pretty' as any,
              }}
              {...props}
            >
              {children}
            </h3>
            <CareerScoreCard
              score={Number.isFinite(score) ? score : null}
              aiImpact={section ? aiImpact : null}
              feasibility={section ? feasibility : null}
              move={section ? (section.metadata?.move ?? null) : null}
            />
          </>
        );
      },
    };
  }, [sections, fullBody, preamble]);

  const allRevealed = revealedCount >= subsections.length;

  return (
    <div>
      {/* Boilerplate intro panel — visually distinct (light teal),
          extends to the card edges. Always visible when present. */}
      {intro && (
        <div className="-mx-4 -mt-3.5 mb-5 px-4 py-3.5 bg-atlas-teal/5 border-b border-atlas-teal/10 rounded-t-2xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {intro}
          </ReactMarkdown>
        </div>
      )}
      {preamble && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={preambleComponents}>
          {preamble}
        </ReactMarkdown>
      )}
      {subsections.slice(0, revealedCount).map((sub, idx) => {
        // Render the title manually so we can prefix it with an icon.
        // The body still goes through ReactMarkdown for paragraph/list styling.
        // NOTE: `first:mt-0` would always trigger here because each subsection
        // is its own wrapper div, so we apply mt-6 unconditionally except on
        // the very first subsection (where the preamble's bottom margin is
        // already enough). This restores the breathing room above each h5.
        const Icon = iconForSubsection(sub.title);
        const isLastVisible = idx === revealedCount - 1;
        // Spacing above each sub-header. First one sits just below the intro
        // paragraph (modest gap). Subsequent ones get a clear visual break
        // (mt-10 = 40px) so they don't feel cramped against the previous
        // sub-section's last paragraph.
        const headingMargin = idx === 0 ? 'mt-4' : 'mt-10';
        // scroll-mt-[120px] leaves enough room above the wrapper for the
        // sticky page navbar (~73px) plus ~50px breathing room. Earlier
        // values were too small and the sub-header landed behind the navbar
        // — user could see the first sentence but not the heading itself.
        return (
          <div key={idx} ref={isLastVisible ? lastRevealedRef : undefined} className="scroll-mt-[120px]">
            <h5 className={`text-lg font-semibold text-atlas-teal mb-3 flex items-center gap-2.5 ${headingMargin}`}>
              {Icon && <Icon className="w-5 h-5 shrink-0" strokeWidth={2.25} />}
              <span>{sub.title}</span>
            </h5>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {sub.body}
            </ReactMarkdown>
          </div>
        );
      })}
      {revealedCount < subsections.length && (() => {
        const nextTitle = subsections[revealedCount].title;
        const NextIcon = iconForSubsection(nextTitle);
        return (
          <button
            type="button"
            onClick={() => setRevealedCount((c) => c + 1)}
            className="mt-6 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-atlas-teal/30 bg-atlas-teal/5 hover:bg-atlas-teal/10 hover:border-atlas-teal/50 transition-colors text-left group"
          >
            <span className="text-lg font-semibold text-atlas-teal flex items-center gap-2.5">
              {NextIcon && <NextIcon className="w-5 h-5 shrink-0" strokeWidth={2.25} />}
              <span>{nextTitle}</span>
            </span>
            <ChevronDown className="w-5 h-5 text-atlas-teal shrink-0 group-hover:translate-y-0.5 transition-transform" />
          </button>
        );
      })()}
      {/* Career-comparison subsection — appears once the last subsection
          ("Alignment with your ambitions") is revealed, just above the
          ask pill. */}
      {allRevealed && comparisonSlot}
      {/* Per-card "ask about this role" pill — same UX as multi-card
          collapsibles. Appears once every subsection has been revealed
          so it doesn't distract during reading. Career title comes from
          the ### heading at the top of the preamble. */}
      {allRevealed && onAskAboutRole && (() => {
        const titleMatch = (preamble || '').match(/^###\s+(.+)$/m);
        const roleTitle = titleMatch
          ? titleMatch[1].replace(/\*\*/g, '').trim()
          : null;
        if (!roleTitle) return null;
        // Only real career sections get the pill. The heading must match a
        // scored career row in the report; personality sections (approach,
        // strengths, etc.) have ### subsection headings that never will.
        if (!findSectionByTitle(sections, roleTitle)) return null;
        return (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAskAboutRole(roleTitle)}
              // .ask-pill in index.css keeps the pill pure white over the
              // global .dark .bg-white !important override, and runs the
              // teal-fill + white-text hover transition. Inline style was
              // blocking the hover from kicking in.
              className="ask-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-atlas-teal text-atlas-teal text-sm font-medium shadow-md transition-colors"
            >
              <MessageCircle size={14} />
              Ask about this role
            </button>
            {onAskFeasibility && (
              <button
                type="button"
                onClick={() => onAskFeasibility(roleTitle)}
                className="ask-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-atlas-teal text-atlas-teal text-sm font-medium shadow-md transition-colors"
              >
                <Route size={14} />
                Can I get there from here?
              </button>
            )}
          </div>
        );
      })()}
      {/* Boilerplate outro panel — appears only after all subsections are
          revealed, with extra top margin so it doesn't feel glued to the
          last paragraph. */}
      {allRevealed && outro && (
        <div className="-mx-4 mt-10 -mb-3.5 px-4 py-3.5 bg-atlas-teal/5 border-t border-atlas-teal/10 rounded-b-2xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {outro}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// Renders a multi-career message as collapsible blocks.
// By default first career is open; when defaultAllCollapsed=true, all start closed.
// When onAllBlocksOpened is provided, fires once every block has been opened at least once.
const CollapsibleCareerBlocks: React.FC<{
  intro: string;
  blocks: CareerBlock[];
  defaultAllCollapsed?: boolean;
  onAllBlocksOpened?: () => void;
  sections?: ReportSection[];
  // Boilerplate intro extracted from the platform-delivery body (rendered
  // as a tinted panel above the blocks). Distinct from the `intro` above,
  // which is in-body intro text between the boilerplate and the first card.
  deliveryIntro?: string | null;
  // Boilerplate outro — tinted panel below the blocks. Gated on all
  // sub-blocks having been expanded at least once so the user doesn't
  // see the wrap-up before reading.
  deliveryOutro?: string | null;
  // Click handler for the per-card "Ask about this role" button. Receives
  // the role title so the chat container can scope the next user message
  // to that specific career.
  onAskAboutRole?: (roleTitle: string) => void;
  // Click handler for the sibling "Can I get there from here?" button.
  // Auto-sends a transition/reskilling question for that career.
  onAskFeasibility?: (roleTitle: string) => void;
}> = ({
  intro,
  blocks,
  // Kept for backward compat with callers that still pass it. Ignored:
  // we always start with all blocks collapsed now (clean uniform list).
  defaultAllCollapsed: _defaultAllCollapsed,
  onAllBlocksOpened,
  sections,
  deliveryIntro,
  deliveryOutro,
  onAskAboutRole,
  onAskFeasibility,
}) => {
  // All blocks are uniform collapsible cards, all closed by default. User
  // gets a clean scannable list of options (title + size + score + AI
  // impact pills) and expands any card to read its body. The previous
  // "first block auto-open" pattern made it look like a second-clicked
  // card was nested inside the first.
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const [everOpened, setEverOpened] = useState<Set<number>>(new Set());
  const firedRef = useRef(false);

  const toggle = (idx: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
    setEverOpened((prev) => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      if (next.size >= blocks.length && !firedRef.current && onAllBlocksOpened) {
        firedRef.current = true;
        onAllBlocksOpened();
      }
      return next;
    });
  };

  const allOpened = blocks.length > 0 && everOpened.size >= blocks.length;

  // Pull the company-size line ("#### Small (11–50) / Boutique") out of
  // each block's body so we can show it in the collapsed header next
  // to the title. Returns the body without the size line so it doesn't
  // double-render when the block is expanded.
  const splitSizeFromBody = (body: string): { size: string | null; rest: string } => {
    const m = body.match(/^####\s+(.+)$/m);
    if (!m) return { size: null, rest: body };
    const size = m[1].replace(/\*\*/g, '').trim();
    const rest = body.replace(/^####\s+.+$\n*/m, '').trim();
    return { size, rest };
  };

  return (
    <div>
      {/* Boilerplate intro panel (light teal band, full card width) */}
      {deliveryIntro && (
        <div className="-mx-4 -mt-3.5 mb-5 px-4 py-3.5 bg-atlas-teal/5 border-b border-atlas-teal/10 rounded-t-2xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {deliveryIntro}
          </ReactMarkdown>
        </div>
      )}

      {/* In-body intro text (between boilerplate and first card) */}
      {intro && (
        <div className="mb-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {intro}
          </ReactMarkdown>
        </div>
      )}

      {/* All career blocks render uniformly as collapsible cards */}
      {blocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.map((block, idx) => {
            const isOpen = openIndices.has(idx);
            const section = findSectionByTitle(sections, block.title);
            const score = section?.score != null ? Number(section.score) : null;
            const aiImpact = extractAIImpact(block.body || '');
            const feasibility = extractFeasibility(block.body || '');
            const hasCard =
              (Number.isFinite(score) && score != null) || !!aiImpact || !!feasibility;
            const { size, rest } = splitSizeFromBody(block.body || '');

            return (
              <div
                key={idx}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Clickable header — always visible */}
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {/* h3 so DOM section-detection still works */}
                    <h3 className="text-base font-bold text-atlas-navy font-heading m-0 leading-snug">
                      {block.title}
                    </h3>
                    {/* Company size — small subhead under the title */}
                    {size && (
                      <div className="text-xs text-atlas-teal font-medium leading-tight">
                        {size}
                      </div>
                    )}
                    {/* Match score + AI impact pills in the collapsed header
                        so users can scan all options without expanding each. */}
                    {hasCard && (
                      <CareerScoreCard
                        score={Number.isFinite(score) ? score : null}
                        aiImpact={aiImpact}
                        feasibility={feasibility}
                        move={section?.metadata?.move ?? null}
                      />
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Collapsible body — size already shown in header,
                    so render the size-stripped `rest` instead of full body */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 text-[0.9375rem]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {rest}
                    </ReactMarkdown>
                    {/* Per-card "ask about this role" button — gives the
                        user a frictionless way to discuss this specific
                        career without scrolling/copying. The chat
                        container prefixes the next free-text message
                        with [About: <role>] so the agent has explicit
                        context. */}
                    {onAskAboutRole && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onAskAboutRole(block.title)}
                          // See .ask-pill in index.css — handles both the
                          // dark-mode bg-white override AND the hover
                          // transition without inline style getting in the way.
                          className="ask-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-atlas-teal text-atlas-teal text-sm font-medium shadow-md transition-colors"
                        >
                          <MessageCircle size={14} />
                          Ask about this role
                        </button>
                        {onAskFeasibility && (
                          <button
                            type="button"
                            onClick={() => onAskFeasibility(block.title)}
                            className="ask-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-atlas-teal text-atlas-teal text-sm font-medium shadow-md transition-colors"
                          >
                            <Route size={14} />
                            Can I get there from here?
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Boilerplate outro panel — appears once every sub-block has been
          opened at least once. Light teal band, extra top margin so it
          doesn't sit on top of the last expanded block. */}
      {allOpened && deliveryOutro && (
        <div className="-mx-4 mt-10 -mb-3.5 px-4 py-3.5 bg-atlas-teal/5 border-t border-atlas-teal/10 rounded-b-2xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {deliveryOutro}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  messageId,
  content,
  sender,
  onSectionDetected,
  onAllBlocksOpened,
  defaultAllCollapsed = false,
  sections,
  isLatestBotMessage = false,
  onChipSend,
  onChipFocusInput,
  onSequentialRevealStateChange,
  onAskAboutRole,
  failed = false,
  onRetry,
  bookmarkable = false,
  bookmarked = false,
  onBookmarkToggle,
  alreadyInReport = false,
  liked = false,
  onLikeToggle,
  onComparisonExplain,
}) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();
  // Auto-read this message when readAll is on AND it's the latest bot message.
  // Track per-message so toggling readAll mid-conversation doesn't re-read
  // older messages, and so the same message isn't read twice.
  const autoReadFiredRef = useRef(false);
  useEffect(() => {
    if (sender !== 'bot') return;
    if (!isLatestBotMessage) return;
    if (!tts.isSupported || !tts.readAll) return;
    if (!messageId) return;
    if (autoReadFiredRef.current) return;
    autoReadFiredRef.current = true;
    // Small delay so the speech doesn't fire mid-render and step on the
    // user's own click sounds (e.g. just-tapped a quick reply).
    const timer = setTimeout(() => {
      tts.speak(content, messageId);
    }, 250);
    return () => clearTimeout(timer);
  }, [sender, isLatestBotMessage, tts, messageId, content]);

  // After bot message renders, scan for section headings in the DOM
  useEffect(() => {
    if (sender !== 'bot' || !onSectionDetected || !messageRef.current) return;

    const headings = messageRef.current.querySelectorAll('h3');
    console.log('[Section] DOM scan: found', headings.length, 'h3 elements');
    headings.forEach((h3) => {
      const text = h3.textContent || '';
      console.log('[Section] h3 text:', text);
      let idx = findSectionIndex(text);
      // Fallback: if the heading doesn't match any altTitle, try matching
      // it against the user's report_sections data. The agent sometimes
      // drops the "Career 1:" prefix and just emits "### [career title]",
      // so a literal title like "Independent Supervisory Board Member"
      // looks meaningless to findSectionIndex. But that title IS in the
      // report_sections table with section_type='top_career_1', which
      // tells us this message is the Primary Career Match (canonical 5).
      if (idx < 0 && sections && sections.length > 0) {
        const section = findSectionByTitle(sections, text);
        if (section) {
          const fallbackIdx = SECTION_TYPE_TO_INDEX[section.section_type];
          if (fallbackIdx != null) {
            idx = fallbackIdx;
            console.log('[Section] fallback via report_sections:', section.section_type, '→', idx);
          }
        }
      }
      console.log('[Section] findSectionIndex result:', idx, idx >= 0 ? `(${ALL_SECTIONS[idx].title})` : '(no match)');
      if (idx >= 0) {
        onSectionDetected(idx);
        h3.setAttribute('data-section-id', ALL_SECTIONS[idx].id);
      }
    });
  }, [content, sender, onSectionDetected, sections]);

  if (sender === 'user') {
    return (
      <div className="flex justify-end items-center gap-2 mb-4">
        {/* Subtle retry affordance for messages whose agent call failed.
            Sits to the LEFT of the bubble (still on the right side of the
            chat) so it doesn't push vertical scroll. Only shows on the
            failed message itself. */}
        {failed && onRetry && messageId && (
          <button
            type="button"
            onClick={() => onRetry(messageId)}
            title="Retry sending this message"
            aria-label="Retry sending this message"
            className="text-gray-400 hover:text-atlas-teal transition-colors p-1 rounded-full"
          >
            <RotateCw size={14} />
          </button>
        )}
        <div className={`max-w-[75%] bg-atlas-teal text-white rounded-2xl px-4 py-3.5 text-[0.9375rem] leading-relaxed ${
          failed ? 'opacity-70' : ''
        }`}>
          {content}
        </div>
      </div>
    );
  }

  // Bot message — convert any HTML tags to markdown, then sanitize
  const processedContent = htmlToMarkdown(content);
  const sanitized = DOMPurify.sanitize(processedContent);

  // Pull platform-delivery boilerplate (intro / outro panels) out of the
  // body so they can be rendered as visually distinct tinted bands.
  // Returns null for non-section-delivery messages (discussion replies,
  // follow-ups), in which case we render the message as today.
  const sectionDelivery = extractIntroOutro(sanitized);
  const bodyForParsing = sectionDelivery?.body ?? sanitized;
  const deliveryIntro = sectionDelivery?.intro ?? null;
  const deliveryOutro = sectionDelivery?.outro ?? null;

  // Check if this message has multiple career blocks worth collapsing
  const { intro, blocks } = splitIntoCareerBlocks(bodyForParsing);
  const hasMultipleBlocks = blocks.length >= 2;

  // Section-reveal messages have multiple ## sub-sections (e.g. Approach,
  // Strengths, Development, Values) — apply sequential reveal so the user
  // gets one sub-section at a time. Applied to ALL such messages (not just
  // the latest) so historical section reveals are also collapsed and the
  // user can scroll up to a clean, scannable structure.
  const { preamble: subsectionPreamble, subsections } = splitIntoH2Subsections(bodyForParsing);
  const useSequentialReveal = !hasMultipleBlocks && subsections.length >= 2;

  // For messages that don't use sequential reveal (discussion replies,
  // follow-up option lists, multi-block career bundles), there's no
  // SequentialSubsections to fire the reveal-state callback. Report
  // (0, 0) so the parent unlocks input + quick replies for these
  // messages. SequentialSubsections handles the reporting itself when
  // useSequentialReveal is true, so we skip in that case to avoid races.
  useEffect(() => {
    if (!isLatestBotMessage) return;
    if (useSequentialReveal) return;
    onSequentialRevealStateChange?.(0, 0);
  }, [isLatestBotMessage, useSequentialReveal, onSequentialRevealStateChange]);

  // Detect 'follow-up with options' messages (response to Explore More /
  // I see this differently). Only the latest bot message gets the chip
  // treatment so old follow-ups stay rendered as plain bullets — clicking
  // through historical chips wouldn't make sense conversationally.
  const followUpOptions =
    isLatestBotMessage && !hasMultipleBlocks && !useSequentialReveal
      ? detectFollowUpOptions(sanitized)
      : null;

  // If this single message is a Career 2 or Career 3 section, resolve its
  // report_sections row so we can render the comparison card. Career 1 is
  // intentionally excluded — there is nothing earlier to compare against.
  const comparisonSection = useMemo(() => {
    if (sender !== 'bot' || hasMultipleBlocks) return null;
    const headingMatch = sanitized.match(/^###\s+(.+)$/m);
    if (!headingMatch) return null;
    const section = findSectionByTitle(sections, headingMatch[1]);
    if (
      section &&
      (section.section_type === 'top_career_2' || section.section_type === 'top_career_3')
    ) {
      return section;
    }
    return null;
  }, [sender, hasMultipleBlocks, sanitized, sections]);

  // The comparison card element, built once. Rendered inside
  // SequentialSubsections (gated on full reveal) for the latest message, or
  // directly below the content for historical / non-sequential renders.
  const comparisonCard =
    comparisonSection && sections && onComparisonExplain ? (
      <CareerComparisonCard
        sections={sections}
        focalSectionType={comparisonSection.section_type as 'top_career_2' | 'top_career_3'}
        onExplain={onComparisonExplain}
      />
    ) : null;

  // For single-block messages (e.g. top_career_1/2/3), enrich the h3 renderer
  // so the score card appears right under the career title without changing
  // the surrounding markdown flow.
  const enrichedComponents = useMemo(() => {
    if (hasMultipleBlocks) return markdownComponents;
    return {
      ...markdownComponents,
      h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
        const headingText = React.Children.toArray(children)
          .map((c) => (typeof c === 'string' ? c : ''))
          .join('')
          .trim();
        const section = findSectionByTitle(sections, headingText);
        const score = section?.score != null ? Number(section.score) : null;
        // Look for an AI Impact rating anywhere in the message body.
        const aiImpact = extractAIImpact(sanitized);
        const feasibility = extractFeasibility(sanitized);
        return (
          <>
            <h3
              className="text-[28px] mt-4 mb-4 font-heading"
              style={{
                color: '#122E3B',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                textWrap: 'pretty' as any,
              }}
              {...props}
            >
              {children}
            </h3>
            <CareerScoreCard
              score={Number.isFinite(score) ? score : null}
              aiImpact={section ? aiImpact : null}
              feasibility={section ? feasibility : null}
              move={section ? (section.metadata?.move ?? null) : null}
            />
          </>
        );
      },
    };
  }, [hasMultipleBlocks, sections, sanitized]);

  return (
    <div className="flex justify-start mb-4">
      <div
        ref={messageRef}
        className="relative overflow-hidden max-w-[85%] rounded-[20px] border px-5 py-4 text-[15px] leading-[1.6]"
        style={{
          background: '#FDFBF2',
          borderColor: 'rgba(201, 182, 144, 0.6)',
          boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
          color: '#1F2937',
        }}
      >
        {/* Soft gold radial bloom top-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            background:
              'radial-gradient(circle, rgba(212,160,36,0.16) 0%, rgba(212,160,36,0) 70%)',
          }}
        />
        {hasMultipleBlocks ? (
          <CollapsibleCareerBlocks
            intro={intro}
            blocks={blocks}
            defaultAllCollapsed={defaultAllCollapsed}
            onAllBlocksOpened={onAllBlocksOpened}
            sections={sections}
            deliveryIntro={deliveryIntro}
            deliveryOutro={deliveryOutro}
            // All multi-card sections get the per-card ask buttons —
            // including historical ones, since the user is clicking
            // NOW and the agent processes the new turn fresh.
            onAskAboutRole={onAskAboutRole}
            onAskFeasibility={
              onChipSend
                ? (role) => onChipSend(buildFeasibilityQuestion(role))
                : undefined
            }
          />
        ) : useSequentialReveal ? (
          <SequentialSubsections
            preamble={subsectionPreamble}
            subsections={subsections}
            sections={sections}
            fullBody={sanitized}
            intro={deliveryIntro}
            outro={deliveryOutro}
            // Only the latest message reports state — older messages
            // shouldn't lock the input even if their state is partial.
            onRevealStateChange={isLatestBotMessage ? onSequentialRevealStateChange : undefined}
            // Single-card career sections (top_career_1/2/3, dream_jobs)
            // also get the per-card ask button so users can scope a
            // follow-up to that specific role.
            onAskAboutRole={onAskAboutRole}
            onAskFeasibility={
              onChipSend
                ? (role) => onChipSend(buildFeasibilityQuestion(role))
                : undefined
            }
            comparisonSlot={comparisonCard}
          />
        ) : followUpOptions ? (
          <div>
            {followUpOptions.intro && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {followUpOptions.intro}
              </ReactMarkdown>
            )}
            {/* Claude-style multiple-choice container: single rounded card,
                each option a full-width row, thin teal divider between rows.
                Numbered prefix on regular options; pencil icon on the
                free-text 'Something else' option. */}
            <div className="mt-3 rounded-xl border border-atlas-teal/30 overflow-hidden bg-white">
              {followUpOptions.options.map((opt, i) => {
                const isLastOption = i === followUpOptions.options.length - 1;
                const isFreeText = opt.isFreeText;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (isFreeText) {
                        onChipFocusInput?.("Let me know what's on your mind…");
                      } else {
                        onChipSend?.(opt.message);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-atlas-teal/5 transition-colors ${
                      i > 0 ? 'border-t border-atlas-teal/15' : ''
                    }`}
                  >
                    {isFreeText ? (
                      <Pencil className="w-4 h-4 text-atlas-teal/70 shrink-0" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-atlas-teal/10 text-atlas-teal flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                    )}
                    <span className="text-sm font-medium text-atlas-navy leading-snug">
                      {opt.display}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={enrichedComponents}>
            {sanitized}
          </ReactMarkdown>
        )}
        {/* Sequential-reveal messages render the card inside
            SequentialSubsections (with the ask pill); other renders show it
            here, directly below the content. */}
        {!useSequentialReveal && comparisonCard}
        {messageId && (
          <MessageVoiceButton
            messageId={messageId}
            text={sanitized}
            bookmarkable={bookmarkable}
            bookmarked={bookmarked}
            alreadyInReport={alreadyInReport}
            onBookmarkToggle={
              onBookmarkToggle ? () => onBookmarkToggle(messageId) : undefined
            }
            liked={liked}
            onLikeToggle={
              onLikeToggle ? () => onLikeToggle(messageId, sanitized) : undefined
            }
          />
        )}
      </div>
    </div>
  );
};
