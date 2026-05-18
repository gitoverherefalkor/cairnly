# Career Comparison (Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual career-comparison block (5-axis fit-radar + headline + "Explain this comparison" button) to the Career 2 and Career 3 messages in the Cairnly AI chat.

**Architecture:** WF4 (n8n) writes `fit_scores` + `comparison` into each `top_career` row's `metadata` JSONB column (handled separately — not in this plan). The frontend reads that metadata via the existing `useReportSections` hook, renders a pure SVG radar component, wraps it in a chat card, and attaches the card to Career 2/3 messages in `ChatMessage`. The "Explain" button posts the pre-written explanation into the chat as a bot message via the existing `addMessage` function.

**Tech Stack:** React + TypeScript, Vite, Tailwind CSS, inline SVG (no charting library).

**Scope:** Frontend only. The WF4 prompt + `Split Top3` code node are applied separately by the user; no database migration is needed (the `metadata` column already exists). Dashboard placement is a separate effort.

**Testing note:** This project has no test runner configured and the team convention (CLAUDE.md) is visual verification in the browser. Tasks therefore use a build check (`npm run build`) plus browser verification rather than unit tests. The radar component degrades gracefully (renders nothing) when `fit_scores` is absent, so it is safe to ship before any report carries the new metadata.

---

## File Structure

- **Create** `src/components/career/CareerComparisonRadar.tsx` — pure, presentational SVG radar. No app coupling; reusable on the dashboard later. Built aspect-flexible (SVG `viewBox`, scales to container).
- **Create** `src/components/chat/CareerComparisonCard.tsx` — chat-specific wrapper: headline + radar + legend + "Explain" button. Assembles radar data from report sections.
- **Modify** `src/hooks/useReportSections.ts` — extend the `metadata` type with `fit_scores` and `comparison`; export `FitScores` / `CareerComparison` types.
- **Modify** `src/components/chat/ChatMessage.tsx` — detect a Career 2/3 message and render `CareerComparisonCard`; add the `onComparisonExplain` prop.
- **Modify** `src/components/chat/ChatMessages.tsx` — thread the `onComparisonExplain` prop through.
- **Modify** `src/components/chat/ChatContainer.tsx` — supply `onComparisonExplain` (calls `addMessage('bot', ...)`).

---

## Task 1: Extend the report-section metadata type

**Files:**
- Modify: `src/hooks/useReportSections.ts`

- [ ] **Step 1: Add the fit-score types and extend `metadata`**

In `src/hooks/useReportSections.ts`, immediately above the `ReportSection` interface (currently around line 7), add:

```typescript
// Five fit axes for the career comparison radar. Each is 1-5, oriented as
// fit-for-this-candidate (5 = excellent fit). Written by WF4 into metadata.
export interface FitScores {
  autonomy: number;
  social: number;
  pace: number;
  stability: number;
  schedule: number;
}

// Pre-written comparison shown on Career 2 and Career 3. headline = the
// one-line main difference; explanation = the paragraph the "Explain this
// comparison" button posts into the chat.
export interface CareerComparison {
  headline: string;
  explanation: string;
}
```

Then change the `metadata` field of the `ReportSection` interface from:

```typescript
  metadata: { personality_scores?: Record<string, number> } | null;
```

to:

```typescript
  metadata: {
    personality_scores?: Record<string, number>;
    fit_scores?: FitScores;
    comparison?: CareerComparison;
  } | null;
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReportSections.ts
git commit -m "Add fit-score and comparison types to report section metadata"
```

---

## Task 2: Build the pure radar component

**Files:**
- Create: `src/components/career/CareerComparisonRadar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/career/CareerComparisonRadar.tsx` with this exact content:

