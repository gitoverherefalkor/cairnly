# Share Card Redesign

Refresh the LinkedIn-ready share card modal so users can share *either* a personality quote *or* a best-fit career, with cleaner visuals and a better quote source.

## Why

Current share card (`src/components/dashboard/v2/ShareCardModal.tsx`) has four problems Sjoerd flagged:

1. Locked to the Top-1 career — no way to share Top 2/3 or an outside-the-box career.
2. Uses the old `CairnGlyph` SVG stacked-stones drawing; the rest of the product has moved to the `cairn_symbol_invert.png` mark used in the About section.
3. The giant golden opening quote mark (`❝`, 96px) sits on top of the first letter of the quote.
4. Quote candidates are just `firstSentences(content, 1)` of section bodies — they read awkwardly because they pick up the section heading prefix ("Identifying Your Core Strengths You build things.").

## Design

### Two share types, one modal

Add a toggle at the top of the modal — pill group, two options: `Personality` / `Best-fit role`. Default to `Best-fit role`. The card preview re-renders on switch.

Both types share the same visual treatment (see Visual below); only the right-panel content and the quote source change.

### Type A — Personality card

- **Section picker**: vertical button list of available personality sections, labeled by their section title. Source sections (in this order, only render the ones present): `strengths`, `values`, `approach` (or `personality_team`), `development`, `exec_summary` (or `executive_summary`).
- **Quote picker**: 3–4 candidate sentences extracted from the selected section. Extraction strips the heading text from the front (so "Identifying Your Core Strengths" no longer prefixes the first sentence) and picks sentences between 30–220 characters.
- **Right panel content**: `FROM MY REPORT` eyebrow → first name + "shares a line from their Cairnly report" → no career title or match bar.

### Type B — Best-fit role card

- **Role picker**: vertical button list with one row per career. Includes:
  - `top_career_1`, `top_career_2`, `top_career_3` (always)
  - All `outside_box` careers (zero or more — usually 1–3)
  - Each row shows the career title and (for top 3) the match %.
- Default selection: `top_career_1`.
- **Quote picker**: 3–4 candidate sentences extracted from the **"Why this role fits you"** subsection of the selected career body (for outside-box careers, the subsection is **"Why this might be a fit"**). If no such subsection is found, fall back to `firstSentences(content, 3)` of the whole career body.
- **Right panel content**: existing layout — career title + match % bar (no match bar for outside-box, just title).

### Visual fixes (apply to both card types)

1. **Drop the giant `❝`.** Remove the absolute-positioned 96px quote mark entirely. The cream paper + display-font quote already reads as a quotation.
2. **Replace `CairnGlyph kind="capstone"`** in the right-panel header with `cairn_symbol_invert.png` (imported from `src/logos/cairnly-logo/cairn_symbol_invert.png`), rendered at ~64px height.
3. **Right-panel background image**: swap `/dashboard/cairn_trail_landscape.jpg` (constant `CAIRN_TRAIL_URL`) for `src/logos/Cairn_image_hero.png` imported as a module asset. Keep the dark overlay gradient so text stays legible.
4. **Cairn symbol watermark behind the right-panel content**: faint `cairn_symbol_invert.png` positioned right-center at ~9% opacity, mirroring the `WhyWeBuiltThis` About section treatment. Sits above the photo background, below the text content.

## Implementation

### Files changed

- `src/components/dashboard/v2/ShareCardModal.tsx` — add card-type toggle; add role picker for Type B; consume two separate quote arrays; render new visual treatment.
- `src/pages/Dashboard.tsx` — build the data the modal needs:
  - `personalityShares`: `Array<{ sectionType, title, quotes: string[] }>`
  - `roleShares`: `Array<{ sectionType, title, matchPct, quotes: string[] }>`
- `src/components/dashboard/v2/dashboardV2Shared.tsx` — add two small helpers:
  - `extractSubsectionContent(body, headingPatterns: string[]): string | null` — find an `<h3>`/`<h4>`/`<h5>` whose text loosely matches one of the patterns, return the HTML between it and the next heading.
  - `pickShareSentences(body, sectionTitleToStrip?: string, max = 4): string[]` — clean the body to text, optionally strip the leading section title, split into sentences, filter by length (30–220 chars), dedupe, cap at `max`.

### Data flow

```
Dashboard.tsx
  ├─ for each personality section_type:
  │     pickShareSentences(content, title) → quotes[]
  │     push { sectionType, title, quotes } to personalityShares
  └─ for each career (top_career_1..3, outside_box[]):
        body = career.content
        subsection = extractSubsectionContent(body, ['why this role fits you', 'why this might be a fit'])
        quotes = pickShareSentences(subsection ?? body)
        push { sectionType, title, matchPct, quotes } to roleShares
  → pass both arrays as props to ShareCardModal
```

### Out of scope

- No n8n workflow changes.
- No Supabase migrations.
- No new section_types or report fields.
- LinkedIn "share intent" deep-link is not added — download PNG behavior stays.
- Runner-ups and dream-jobs are not in the role picker (per Sjoerd's call).

## Acceptance

- Modal opens with `Best-fit role` selected by default, showing Top 1 career, with 3–4 sentences pulled from its "Why this role fits you" subsection.
- Toggling to `Personality` shows the available personality sections; picking one repopulates the quote list.
- Quote candidates no longer start with a section heading prefix ("Identifying Your Core Strengths You build things." should not appear).
- Giant `❝` is gone from the card.
- Right-panel uses `Cairn_image_hero.png` as the photo background, with `cairn_symbol_invert.png` as a faint watermark behind the content.
- The old `CairnGlyph` capstone SVG is no longer rendered on the share card (the import stays in `dashboardV2Shared.tsx` for other uses).
- PNG export still produces a 1200×627 file.
