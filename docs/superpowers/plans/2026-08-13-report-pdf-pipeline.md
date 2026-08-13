# Report PDF Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a print-quality, multi-page PDF of a user's finished career report (all charts, pills and styling intact) server-side, on demand, and store it in Supabase Storage.

**Architecture:** A dedicated `/report/print` React route renders an A4-paginated version of the report using the *same* palette, pill components and SVG charts as the live dashboard. A Vercel serverless function running headless Chromium loads that route and prints it to PDF. Because headless Chromium has no Supabase session, the print route authenticates with a short-lived single-use render token that a public edge function exchanges for report data via the service role.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres, Storage, Deno edge functions), Vercel serverless (Node 22) with `puppeteer-core` + `@sparticuz/chromium`, Vitest.

---

## Why this order

Task 1 is a pure refactor with tests and no behaviour change — it makes the chart data available to a second consumer without duplicating logic. Tasks 2-4 build the plumbing the renderer needs. Tasks 5-6 build the visual artifact, which you can eyeball in a normal browser before any Chromium is involved. Task 7 adds Chromium. Task 8 wires it together. Task 9 gives you a button to prove it end-to-end.

Do not reorder. Task 7 is the only step with real technical risk, and everything before it is verifiable without it.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/components/dashboard/v2/reportChartData.ts` | Pure functions deriving radar axes / career-map points / comparison payloads from `ReportSection[]`. Consumed by both `DashboardV4` and the print document. |
| `src/components/dashboard/v2/reportChartData.test.ts` | Unit tests for the above. |
| `src/components/report-pdf/ReportPrintDocument.tsx` | Top-level A4 print layout: cover page, then one block per report section. |
| `src/components/report-pdf/PrintPage.tsx` | A single A4 page wrapper enforcing size and page-break behaviour. |
| `src/components/report-pdf/PrintSection.tsx` | Renders one `ReportSection` (title, pills, markdown body). |
| `src/components/report-pdf/printStyles.ts` | `@page` rules and print-specific CSS injected by the print route. |
| `src/pages/ReportPrint.tsx` | The `/report/print` route. Reads `?rt=` token, fetches data, signals readiness. |
| `supabase/functions/report-print-data/index.ts` | Public edge fn. Exchanges a render token for report JSON via service role. |
| `supabase/functions/render-report-pdf/index.ts` | Authenticated edge fn. Mints a token, calls the Vercel renderer, stores the PDF. |
| `api/render-report.js` | Vercel serverless fn. Chromium → PDF buffer. |
| `supabase/migrations/20260813120000_report_pdf_pipeline.sql` | `report_render_tokens` + `report_pdfs` tables, `report-pdfs` storage bucket. |

**Modified:**

| Path | Change |
|---|---|
| `src/components/dashboard/v2/DashboardV4.tsx:402-540` | Replace inline `useMemo` chart builders with calls into `reportChartData.ts`. |
| `src/App.tsx:135-164` | Add the `/report/print` route. |
| `vercel.json:3` | Exclude `/api/` from the SPA rewrite; add function memory/duration config. |
| `supabase/config.toml` | Add `verify_jwt` entries for the two new functions. |
| `package.json` | Add `puppeteer-core` + `@sparticuz/chromium`. |

---

## Task 1: Extract chart data builders into a tested pure module

Today the three chart payloads are built inside `DashboardV4` as `useMemo` blocks (lines 402-540). The print document needs the identical data. Copy-pasting would guarantee the two drift apart, so extract first.

**Files:**
- Create: `src/components/dashboard/v2/reportChartData.ts`
- Create: `src/components/dashboard/v2/reportChartData.test.ts`
- Modify: `src/components/dashboard/v2/DashboardV4.tsx:402-540`

---

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/v2/reportChartData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildRadarAxes,
  buildCareerMapPoints,
  buildCompareCareers,
  RADAR_COLORS,
} from './reportChartData';
import type { ReportSection } from '@/hooks/useReportSections';

// Minimal ReportSection factory — only the fields the builders read.
function section(over: Partial<ReportSection>): ReportSection {
  return {
    id: 'id-' + Math.random(),
    report_id: 'r1',
    section_type: 'top_career_1',
    title: 'A Career',
    content: '',
    order_number: 1,
    company_size_type: null,
    alternate_titles: null,
    feedback_category: null,
    feedback: null,
    explore: null,
    fb_status: null,
    score: null,
    metadata: null,
    share_quotes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  } as ReportSection;
}

describe('buildRadarAxes', () => {
  it('returns empty when no approach section exists', () => {
    expect(buildRadarAxes([section({ section_type: 'top_career_1' })])).toEqual([]);
  });

  it('normalises 1-10 scores to 0-1 and keeps the raw score', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'approach',
        metadata: { personality_scores: { strategic_depth: 8, execution_bias: 5 } },
      }),
    ]);
    expect(axes).toHaveLength(2);
    expect(axes[0]).toMatchObject({ label: 'Strategic Depth', v: 0.8, score: 8 });
    expect(axes[1]).toMatchObject({ label: 'Execution', v: 0.5, score: 5 });
  });

  it('skips axes whose score is missing or non-numeric', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'approach',
        metadata: { personality_scores: { strategic_depth: 8, execution_bias: 'x' as never } },
      }),
    ]);
    expect(axes).toHaveLength(1);
  });

  it('also accepts personality_team as the source section', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'personality_team',
        metadata: { personality_scores: { people_intuition: 10 } },
      }),
    ]);
    expect(axes).toHaveLength(1);
    expect(axes[0].v).toBe(1);
  });
});

describe('buildCareerMapPoints', () => {
  it('maps match score to y as 1 - score/100', () => {
    const pts = buildCareerMapPoints([
      section({ section_type: 'top_career_1', score: '80', title: 'Product Lead' }),
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].y).toBeCloseTo(0.2);
    expect(pts[0].label).toBe('Product Lead');
    expect(pts[0].rank).toBe(1);
  });

  it('drops sections with a non-numeric score', () => {
    expect(buildCareerMapPoints([section({ score: null })])).toEqual([]);
    expect(buildCareerMapPoints([section({ score: 'abc' })])).toEqual([]);
  });

  it('includes runner_ups as unranked secondary points', () => {
    const pts = buildCareerMapPoints([
      section({ section_type: 'top_career_1', score: '90' }),
      section({ section_type: 'runner_ups', score: '60', title: 'Ops Manager' }),
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[1].rank).toBeUndefined();
    expect(pts[1].label).toBe('Ops Manager');
  });

  it('defaults x to 0.5 when AI impact cannot be read from content', () => {
    const pts = buildCareerMapPoints([section({ score: '50', content: 'no impact marker' })]);
    expect(pts[0].x).toBe(0.5);
  });

  it('strips HTML from titles', () => {
    const pts = buildCareerMapPoints([
      section({ score: '70', title: '<h3><strong>Data Lead</strong></h3>' }),
    ]);
    expect(pts[0].label).toBe('Data Lead');
  });
});

describe('buildCompareCareers', () => {
  const fit = { autonomy: 5, stability: 4, schedule: 3, pace: 2, social: 1 };

  it('normalises the 1-5 fit scores to 0-1 in fixed axis order', () => {
    const out = buildCompareCareers([
      section({ section_type: 'top_career_1', title: 'X', metadata: { fit_scores: fit } }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].scores).toEqual([1, 0.8, 0.6, 0.4, 0.2]);
    expect(out[0].rank).toBe(1);
  });

  it('skips careers with no fit_scores', () => {
    expect(buildCompareCareers([section({ metadata: null })])).toEqual([]);
  });

  it('clamps out-of-range values into 0-1', () => {
    const out = buildCompareCareers([
      section({ metadata: { fit_scores: { ...fit, autonomy: 9, social: -3 } } }),
    ]);
    expect(out[0].scores[0]).toBe(1);
    expect(out[0].scores[4]).toBe(0);
  });

  it('exposes a stable colour per rank', () => {
    expect(RADAR_COLORS[1]).toBe('#d97706');
    expect(RADAR_COLORS[2]).toBe('#6366f1');
    expect(RADAR_COLORS[3]).toBe('#0d9488');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/dashboard/v2/reportChartData.test.ts
```

