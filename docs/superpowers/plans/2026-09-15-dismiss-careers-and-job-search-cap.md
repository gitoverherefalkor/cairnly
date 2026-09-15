# "Not for me" + Job Search Free Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users dismiss career recommendations they don't want (Phase A), and open job search to everyone with a 4-search free tier that the referral uncaps (Phase B).

**Architecture:** Phase A adds a `dismissed_careers` table, a React Query hook, a small dismiss control rendered by the dashboard accordion, and a filter in the PDF document builder. Phase B authenticates the `search-jobs` edge function, locks down self-writable `profiles` columns, and adds a credit gate whose pure decision logic lives in a shared module so vitest can test it. The two phases share no code and can ship independently.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query, Tailwind, Supabase (Postgres + Deno edge functions), vitest, i18next.

**Source spec:** `docs/superpowers/specs/2026-09-15-jobs-cap-chat-continuation-dismiss-design.md`

---

## Conventions for this plan

- Migrations are applied **individually via the Supabase MCP `apply_migration`**, never `supabase db push`. The local migration filenames do not match the recorded versions in this project (see the migration-history-mismatch note in CLAUDE.md), so `db push` is unsafe.
- `tsc --noEmit` checks **zero files** in this repo (root `tsconfig.json` has `files: []`). It proves nothing. Verification is `npm run build` + `npx vitest run` + the browser.
- Never exceed `font-weight: 700` anywhere in new UI.
- /ops copy is English only. User-facing copy is EN + NL.
- Commit after every task.

## File Structure

### Phase A — "Not for me"

| File | Responsibility |
|---|---|
| `supabase/migrations/20260915140000_dismissed_careers.sql` | New table, RLS, indexes, purge wiring |
| `src/hooks/useDismissedCareers.ts` | Read + toggle + set-reason, React Query |
| `src/hooks/useDismissedCareers.test.ts` | Pure-helper tests (`isDismissed`, `bySectionId`) |
| `src/components/dashboard/v2/NotForMeControl.tsx` | The button, the chip row, the Undo affordance |
| `src/components/dashboard/v2/DashboardV4.tsx` | Carry `sectionId`, render the control, apply the greyed style, re-order |
| `src/components/report-pdf/dismissed.ts` | `filterDismissed()` + `isSetAside()` for the printed document |
| `src/components/report-pdf/dismissed.test.ts` | Tests for both |
| `src/components/report-pdf/ReportPrintDocument.tsx` | Apply the filter, render the "Set aside" marker |
| `src/components/report-pdf/printBuild.ts` | Bump `PRINT_BUILD` |
| `src/pages/ReportPrint.tsx` | Thread `dismissed` from the payload into the document |
| `supabase/functions/report-print-data/index.ts` | Return the `dismissed` array |
| `src/components/ops/DismissalsCard.tsx` | /ops aggregate |
| `src/pages/Ops.tsx` | Mount the card on the Platform tab |
| `public/locales/{en,nl}/dashboard.json` | Copy |

`NotForMeControl.tsx` is its own file deliberately: `DashboardV4.tsx` is already 3094 lines and should not grow further.

### Phase B — Job search free tier

| File | Responsibility |
|---|---|
| `supabase/migrations/20260915150000_lock_profiles_columns.sql` | Security fix 2 |
| `supabase/migrations/20260915151000_user_job_searches_rls.sql` | RLS + indexes on the revived table |
| `supabase/functions/_shared/searchCredits.ts` | Pure `decideSearchCharge()` — no Deno imports |
| `supabase/functions/_shared/searchCredits.test.ts` | Tests for every branch |
| `vite.config.ts` | Widen the vitest `include` to reach `supabase/functions` |
| `supabase/functions/search-jobs/index.ts` | Auth, report ownership, entitlement, the gate, logging |
| `src/hooks/useJobSearchCredits.ts` | `{ used, limit, unlimited, remaining }` |
| `src/pages/Jobs.tsx` | Gate on credits instead of `jobsFeature.unlocked` |
| `src/components/jobs/v2/JobsSearch.tsx` | Credit counter + over-selection warning |
| `src/components/jobs/v2/JobsLocked.tsx` | Becomes the out-of-searches state |
| `src/hooks/useReferralStatus.ts` | Ladder copy: unlock → unlimited |
| `public/locales/{en,nl}/jobs.json`, `dashboard.json` | Copy |

---

# PHASE A — "Not for me"

## Task 1: `dismissed_careers` table

**Files:**
- Create: `supabase/migrations/20260915140000_dismissed_careers.sql`

- [ ] **Step 1: Write the migration**

```sql
-- "Not for me" — let a user set aside a career recommendation they don't want.
--
-- Why its own table rather than a flag on report_sections: that table's
-- `metadata` jsonb is written by n8n (WF4 writes fit_scores, comparison, move,
-- origin). A browser write racing a workflow write would clobber one or the
-- other. A separate table also keeps the /ops aggregate and the retention
-- purge trivial.
--
-- section_id is the right key for every case. top_career_1/2/3 are one row
-- each; runner_ups / outside_box / dream_jobs are already one row PER CAREER,
-- split on ---CAREER_SPLIT--- by WF4. So "one dismissal per section row"
-- covers both shapes with no special casing.
--
-- section_type and career_title are denormalised on purpose: /ops aggregates
-- across users without joining, and career_title survives the title being
-- re-translated later (content_i18n churn) so the historical signal stays
-- readable.

CREATE TABLE IF NOT EXISTS public.dismissed_careers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.report_sections(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  career_title TEXT NOT NULL,
  -- Optional, skippable. NULL means the user dismissed without saying why.
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dismissed_careers_unique UNIQUE (report_id, section_id),
  CONSTRAINT dismissed_careers_reason_valid CHECK (
    reason IS NULL OR reason IN (
      'not_interested', 'wrong_level', 'pay_too_low', 'already_did', 'location', 'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_dismissed_careers_report
  ON public.dismissed_careers (report_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_careers_user
  ON public.dismissed_careers (user_id);
-- Backs the /ops aggregate (group by section_type, reason).
CREATE INDEX IF NOT EXISTS idx_dismissed_careers_type
  ON public.dismissed_careers (section_type);

ALTER TABLE public.dismissed_careers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dismissed_careers'
      AND policyname = 'Users manage their own dismissed careers'
  ) THEN
    CREATE POLICY "Users manage their own dismissed careers"
      ON public.dismissed_careers FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dismissed_careers'
      AND policyname = 'Service role full access on dismissed careers'
  ) THEN
    CREATE POLICY "Service role full access on dismissed careers"
      ON public.dismissed_careers FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.dismissed_careers IS
  'Careers the user set aside via the dashboard "Not for me" control. Greys the card, omits it from the PDF (runner-ups/outside-box) or marks it "set aside" (top 3), and feeds the /ops dismissal aggregate. Never read by any n8n workflow.';
```

- [ ] **Step 2: Apply it via the Supabase MCP**

Use `apply_migration` with name `dismissed_careers` and the SQL above, against project `pcoyafgsirrznhmdaiji`.

Do NOT run `supabase db push`.

- [ ] **Step 3: Verify the table and policies exist**

Run `execute_sql` against `pcoyafgsirrznhmdaiji`:

```sql
select tablename, policyname, cmd from pg_policies
where schemaname='public' and tablename='dismissed_careers';
```

Expected: two rows, `Users manage their own dismissed careers` (ALL) and `Service role full access on dismissed careers` (ALL).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915140000_dismissed_careers.sql
git commit -m "db: dismissed_careers table for the \"Not for me\" control"
```

---

## Task 2: Wire the new table into deletion and retention

**Files:**
- Create: `supabase/migrations/20260915140100_dismissed_careers_cleanup.sql`

The two delete RPCs and the retention purge enumerate tables by hand. A new user-data table that is not added to them leaks personal data past an account deletion.

- [ ] **Step 1: Read the three existing functions to get their current bodies**

```bash
grep -n "DELETE FROM public.chat_messages" supabase/migrations/20260529120000_delete_user_personal_data.sql supabase/migrations/20260616130000_auto_cleanup_on_auth_user_delete.sql
grep -n "chat_messages" supabase/migrations/20260708170000_retention_and_survey_response_stats.sql
```

Note the surrounding `DELETE FROM public.<table> WHERE user_id = p_user_id;` block in each.

- [ ] **Step 2: Write the migration**

```sql
-- Add dismissed_careers to the two account-deletion RPCs and the retention
-- purge. Both RPCs enumerate tables by hand, so a new user-data table that
-- isn't listed survives an account deletion. The FKs already cascade from
-- auth.users and reports, but these RPCs are the documented path and are what
-- the GDPR flow calls, so they must agree with the schema.
--
-- Written as targeted ALTERs of the existing function bodies: re-run
-- CREATE OR REPLACE with the CURRENT body plus one line. Copy the body from
-- the migration that last defined each function; do not reconstruct it from
-- memory.