```tsx
import React from 'react';
import type { FitScores } from '@/hooks/useReportSections';

export interface RadarCareer {
  label: string;
  scores: FitScores;
  color: string; // hex
  focal: boolean;
}

interface CareerComparisonRadarProps {
  careers: RadarCareer[];
  size?: number; // rendered px width; SVG scales down on narrow screens
}

// The five comparison axes, clockwise from the top. `key` matches FitScores
// fields; `tip` is the hover tooltip copy shown on the axis label.
const AXES: { key: keyof FitScores; label: string; angle: number; tip: string }[] = [
  { key: 'autonomy', label: 'Autonomy', angle: -90, tip: "How well the role's independence matches your need to make your own decisions." },
  { key: 'stability', label: 'Stability', angle: -18, tip: 'How well the income and path stability match your need for security.' },
  { key: 'schedule', label: 'Schedule', angle: 54, tip: 'How well the working schedule matches your work-life-balance needs.' },
  { key: 'pace', label: 'Pace & pressure', angle: 126, tip: "How well the role's intensity and pressure match your stress tolerance." },
  { key: 'social', label: 'Social load', angle: 198, tip: 'How well the people and interaction demands fit your social energy.' },
];

const CX = 160;
const CY = 150;
const MAX_R = 105; // radius for a score of 5
const LABEL_R = 128;

function pointAt(angleDeg: number, score: number): { x: number; y: number } {
  const clamped = Math.max(1, Math.min(5, score));
  const r = (clamped / 5) * MAX_R;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function polygonPoints(scores: FitScores): string {
  return AXES.map((a) => {
    const p = pointAt(a.angle, scores[a.key]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

export const CareerComparisonRadar: React.FC<CareerComparisonRadarProps> = ({
  careers,
  size = 320,
}) => {
  if (!careers || careers.length === 0) return null;

  const rings = [1, 2, 3, 4, 5].map((lvl) => (lvl / 5) * MAX_R);
  // Draw non-focal careers first so the focal polygon sits on top.
  const ordered = [...careers].sort((a, b) => Number(a.focal) - Number(b.focal));

  return (
    <svg
      viewBox="-50 0 420 305"
      width={size}
      style={{ maxWidth: '100%', height: 'auto' }}
      role="img"
      aria-label="Career comparison radar"
    >
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke={i === rings.length - 1 ? '#e2e8f0' : '#eef2f6'}
          strokeWidth={1}
        />
      ))}

      {AXES.map((a) => {
        const p = pointAt(a.angle, 5);
        return (
          <line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#cbd5e1" strokeWidth={1} />
        );
      })}

      {ordered.map((c) => (
        <polygon
          key={c.label}
          points={polygonPoints(c.scores)}
          fill={c.focal ? c.color : 'none'}
          fillOpacity={c.focal ? 0.2 : undefined}
          stroke={c.color}
          strokeWidth={c.focal ? 2.5 : 2}
        />
      ))}

      {ordered
        .filter((c) => c.focal)
        .map((c) =>
          AXES.map((a) => {
            const p = pointAt(a.angle, c.scores[a.key]);
            return <circle key={`${c.label}-${a.key}`} cx={p.x} cy={p.y} r={3.5} fill={c.color} />;
          }),
        )}

      {AXES.map((a) => {
        const rad = (a.angle * Math.PI) / 180;
        const x = CX + LABEL_R * Math.cos(rad);
        const y = CY + LABEL_R * Math.sin(rad);
        const cos = Math.cos(rad);
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <text
            key={a.key}
            x={x.toFixed(1)}
            y={(y + 4).toFixed(1)}
            textAnchor={anchor}
            fontSize={12}
            fontWeight={600}
            fill="#1e293b"
            style={{ cursor: 'help' }}
          >
            {a.label}
            <title>{a.tip}</title>
          </text>
        );
      })}
    </svg>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: build succeeds. The component is not yet imported anywhere, which is fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/career/CareerComparisonRadar.tsx
git commit -m "Add pure SVG radar component for career comparison"
```

---

## Task 3: Build the chat comparison card

**Files:**
- Create: `src/components/chat/CareerComparisonCard.tsx`

This card assembles radar data from report sections, shows the headline, the radar, a legend, and the "Explain this comparison" button.

- [ ] **Step 1: Create the component**

Create `src/components/chat/CareerComparisonCard.tsx` with this exact content:

