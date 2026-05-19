
import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft, ChevronDown, Bot, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReportSection } from '@/hooks/useReportSections';
import AILegend from './AILegend';
import { iconForSubsection } from '@/components/chat/subsectionIcons';
import { CareerScoreCard, extractAIImpact, extractFeasibility } from '@/components/chat/CareerScoreCard';

// ── Utilities ───────────────────────────────────────────────────────────

// Strip all HTML tags for clean text display (titles, nav buttons)
const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '').trim();

// Convert HTML tags the AI sometimes includes to markdown equivalents.
// Same logic as the chat's htmlToMarkdown — keeps one rendering pipeline.
function htmlToMarkdown(text: string): string {
  let result = text;
  result = result.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1');
  result = result.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1');
  result = result.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1');
  result = result.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  result = result.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  // Convert ✓ and • bullets to markdown list items
  result = result.replace(/^✓\s/gm, '- ✓ ');
  result = result.replace(/^•\s/gm, '- ');
  // Bold specific labels that should stand out
  result = result.replace(/^(Alternative titles:)/gim, '**$1**');
  result = result.replace(/^(Your match score:)/gim, '**$1**');
  return result;
}

// Flatten React children (markdown headings) to plain text for icon lookup.
function childrenText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => {
      if (typeof c === 'string' || typeof c === 'number') return String(c);
      if (React.isValidElement(c)) return childrenText((c as any).props?.children);
      return '';
    })
    .join('');
}

// Parse a section's text score into a finite number, or null.
function toScore(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Dashboard-tuned Markdown Components ─────────────────────────────────
// Slightly larger than the chat components since this is full-page reading.

const dashboardComponents: Record<string, React.FC<any>> = {
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-bold mt-8 mb-4 text-atlas-navy first:mt-0" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-xl font-bold mt-10 mb-4 text-atlas-navy first:mt-0" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-lg font-semibold mt-6 mb-3 text-atlas-blue" {...props}>{children}</h4>
  ),
  h5: ({ children, ...props }) => {
    // Match the chat: prefix a Lucide icon when the subsection heading is a
    // known one. Unmatched headings render plain (no decorative noise).
    const Icon = iconForSubsection(childrenText(children));
    return (
      <h5 className="flex items-center gap-2 text-base font-semibold mt-5 mb-2 text-atlas-teal" {...props}>
        {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
        <span>{children}</span>
      </h5>
    );
  },
  p: ({ children, ...props }) => {
    // Detect standalone bold paragraphs (e.g. "**Feasibility Rating**") and render as subheadings.
    // This makes them visually consistent with numbered headers like "1. Career Name".
    const childArray = React.Children.toArray(children);
    if (
      childArray.length === 1 &&
      React.isValidElement(childArray[0]) &&
      (childArray[0] as React.ReactElement).type === 'strong'
    ) {
      return (
        <p className="text-base font-semibold mt-5 mb-2 text-gray-800" {...props}>{children}</p>
      );
    }
    return <p className="mb-3 last:mb-0" {...props}>{children}</p>;
  },
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-6 mb-3 space-y-1.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  // Horizontal rules are handled at a higher level (section separators), so hide them here
  hr: () => null,
};

// ── Reusable Sub-components ─────────────────────────────────────────────

// Render markdown through the full pipeline: htmlToMarkdown → sanitize → react-markdown
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={dashboardComponents}>
    {DOMPurify.sanitize(htmlToMarkdown(content))}
  </ReactMarkdown>
);

// Extract "How AI will impact this role" from markdown content into a separate block
function extractAIImpactSection(markdown: string): { contentWithoutAI: string; aiImpactContent: string | null } {
  // Match the h5 header and everything until the next h5 or end of content
  const pattern = /##### How AI will impact this role\s*\n([\s\S]*?)(?=##### |\s*$)/i;
  const match = markdown.match(pattern);

  if (!match) return { contentWithoutAI: markdown, aiImpactContent: null };

  const aiContent = match[1].trim();
  if (!aiContent) return { contentWithoutAI: markdown, aiImpactContent: null };

  // Remove the entire AI impact section (header + content) from the main content
  const contentWithoutAI = markdown.replace(/##### How AI will impact this role\s*\n[\s\S]*?(?=##### |\s*$)/i, '').trim();

  return { contentWithoutAI, aiImpactContent: aiContent };
}

// Styled callout box for AI impact analysis — displayed separately to highlight it as a USP
const AIImpactCallout: React.FC<{ content: string }> = ({ content }) => (
  <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-lg">
    <div className="flex items-center gap-2 mb-3">
      <Bot className="w-5 h-5 text-slate-600" />
      <h4 className="font-semibold text-slate-700">AI Impact on This Role</h4>
    </div>
    <div className="text-slate-700">
      <MarkdownContent content={content} />
    </div>
  </div>
);

// Sections that should show the AI impact callout (not outside-box or dream-jobs)
const AI_IMPACT_SECTIONS = ['first-career', 'second-career', 'third-career', 'runner-up'];

// Returns true if the feedback text is essentially "no changes" boilerplate
const isEmptyFeedback = (text: string): boolean => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  return (
    normalized.includes('no changes needed') ||
    normalized.includes('no changes were made') ||
    normalized.includes('no feedback was provided') ||
    normalized.includes('no adjustments needed') ||
    normalized.includes('no modifications') ||
    normalized === ''
  );
};