Expected: FAIL — `Failed to resolve import "./reportChartData"`.

- [ ] **Step 3: Write the module**

Create `src/components/dashboard/v2/reportChartData.ts`. This is a straight lift of the `useMemo` bodies from `DashboardV4.tsx:402-540`, with the React wrapper removed:

```ts
// Pure chart-data builders shared by the live dashboard (DashboardV4) and the
// print/PDF document. Extracted so both consumers derive identical payloads —
// previously these lived as useMemo blocks inside DashboardV4.

import { extractAIImpact, type AIImpactLevel } from '@/components/chat/CareerScoreCard';
import type { ReportSection } from '@/hooks/useReportSections';
import type { RadarAxis } from './V4PersonalityRadarSVG';
import type { CareerPoint } from './V4CareerMapSVG';
import type { CompareCareer } from './V4CompareRadarSVG';
import type { RadarCareer } from '@/components/career/CareerComparisonRadar';
import { stripHtml } from './dashboardV2Shared';

/** Polygon colours by rank. Kept identical across the front-face preview and
 *  the back-face detail radar so a polygon never changes identity. */
export const RADAR_COLORS: Record<1 | 2 | 3, string> = {
  1: '#d97706', // amber
  2: '#6366f1', // indigo
  3: '#0d9488', // teal
};

const TOPS: { type: string; rank: 1 | 2 | 3 }[] = [
  { type: 'top_career_1', rank: 1 },
  { type: 'top_career_2', rank: 2 },
  { type: 'top_career_3', rank: 3 },
];

const PERSONALITY_AXES: { key: string; label: string; short: string }[] = [
  { key: 'strategic_depth', label: 'Strategic Depth', short: 'Strategic\nDepth' },
  { key: 'execution_bias', label: 'Execution', short: 'Execution' },
  { key: 'people_intuition', label: 'People Intuition', short: 'People\nIntuition' },
  { key: 'ambiguity_tolerance', label: 'Ambiguity Tolerance', short: 'Ambiguity\nTolerance' },
  { key: 'recognition_pull', label: 'Recognition Pull', short: 'Recognition\nPull' },
];

/** Personality radar — from the approach section's metadata.personality_scores
 *  (5 axes, 1-10). Returns [] when the section or scores are absent. */
export function buildRadarAxes(sections: ReportSection[]): RadarAxis[] {
  const approach = sections.find(
    (s) => s.section_type === 'approach' || s.section_type === 'personality_team',
  );
  const ps = approach?.metadata?.personality_scores;
  if (!ps) return [];
  return PERSONALITY_AXES.map((m) => {
    const score = ps[m.key];
    if (typeof score !== 'number') return null;
    return { label: m.label, short: m.short, v: score / 10, score };
  }).filter(Boolean) as RadarAxis[];
}

/** AI exposure on the clinical 5-level scale, spread across 0..1. */
function xForImpact(impact: AIImpactLevel | null): number {
  switch (impact) {
    case 'Minimal':
      return 0.12;
    case 'Moderate':
      return 0.35;
    case 'High':
      return 0.58;
    case 'Severe':
      return 0.78;
    case 'Critical':
      return 0.92;
    default:
      return 0.5;
  }
}

/** Career map — top 3 as ranked bubbles, runner-ups as unranked secondaries.
 *  y = 1 - match/100 so the strongest match sits at the top of the chart. */
export function buildCareerMapPoints(sections: ReportSection[]): CareerPoint[] {
  const points: CareerPoint[] = [];

  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    if (!s) continue;
    const score = s.score != null ? Number(s.score) : NaN;
    if (!Number.isFinite(score)) continue;
    points.push({
      x: xForImpact(extractAIImpact(s.content || '')),
      y: 1 - score / 100,
      label: stripHtml(s.title || `Career ${rank}`),
      rank,
    });
  }

  for (const s of sections.filter((x) => x.section_type === 'runner_ups')) {
    const score = s.score != null ? Number(s.score) : NaN;
    if (!Number.isFinite(score)) continue;
    points.push({
      x: xForImpact(extractAIImpact(s.content || '')),
      y: 1 - score / 100,
      label: stripHtml(s.title || 'Runner-up'),
    });
  }

  return points;
}

/** Tuple form for the compact front-face V4CompareRadarSVG.
 *  Axis order is fixed: autonomy, stability, schedule, pace, social. */
export function buildCompareCareers(sections: ReportSection[]): CompareCareer[] {
  const out: CompareCareer[] = [];
  const norm = (n: number) => Math.max(0, Math.min(1, n / 5));
  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    const f = s?.metadata?.fit_scores;
    if (!s || !f) continue;
    out.push({
      rank,
      label: stripHtml(s.title || `Career ${rank}`),
      scores: [norm(f.autonomy), norm(f.stability), norm(f.schedule), norm(f.pace), norm(f.social)],
    });
  }
  return out;
}

/** Object form for the larger CareerComparisonRadar detail view. */
export function buildCompareCareersRich(sections: ReportSection[]): RadarCareer[] {
  const out: RadarCareer[] = [];
  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    const f = s?.metadata?.fit_scores;
    if (!s || !f) continue;
    out.push({
      label: stripHtml(s.title || `Career ${rank}`),
      scores: f,
      color: RADAR_COLORS[rank],
      focal: rank === 1,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/dashboard/v2/reportChartData.test.ts
```