-- 1. delete_user_personal_data  (20260529120000, later revised)
-- 2. handle_auth_user_delete    (20260616130000)
-- 3. purge_expired_reports      (20260708170000 / 20260710120000)
--
-- For each: add
--     DELETE FROM public.dismissed_careers WHERE user_id = p_user_id;
-- next to the existing chat_messages delete, and for the retention purge add
--     DELETE FROM public.dismissed_careers dc USING <the same report join>
-- alongside the chat_messages purge.
```

**Important:** this step needs the live function bodies. Fetch them first:

```sql
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_user_personal_data', 'handle_auth_user_delete', 'purge_expired_reports');
```

Write the migration as three `CREATE OR REPLACE FUNCTION` statements, each being the fetched body with the single extra DELETE added. Do not drop and recreate.

- [ ] **Step 3: Apply via `apply_migration`, name `dismissed_careers_cleanup`**

- [ ] **Step 4: Verify each function now mentions the table**

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and pg_get_functiondef(p.oid) like '%dismissed_careers%';
```

Expected: all three function names.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915140100_dismissed_careers_cleanup.sql
git commit -m "db: purge dismissed_careers on account delete and retention run"
```

---

## Task 3: Regenerate Supabase types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Regenerate**

Use the Supabase MCP `generate_typescript_types` for project `pcoyafgsirrznhmdaiji` and write the output to `src/integrations/supabase/types.ts`.

- [ ] **Step 2: Verify the new table is present**

```bash
grep -n "dismissed_careers" src/integrations/supabase/types.ts | head -3
```

Expected: at least one match.

- [ ] **Step 3: Verify the build still compiles**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "types: regenerate for dismissed_careers"
```

---

## Task 4: `useDismissedCareers` hook

**Files:**
- Create: `src/hooks/useDismissedCareers.ts`
- Create: `src/hooks/useDismissedCareers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { indexBySectionId, type DismissedCareer } from './useDismissedCareers';

function row(over: Partial<DismissedCareer>): DismissedCareer {
  return {
    id: 'd1',
    user_id: 'u1',
    report_id: 'r1',
    section_id: 's1',
    section_type: 'runner_ups',
    career_title: 'Data Steward',
    reason: null,
    note: null,
    created_at: '2026-09-15T00:00:00Z',
    ...over,
  };
}

describe('indexBySectionId', () => {
  it('returns an empty map for no rows', () => {
    expect(indexBySectionId([]).size).toBe(0);
  });

  it('keys each row by its section_id', () => {
    const map = indexBySectionId([row({ section_id: 'a' }), row({ id: 'd2', section_id: 'b' })]);
    expect(map.size).toBe(2);
    expect(map.get('a')?.section_id).toBe('a');
    expect(map.get('b')?.id).toBe('d2');
  });

  it('keeps the first row when section_id repeats', () => {
    const map = indexBySectionId([
      row({ id: 'first', section_id: 'a' }),
      row({ id: 'second', section_id: 'a' }),
    ]);
    expect(map.get('a')?.id).toBe('first');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/hooks/useDismissedCareers.test.ts
```

Expected: FAIL, "Failed to resolve import" or "indexBySectionId is not a function".

- [ ] **Step 3: Write the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Reasons offered by the chip row. Kept in sync with the CHECK constraint in
// 20260915140000_dismissed_careers.sql — adding one here needs a migration.
export const DISMISS_REASONS = [
  'not_interested',
  'wrong_level',
  'pay_too_low',
  'already_did',
  'location',
  'other',
] as const;

export type DismissReason = (typeof DISMISS_REASONS)[number];

export interface DismissedCareer {
  id: string;
  user_id: string;
  report_id: string;
  section_id: string;
  section_type: string;
  career_title: string;
  reason: DismissReason | null;
  note: string | null;
  created_at: string;
}

/**
 * section_id → row. Exported separately from the hook so it can be unit
 * tested without a React tree or a Supabase client.
 */
export function indexBySectionId(rows: DismissedCareer[]): Map<string, DismissedCareer> {
  const map = new Map<string, DismissedCareer>();
  for (const r of rows) {
    if (!map.has(r.section_id)) map.set(r.section_id, r);
  }
  return map;
}

interface DismissInput {
  sectionId: string;
  sectionType: string;
  careerTitle: string;
}

