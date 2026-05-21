// Step 1 of the wizard: user picks up to 3 careers from their assessment.
//
// Careers come from report_sections, grouped by section_type. We surface the
// "Why suited" tier (top_career_1/2/3, runner_ups) at the top since those have
// the richest narrative content for the LLM, then outside-the-box and dream
// jobs below for users who want to apply for a stretch role.

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { useReportSections } from '@/hooks/useReportSections';
import type { CareerSelection } from '../types';
import { stripHtml } from '../utils';

interface CareerPickerStepProps {
  reportId: string;
  selected: CareerSelection[];
  onChange: (next: CareerSelection[]) => void;
  onNext: () => void;
}

const CAREER_SECTION_TYPES = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

const GROUP_LABELS: Record<string, string> = {
  top: 'Your top career matches',
  runner_ups: 'Runner-up careers',
  outside_box: 'Outside-the-box paths',
  dream_jobs: 'Dream jobs',
};

const MAX_SELECT = 3;

export function CareerPickerStep({ reportId, selected, onChange, onNext }: CareerPickerStepProps) {
  const { sections, isLoading } = useReportSections(reportId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your careers…
      </div>
    );
  }

  const careers = sections.filter((s) => CAREER_SECTION_TYPES.has(s.section_type));

  if (careers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          We couldn't find any career recommendations on this report.
        </p>
      </div>
    );
  }

  const groups = [
    {
      key: 'top',
      label: GROUP_LABELS.top,
      items: careers
        .filter((c) =>
          ['top_career_1', 'top_career_2', 'top_career_3'].includes(c.section_type),
        )
        .sort((a, b) =>
          a.section_type.localeCompare(b.section_type),
        ),
    },
    {
      key: 'runner_ups',
      label: GROUP_LABELS.runner_ups,
      items: careers
        .filter((c) => c.section_type === 'runner_ups')
        .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)),
    },
    {
      key: 'outside_box',
      label: GROUP_LABELS.outside_box,
      items: careers.filter((c) => c.section_type === 'outside_box'),
    },
    {
      key: 'dream_jobs',
      label: GROUP_LABELS.dream_jobs,
      items: careers.filter((c) => c.section_type === 'dream_jobs'),
    },
  ].filter((g) => g.items.length > 0);

  const selectedIds = new Set(selected.map((s) => s.section_id));
  const atLimit = selected.length >= MAX_SELECT;

  const toggle = (id: string, sectionType: string, title: string) => {
    if (selectedIds.has(id)) {
      onChange(selected.filter((s) => s.section_id !== id));
    } else {
      if (atLimit) return;
      onChange([
        ...selected,
        { section_id: id, section_type: sectionType, career_title: title },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Pick up to {MAX_SELECT} careers to tailor a résumé for
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll create a separate tailored résumé for each one — different careers want different
          things up top.
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            <div className="grid gap-2">
              {group.items.map((item) => {
                const title = stripHtml(item.title);
                const checked = selectedIds.has(item.id);
                const disabled = !checked && atLimit;
                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition ${
                      checked
                        ? 'border-atlas-teal bg-atlas-teal/5'
                        : disabled
                          ? 'opacity-50'
                          : 'hover:border-atlas-teal/50'
                    }`}
                    onClick={() => !disabled && toggle(item.id, item.section_type, title)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        className="data-[state=checked]:bg-atlas-teal data-[state=checked]:border-atlas-teal"
                        onCheckedChange={() => toggle(item.id, item.section_type, title)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{title || 'Untitled career'}</div>
                        {item.alternate_titles ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {stripHtml(item.alternate_titles)}
                          </div>
                        ) : null}
                      </div>
                      {item.score ? (
                        <Badge variant="outline" className="border-atlas-teal/40">
                          {Math.round(Number(item.score))}/100
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          {selected.length} of {MAX_SELECT} selected
        </div>
        <Button
          onClick={onNext}
          disabled={selected.length === 0}
          className="bg-atlas-teal hover:bg-atlas-teal/90"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