Expected: PASS, 12 tests.

If `buildCompareCareers` fails the clamp test, check that `norm` applies `Math.max(0, ...)` before `Math.min(1, ...)`.

- [ ] **Step 5: Replace the inline builders in DashboardV4**

In `src/components/dashboard/v2/DashboardV4.tsx`, add to the import block (after the existing `./dashboardV2Shared` import at line 33-49):

```ts
import {
  buildRadarAxes,
  buildCareerMapPoints,
  buildCompareCareers,
  buildCompareCareersRich,
  RADAR_COLORS,
} from './reportChartData';
```

Then delete lines 402-540 (the `// ── Chart data builders ──` block through the end of `compareCareersRich`) and replace with:

```ts
  // ── Chart data builders ──────────────────────────────────────
  // Derivations live in reportChartData.ts so the print/PDF document
  // builds identical payloads from the same sections.
  const radarAxes = useMemo(() => buildRadarAxes(sections), [sections]);
  const careerMapPoints = useMemo(() => buildCareerMapPoints(sections), [sections]);
  const compareCareers = useMemo(() => buildCompareCareers(sections), [sections]);
  const compareCareersRich = useMemo(() => buildCompareCareersRich(sections), [sections]);
```

`RADAR_COLORS` was declared inline in that block — the import now supplies it. If TypeScript reports it as unused elsewhere in the file, leave the import off.

- [ ] **Step 6: Verify nothing broke**

```bash
npm run build && npx vitest run
```

Expected: build succeeds, all tests pass. The dashboard must look identical — this task changes no behaviour.

- [ ] **Step 7: Verify in the browser**

Start the dev server via the preview tool (not `npm run dev` in a shell), open `/dashboard` as a user with a completed report, and confirm the personality radar, career map and comparison radar all render exactly as before.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/v2/reportChartData.ts src/components/dashboard/v2/reportChartData.test.ts src/components/dashboard/v2/DashboardV4.tsx && git commit -m "refactor(dashboard): extract chart data builders into a tested pure module"
```

---

## Task 2: Fix the Vercel rewrite and add function config

`vercel.json` currently rewrites `/((?!assets/).*)` to `/`. That pattern matches `/api/render-report`, so the serverless function would never be reached — the SPA index.html would be served instead. This must be fixed *before* Task 7 or you will debug a phantom 404.

**Files:**
- Modify: `vercel.json:3`

---

- [ ] **Step 1: Update the rewrite and add function limits**

In `vercel.json`, change the `rewrites` array from:

```json
  "rewrites": [
    { "source": "/((?!assets/).*)", "destination": "/" }
  ],
```

to:

```json
  "rewrites": [
    { "source": "/((?!api/|assets/).*)", "destination": "/" }
  ],
  "functions": {
    "api/render-report.js": {
      "memory": 2048,
      "maxDuration": 60
    }
  },
```

`memory: 2048` is needed because Chromium is memory-hungry; the default 1024 causes intermittent OOM kills on content-heavy pages. `maxDuration: 60` requires the Pro plan (Hobby caps at 10s).

- [ ] **Step 2: Verify the JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add vercel.json && git commit -m "chore(vercel): exclude /api from the SPA rewrite and set renderer limits"
```

---

## Task 3: Database schema — render tokens, PDF records, storage bucket

Two tables and one private bucket.

`report_render_tokens` exists because headless Chromium has no Supabase session. The orchestrator mints a single-use token, Chromium presents it, and it dies within minutes.

`report_pdfs` records what was generated so the dashboard and (later) the share gate can find it.

**Files:**
- Create: `supabase/migrations/20260813120000_report_pdf_pipeline.sql`

---

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260813120000_report_pdf_pipeline.sql`:

```sql
-- Report PDF pipeline: render tokens, generated-PDF records, private bucket.
--
-- Headless Chromium (running in the Vercel renderer) has no Supabase session,
-- so it cannot read report data directly. Instead the orchestrator mints a
-- single-use, short-lived token here; the print route presents it to the
-- public report-print-data function, which validates and burns it before
-- returning data via the service role.