```tsx
import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import { CareerComparisonRadar, type RadarCareer } from '@/components/career/CareerComparisonRadar';

interface CareerComparisonCardProps {
  // All report sections (from useReportSections) — used to read the
  // top_career rows and their fit_scores.
  sections: ReportSection[];
  // Which career this card belongs to.
  focalSectionType: 'top_career_2' | 'top_career_3';
  // Posts the pre-written explanation into the chat as a bot message.
  onExplain: (explanation: string) => void;
}

const FOCAL_COLOR = '#0d9488';
const NON_FOCAL_COLORS: Record<string, string> = {
  top_career_1: '#f59e0b',
  top_career_2: '#6366f1',
};

// Career order on screen — the careers plotted depend on the focal one.
const CAREER_ORDER = ['top_career_1', 'top_career_2', 'top_career_3'] as const;

function stripHtml(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export const CareerComparisonCard: React.FC<CareerComparisonCardProps> = ({
  sections,
  focalSectionType,
  onExplain,
}) => {
  const [explained, setExplained] = useState(false);

  const focal = sections.find((s) => s.section_type === focalSectionType);
  if (!focal || !focal.metadata?.fit_scores || !focal.metadata?.comparison) {
    return null;
  }

  // Plot every career up to and including the focal one.
  const focalIndex = CAREER_ORDER.indexOf(focalSectionType);
  const careers: RadarCareer[] = [];
  for (let i = 0; i <= focalIndex; i++) {
    const type = CAREER_ORDER[i];
    const section = sections.find((s) => s.section_type === type);
    const scores = section?.metadata?.fit_scores;
    if (!section || !scores) continue;
    const isFocal = type === focalSectionType;
    careers.push({
      label: stripHtml(section.title) || `Career ${i + 1}`,
      scores,
      color: isFocal ? FOCAL_COLOR : NON_FOCAL_COLORS[type] ?? '#94a3b8',
      focal: isFocal,
    });
  }

  // Need at least the focal career + one other to be a comparison.
  if (careers.length < 2) return null;

  const { headline, explanation } = focal.metadata.comparison;

  const handleExplain = () => {
    if (explained) return;
    onExplain(explanation);
    setExplained(true);
  };

  return (
    <div className="mt-4 rounded-xl border border-atlas-teal/30 bg-white p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-atlas-teal mb-1.5">
        How this differs
      </div>
      <p className="text-sm text-atlas-navy font-medium leading-snug mb-3">{headline}</p>

      <div className="flex justify-center">
        <CareerComparisonRadar careers={careers} />
      </div>

      <div className="flex flex-wrap gap-2 mt-2 mb-3">
        {careers.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-atlas-navy"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={handleExplain}
        disabled={explained}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
          explained
            ? 'bg-gray-100 text-gray-400 cursor-default'
            : 'bg-atlas-teal text-white hover:bg-atlas-teal/90'
        }`}
      >
        <MessageCircle size={14} />
        {explained ? 'Explanation added below' : 'Explain this comparison'}
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/CareerComparisonCard.tsx
git commit -m "Add chat career-comparison card with explain button"
```

---

## Task 4: Render the card on Career 2/3 messages

**Files:**
- Modify: `src/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Import the card**

In `src/components/chat/ChatMessage.tsx`, add this import after the existing `MessageVoiceButton` import (line 10):

```typescript
import { CareerComparisonCard } from './CareerComparisonCard';
```

- [ ] **Step 2: Add the `onComparisonExplain` prop**

In the `ChatMessageProps` interface, add this field directly after `onBookmarkToggle?: (messageId: string) => void;` (line 52):

```typescript
  // Posts the pre-written comparison explanation into the chat as a bot
  // message. Supplied by ChatContainer; only used by Career 2/3 messages.
  onComparisonExplain?: (content: string) => void;
```

- [ ] **Step 3: Accept the prop in the component signature**

Find the `ChatMessage` component's destructured props (the `const ChatMessage = ({ ... }) =>` or `function ChatMessage({ ... })` declaration). Add `onComparisonExplain` to the destructured list alongside the other props.

- [ ] **Step 4: Detect a Career 2/3 message**

Add this `useMemo` near the other derived values, just before the `enrichedComponents` useMemo (around line 993). It reuses the existing `findSectionByTitle` helper:

```typescript
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
```

- [ ] **Step 5: Render the card**

In the return JSX, find the `{messageId && (` block that renders `<MessageVoiceButton ... />` (line 1110). Directly **above** that block, add:

```tsx
        {comparisonSection && sections && onComparisonExplain && (
          <CareerComparisonCard
            sections={sections}
            focalSectionType={
              comparisonSection.section_type as 'top_career_2' | 'top_career_3'
            }
            onExplain={onComparisonExplain}
          />
        )}
```

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: build succeeds. (The card will not render yet — `onComparisonExplain` is still undefined until Task 5.)

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ChatMessage.tsx
git commit -m "Render comparison card on Career 2 and Career 3 chat messages"
```

---

## Task 5: Wire the explain handler through the chat tree

`addMessage` lives in `ChatContainer` (via `useChatMessages`). It is passed to the `<ChatMessages>` list, which renders each `<ChatMessage>`. This task threads a new `onComparisonExplain` prop down that path — mirroring the existing `onAskAboutRole` prop.

**Files:**
- Modify: `src/components/chat/ChatMessages.tsx`
- Modify: `src/components/chat/ChatContainer.tsx`

- [ ] **Step 1: Add the prop to `ChatMessagesProps`**

In `src/components/chat/ChatMessages.tsx`, find the `ChatMessagesProps` interface (around line 17). Add, next to `onAskAboutRole`:

```typescript
  // Posts a comparison explanation into the chat as a bot message.
  onComparisonExplain?: (content: string) => void;