// Styled feedback and explore cards that appear below section content
const FeedbackExploreCards: React.FC<{
  feedback?: string | null;
  explore?: string | null;
  showAILegend?: boolean;
}> = ({ feedback, explore, showAILegend }) => {
  const hasMeaningfulFeedback = feedback && !isEmptyFeedback(feedback);

  return (
  <>
    {showAILegend && hasMeaningfulFeedback && <AILegend />}
    {hasMeaningfulFeedback && (
      <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">💬</span>
          <h4 className="font-semibold text-amber-800">Chat Session Feedback</h4>
        </div>
        <div className="text-amber-900">
          <MarkdownContent content={feedback} />
        </div>
      </div>
    )}
    {explore && (
      <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔍</span>
          <h4 className="font-semibold text-blue-800">Explore More</h4>
        </div>
        <div className="text-blue-900">
          <MarkdownContent content={explore} />
        </div>
      </div>
    )}
  </>
  );
};

// Collapsible accordion for multi-career sections (runner-up, outside-box, dream-jobs).
// Replaces the old JUMP TO navigation — each career is its own expandable block.
const CollapsibleCareerAccordion: React.FC<{
  sections: ReportSection[];
  showAILegend: boolean;
  showAIImpact?: boolean;
}> = ({ sections, showAILegend, showAIImpact = false }) => {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section, idx) => {
        const isOpen = openIndices.has(idx);
        const title = stripHtml(section.title || `Career ${idx + 1}`);

        // Strip leading heading from content — the title is shown in the accordion header instead
        let bodyMarkdown = htmlToMarkdown(section.content || '');
        bodyMarkdown = bodyMarkdown.replace(/^#{1,4}\s+\**.*?\**\s*\n+/, '').trim();

        // Extract AI impact into its own callout if applicable
        let mainContent = bodyMarkdown;
        let aiImpactContent: string | null = null;
        if (showAIImpact) {
          const extracted = extractAIImpactSection(bodyMarkdown);
          mainContent = extracted.contentWithoutAI;
          aiImpactContent = extracted.aiImpactContent;
        }

        return (
          <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Accordion header — always visible */}
            <button
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-lg font-bold text-atlas-navy font-heading m-0 leading-snug">
                {title}
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 shrink-0 ml-3 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Collapsible body */}
            {isOpen && (
              <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                {/* Match/AI-impact/feasibility pills — same as the chat */}
                <CareerScoreCard
                  score={toScore(section.score)}
                  aiImpact={extractAIImpact(section.content || '')}
                  feasibility={extractFeasibility(section.content || '')}
                />
                <div
                  className="text-gray-700 leading-relaxed"
                  style={{ fontSize: '16px', lineHeight: '1.8' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={dashboardComponents}>
                    {DOMPurify.sanitize(mainContent)}
                  </ReactMarkdown>
                  {aiImpactContent && <AIImpactCallout content={aiImpactContent} />}
                  <FeedbackExploreCards
                    feedback={section.feedback}
                    explore={section.explore}
                    showAILegend={showAILegend && idx === 0}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

interface GroupedSections {
  [uiSectionId: string]: ReportSection[];
}

interface ExpandedSectionViewProps {
  expandedSection: string;
  chapters: any[];
  groupedSections: GroupedSections;
  getSectionContent: (chapterId: string, sectionId: string) => string;
  getNextSection: (chapterId: string, sectionId: string) => any;
  getPreviousSection: (chapterId: string, sectionId: string) => any;
  getNextCareer: (careerId: string) => any;
  getPreviousCareer: (careerId: string) => any;
  onSectionExpand: (sectionId: string | null) => void;
  onSectionRead?: (sectionId: string) => void;
}

const ExpandedSectionView: React.FC<ExpandedSectionViewProps> = ({
  expandedSection,
  chapters,
  groupedSections,
  getSectionContent,
  getNextSection,
  getPreviousSection,
  getNextCareer,
  getPreviousCareer,
  onSectionExpand,
  onSectionRead
}) => {
  const navigate = useNavigate();

  // Career sections that should show AI Legend (all except dream-jobs)
  const careerSectionsWithAILegend = ['first-career', 'second-career', 'third-career', 'runner-up', 'outside-box'];

  // Multi-item sections use collapsible accordions instead of one long page
  const multiItemSections = ['runner-up', 'outside-box', 'dream-jobs'];

  const getCareerTitle = (careerId: string) => {
    const sectionTitles: Record<string, string> = {
      'first-career': 'Primary Career Match',
      'second-career': 'Second Career Match',
      'third-career': 'Third Career Match',
      'runner-up': 'Runner-up Careers',
      'outside-box': 'Outside-the-Box Careers',
      'dream-jobs': 'Dream Job Analysis'
    };

    if (multiItemSections.includes(careerId)) {
      return sectionTitles[careerId] || careerId;
    }

    const sections = groupedSections[careerId];
    if (sections && sections.length > 0 && sections[0].title) {
      return stripHtml(sections[0].title);
    }

    return sectionTitles[careerId] || careerId;
  };

  const getSectionDescription = (careerId: string) => {
    const descriptions: Record<string, string> = {
      'first-career': 'Your top career match based on your profile',
      'second-career': 'A strong alternative career path for you',
      'third-career': 'Another well-suited career option',
      'runner-up': 'Additional career options worth considering',
      'outside-box': 'Creative career paths based on your unique interests',
      'dream-jobs': 'Feasibility analysis of your dream career aspirations'
    };
    return descriptions[careerId] || 'Detailed career analysis and recommendations';
  };

  // Career section IDs that use the career view layout
  const careerSectionIds = ['first-career', 'second-career', 'third-career', 'runner-up', 'outside-box', 'dream-jobs'];

  // ── Scroll-based read detection ────────────────────────────────────
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !onSectionRead) return;

    let marked = false;
    const sectionId = expandedSection;

    const markRead = () => {
      if (marked) return;
      marked = true;
      onSectionRead(sectionId);
    };

    const handleScroll = () => {
      if (!contentEl || marked) return;
      const rect = contentEl.getBoundingClientRect();
      const scrolledPast = Math.max(0, -rect.top);
      if (scrolledPast >= Math.max(rect.height * 0.3, 150)) {
        markRead();
      }
    };

    // For short content that fits in the viewport, mark read after 8 seconds
    const timerId = window.setTimeout(() => {
      if (!contentEl || marked) return;
      const rect = contentEl.getBoundingClientRect();
      if (rect.height <= window.innerHeight * 1.3) {
        markRead();
      }
    }, 8000);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timerId);
    };
  }, [expandedSection, onSectionRead]);

  // ── Render helpers for content sections ────────────────────────────

  // Render a single-item section's content (about-you sections or single careers)
  const renderSingleSectionContent = (sectionId: string, chapterId: string, showAILegend: boolean) => {
    const dbSections = groupedSections[sectionId];
    const dbSection = dbSections?.[0];

    if (!dbSection) {
      return <p className="text-gray-500 italic">Content not available yet.</p>;
    }

    let content = dbSection.content || '';

    // For career sections with a proper header above, strip the leading heading
    // to avoid duplicate titles (DB content often starts with ### **Career Title**)
    if (careerSectionIds.includes(sectionId)) {
      const converted = htmlToMarkdown(content);
      content = converted.replace(/^#{1,4}\s+\**.*?\**\s*\n+/, '').trim();
    }

    // Extract AI impact section into its own callout for eligible career sections
    let mainContent = content;
    let aiImpactContent: string | null = null;
    if (AI_IMPACT_SECTIONS.includes(sectionId)) {
      const extracted = extractAIImpactSection(htmlToMarkdown(content));
      mainContent = extracted.contentWithoutAI;
      aiImpactContent = extracted.aiImpactContent;
    }

    const isCareer = careerSectionIds.includes(sectionId);
    return (
      <>
        {/* Match/AI-impact/feasibility pills — same as the chat */}
        {isCareer && (
          <CareerScoreCard
            score={toScore(dbSection.score)}
            aiImpact={extractAIImpact(dbSection.content || '')}
            feasibility={extractFeasibility(dbSection.content || '')}
          />
        )}
        <MarkdownContent content={mainContent} />
        {aiImpactContent && <AIImpactCallout content={aiImpactContent} />}
        <FeedbackExploreCards
          feedback={dbSection.feedback}
          explore={dbSection.explore}
          showAILegend={showAILegend}
        />
      </>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────

  return (
    <Card className="mb-6">
      <CardContent className="p-0" ref={contentRef}>
        {/* ── About You sections (non-career) ── */}
        {chapters.map(chapter =>
          chapter.sections.map((section: any) => {
            if (section.id !== expandedSection) return null;
            if (careerSectionIds.includes(section.id)) return null;

            const nextSection = getNextSection(chapter.id, section.id);
            const previousSection = getPreviousSection(chapter.id, section.id);

            return (
              <div key={section.id}>
                {/* Close button */}
                <div className="flex justify-end p-4 border-b border-gray-100">
                  <button
                    onClick={() => onSectionExpand(null)}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="h-5 w-5 text-gray-600" />
                  </button>
                </div>

                <div className="p-6 md:p-8 lg:p-10">
                  <div className="max-w-prose mx-auto">
                    {/* Section header */}
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-atlas-navy mb-2">{section.title}</h2>
                      <p className="text-gray-600">{section.description}</p>
                    </div>

                    {/* Content */}
                    <div
                      className="text-gray-700 leading-relaxed"
                      style={{ fontSize: '16px', lineHeight: '1.8' }}
                    >
                      {renderSingleSectionContent(section.id, chapter.id, false)}
                    </div>

                    {/* Prev / Next nav */}
                    {(previousSection || nextSection) && (
                      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                        <div>
                          {previousSection && (
                            <button
                              onClick={() => onSectionExpand(previousSection.section.id)}
                              className="flex items-center text-atlas-blue hover:text-atlas-navy transition-colors font-medium"
                            >
                              <ArrowLeft className="h-4 w-4 mr-2" />
                              Previous: {previousSection.section.title}
                            </button>
                          )}
                        </div>
                        <div>
                          {nextSection && (
                            <button
                              onClick={() => onSectionExpand(nextSection.section.id)}
                              className="flex items-center text-atlas-blue hover:text-atlas-navy transition-colors font-medium"
                            >
                              Next: {nextSection.section.title}
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* ── Career sections ── */}
        {careerSectionIds.includes(expandedSection) && (
          <div>
            {/* Close button */}
            <div className="flex justify-end p-4 border-b border-gray-100">
              <button
                onClick={() => onSectionExpand(null)}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 md:p-8 lg:p-10">
              <div className="max-w-prose mx-auto">
                {/* Multi-item sections → collapsible accordions */}
                {multiItemSections.includes(expandedSection) && groupedSections[expandedSection] ? (
                  <>
                    {/* Section header for multi-item */}
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-atlas-navy mb-2">{getCareerTitle(expandedSection)}</h2>
                      <p className="text-gray-600">{getSectionDescription(expandedSection)}</p>
                    </div>
                    <CollapsibleCareerAccordion
                      sections={groupedSections[expandedSection]}
                      showAILegend={careerSectionsWithAILegend.includes(expandedSection)}
                      showAIImpact={AI_IMPACT_SECTIONS.includes(expandedSection)}
                    />
                  </>
                ) : (
                  /* Single career sections (top 3) → header + content */
                  <>
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-atlas-navy mb-2">{getCareerTitle(expandedSection)}</h2>
                      <p className="text-gray-600">{getSectionDescription(expandedSection)}</p>
                    </div>
                    <div
                      className="text-gray-700 leading-relaxed"
                      style={{ fontSize: '16px', lineHeight: '1.8' }}
                    >
                      {renderSingleSectionContent(
                        expandedSection,
                        'career-suggestions',
                        careerSectionsWithAILegend.includes(expandedSection)
                      )}
                    </div>
                  </>
                )}

                {/* Job search CTA — temporarily hidden while feature is in testing.
                    Testers can access the feature directly via /jobs?career={sectionId}. */}

                {/* Prev / Next career nav */}
                {(() => {
                  const nextCareer = getNextCareer(expandedSection);
                  const previousCareer = getPreviousCareer(expandedSection);
                  return (previousCareer || nextCareer) && (
                    <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                      <div>
                        {previousCareer && (
                          <button
                            onClick={() => onSectionExpand(previousCareer.id)}
                            className="flex items-center text-atlas-blue hover:text-atlas-navy transition-colors font-medium"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Previous: {previousCareer.title}
                          </button>
                        )}
                      </div>
                      <div>
                        {nextCareer && (
                          <button
                            onClick={() => onSectionExpand(nextCareer.id)}
                            className="flex items-center text-atlas-blue hover:text-atlas-navy transition-colors font-medium"
                          >
                            Next: {nextCareer.title}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExpandedSectionView;