create table if not exists public.report_render_tokens (
  token       uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_report_render_tokens_report
  on public.report_render_tokens (report_id);
create index if not exists idx_report_render_tokens_expiry
  on public.report_render_tokens (expires_at);

-- No RLS policies: only the service role ever touches this table. RLS on with
-- zero policies means any anon/authenticated access is denied by default.
alter table public.report_render_tokens enable row level security;

-- ── Generated PDFs ──────────────────────────────────────────────────────────

create table if not exists public.report_pdfs (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  storage_path   text not null,
  byte_size      integer,
  language       text not null default 'en',
  generated_at   timestamptz not null default now(),
  -- Bump when the print layout changes so stale PDFs can be regenerated.
  layout_version integer not null default 1
);

create unique index if not exists idx_report_pdfs_one_per_report
  on public.report_pdfs (report_id);

alter table public.report_pdfs enable row level security;

-- Users may see that their own PDF exists (the dashboard needs this to decide
-- whether to show a download button). Writes stay service-role only.
drop policy if exists "own report pdfs are readable" on public.report_pdfs;
create policy "own report pdfs are readable"
  on public.report_pdfs for select
  to authenticated
  using (user_id = auth.uid());

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Private bucket. The edge functions (service role) are the only reader and
-- writer; users receive time-limited signed URLs, never direct object access.

insert into storage.buckets (id, name, public)
values ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

-- ── Housekeeping ────────────────────────────────────────────────────────────
-- Expired render tokens are dead weight. Purge daily at 03:20 UTC.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-render-tokens') then
    perform cron.unschedule('purge-expired-render-tokens');
  end if;
end $$;

select cron.schedule(
  'purge-expired-render-tokens',
  '20 3 * * *',
  $$ delete from public.report_render_tokens where expires_at < now() - interval '1 day' $$
);
```

- [ ] **Step 2: Apply the migration**

Per the project's migration-history mismatch, do NOT run `supabase db push`. Apply this single file via the Supabase MCP `apply_migration` tool, using the file's exact contents and the name `20260813120000_report_pdf_pipeline`.

- [ ] **Step 3: Verify the schema landed**

Run via MCP `execute_sql` (read-only):

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('report_render_tokens','report_pdfs')
order by table_name, ordinal_position;
```

Expected: 6 rows for `report_render_tokens`, 8 for `report_pdfs`.

```sql
select id, public from storage.buckets where id = 'report-pdfs';
```

Expected: one row, `public = false`.

- [ ] **Step 4: Regenerate TypeScript types**

Use the Supabase MCP `generate_typescript_types` tool and write the output to `src/integrations/supabase/types.ts`.

- [ ] **Step 5: Verify the build still compiles**

```bash
npm run build
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260813120000_report_pdf_pipeline.sql src/integrations/supabase/types.ts && git commit -m "feat(db): add render tokens, report_pdfs table and private PDF bucket"
```

---

## Task 4: `report-print-data` edge function

Public (no JWT) because headless Chromium presents a render token instead. The token is validated, burned, and exchanged for the report payload.

**Files:**
- Create: `supabase/functions/report-print-data/index.ts`
- Modify: `supabase/config.toml`

---

- [ ] **Step 1: Write the function**

Create `supabase/functions/report-print-data/index.ts`:

```ts
// report-print-data — exchanges a single-use render token for the report data
// needed by the /report/print route.
//
// This function is intentionally PUBLIC (verify_jwt = false): the caller is
// headless Chromium inside the Vercel renderer, which has no Supabase session.
// Security rests entirely on the render token: single-use, 10-minute lifetime,
// minted only by render-report-pdf for a report the authenticated user owns.
//
// Input:  { token: string (uuid) }
// Output: { report: {...}, sections: [...], profile: { first_name, country } }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  let token: string | undefined;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !UUID_RE.test(token)) {
    return errorResponse('Missing or malformed token', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Burn the token atomically: the update only matches an unused, unexpired
  // row, so a replayed request finds nothing and is rejected.
  const { data: burned, error: burnError } = await supabase
    .from('report_render_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('report_id, user_id')
    .maybeSingle();

  if (burnError) {
    console.error('[report-print-data] token burn failed:', burnError);
    return errorResponse('Token validation failed', 500, corsHeaders);
  }
  if (!burned) {
    // Covers unknown, already-used and expired tokens alike — deliberately
    // indistinguishable to the caller.
    return errorResponse('Invalid or expired token', 403, corsHeaders);
  }

  const [{ data: report }, { data: sections }, { data: profile }] = await Promise.all([
    supabase
      .from('reports')
      .select('id, title, status, created_at, updated_at')
      .eq('id', burned.report_id)
      .maybeSingle(),
    supabase
      .from('report_sections')
      .select('*')
      .eq('report_id', burned.report_id)
      .order('order_number', { ascending: true, nullsFirst: false }),
    supabase
      .from('profiles')
      .select('first_name, country')
      .eq('id', burned.user_id)
      .maybeSingle(),
  ]);

  if (!report) {
    return errorResponse('Report not found', 404, corsHeaders);
  }

  return new Response(
    JSON.stringify({
      report,
      sections: sections ?? [],
      profile: { first_name: profile?.first_name ?? '', country: profile?.country ?? null },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
```

- [ ] **Step 2: Register it as public in config.toml**

Append to `supabase/config.toml`:

```toml
# Called by headless Chromium inside the Vercel PDF renderer, which has no
# Supabase session. Auth is the single-use render token checked in-function.
[functions.report-print-data]
verify_jwt = false
```

- [ ] **Step 3: Verify the function type-checks**

```bash
npx deno check supabase/functions/report-print-data/index.ts
```

Expected: no errors. (If `deno` is not installed, skip — the GitHub Action will catch it on push.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/report-print-data/index.ts supabase/config.toml && git commit -m "feat(edge): add report-print-data token exchange for the PDF renderer"
```

Per the project's Edge Function auto-deploy, pushing to `main` deploys this. On a branch it is not live.

---

## Task 5: Print document components

The A4 document. Reuses `PALETTE`, the pill components and the SVG charts from `dashboardV2Shared` so the PDF matches the dashboard, but with its own paginated layout rather than the interactive one.

**Files:**
- Create: `src/components/report-pdf/printStyles.ts`
- Create: `src/components/report-pdf/PrintPage.tsx`
- Create: `src/components/report-pdf/PrintSection.tsx`
- Create: `src/components/report-pdf/ReportPrintDocument.tsx`

---

- [ ] **Step 1: Write the print stylesheet**

Create `src/components/report-pdf/printStyles.ts`:

```ts
// Print-only CSS for the /report/print route. Injected as a <style> tag by
// ReportPrint.tsx rather than living in Tailwind, because these rules must
// apply to the headless-Chromium render and must not leak into the app.

export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Each .print-page is exactly one A4 sheet. height (not min-height) keeps
     Chromium from spilling a sliver onto a following blank page. */
  .print-page {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }

  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* Never split a pill, chart or heading across a page boundary. */
  .print-nobreak {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* On-screen only: show sheet edges while developing. Chromium's PDF export
     ignores this because it prints at the @page size with no viewport chrome. */
  @media screen {
    body { background: #55606a; padding: 24px 0; }
    .print-page {
      margin: 0 auto 24px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
      background: #ffffff;
    }
  }
`;
```

- [ ] **Step 2: Write the page wrapper**

Create `src/components/report-pdf/PrintPage.tsx`:

```tsx
import React from 'react';

/** One A4 sheet. Padding is inside the fixed 210×297mm box, so content never
 *  pushes the sheet taller and creates a stray blank page. */
export const PrintPage: React.FC<{
  children: React.ReactNode;
  padded?: boolean;
}> = ({ children, padded = true }) => (
  <div className="print-page" style={{ padding: padded ? '18mm 16mm' : 0 }}>
    {children}
  </div>
);
```

- [ ] **Step 3: Write the section renderer**

Create `src/components/report-pdf/PrintSection.tsx`:

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportSection } from '@/hooks/useReportSections';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  AIImpactPill,
  MatchPill,
  MovePill,
  stripHtml,
  type AIImpactLevel,
  type MoveLevel,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { extractAIImpact } from '@/components/chat/CareerScoreCard';

/** The AI sometimes emits HTML instead of Markdown. Normalise to Markdown so
 *  the document renders through a single pipeline. Mirrors htmlToMarkdown in
 *  DashboardV4 — kept separate so print formatting can diverge if needed. */
export function htmlToMarkdown(text: string): string {
  let r = text;
  r = r.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
  r = r.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n');
  r = r.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n');
  r = r.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  r = r.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  r = r.replace(/<br\s*\/?>/gi, '\n');
  r = r.replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '\n\n');
  r = r.replace(/<ul[^>]*>/gi, '\n\n').replace(/<\/ul>/gi, '\n\n');
  r = r.replace(/<ol[^>]*>/gi, '\n\n').replace(/<\/ol>/gi, '\n\n');
  r = r.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  r = r.replace(/\n{3,}/g, '\n\n');
  return r;
}

const CAREER_TYPES = ['top_career_1', 'top_career_2', 'top_career_3', 'outside_box'];

export const PrintSection: React.FC<{ section: ReportSection }> = ({ section }) => {
  const isCareer = CAREER_TYPES.includes(section.section_type);
  const score = section.score != null ? Number(section.score) : NaN;
  const impact = isCareer ? extractAIImpact(section.content || '') : null;
  const move = section.metadata?.move as MoveLevel | undefined;

  return (
    <section style={{ marginBottom: '10mm' }}>
      <h2
        className="print-nobreak"
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: PALETTE.canvasDeep,
          margin: '0 0 6px 0',
        }}
      >
        {stripHtml(section.title || '')}
      </h2>

      {isCareer && (
        <div
          className="print-nobreak"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px 0' }}
        >
          {Number.isFinite(score) && <MatchPill pct={score} />}
          {impact && <AIImpactPill label={impact as AIImpactLevel} />}
          {move && <MovePill level={move} />}
        </div>
      )}

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10.5,
          lineHeight: 1.6,
          color: PALETTE.ink,
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {htmlToMarkdown(section.content || '')}
        </ReactMarkdown>
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Write the document**

Create `src/components/report-pdf/ReportPrintDocument.tsx`:

```tsx
import React from 'react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PrintPage } from './PrintPage';
import { PrintSection } from './PrintSection';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LOGO_WORDMARK_URL,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { V4PersonalityRadarSVG } from '@/components/dashboard/v2/V4PersonalityRadarSVG';
import { V4CareerMapSVG, V4CareerMapLegend } from '@/components/dashboard/v2/V4CareerMapSVG';
import { V4CompareRadarSVG, V4CompareLegend } from '@/components/dashboard/v2/V4CompareRadarSVG';
import {
  buildRadarAxes,
  buildCareerMapPoints,
  buildCompareCareers,
} from '@/components/dashboard/v2/reportChartData';

// Narrative order for the printed document. Sections absent from the report
// are skipped; anything not listed here is appended at the end in
// order_number order so nothing is ever silently dropped.
const SECTION_ORDER = [
  'exec_summary',
  'approach',
  'personality_team',
  'strengths',
  'development',
  'values',
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_job',
];

function orderSections(sections: ReportSection[]): ReportSection[] {
  const ranked = [...sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.section_type);
    const bi = SECTION_ORDER.indexOf(b.section_type);
    if (ai === -1 && bi === -1) return (a.order_number ?? 0) - (b.order_number ?? 0);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return ranked;
}

export const ReportPrintDocument: React.FC<{
  firstName: string;
  sections: ReportSection[];
  generatedAt: string | null;
}> = ({ firstName, sections, generatedAt }) => {
  const ordered = orderSections(sections);
  const radarAxes = buildRadarAxes(sections);
  const mapPoints = buildCareerMapPoints(sections);
  const compare = buildCompareCareers(sections);

  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <PrintPage padded={false}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.canvasDeep,
            padding: '28mm 20mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#fff',
          }}
        >
          <img
            src={LOGO_WORDMARK_URL}
            alt="Cairnly"
            crossOrigin="anonymous"
            style={{ height: 46, width: 'auto' }}
          />
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: PALETTE.goldBright,
              }}
            >
              Career Report
            </div>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                margin: '10px 0 0 0',
              }}
            >
              {firstName ? `${firstName}'s next move` : 'Your next move'}
            </h1>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            {dateLabel} · cairnly.io
          </div>
        </div>
      </PrintPage>

      {/* ── Charts ────────────────────────────────────────────── */}
      {(radarAxes.length > 0 || mapPoints.length > 0 || compare.length > 0) && (
        <PrintPage>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 22,
              color: PALETTE.canvasDeep,
              margin: '0 0 8mm 0',
            }}
          >
            Your profile at a glance
          </h2>

          {radarAxes.length > 0 && (
            <div className="print-nobreak" style={{ marginBottom: '8mm', textAlign: 'center' }}>
              <V4PersonalityRadarSVG axes={radarAxes} size={330} />
            </div>
          )}

          {mapPoints.length > 0 && (
            <div className="print-nobreak" style={{ marginBottom: '8mm' }}>
              <V4CareerMapSVG points={mapPoints} />
              <V4CareerMapLegend points={mapPoints} />
            </div>
          )}

          {compare.length > 0 && (
            <div className="print-nobreak">
              {/* variant="full" — the 460-wide viewBox. "compact" exists for the
                  dashboard's hero flip card and is too small for print. */}
              <V4CompareRadarSVG careers={compare} focalRank={1} variant="full" />
              <V4CompareLegend careers={compare} focalRank={1} />
            </div>
          )}
        </PrintPage>
      )}

      {/* ── Narrative ─────────────────────────────────────────── */}
      <PrintPage>
        {ordered.map((s) => (
          <PrintSection key={s.id} section={s} />
        ))}
      </PrintPage>
    </>
  );
};
```

**Note on the narrative page:** all sections currently sit inside one `PrintPage`, whose fixed 297mm height will clip overflow. Task 6 Step 5 covers measuring real content and splitting across sheets. Do not skip that step.

- [ ] **Step 5: Verify it compiles**

```bash
npm run build
```

Expected: success.

The chart component signatures used above were verified against source and are correct:

| Component | Props |
|---|---|
| `V4PersonalityRadarSVG` | `axes: RadarAxis[]`, `size?: number` |
| `V4CareerMapSVG` | `points: CareerPoint[]` |
| `V4CareerMapLegend` | `points: CareerPoint[]` |
| `V4CompareRadarSVG` | `careers: CompareCareer[]`, `focalRank?: 1\|2\|3`, `variant?: 'compact'\|'full'` |
| `V4CompareLegend` | `careers: CompareCareer[]`, `focalRank?: 1\|2\|3` |

If a type error appears anyway, match the component's real signature — never cast to `any`.

- [ ] **Step 6: Commit**

```bash
git add src/components/report-pdf && git commit -m "feat(pdf): add A4 print document components for the report"
```

---

## Task 6: The `/report/print` route

Reads `?rt=<token>`, exchanges it for data, renders the document, then sets a readiness flag Chromium waits on.

**Files:**
- Create: `src/pages/ReportPrint.tsx`
- Modify: `src/App.tsx`

---

- [ ] **Step 1: Write the page**

Create `src/pages/ReportPrint.tsx`:

```tsx
// /report/print — the printable report, rendered for headless Chromium.
//
// Not linked from the app UI. Auth is the single-use render token in ?rt=,
// exchanged via the public report-print-data function. When rendering and
// font loading are both finished it sets window.__REPORT_READY__, which the
// Vercel renderer polls before calling page.pdf(). Waiting on that flag is far
// more reliable than networkidle, which fires before webfonts settle and
// produces PDFs with fallback-font metrics.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportSection } from '@/hooks/useReportSections';
import { ReportPrintDocument } from '@/components/report-pdf/ReportPrintDocument';
import { PRINT_CSS } from '@/components/report-pdf/printStyles';