```

- [ ] **Step 2: Destructure the prop**

In the `ChatMessages` component definition (the `forwardRef` callback around line 72), add `onComparisonExplain` to the destructured props list, next to `onAskAboutRole`.

- [ ] **Step 3: Pass it to `ChatMessage`**

In the `<ChatMessage ... />` JSX (around line 252-273), add this prop next to `onAskAboutRole={onAskAboutRole}`:

```tsx
                  onComparisonExplain={onComparisonExplain}
```

- [ ] **Step 4: Supply the handler from `ChatContainer`**

In `src/components/chat/ChatContainer.tsx`, find the `<ChatMessages ... />` JSX (around line 778-804). Add this prop next to `onAskAboutRole={handleAskAboutRole}` (line 790):

```tsx
          onComparisonExplain={(content) => addMessage('bot', content)}
```

`addMessage` is already in scope here (destructured from `useChatMessages` at line 193). Default persistence applies, so the explanation is saved to the `chat_messages` table and survives a reload.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ChatMessages.tsx src/components/chat/ChatContainer.tsx
git commit -m "Wire comparison explain handler through the chat component tree"
```

---

## Task 6: End-to-end verification

**Files:** none (verification only)

The radar needs a report whose `top_career_2/3` rows carry `metadata.fit_scores` and `metadata.comparison`. That data is produced by the updated WF4 (applied separately). Verify in this order:

- [ ] **Step 1: Confirm graceful degradation on existing reports**

Start the dev server (`npm run dev`), open the chat for an existing pre-feature report, scroll to a Career 2 or 3 message. Expected: no comparison card appears, no console errors. (Old reports have no `fit_scores`; the card returns `null`.)

- [ ] **Step 2: Generate a fresh report**

After the WF4 prompt + `Split Top3` code-node changes are live, run a full assessment so a new report is generated. In Supabase, confirm a `top_career_2` row has `metadata` containing `fit_scores` (5 keys) and `comparison` (`headline`, `explanation`).

- [ ] **Step 3: Verify the card in the chat**

Open the chat for the new report. On the Career 2 message: confirm the comparison card renders with the headline, a 2-career radar, a legend, and the "Explain this comparison" button. On the Career 3 message: confirm a 3-career radar. Career 1: confirm no card.

- [ ] **Step 4: Verify axis tooltips**

Hover each of the 5 axis labels. Expected: a native tooltip with the explanatory copy appears.

- [ ] **Step 5: Verify the explain button**

Click "Explain this comparison". Expected: a new bot message with the explanation paragraph appears at the bottom of the chat; the button becomes disabled and reads "Explanation added below". Reload the page and confirm the explanation message persisted.

- [ ] **Step 6: Responsive check**

Narrow the browser to a mobile width. Expected: the radar SVG scales down inside the message bubble without clipping or overflow.

- [ ] **Step 7: Final commit (if any verification fixes were made)**

```bash
git add -A
git commit -m "Fix issues found during career comparison verification"
```

---

## Self-Review

**Spec coverage:** Spec sections map to tasks — data model → Task 1; radar component → Task 2; chat card + explain button → Task 3; chat placement → Tasks 4-5; verification → Task 6. WF4 prompt/code-node and the `metadata` column are explicitly out of this plan's scope (applied separately; column already exists). WF5.3 needs no change (per spec).

**Placeholders:** None — all components have complete code; all edits cite exact files and anchor lines.

**Type consistency:** `FitScores` is defined in Task 1 and imported by `CareerComparisonRadar` (Task 2) and indirectly by `CareerComparisonCard` (Task 3). `RadarCareer` is defined/exported in Task 2 and imported in Task 3. `onComparisonExplain: (content: string) => void` has the same signature in `ChatMessageProps` (Task 4), `ChatMessagesProps` (Task 5), and the `ChatContainer` handler (Task 5). `focalSectionType` is typed `'top_career_2' | 'top_career_3'` consistently in Task 3 and Task 4.