export function useDismissedCareers(reportId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['dismissed-careers', reportId];

  const { data: dismissed = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<DismissedCareer[]> => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('dismissed_careers')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching dismissed careers:', error);
        throw error;
      }
      return (data as DismissedCareer[]) ?? [];
    },
    enabled: !!reportId && !!user?.id,
  });

  const bySectionId = indexBySectionId(dismissed);

  const dismissMutation = useMutation({
    mutationFn: async (input: DismissInput) => {
      if (!user?.id || !reportId) throw new Error('No user or report');
      const { data, error } = await supabase
        .from('dismissed_careers')
        .insert({
          user_id: user.id,
          report_id: reportId,
          section_id: input.sectionId,
          section_type: input.sectionType,
          career_title: input.careerTitle,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) => {
      console.error('Error dismissing career:', error);
      toast({
        title: 'Could not set that aside',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      if (!reportId) throw new Error('No report');
      const { error } = await supabase
        .from('dismissed_careers')
        .delete()
        .eq('report_id', reportId)
        .eq('section_id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) => {
      console.error('Error restoring career:', error);
      toast({
        title: 'Could not bring that back',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const setReasonMutation = useMutation({
    mutationFn: async ({ sectionId, reason }: { sectionId: string; reason: DismissReason }) => {
      if (!reportId) throw new Error('No report');
      const { error } = await supabase
        .from('dismissed_careers')
        .update({ reason })
        .eq('report_id', reportId)
        .eq('section_id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    // Deliberately silent on failure: the reason is optional garnish, and a
    // toast here would punish the user for a nicety they did not have to give.
    onError: (error: unknown) => console.error('Error saving dismiss reason:', error),
  });

  return {
    dismissed,
    bySectionId,
    isLoading,
    isDismissed: (sectionId: string) => bySectionId.has(sectionId),
    dismiss: dismissMutation.mutate,
    restore: restoreMutation.mutate,
    setReason: setReasonMutation.mutate,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run src/hooks/useDismissedCareers.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDismissedCareers.ts src/hooks/useDismissedCareers.test.ts
git commit -m "dashboard: useDismissedCareers hook for the \"Not for me\" control"
```

---

## Task 5: Carry `sectionId` into the accordion row model

**Files:**
- Modify: `src/components/dashboard/v2/DashboardV4.tsx:247-272` (types), and the row builder around `:470-520`

The accordion rows are derived from `report_sections` but currently drop the underlying row id. `CareerEntry` is `{ title, content }` only. Without the id there is nothing to key a dismissal to.

- [ ] **Step 1: Extend the two interfaces**

Replace lines 247-250:

```typescript
interface CareerEntry {
  title: string;
  content: string;
  // report_sections.id for this specific career. Keys the "Not for me"
  // dismissal — see useDismissedCareers.
  sectionId: string;
  sectionType: string;
}
```

And add to `ReportRow` (after `careers?: CareerEntry[];` on line 259):

```typescript
  // report_sections.id for single-section rows (the top 3). Multi-career rows
  // carry the id per CareerEntry instead. Undefined for About-You rows, which
  // are not dismissible.
  sectionId?: string;
  sectionType?: string;
```

- [ ] **Step 2: Populate them in the row builder**

In the top-3 branch, the `rows.push({ ... })` call currently ends with `comparison,`. Add two fields:

```typescript
      rows.push({
        id,
        title: stripHtml(
          sectionTitle(s, lang) || t('v4.fallback.careerMatch', { defaultValue: 'Career match' }),
        ),
        oneLiner: oneLinerFor(id),
        content: sectionText(s, lang),
        careerSlot: slot,
        comparison,
        sectionId: s.id,
        sectionType: s.section_type,
      });
```

In the grouped branch, the `careers:` mapping currently returns `{ title, content }`. Change it to:

```typescript
        careers: matches.map((s) => ({
          title: stripHtml(
            sectionTitle(s, lang) || t('v4.fallback.career', { defaultValue: 'Career' }),
          ),
          content: sectionText(s, lang),
          sectionId: s.id,
          sectionType: s.section_type,
        })),
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build
```

Expected: exit 0. If TypeScript complains about a `CareerEntry` literal missing `sectionId` anywhere else, fix that call site the same way.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/v2/DashboardV4.tsx
git commit -m "dashboard: carry report_sections.id onto accordion rows and career tabs"
```

---

## Task 6: The `NotForMeControl` component

**Files:**
- Create: `src/components/dashboard/v2/NotForMeControl.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOff, Undo2 } from 'lucide-react';
import { DISMISS_REASONS, type DismissReason } from '@/hooks/useDismissedCareers';

// "Not for me" — sets a career aside. One click to dismiss, one click to bring
// it back, and a skippable row of reason chips in between. No modal and no
// confirmation: the action is fully reversible, so a confirm step would be
// friction for nothing.

interface Props {
  isDismissed: boolean;
  // Present once dismissed and a reason has been chosen; hides the chip row.
  reason: DismissReason | null;
  onDismiss: () => void;
  onRestore: () => void;
  onReason: (reason: DismissReason) => void;
}

const BTN: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.14)',
  padding: '6px 12px',
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 150ms ease',
};

export const NotForMeControl: React.FC<Props> = ({
  isDismissed,
  reason,
  onDismiss,
  onRestore,
  onReason,
}) => {
  const { t } = useTranslation('dashboard');
  // Show the chips only for the dismissal that just happened in this session,
  // so re-opening an old dismissed card doesn't nag for a reason again.
  const [showChips, setShowChips] = useState(false);

  if (isDismissed) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          style={BTN}
          onClick={(e) => {
            e.stopPropagation();
            setShowChips(false);
            onRestore();
          }}
        >
          <Undo2 size={13} />
          {t('v4.notForMe.restore', { defaultValue: 'Bring it back' })}
        </button>

        {showChips && !reason && (
          <>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {t('v4.notForMe.whyOptional', { defaultValue: 'Why? (optional)' })}
            </span>
            {DISMISS_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                style={{ ...BTN, padding: '5px 10px', fontSize: 11.5 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReason(r);
                  setShowChips(false);
                }}
              >
                {t(`v4.notForMe.reason.${r}`)}
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      style={BTN}
      onClick={(e) => {
        e.stopPropagation();
        setShowChips(true);
        onDismiss();
      }}
    >
      <EyeOff size={13} />
      {t('v4.notForMe.dismiss', { defaultValue: 'Not for me' })}
    </button>
  );
};
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/v2/NotForMeControl.tsx
git commit -m "dashboard: NotForMeControl button and reason chips"
```

---

## Task 7: Copy for the dismiss control (EN + NL)

**Files:**
- Modify: `public/locales/en/dashboard.json`
- Modify: `public/locales/nl/dashboard.json`

- [ ] **Step 1: Add the `notForMe` block under `v4` in `public/locales/en/dashboard.json`**

```json
"notForMe": {
  "dismiss": "Not for me",
  "restore": "Bring it back",
  "whyOptional": "Why? (optional)",
  "setAside": "Set aside",
  "reason": {
    "not_interested": "Not interested",
    "wrong_level": "Wrong level",
    "pay_too_low": "Pay too low",
    "already_did": "Already did this",
    "location": "Location",
    "other": "Something else"
  }
}
```

- [ ] **Step 2: Add the Dutch equivalent under `v4` in `public/locales/nl/dashboard.json`**

```json
"notForMe": {
  "dismiss": "Niets voor mij",
  "restore": "Toch weer tonen",
  "whyOptional": "Waarom? (optioneel)",
  "setAside": "Opzij gezet",
  "reason": {
    "not_interested": "Niet interessant",
    "wrong_level": "Verkeerd niveau",
    "pay_too_low": "Betaalt te weinig",
    "already_did": "Dit heb ik al gedaan",
    "location": "Locatie",
    "other": "Iets anders"
  }
}
```

- [ ] **Step 3: Verify both files are valid JSON**

```bash
python3 -c "import json; [json.load(open(f'public/locales/{l}/dashboard.json')) for l in ('en','nl')]; print('both valid')"
```

Expected: `both valid`.

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/dashboard.json public/locales/nl/dashboard.json
git commit -m "i18n: copy for the \"Not for me\" control (EN + NL)"
```

---

## Task 8: Render the control in the dashboard accordion

**Files:**
- Modify: `src/components/dashboard/v2/DashboardV4.tsx`

- [ ] **Step 1: Import the hook and the component at the top of the file**

```typescript
import { useDismissedCareers, type DismissReason } from '@/hooks/useDismissedCareers';
import { NotForMeControl } from './NotForMeControl';
```

- [ ] **Step 2: Call the hook in `DashboardV4` (line 301) beside the other hooks**

```typescript
  const dismissedCareers = useDismissedCareers(reportId);
```

Use whatever the component already calls the report id in scope. If it is not already available, read it from the same prop the existing `useReportSections` call uses.

- [ ] **Step 3: Sort dismissed careers to the bottom of their group**

In the row builder's grouped branch, after `matches` is computed and before `rows.push`, sort so dismissed careers sink:

```typescript
      const ordered = [...matches].sort((a, b) => {
        const ad = dismissedCareers.isDismissed(a.id) ? 1 : 0;
        const bd = dismissedCareers.isDismissed(b.id) ? 1 : 0;
        return ad - bd;
      });
```

Then map over `ordered` instead of `matches`. Add `dismissedCareers.bySectionId` to the `useMemo` dependency array alongside `sections`, `lang`, `t`.

- [ ] **Step 4: Thread the dismissal props into `ReportAccordionRow`**

Extend its props (line 2684):

```typescript
const ReportAccordionRow: React.FC<{
  row: ReportRow;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
  registerRef: (node: HTMLDivElement | null) => void;
  dismissal: ReturnType<typeof useDismissedCareers>;
}> = ({ row, isOpen, isLast, onToggle, registerRef, dismissal }) => {
```

Pass `dismissal={dismissedCareers}` at the call site where `ReportAccordionRow` is rendered.

- [ ] **Step 5: Render the control and grey the card**

Inside `ReportAccordionRow`, compute the active career's section id, which is `row.sectionId` for single rows and `row.careers[activeCareer].sectionId` for grouped ones:

```typescript
  const activeSectionId =
    row.careers && row.careers.length > 0
      ? row.careers[activeCareer]?.sectionId
      : row.sectionId;
  const activeSectionType =
    row.careers && row.careers.length > 0
      ? row.careers[activeCareer]?.sectionType
      : row.sectionType;
  const activeTitle =
    row.careers && row.careers.length > 0 ? row.careers[activeCareer]?.title : row.title;
  const dismissedRow = activeSectionId ? dismissal.bySectionId.get(activeSectionId) : undefined;
  const isDismissed = !!dismissedRow;
```

Apply the greyed treatment to the row's outer `<div>` by merging into its existing `style` object:

```typescript
        opacity: isDismissed ? 0.45 : 1,
        filter: isDismissed ? 'grayscale(0.7)' : 'none',
        transition: 'opacity 200ms ease, filter 200ms ease',
```

Render the control at the end of the expanded body, but only for career rows (`row.careerSlot` is set) and only when an id is available:

```tsx
      {isOpen && activeSectionId && row.careerSlot && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <NotForMeControl
            isDismissed={isDismissed}
            reason={dismissedRow?.reason ?? null}
            onDismiss={() =>
              dismissal.dismiss({
                sectionId: activeSectionId,
                sectionType: activeSectionType ?? '',
                careerTitle: activeTitle ?? '',
              })
            }
            onRestore={() => dismissal.restore(activeSectionId)}
            onReason={(reason: DismissReason) =>
              dismissal.setReason({ sectionId: activeSectionId, reason })
            }
          />
        </div>
      )}
```

Career 1 is dismissible like any other, and deliberately does NOT promote career 2 into the hero slot: `HeroMatch`, the radar, the career map and the exec summary are all left untouched.

- [ ] **Step 6: Verify the build**

```bash
npm run build && npx vitest run
```

Expected: build exit 0, all existing tests still pass.

- [ ] **Step 7: Verify in the browser**

Start the dev server with the Browser pane (`preview_start`, never `npm run dev` via Bash), open a completed report's dashboard, expand a runner-up, and check:
- "Not for me" appears; clicking it greys the card and reveals the chips
- clicking a chip hides the chips and keeps the card greyed
- "Bring it back" restores full opacity
- a hard reload keeps the dismissal (it is persisted, not local state)
- the radar, career map and exec summary are unchanged when career 1 is dismissed

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/v2/DashboardV4.tsx
git commit -m "dashboard: render \"Not for me\" on career rows, grey and sink dismissed cards"
```

---

## Task 9: PDF filter helpers

**Files:**
- Create: `src/components/report-pdf/dismissed.ts`
- Create: `src/components/report-pdf/dismissed.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { filterDismissed, isSetAside, type DismissedRef } from './dismissed';
import type { ReportSection } from '@/hooks/useReportSections';

let seq = 0;
function section(over: Partial<ReportSection>): ReportSection {
  return {
    id: `id-${seq++}`,
    report_id: 'r1',
    section_type: 'runner_ups',
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
    content_i18n: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as ReportSection;
}

const ref = (section_id: string, section_type: string): DismissedRef => ({ section_id, section_type });

describe('filterDismissed', () => {
  it('returns every section when nothing is dismissed', () => {
    const s = [section({ id: 'a' }), section({ id: 'b' })];
    expect(filterDismissed(s, []).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('drops a dismissed runner-up', () => {
    const s = [section({ id: 'a' }), section({ id: 'b' })];
    expect(filterDismissed(s, [ref('a', 'runner_ups')]).map((x) => x.id)).toEqual(['b']);
  });

  it('drops dismissed outside_box and dream_jobs too', () => {
    const s = [
      section({ id: 'a', section_type: 'outside_box' }),
      section({ id: 'b', section_type: 'dream_jobs' }),
      section({ id: 'c', section_type: 'runner_ups' }),
    ];
    const out = filterDismissed(s, [ref('a', 'outside_box'), ref('b', 'dream_jobs')]);
    expect(out.map((x) => x.id)).toEqual(['c']);
  });

  it('KEEPS a dismissed top-3 career, because the prose refers to them by number', () => {
    const s = [
      section({ id: 'a', section_type: 'top_career_1' }),
      section({ id: 'b', section_type: 'top_career_2' }),
    ];
    expect(filterDismissed(s, [ref('a', 'top_career_1')]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('never drops a non-career section even if somehow referenced', () => {
    const s = [section({ id: 'a', section_type: 'values' })];
    expect(filterDismissed(s, [ref('a', 'values')]).map((x) => x.id)).toEqual(['a']);
  });
});

describe('isSetAside', () => {
  it('is true for a dismissed top-3 career', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'top_career_2' }), [ref('a', 'top_career_2')])).toBe(true);
  });

  it('is false for a career that was not dismissed', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'top_career_2' }), [])).toBe(false);
  });

  it('is false for a dismissed runner-up, which is dropped rather than marked', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'runner_ups' }), [ref('a', 'runner_ups')])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/components/report-pdf/dismissed.test.ts
```

Expected: FAIL, "Failed to resolve import ./dismissed".

- [ ] **Step 3: Write the implementation**

```typescript
import type { ReportSection } from '@/hooks/useReportSections';

// What report-print-data sends alongside the sections: one entry per career
// the user set aside via the dashboard "Not for me" control.
export interface DismissedRef {
  section_id: string;
  section_type: string;
}

// Career groups that repeat (one report_sections row per career). A dismissed
// one is simply absent from the printed report — nothing in the prose refers
// to "runner-up number 3", so removing it leaves no hole.
const DROPPABLE = new Set(['runner_ups', 'outside_box', 'dream_jobs']);

// The top 3 are referred to by number throughout the narrative ("your second
// match"), so a dismissed one stays in the document and is marked instead.
const MARKABLE = new Set(['top_career_1', 'top_career_2', 'top_career_3']);

/**
 * Removes dismissed careers from the printable section list. Only the
 * repeating career groups are dropped; everything else passes through,
 * including a dismissed top-3 career (see isSetAside).
 */
export function filterDismissed(
  sections: ReportSection[],
  dismissed: DismissedRef[],
): ReportSection[] {
  if (dismissed.length === 0) return sections;
  const droppedIds = new Set(
    dismissed.filter((d) => DROPPABLE.has(d.section_type)).map((d) => d.section_id),
  );
  if (droppedIds.size === 0) return sections;
  return sections.filter((s) => !droppedIds.has(s.id));
}

/** True when this section is a top-3 career the user set aside. */
export function isSetAside(section: ReportSection, dismissed: DismissedRef[]): boolean {
  if (!MARKABLE.has(section.section_type)) return false;
  return dismissed.some((d) => d.section_id === section.id);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run src/components/report-pdf/dismissed.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/report-pdf/dismissed.ts src/components/report-pdf/dismissed.test.ts
git commit -m "report-pdf: filterDismissed and isSetAside helpers"
```

---

## Task 10: Return dismissals from `report-print-data`

**Files:**
- Modify: `supabase/functions/report-print-data/index.ts:67-83` and the response object at `:139-158`

- [ ] **Step 1: Add the query to the existing `Promise.all`**

Change the destructuring at line 67 from three entries to four:

```typescript
  const [{ data: report }, { data: sections }, { data: profile }, { data: dismissed }] =
    await Promise.all([
```

and append this query after the `profiles` one, before the closing `]);`:

```typescript
    // Careers the user set aside via the dashboard "Not for me" control.
    // Service-role read: the render token has already been burned and proves
    // this request is for this report.
    supabase
      .from('dismissed_careers')
      .select('section_id, section_type')
      .eq('report_id', burned.report_id),
```

- [ ] **Step 2: Add it to the response body**

In the `JSON.stringify({ ... })` call, after `sections: sections ?? [],` add:

```typescript
      // One entry per career the user set aside. The print document drops
      // dismissed runner-ups / outside-box / dream jobs entirely and marks a
      // dismissed top-3 career "set aside" instead, because the prose refers
      // to the top three by number.
      dismissed: dismissed ?? [],
```

- [ ] **Step 3: Verify the function still parses**

```bash
npx deno check supabase/functions/report-print-data/index.ts 2>&1 | tail -5
```

Expected: no errors. If `deno` is not installed, skip this step; the deploy step in Task 12 will catch a syntax error.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/report-print-data/index.ts
git commit -m "report-print-data: return the user's dismissed careers"
```

---

## Task 11: Apply the filter in the printed document

**Files:**
- Modify: `src/pages/ReportPrint.tsx:117` (type), `:264` (props)
- Modify: `src/components/report-pdf/ReportPrintDocument.tsx:56` (orderSections), props
- Modify: `src/components/report-pdf/printBuild.ts:16`

- [ ] **Step 1: Thread `dismissed` through `ReportPrint.tsx`**

Add to the `PrintData` interface at line 117, beside `sections`:

```typescript
  dismissed: { section_id: string; section_type: string }[];
```

And pass it to the document at line 264, beside `sections={data.sections}`:

```tsx
        dismissed={data.dismissed ?? []}
```

The `?? []` matters: a PDF re-rendered from a cached payload written before this change has no `dismissed` key.

- [ ] **Step 2: Accept and apply it in `ReportPrintDocument.tsx`**

Add the import:

```typescript
import { filterDismissed, isSetAside, type DismissedRef } from './dismissed';
```

Add to the component's props type (around line 195, beside `sections: ReportSection[];`):

```typescript
  dismissed?: DismissedRef[];
```

Destructure it with a default in the component signature: `dismissed = [],`.

Change line 201 from:

```typescript
  const ordered = orderSections(sections);
```

to:

```typescript
  // Dismissed runner-ups / outside-box / dream jobs never reach the document.
  // A dismissed top-3 career survives here and is marked below instead.
  const ordered = orderSections(filterDismissed(sections, dismissed));
```

- [ ] **Step 3: Render the "Set aside" marker on dismissed top-3 careers**

Find where `ordered` is mapped into `PrintSection` elements. For each section, pass a marker prop:

```tsx
            setAside={isSetAside(s, dismissed)}
```

In `src/components/report-pdf/PrintSection.tsx`, accept `setAside?: boolean` and render, directly under the section title:

```tsx
      {setAside && (
        <div
          style={{
            display: 'inline-block',
            marginBottom: 10,
            padding: '3px 10px',
            borderRadius: 9999,
            border: '1px solid rgba(0,0,0,0.18)',
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(0,0,0,0.5)',
          }}
        >
          {lang === 'nl' ? 'Opzij gezet' : 'Set aside'}
        </div>
      )}
```

Use whatever `lang` variable `PrintSection` already has in scope; if it has none, pass it down from `ReportPrintDocument`, which computes `lang` at line 202. The print document does not use i18next (it renders in a headless browser from a service-role payload), so the string is inline, matching how the rest of `report-pdf` handles EN/NL.

- [ ] **Step 4: Bump the print build fingerprint**

In `src/components/report-pdf/printBuild.ts`, change line 16:

```typescript
export const PRINT_BUILD = 'p21-dismissed-careers';
```

This is mandatory. Without it, a render cannot be distinguished from a stale build, and an hour was lost to exactly that on 2026-08-13.

- [ ] **Step 5: Verify**

```bash
npm run build && npx vitest run
```

Expected: exit 0, all tests pass.

- [ ] **Step 6: Verify the rendered PDF**

Open `/report/print?rt=<token>` in the Browser pane, confirm `window.__PRINT_BUILD__` reads `p21-dismissed-careers`, and check against a report with one dismissed runner-up and one dismissed top-3 career: the runner-up is gone, the top-3 career is present with a "Set aside" pill.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ReportPrint.tsx src/components/report-pdf/
git commit -m "report-pdf: drop dismissed runner-ups, mark dismissed top-3 careers \"Set aside\""
```

---

## Task 12: Deploy the edge function

**Files:**
- None (deploy only)

`report-print-data` is an **existing** function. Per CLAUDE.md, re-deploying an existing edge function requires explicit approval, since it can break live traffic.

- [ ] **Step 1: Ask Sjoerd for approval to redeploy `report-print-data`**

State what changed (one extra query, one extra response key, both additive) and that PDF rendering is the only consumer.

- [ ] **Step 2: On approval, push to `main`**

Edge functions auto-deploy via the GitHub Action on push to `main`. No manual `supabase functions deploy` and no `vercel --prod`.

- [ ] **Step 3: Verify the deployed function returns the new key**

Render one report PDF and confirm the payload carries `dismissed`.

---

## Task 13: /ops dismissal aggregate

**Files:**
- Create: `src/components/ops/DismissalsCard.tsx`
- Modify: `src/pages/Ops.tsx:1951` (Platform tab)

- [ ] **Step 1: Write the card**

English only, per the ops language rule. Reuse the existing `SectionCard` shell.

```tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// What users are setting aside, and why. Read-only. English only — /ops and
// all internal tooling stays English; Dutch is a user-facing target.

const REASON_LABEL: Record<string, string> = {
  not_interested: 'Not interested',
  wrong_level: 'Wrong level',
  pay_too_low: 'Pay too low',
  already_did: 'Already did this',
  location: 'Location',
  other: 'Something else',
  unstated: 'No reason given',
};

interface Row {
  career_title: string;
  section_type: string;
  reason: string | null;
}

export const DismissalsCard: React.FC = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ops-dismissals'],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from('dismissed_careers')
        .select('career_title, section_type, reason')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  if (isLoading) return <div className="text-[13px] text-white/55">Loading dismissals…</div>;
  if (rows.length === 0) {
    return <div className="text-[13px] text-white/55">Nobody has set a career aside yet.</div>;
  }

  const byCareer = new Map<string, number>();
  const byReason = new Map<string, number>();
  for (const r of rows) {
    byCareer.set(r.career_title, (byCareer.get(r.career_title) ?? 0) + 1);
    const key = r.reason ?? 'unstated';
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }

  const topCareers = [...byCareer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const reasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <div className="text-[12px] uppercase tracking-wide text-white/45 mb-2">
          Most set aside
        </div>
        {topCareers.map(([title, n]) => (
          <div key={title} className="flex justify-between py-1 text-[13px] text-white/[0.86]">
            <span className="truncate pr-3">{title}</span>
            <span className="text-white/55 tabular-nums">{n}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-[12px] uppercase tracking-wide text-white/45 mb-2">Why</div>
        {reasons.map(([reason, n]) => (
          <div key={reason} className="flex justify-between py-1 text-[13px] text-white/[0.86]">
            <span>{REASON_LABEL[reason] ?? reason}</span>
            <span className="text-white/55 tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DismissalsCard;
```

- [ ] **Step 2: Mount it on the Platform tab**

In `src/pages/Ops.tsx`, import it at the top beside the other ops imports:

```typescript
import DismissalsCard from '@/components/ops/DismissalsCard';
```

And inside the `activeTab === 'platform'` block, after the existing `n8n errors` `SectionCard`, add:

```tsx
                  <SectionCard
                    id="dismissals"
                    title="Careers set aside"
                    subtitle="What users rejected, and why"
                    open={open.dismissals}
                    onToggle={toggle}
                  >
                    <DismissalsCard />
                  </SectionCard>
```

Add `dismissals: false` to the `open` state object's initial value so the toggle has a key.

**Note on access:** /ops is admin-gated, but `dismissed_careers` RLS scopes `SELECT` to `auth.uid() = user_id`, so this query returns only Sjoerd's own rows. Check how the other /ops tabs read cross-user data (`ops-feed` uses a service-role edge function). If they go through an edge function, this card must too: add the aggregate to `ops-feed` rather than querying from the browser. Verify before shipping, and prefer the edge-function route.

- [ ] **Step 3: Verify**

```bash
npm run build
```

Expected: exit 0. Then open /ops → Platform in the Browser pane and confirm the card renders (empty state is fine).

- [ ] **Step 4: Commit**

```bash
git add src/components/ops/DismissalsCard.tsx src/pages/Ops.tsx
git commit -m "ops: careers-set-aside aggregate on the Platform tab"
```

---

# PHASE B — Job search free tier

## Task 14: Security fix — lock down self-writable `profiles` columns

**Files:**
- Create: `supabase/migrations/20260915150000_lock_profiles_columns.sql`

This is a live privilege-escalation hole and a hard prerequisite: the "unlimited searches" entitlement reads `comp_tool_unlocks`, so a self-granted comp is a self-granted uncapped search budget.

- [ ] **Step 1: Audit every profile write in the app first**

```bash
grep -rn "from('profiles')" --include="*.ts" --include="*.tsx" src/ | grep -i "update\|upsert"
grep -rn "updateProfile" --include="*.ts" --include="*.tsx" src/
```

Write down the union of every column written. The allowlist below must be a superset. `useProfile().updateProfile` spreads an arbitrary object, so a missing column breaks a save **silently at runtime** — the build will not catch it.

- [ ] **Step 2: Write the migration**

```sql
-- Stop users granting themselves paid features.
--
-- The policy on public.profiles is:
--     "Users can update their own profile"  UPDATE  USING (auth.uid() = id)
-- with no WITH CHECK and no column restriction. The frontend writes to
-- profiles directly, so any logged-in user can open devtools and run
--     supabase.from('profiles').update({ comp_tool_unlocks: 3 })
-- to unlock job search, tailored resumes and cover letters. The column name
-- is public: it ships in src/integrations/supabase/types.ts.
--
-- The same hole exposes partner_id (self-attribute to a partner, which changes
-- white-label branding), referral_code and stripe_promotion_code_id.
--
-- RLS policies cannot express column-level rules, so the fix is a column-level
-- GRANT. Revoke blanket UPDATE from `authenticated`, then re-grant exactly the
-- columns the app legitimately writes. The RLS policy still scopes rows to the
-- owner; this narrows WHICH COLUMNS that owner may touch.
--
-- Columns deliberately left out (service role only): id, email, auth_provider,
-- created_at, referral_code, stripe_promotion_code_id, partner_id,
-- comp_tool_unlocks.

REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  first_name,
  last_name,
  country,
  pronouns,
  age_range,
  region,
  preferred_language,
  email_reminders_enabled,
  privacy_consent_at,
  terms_consent_at,
  resume_data,
  resume_parsed_data,
  resume_uploaded_at,
  resume_full_data,
  resume_full_data_extracted_at,
  updated_at
) ON public.profiles TO authenticated;

COMMENT ON COLUMN public.profiles.comp_tool_unlocks IS
  'Manually granted tool unlocks (0-3), for comping someone the referral-gated tools. Read only by the tool gate; never affects the referral refund ladder. NOT user-writable: excluded from the column-level UPDATE grant to authenticated (20260915150000).';
```

- [ ] **Step 3: Apply via `apply_migration`, name `lock_profiles_columns`**

- [ ] **Step 4: Verify the grant took**

```sql
select privilege_type, column_name
from information_schema.column_privileges
where table_schema='public' and table_name='profiles'
  and grantee='authenticated' and privilege_type='UPDATE'
order by column_name;
```

Expected: exactly the 16 allowed columns. `comp_tool_unlocks`, `partner_id`, `referral_code` and `stripe_promotion_code_id` must NOT appear.

- [ ] **Step 5: Verify the escalation is actually blocked**

```sql
select * from pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'comp_tool_unlocks', 'UPDATE');
```

Expected: `false`.

- [ ] **Step 6: Regression-test every profile write in the browser**

This is the step that catches a missing column. In the Browser pane, exercise each flow and confirm no console error and the value persists after reload:
- Profile page: change first name, last name, country → Save
- Profile page: toggle email reminders
- Profile page: delete résumé data
- Résumé upload: upload a PDF and confirm `resume_uploaded_at` is written
- Checkout: reach the consent step and confirm `privacy_consent_at` / `terms_consent_at` are written

If any write now fails with `permission denied for column`, add that column to the GRANT in a follow-up migration. Do not widen it back to a blanket grant.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260915150000_lock_profiles_columns.sql
git commit -m "security: users can no longer grant themselves comp_tool_unlocks"
```

---

## Task 15: RLS and indexes on `user_job_searches`

**Files:**
- Create: `supabase/migrations/20260915151000_user_job_searches_rls.sql`

The table exists but nothing has ever written to it, so its RLS and indexes have never been exercised.

- [ ] **Step 1: Inspect its current state**

```sql
select relrowsecurity from pg_class where relname='user_job_searches';
select policyname, cmd from pg_policies where schemaname='public' and tablename='user_job_searches';
select indexname from pg_indexes where schemaname='public' and tablename='user_job_searches';
```

- [ ] **Step 2: Write the migration, keeping only what the inspection showed missing**

```sql
-- Revive user_job_searches as the job-search credit ledger.
--
-- The table has existed since the first jobs build but nothing ever wrote to
-- it (only the two delete RPCs reference it). Its shape is already exactly
-- right for the credit model: one row per user + report + career + country,
-- with a search_status column.
--
--   search_status = 'charged'  the search reached n8n and cost real money
--                              (Apify LinkedIn scrape + AI scoring)
--   search_status = 'cached'   served from job_search_cache, cost nothing
--
-- Only 'charged' rows count against the 4-search free tier, so re-running a
-- Recent Search chip is free — which is both fairer and exactly our own cost.
--
-- Rows are written by the search-jobs edge function under the service role.
-- The browser only reads its own rows, to show the remaining-credits counter.

ALTER TABLE public.user_job_searches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_job_searches'
      AND policyname='Users read their own job searches'
  ) THEN
    CREATE POLICY "Users read their own job searches"
      ON public.user_job_searches FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- No INSERT/UPDATE/DELETE policy for authenticated, deliberately: a user who
  -- could delete their own rows could reset their own credit counter.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_job_searches'
      AND policyname='Service role full access on user job searches'
  ) THEN
    CREATE POLICY "Service role full access on user job searches"
      ON public.user_job_searches FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Backs the credit count: "how many charged rows for this report?"
CREATE INDEX IF NOT EXISTS idx_user_job_searches_report_status
  ON public.user_job_searches (report_id, search_status);

COMMENT ON TABLE public.user_job_searches IS
  'Job-search credit ledger. One row per career searched. search_status = charged (hit n8n, counts against the free tier) or cached (free). Written only by the search-jobs edge function; users can read their own rows but never write them.';
```

- [ ] **Step 3: Apply via `apply_migration`, name `user_job_searches_rls`**

- [ ] **Step 4: Verify**

```sql
select policyname, cmd from pg_policies where schemaname='public' and tablename='user_job_searches';
```

Expected: the SELECT policy and the service-role ALL policy. No INSERT/UPDATE/DELETE policy for `authenticated`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915151000_user_job_searches_rls.sql
git commit -m "db: RLS and index on user_job_searches, now the credit ledger"
```

---

## Task 16: Let vitest reach `supabase/functions`

**Files:**
- Modify: `vite.config.ts:22-24`

The vitest config lives in `vite.config.ts`, not a separate `vitest.config.ts`. Its `include` is `src/**` only, so edge-function logic is currently untestable. The gate's decision logic is the highest-value thing to test in this whole plan, so widen it.

- [ ] **Step 1: Change the include**

```typescript
  test: {
    // `supabase/functions` is Deno at runtime, but pure-logic modules there
    // (no Deno.* imports) are plain TypeScript and worth unit testing. Only
    // *.test.ts files are collected, so nothing Deno-specific is loaded.
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
  },
```

- [ ] **Step 2: Verify nothing broke**

```bash
npx vitest run
```

Expected: the same test count as before this change, all passing.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "test: let vitest collect pure-logic tests under supabase/functions"
```

---

## Task 17: The credit decision logic

**Files:**
- Create: `supabase/functions/_shared/searchCredits.ts`
- Create: `supabase/functions/_shared/searchCredits.test.ts`

Pure logic, no Deno imports, so it is testable and the edge function stays a thin shell around it.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { decideSearchCharge, FREE_SEARCH_LIMIT } from './searchCredits';

describe('decideSearchCharge', () => {
  it('serves a cache hit without charging, even at the limit', () => {
    const d = decideSearchCharge({ cacheHit: true, unlimited: false, chargedCount: FREE_SEARCH_LIMIT });
    expect(d).toEqual({ allow: true, charge: false, log: 'cached' });
  });

  it('serves a cache hit without charging for an unlimited user', () => {
    const d = decideSearchCharge({ cacheHit: true, unlimited: true, chargedCount: 0 });
    expect(d).toEqual({ allow: true, charge: false, log: 'cached' });
  });

  it('charges an unlimited user but never blocks them', () => {
    const d = decideSearchCharge({ cacheHit: false, unlimited: true, chargedCount: 999 });
    expect(d).toEqual({ allow: true, charge: true, log: 'charged' });
  });

  it('charges a free-tier user below the limit', () => {
    const d = decideSearchCharge({ cacheHit: false, unlimited: false, chargedCount: 0 });
    expect(d).toEqual({ allow: true, charge: true, log: 'charged' });
  });

  it('allows the very last free search', () => {
    const d = decideSearchCharge({
      cacheHit: false,
      unlimited: false,
      chargedCount: FREE_SEARCH_LIMIT - 1,
    });
    expect(d.allow).toBe(true);
    expect(d.charge).toBe(true);
  });

  it('blocks a free-tier user who has used the limit', () => {
    const d = decideSearchCharge({
      cacheHit: false,
      unlimited: false,
      chargedCount: FREE_SEARCH_LIMIT,
    });
    expect(d).toEqual({ allow: false, charge: false, log: null });
  });

  it('blocks a free-tier user somehow over the limit', () => {
    const d = decideSearchCharge({
      cacheHit: false,
      unlimited: false,
      chargedCount: FREE_SEARCH_LIMIT + 3,
    });
    expect(d.allow).toBe(false);
  });

  it('has a free limit of 4', () => {
    expect(FREE_SEARCH_LIMIT).toBe(4);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run supabase/functions/_shared/searchCredits.test.ts
```

Expected: FAIL, "Failed to resolve import ./searchCredits".

- [ ] **Step 3: Write the implementation**

```typescript
// Job-search credit rules. Pure logic, no Deno imports, so vitest can cover
// every branch (see vite.config.ts `test.include`).
//
// One "search" is ONE CAREER that actually reaches n8n. A press of Search can
// cover up to 3 careers, each of which is a separate search-jobs call, and
// each of those is a separate Apify LinkedIn scrape plus AI scoring. Charging
// per career is what actually tracks our cost.
//
// Cache hits are free. The Recent Searches chips deliberately re-run previous
// configs, which the 24h job_search_cache serves for nothing, so charging for
// them would bill the user for something that costs us zero.

export const FREE_SEARCH_LIMIT = 4;

export interface ChargeInput {
  /** Whether job_search_cache already had a fresh result for this signature. */
  cacheHit: boolean;
  /** True when the user has a referral or a comped tool unlock. */
  unlimited: boolean;
  /** Existing 'charged' rows in user_job_searches for THIS report. */
  chargedCount: number;
}

export interface ChargeDecision {
  /** False means: refuse the request, do not call n8n. */
  allow: boolean;
  /** True means: this run consumes one of the free searches. */
  charge: boolean;
  /** What to write to user_job_searches.search_status, or null when refused. */
  log: 'charged' | 'cached' | null;
}

export function decideSearchCharge(input: ChargeInput): ChargeDecision {
  // A cache hit costs nothing, so it is always allowed and never charged —
  // including for a user who has already exhausted their free searches.
  if (input.cacheHit) {
    return { allow: true, charge: false, log: 'cached' };
  }

  if (input.unlimited) {
    return { allow: true, charge: true, log: 'charged' };
  }

  if (input.chargedCount >= FREE_SEARCH_LIMIT) {
    return { allow: false, charge: false, log: null };
  }

  return { allow: true, charge: true, log: 'charged' };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run supabase/functions/_shared/searchCredits.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/searchCredits.ts supabase/functions/_shared/searchCredits.test.ts
git commit -m "search-jobs: pure credit decision logic, fully covered"
```

---

## Task 18: Authenticate and gate `search-jobs`

**Files:**
- Modify: `supabase/functions/search-jobs/index.ts`
- Modify: `supabase/config.toml:58-59`

- [ ] **Step 1: Add the imports**

Change line 3 to include the auth helper, and add the credit module:

```typescript
import {
  getCorsHeaders,
  handleCorsPreFlight,
  checkRateLimit,
  errorResponse,
  getAuthenticatedUser,
} from "../_shared/cors.ts";
import { decideSearchCharge, FREE_SEARCH_LIMIT } from "../_shared/searchCredits.ts";
```

- [ ] **Step 2: Authenticate the caller, right after the rate-limit check**

Insert after `if (rateLimited) return rateLimited;`:

```typescript
  // Until 2026-09-15 this function had verify_jwt = false AND no in-function
  // auth check, so anyone with the URL could trigger paid Apify scrapes. The
  // referral gate lived only in React and protected nothing here. Auth is also
  // a hard requirement for the per-user free-tier cap below.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const userId = authed.userId;
```

`verify_jwt` stays `false` at the gateway, matching `ensure-referral-code`: the platform check rejects the publishable key, so the JWT is verified in-function instead. Update the comment in `supabase/config.toml` above the `[functions.search-jobs]` block to say so, since the misplaced comment there is what disguised this hole.

- [ ] **Step 3: Verify the report belongs to the caller**

After `report_id` is destructured from the body, add:

```typescript
  // The cap is per report, so an unverified report_id would let a user spend
  // someone else's allowance — or dodge their own by borrowing a stranger's id.
  if (!report_id) {
    return errorResponse('report_id is required', 400, corsHeaders);
  }
  const { data: ownedReport } = await supabase
    .from('reports')
    .select('id')
    .eq('id', report_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!ownedReport) {
    return errorResponse('Report not found', 404, corsHeaders);
  }
```

This must sit **after** the service-role `supabase` client is created. Move it below that line if necessary.

- [ ] **Step 4: Resolve the entitlement**

```typescript
  // Unlimited if the user earned a referral or we comped them the tools.
  // comp_tool_unlocks is service-role-writable only as of 20260915150000.
  const [{ count: referralCount }, { data: profileRow }] = await Promise.all([
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId),
    supabase.from('profiles').select('comp_tool_unlocks').eq('id', userId).maybeSingle(),
  ]);
  const unlimited = (referralCount ?? 0) >= 1 || (profileRow?.comp_tool_unlocks ?? 0) >= 1;
```

- [ ] **Step 5: Apply the decision around the existing cache lookup**

The function already checks `job_search_cache` and returns early on a hit at line ~170. Restructure so both paths go through `decideSearchCharge`:

```typescript
  const cacheHit = !!cached;

  const { count: chargedCount } = await supabase
    .from('user_job_searches')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', report_id)
    .eq('search_status', 'charged');

  const decision = decideSearchCharge({
    cacheHit,
    unlimited,
    chargedCount: chargedCount ?? 0,
  });

  if (!decision.allow) {
    return new Response(
      JSON.stringify({
        error: 'search_limit_reached',
        used: chargedCount ?? 0,
        limit: FREE_SEARCH_LIMIT,
      }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
```

Use 429 rather than 402: the frontend already distinguishes errors by the `error` string, and 402 triggers payment-required handling in some proxies.

- [ ] **Step 6: Log the ledger row on both paths**

On the cache-hit early return, before returning:

```typescript
    await supabase.from('user_job_searches').insert({
      user_id: userId,
      report_id,
      career_title,
      section_type: body.section_type ?? 'unknown',
      country_code: countryNormalized,
      location: location || null,
      search_status: 'cached',
    });
```

And after the n8n call succeeds and the cache row is inserted:

```typescript
    await supabase.from('user_job_searches').insert({
      user_id: userId,
      report_id,
      career_title,
      section_type: body.section_type ?? 'unknown',
      country_code: countryNormalized,
      location: location || null,
      search_status: decision.log,
    });
```

The charged row is written **after** n8n returns successfully, so a failed or timed-out search never burns a credit.

- [ ] **Step 7: Verify**

```bash
npx vitest run && npm run build
```

Expected: exit 0.

- [ ] **Step 8: Ask Sjoerd for approval to redeploy `search-jobs`**

It is an existing function; per CLAUDE.md a redeploy needs explicit approval. Note that adding auth is a breaking change for any caller that was not sending a JWT, which is the point.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/search-jobs/index.ts supabase/config.toml
git commit -m "search-jobs: require auth, verify report ownership, enforce the 4-search free tier"
```

---

## Task 19: `useJobSearchCredits` hook

**Files:**
- Create: `src/hooks/useJobSearchCredits.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReferralStatus } from '@/hooks/useReferralStatus';

// Mirrors FREE_SEARCH_LIMIT in supabase/functions/_shared/searchCredits.ts.
// The edge function is the enforcer; this is display only. Keep them in sync.
export const FREE_SEARCH_LIMIT = 4;

export interface JobSearchCredits {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  isLoading: boolean;
}

/**
 * How many of the 4 free job searches this report has spent. Only 'charged'
 * rows count: cache hits (including Recent Searches chips) are free.
 */
export function useJobSearchCredits(reportId?: string): JobSearchCredits {
  const { user } = useAuth();
  const referral = useReferralStatus();
  const unlimited = !!referral.features.find((f) => f.key === 'jobs')?.unlocked;

  const { data: used = 0, isLoading } = useQuery({
    queryKey: ['job-search-credits', reportId],
    queryFn: async (): Promise<number> => {
      if (!reportId) return 0;
      const { count, error } = await supabase
        .from('user_job_searches')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('search_status', 'charged');
      if (error) {
        console.error('job search credit count failed:', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!reportId && !!user?.id && !unlimited,
  });

  return {
    used,
    limit: FREE_SEARCH_LIMIT,
    remaining: Math.max(0, FREE_SEARCH_LIMIT - used),
    unlimited,
    isLoading: isLoading || referral.isLoading,
  };
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useJobSearchCredits.ts
git commit -m "jobs: useJobSearchCredits for the remaining-searches counter"
```

---

## Task 20: Replace the referral wall with the credit gate

**Files:**
- Modify: `src/pages/Jobs.tsx:553-567` and the search handler around `:379-410`

- [ ] **Step 1: Import the hook**

```typescript
import { useJobSearchCredits } from '@/hooks/useJobSearchCredits';
```

- [ ] **Step 2: Call it beside the existing `useReferralStatus` call**

```typescript
  const credits = useJobSearchCredits(latestReport?.id);
```

Place it with the other hooks, above every early return, so the hook order stays stable (the file already warns about React error #310 for exactly this reason).

- [ ] **Step 3: Replace the wall**

Change the block at line 556:

```typescript
  if (jobsFeature && !jobsFeature.unlocked) {
    return (<JobsLocked ... />);
  }
```

to:

```typescript
  // Job search is open to everyone: 4 free searches per report, uncapped by
  // a single referral. JobsLocked is now the out-of-searches state, not a wall.
  if (!credits.unlimited && credits.remaining === 0) {
    return (
      <JobsLocked
        firstName={firstName}
        referralCode={referralStatus.referralCode}
        used={credits.used}
        limit={credits.limit}
        onBack={() => navigate('/dashboard')}
        onShare={handleInvite}
        onProfile={() => navigate('/profile')}
        onSignOut={() => navigate('/auth')}
      />
    );
  }
```

`jobsFeature` is now only used for the ladder copy, so remove the unused local if TypeScript flags it.

- [ ] **Step 4: Handle the server-side refusal in `useJobSearch`**

In `src/hooks/useJobSearch.ts`, the catch block currently sets a generic error. Distinguish the cap so the UI can react. Inside the `try`, after `if (error) throw error;`:

```typescript
        if (data?.error === 'search_limit_reached') {
          setResults(prev => prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error', error: 'limit' } : r
          ));
          // Stop the loop: every remaining career would be refused too.
          break;
        }
```

- [ ] **Step 5: Invalidate the credit count after a search**

In `Jobs.tsx`'s `handleSearch`, after `searchJobs(...)` resolves, add:

```typescript
    queryClient.invalidateQueries({ queryKey: ['job-search-credits', latestReport.id] });
```

`queryClient` comes from `useQueryClient()`; add the import and the call if the file does not already have one.

- [ ] **Step 6: Verify**

```bash
npm run build && npx vitest run
```

Expected: exit 0, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Jobs.tsx src/hooks/useJobSearch.ts
git commit -m "jobs: open search to everyone, gate on the 4-search free tier"
```

---

## Task 21: Credit counter and over-selection warning in the search UI

**Files:**
- Modify: `src/components/jobs/v2/JobsSearch.tsx:228`
- Modify: `src/components/jobs/v2/JobsLocked.tsx`

- [ ] **Step 1: Add the props to `JobsSearch`**

```typescript
  creditsRemaining: number;
  creditsUnlimited: boolean;
```

Pass them from `Jobs.tsx`: `creditsRemaining={credits.remaining}` and `creditsUnlimited={credits.unlimited}`.

- [ ] **Step 2: Show the counter beside the Search button**

```tsx
      {!creditsUnlimited && (
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
          {t('search.creditsLeft', {
            count: creditsRemaining,
            defaultValue: '{{count}} of 4 free searches left',
          })}
        </div>
      )}
```

- [ ] **Step 3: Warn when more careers are selected than credits remain**

Directly under the counter:

```tsx
      {!creditsUnlimited && selected.length > creditsRemaining && (
        <div style={{ fontSize: 12.5, color: '#EFBE48', marginTop: 6 }}>
          {t('search.creditsShort', {
            selected: selected.length,
            remaining: creditsRemaining,
            defaultValue:
              'You picked {{selected}} careers but have {{remaining}} searches left. Only the first {{remaining}} will run.',
          })}
        </div>
      )}
```

This is a warning, not a block: the edge function is the enforcer, and a user who wants to spend their last credits on the first two of three picks is making a valid choice.

- [ ] **Step 4: Turn `JobsLocked` into the out-of-searches state**

Accept `used: number` and `limit: number`. Change its headline copy from "unlock job search" to "you've used your free searches", and keep the existing invite CTA as the route to unlimited. Use the `jobs` namespace keys added in Task 22.

- [ ] **Step 5: Verify**

```bash
npm run build
```

Expected: exit 0. Then in the Browser pane confirm the counter renders and the warning appears when 3 careers are selected with 2 credits left.

- [ ] **Step 6: Commit**

```bash
git add src/components/jobs/v2/JobsSearch.tsx src/components/jobs/v2/JobsLocked.tsx src/pages/Jobs.tsx
git commit -m "jobs: show remaining free searches and warn on over-selection"
```

---

## Task 22: Copy for the free tier (EN + NL)

**Files:**
- Modify: `public/locales/{en,nl}/jobs.json`
- Modify: `public/locales/{en,nl}/dashboard.json`

- [ ] **Step 1: Add to `public/locales/en/jobs.json` under `search`**

```json
"creditsLeft": "{{count}} of 4 free searches left",
"creditsShort": "You picked {{selected}} careers but have {{remaining}} searches left. Only the first {{remaining}} will run."
```

And replace the `locked` block's headline and body:

```json
"locked": {
  "title": "You've used your 4 free searches",
  "body": "Invite one person who buys an assessment and job search becomes unlimited, for good.",
  "cta": "Get your invite link"
}
```

Keep any other keys already inside `locked` that the component still uses.

- [ ] **Step 2: Add the Dutch equivalents to `public/locales/nl/jobs.json`**

```json
"creditsLeft": "Nog {{count}} van 4 gratis zoekopdrachten",
"creditsShort": "Je koos {{selected}} loopbanen maar hebt nog {{remaining}} zoekopdrachten. Alleen de eerste {{remaining}} worden uitgevoerd."
```

```json
"locked": {
  "title": "Je 4 gratis zoekopdrachten zijn op",
  "body": "Nodig één persoon uit die een assessment koopt en zoeken naar vacatures wordt onbeperkt, voorgoed.",
  "cta": "Haal je uitnodigingslink"
}
```

- [ ] **Step 3: Update the ladder copy in both `dashboard.json` files**

Step 1 of the toolkit ladder now grants unlimited rather than access. In the `v4.unlock` / `v4.toolkit` blocks, change the job-search step's title and description:

EN: title `"Unlimited job searches"`, description `"Everyone gets 4 free searches. One referral removes the cap for good."`

NL: title `"Onbeperkt vacatures zoeken"`, description `"Iedereen krijgt 4 gratis zoekopdrachten. Eén aanbeveling haalt de limiet er voorgoed af."`

Find the exact key paths first:

```bash
python3 -c "import json;d=json.load(open('public/locales/en/dashboard.json'));print(json.dumps(d['v4'].get('unlock'),indent=1));print(json.dumps(d['v4'].get('toolkit'),indent=1))"
```

- [ ] **Step 4: Validate all four files**

```bash
python3 -c "import json;[json.load(open(f'public/locales/{l}/{n}.json')) for l in ('en','nl') for n in ('jobs','dashboard')];print('all valid')"
```

Expected: `all valid`.

- [ ] **Step 5: Commit**

```bash
git add public/locales/
git commit -m "i18n: free-tier job search copy, ladder step is now unlimited (EN + NL)"
```

---

## Task 23: Update the referral ladder source of truth

**Files:**
- Modify: `src/hooks/useReferralStatus.ts:22-50` and `:79-87`

The hardcoded English strings in `REFERRAL_FEATURES` and `UNLOCK_LADDER` still say the tool is locked.

- [ ] **Step 1: Update the `jobs` entry in `REFERRAL_FEATURES`**

```typescript
  {
    key: 'jobs',
    title: 'Unlimited Job Searches',
    // Job search is open to everyone as of 2026-09-15: 4 free searches per
    // report, enforced by the search-jobs edge function. This ladder step no
    // longer unlocks the tool, it removes the cap. `unlocked` therefore means
    // "uncapped" for this feature, and the Jobs page reads it that way.
    description: 'Everyone gets 4 free searches. One referral removes the cap for good.',
    requiredReferrals: 1,
    builtYet: true,
    route: '/jobs?mode=search',
  },
```

- [ ] **Step 2: Update the matching `UNLOCK_LADDER` entry**

```typescript
  { kind: 'tool', featureKey: 'jobs', requiredReferrals: 1, title: 'Unlimited Job Searches', description: 'Everyone gets 4 free searches. One referral removes the cap for good.', builtYet: true, route: '/jobs?mode=search' },
```

- [ ] **Step 3: Verify**

```bash
npm run build && npx vitest run
```

Expected: exit 0, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useReferralStatus.ts
git commit -m "referrals: job-search step now grants unlimited, not access"
```

---

## Task 24: End-to-end verification

**Files:** none

- [ ] **Step 1: Full local check**

```bash
npm run build && npx vitest run
```

Expected: exit 0, every test passing.

- [ ] **Step 2: Browser walkthrough with a free-tier account**

In the Browser pane (via `preview_start`, never `npm run dev` through Bash):

1. Open `/jobs` on an account with zero referrals. The search page renders, no wall.
2. Counter reads "4 of 4 free searches left".
3. Run a search on one career. Counter drops to 3.
4. Re-run the same search from the Recent Searches chip. Counter **stays at 3** (cache hit, free).
5. Spend the remaining 3. The out-of-searches screen appears with the invite CTA.
6. Confirm the search-jobs network call returns 429 with `search_limit_reached`.

- [ ] **Step 3: Browser walkthrough with an unlimited account**

Grant a test account a comp via the service role (the column is no longer user-writable):

```sql
update public.profiles set comp_tool_unlocks = 1
where id = (select id from auth.users where email = '<test account>');
```

Confirm no counter renders and searches never refuse.

- [ ] **Step 4: Confirm the escalation is dead**

In the browser console of a logged-in free-tier account:

```javascript
await supabase.from('profiles').update({ comp_tool_unlocks: 3 }).eq('id', (await supabase.auth.getUser()).data.user.id)
```

Expected: an error mentioning permission denied for column `comp_tool_unlocks`. Before Task 14 this succeeded.

- [ ] **Step 5: Report to Sjoerd**

State plainly what is on the branch, that it is not live until merged to `main`, and offer either the Vercel preview or a straight merge.

---

## Self-review notes

**Spec coverage.** Every requirement in the spec maps to a task: Phase A data (1-3), hook (4), row ids (5), control (6-8), copy (7, 22), PDF (9-12), /ops (13). Phase B security fixes (14-15), test reach (16), credit logic (17-18), frontend (19-23), verification (24). Phase C is deliberately absent; it is deferred to its own session per decision F.

**Two things this plan flags rather than silently resolves.** Task 2 needs the live function bodies fetched before it can be written, because reconstructing three RPC bodies from memory would be a good way to drop a DELETE. Task 13 notes that `dismissed_careers` RLS scopes SELECT to the owner, so the /ops card may need to route through `ops-feed` under the service role instead of querying from the browser; that has to be checked against how the other tabs read cross-user data before shipping.

**Naming consistency.** `decideSearchCharge` / `FREE_SEARCH_LIMIT` are used identically in Tasks 17, 18 and 19. `indexBySectionId` / `bySectionId` in Tasks 4 and 8. `filterDismissed` / `isSetAside` / `DismissedRef` in Tasks 9, 10 and 11. `search_status` values are `'charged'` and `'cached'` everywhere.