declare global {
  interface Window {
    __REPORT_READY__?: boolean;
    __REPORT_ERROR__?: string;
  }
}

interface PrintData {
  report: { id: string; title: string | null; updated_at: string | null; created_at: string };
  sections: ReportSection[];
  profile: { first_name: string; country: string | null };
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-print-data`;

const ReportPrint: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('rt');
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing render token');
      window.__REPORT_ERROR__ = 'Missing render token';
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FUNCTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error(`report-print-data returned ${res.status}`);
        const json = (await res.json()) as PrintData;
        if (cancelled) return;
        setData(json);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        window.__REPORT_ERROR__ = msg;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Flip the readiness flag only after the DOM has painted AND webfonts have
  // finished loading. Two rAFs guarantee a committed frame.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {
        // Font loading API unavailable — proceed rather than hang the render.
      }
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) window.__REPORT_READY__ = true;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Render error: {error}</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading report…</div>;
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <ReportPrintDocument
        firstName={data.profile.first_name}
        sections={data.sections}
        generatedAt={data.report.updated_at ?? data.report.created_at}
      />
    </>
  );
};

export default ReportPrint;
```

- [ ] **Step 2: Confirm the env var name**

The page reads `VITE_SUPABASE_PUBLISHABLE_KEY`. Verify that matches the project:

```bash
grep -rn "VITE_SUPABASE" src/integrations/supabase/client.ts
```

If the client uses a different name (for example `VITE_SUPABASE_ANON_KEY`), change `ReportPrint.tsx` to match. Do not add a new variable.

- [ ] **Step 3: Register the route**

In `src/App.tsx`, add the lazy import alongside the existing page imports:

```tsx
import ReportPrint from "./pages/ReportPrint";
```

and add the route inside the `<Routes>` block, after the `/dashboard` route at line 140:

```tsx
              <Route path="/report/print" element={<ReportPrint />} />
```

- [ ] **Step 4: Verify it builds and loads**

```bash
npm run build
```

Then start the dev server via the preview tool and open `/report/print` with no token. Expected: the page renders "Render error: Missing render token" — proving the route resolves rather than falling through to the SPA catch-all.

- [ ] **Step 5: Verify pagination against real content**

This is the step people skip and regret.

Mint a token manually against a real completed report (via MCP `execute_sql`, substituting a real report id and its owner's user id):

```sql
insert into public.report_render_tokens (report_id, user_id)
values ('<REPORT_UUID>', '<USER_UUID>')
returning token;
```

Open `/report/print?rt=<token>` in the browser. On screen you will see the sheets with drop shadows. Check:

1. The cover page fills exactly one sheet.
2. The charts page fits without clipping.
3. **The narrative page almost certainly overflows.** Fix by splitting `ordered` across multiple `PrintPage` elements in `ReportPrintDocument.tsx`. Replace the single narrative `PrintPage` with a chunked version, choosing the chunk size from what you actually observe (start at 2):

```tsx
      {/* ── Narrative ─────────────────────────────────────────── */}
      {chunk(ordered, 2).map((group, i) => (
        <PrintPage key={i}>
          {group.map((s) => (
            <PrintSection key={s.id} section={s} />
          ))}
        </PrintPage>
      ))}
```

with this helper above the component:

```tsx
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

Remember the token is single-use — mint a fresh one for each reload.

Iterate until no sheet clips content. Exec summaries and career sections differ a lot in length, so a fixed chunk size will be imperfect; that is acceptable for v1, and a follow-up can measure heights at runtime.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ReportPrint.tsx src/App.tsx src/components/report-pdf/ReportPrintDocument.tsx && git commit -m "feat(pdf): add the /report/print route with token-based data loading"
```

---

## Task 7: The Vercel Chromium renderer

**Files:**
- Create: `api/render-report.js`
- Modify: `package.json`

---

- [ ] **Step 1: Install the dependencies**

```bash
npm install puppeteer-core@^24.10.0 @sparticuz/chromium@^133.0.0
```

These two must stay version-compatible: `@sparticuz/chromium` ships a Chromium build and `puppeteer-core` speaks its DevTools protocol. If Chromium fails to launch in Step 5, a mismatch is the first thing to check.

- [ ] **Step 2: Write the function**

Create `api/render-report.js` (plain JS, not TypeScript — Vercel's zero-config Node runtime handles `.js` without a build step):

```js
// Vercel serverless function: render /report/print to a PDF via headless
// Chromium.
//
// Called only by the render-report-pdf Supabase edge function, authenticated
// with a shared secret. It never talks to the database — it is handed a
// fully-formed print URL containing a single-use render token.
//
// Requires Vercel Pro: maxDuration 60s and 2048MB memory are set in
// vercel.json. Chromium OOMs at the default 1024MB on content-heavy reports.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const READY_TIMEOUT_MS = 30_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.RENDER_SHARED_SECRET;
  if (!secret || req.headers['x-render-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { printUrl } = req.body || {};
  if (typeof printUrl !== 'string' || !printUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'printUrl must be an https URL' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // A4 @ ~150dpi
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    // domcontentloaded, not networkidle: we gate on the app's own readiness
    // flag, which is a stronger signal than an idle network.
    await page.goto(printUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS });

    await page.waitForFunction(
      () => window.__REPORT_READY__ === true || typeof window.__REPORT_ERROR__ === 'string',
      { timeout: READY_TIMEOUT_MS },
    );

    const renderError = await page.evaluate(() => window.__REPORT_ERROR__ || null);
    if (renderError) {
      return res.status(422).json({ error: `Print page failed: ${renderError}` });
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return res.status(200).json({ pdfBase64: Buffer.from(pdf).toString('base64') });
  } catch (err) {
    console.error('[render-report] failed:', err);
    return res.status(500).json({ error: String((err && err.message) || err) });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Best effort — the lambda is about to be frozen anyway.
      }
    }
  }
}
```

- [ ] **Step 3: Set the shared secret**

Generate one:

```bash
openssl rand -hex 32
```

Add it as `RENDER_SHARED_SECRET` in **both** places:
- Vercel → Project Settings → Environment Variables (Production + Preview)
- Supabase → Edge Functions secrets (used by Task 8)

The value must be byte-identical in both.

- [ ] **Step 4: Verify it builds locally**

```bash
npm run build
```

Expected: success. Vite ignores `api/`, so this only confirms nothing else broke.

- [ ] **Step 5: Deploy and smoke-test**

`/api/render-report` cannot be tested by `npm run dev` — it needs the Vercel runtime. Push the branch and use its Vercel preview deployment.

Mint a fresh token (as in Task 6 Step 5), then:

```bash
curl -s -X POST "https://<preview-deployment>.vercel.app/api/render-report" \
  -H "Content-Type: application/json" \
  -H "x-render-secret: $RENDER_SHARED_SECRET" \
  -d '{"printUrl":"https://<preview-deployment>.vercel.app/report/print?rt=<TOKEN>"}' \
  | python3 -c "import sys,json,base64; open('/tmp/report.pdf','wb').write(base64.b64decode(json.load(sys.stdin)['pdfBase64']))" \
  && open /tmp/report.pdf
```

Expected: a multi-page A4 PDF with backgrounds, pills and charts intact, and selectable text.

Troubleshooting:
- `401` → secret mismatch between your shell and Vercel.
- `404` → the `vercel.json` rewrite fix from Task 2 did not deploy.
- `422` → the print page errored; the message carries the reason (usually an expired or already-used token).
- Timeout → check the Vercel function log for a Chromium launch failure, which almost always means a `puppeteer-core` / `@sparticuz/chromium` version mismatch.

- [ ] **Step 6: Commit**

```bash
git add api/render-report.js package.json package-lock.json && git commit -m "feat(pdf): add Vercel Chromium renderer for the print route"
```

---

## Task 8: `render-report-pdf` orchestrator edge function

Mints the token, calls the renderer, stores the PDF, records it.

**Files:**
- Create: `supabase/functions/render-report-pdf/index.ts`
- Modify: `supabase/config.toml`

---

- [ ] **Step 1: Write the function**

Create `supabase/functions/render-report-pdf/index.ts`:

```ts
// render-report-pdf — orchestrates PDF generation for one report.
//
//   1. verify the caller owns the report
//   2. mint a single-use render token
//   3. ask the Vercel renderer to print /report/print?rt=<token>
//   4. store the PDF in the private report-pdfs bucket
//   5. upsert a report_pdfs row and return a signed download URL
//
// Callable by the report owner (JWT) and, later, by the share-verification
// cron using the service role.
//
// Input:  { report_id: string (uuid), force?: boolean }
// Output: { storage_path: string, signed_url: string, cached: boolean }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';

const LAYOUT_VERSION = 1;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  const rateLimited = checkRateLimit(req, 5, corsHeaders);
  if (rateLimited) return rateLimited;

  // NOTE: getAuthenticatedUser resolves to { userId, email } — not { id }.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const { userId: authUserId } = authed;

  let reportId: string | undefined;
  let force = false;
  try {
    const body = await req.json();
    reportId = body?.report_id;
    force = body?.force === true;
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }
  if (!reportId) return errorResponse('report_id is required', 400, corsHeaders);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Ownership + completion check.
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, status')
    .eq('id', reportId)
    .maybeSingle();

  if (!report) return errorResponse('Report not found', 404, corsHeaders);
  if (report.user_id !== authUserId) return errorResponse('Not your report', 403, corsHeaders);
  if (report.status !== 'completed') {
    return errorResponse('Report is not finished yet', 409, corsHeaders);
  }

  // Reuse an existing PDF unless the layout changed or force was passed.
  const { data: existing } = await supabase
    .from('report_pdfs')
    .select('storage_path, layout_version')
    .eq('report_id', reportId)
    .maybeSingle();

  if (existing && existing.layout_version === LAYOUT_VERSION && !force) {
    const { data: signed } = await supabase.storage
      .from('report-pdfs')
      .createSignedUrl(existing.storage_path, SIGNED_URL_TTL_SECONDS);
    return new Response(
      JSON.stringify({
        storage_path: existing.storage_path,
        signed_url: signed?.signedUrl ?? null,
        cached: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 2. Mint the render token.
  const { data: tokenRow, error: tokenError } = await supabase
    .from('report_render_tokens')
    .insert({ report_id: reportId, user_id: report.user_id })
    .select('token')
    .single();

  if (tokenError || !tokenRow) {
    console.error('[render-report-pdf] token mint failed:', tokenError);
    return errorResponse('Could not start render', 500, corsHeaders);
  }

  // 3. Call the renderer.
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://cairnly.io';
  const rendererUrl = Deno.env.get('RENDER_ENDPOINT_URL') ?? `${siteUrl}/api/render-report`;
  const sharedSecret = Deno.env.get('RENDER_SHARED_SECRET');
  if (!sharedSecret) {
    console.error('[render-report-pdf] RENDER_SHARED_SECRET is not set');
    return errorResponse('Renderer is not configured', 500, corsHeaders);
  }

  const printUrl = `${siteUrl}/report/print?rt=${tokenRow.token}`;

  let pdfBytes: Uint8Array;
  try {
    const renderRes = await fetch(rendererUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-render-secret': sharedSecret },
      body: JSON.stringify({ printUrl }),
    });
    const renderJson = await renderRes.json();
    if (!renderRes.ok) {
      console.error('[render-report-pdf] renderer error:', renderRes.status, renderJson);
      return errorResponse(`Renderer failed (${renderRes.status})`, 502, corsHeaders);
    }
    pdfBytes = Uint8Array.from(atob(renderJson.pdfBase64), (c) => c.charCodeAt(0));
  } catch (err) {
    console.error('[render-report-pdf] renderer unreachable:', err);
    return errorResponse('Renderer unreachable', 502, corsHeaders);
  }

  // 4. Store it. Path is namespaced by user so bucket policies stay simple.
  const storagePath = `${report.user_id}/${reportId}-v${LAYOUT_VERSION}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('report-pdfs')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error('[render-report-pdf] upload failed:', uploadError);
    return errorResponse('Could not store the PDF', 500, corsHeaders);
  }

  // 5. Record and sign.
  const { error: recordError } = await supabase.from('report_pdfs').upsert(
    {
      report_id: reportId,
      user_id: report.user_id,
      storage_path: storagePath,
      byte_size: pdfBytes.byteLength,
      layout_version: LAYOUT_VERSION,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'report_id' },
  );

  if (recordError) {
    console.error('[render-report-pdf] record upsert failed:', recordError);
  }

  const { data: signed } = await supabase.storage
    .from('report-pdfs')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  return new Response(
    JSON.stringify({ storage_path: storagePath, signed_url: signed?.signedUrl ?? null, cached: false }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
```

- [ ] **Step 2: Register it in config.toml**

Append to `supabase/config.toml`:

```toml
# Report PDF orchestrator. Requires a real user JWT — ownership of the report
# is re-checked inside the function.
[functions.render-report-pdf]
verify_jwt = true
```

- [ ] **Step 3: Set the remaining secrets**

In Supabase → Edge Functions secrets, confirm all three exist:
- `RENDER_SHARED_SECRET` (same value as Vercel, from Task 7 Step 3)
- `SITE_URL` = `https://cairnly.io`
- `RENDER_ENDPOINT_URL` — only needed when testing against a preview deployment; omit in production and it derives from `SITE_URL`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/render-report-pdf/index.ts supabase/config.toml && git commit -m "feat(edge): add render-report-pdf orchestrator"
```

---

## Task 9: Temporary dashboard trigger for end-to-end verification

A minimal button proving the pipeline works. The share gate in Plan 2 replaces this entry point; the download UI itself stays.

**Files:**
- Modify: `src/pages/Dashboard.tsx`

---

- [ ] **Step 1: Add the handler**

In `src/pages/Dashboard.tsx`, near the existing `latestReport` handlers (around line 606), add:

```tsx
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!latestReport || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('render-report-pdf', {
        body: { report_id: latestReport.id },
      });
      if (error) throw error;
      if (data?.signed_url) window.open(data.signed_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('[Dashboard] PDF render failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };
```

- [ ] **Step 2: Add the button**

Inside the `latestReport && latestReport.status === 'completed'` block (around line 487), next to the existing share entry point:

```tsx
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            style={{ padding: '10px 18px', borderRadius: 9999, cursor: 'pointer' }}
          >
            {pdfLoading ? 'Generating…' : 'Download report PDF'}
          </button>
```

Styling is deliberately plain — this is a test harness, and Plan 2 replaces the surrounding UI.

- [ ] **Step 3: Verify end to end**

```bash
npm run build
```

Push the branch, open its Vercel preview, sign in as a user with a completed report, and click the button. Expected: a few seconds of "Generating…", then a new tab with the PDF.

Then confirm the records landed, via MCP `execute_sql`:

```sql
select storage_path, byte_size, layout_version, generated_at
from public.report_pdfs order by generated_at desc limit 3;
```

Expected: one row, `byte_size` in the low millions.

Click again. It should return near-instantly (`cached: true`) without a second Chromium run.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx && git commit -m "feat(dashboard): add a temporary report PDF download trigger"
```

---

## Definition of done

- [ ] `npx vitest run` passes
- [ ] `npm run build` passes
- [ ] A signed-in user with a completed report can produce a multi-page A4 PDF
- [ ] The PDF has coloured backgrounds, all three charts, and match / AI-impact / Move pills
- [ ] Text in the PDF is selectable (vector, not raster)
- [ ] No page clips its content
- [ ] A second request for the same report returns the cached PDF without re-rendering
- [ ] A reused or expired render token returns 403 from `report-print-data`

---

## Known limitations, deliberately deferred

**Pagination is fixed-size, not measured.** Sections are chunked N-per-page rather than measured at runtime, so a very long career section can still overflow. Revisit once you have seen real reports.

**Dutch reports are untested here.** `report_sections.language` is carried through but nothing in this plan branches on it. Verify an NL report renders before shipping widely; longer German-style compounds in Dutch can change line-breaking.

**`layout_version` is manual.** Bump the constant in `render-report-pdf` whenever the print layout changes materially, or users keep receiving stale cached PDFs.

**No cleanup of old PDFs.** The bucket grows without bound. A retention job belongs with the existing purge work in `project_retention_purge_design`.
