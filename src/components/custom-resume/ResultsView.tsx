// Results page state. One tab per generated résumé; tabs show their per-career
// status badge. Each panel renders ResumePreview, which handles its own
// processing/failed/completed UI.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, ArrowLeft } from 'lucide-react';
import { useCustomResumes } from './hooks/useCustomResumes';
import { ResumePreview } from './ResumePreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TemplateId } from './types';

interface ResultsViewProps {
  customResumeIds: string[];
  onStartNew: () => void;
}

export function ResultsView({ customResumeIds, onStartNew }: ResultsViewProps) {
  const { data: rows, isLoading } = useCustomResumes({ ids: customResumeIds });
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Default the active tab to the first row once we have data
  useEffect(() => {
    if (!activeId && rows && rows.length > 0) {
      setActiveId(rows[0].id);
    }
  }, [rows, activeId]);

  if (isLoading || !rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your résumés…
      </div>
    );
  }

  const inProgress = rows.filter((r) => r.status === 'processing').length;
  const ready = rows.filter((r) => r.status === 'completed').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your tailored résumés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready} of {rows.length} ready
            {inProgress > 0 ? `  ·  ${inProgress} still tailoring` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <Button variant="outline" onClick={onStartNew}>
            <Plus className="mr-1 h-4 w-4" /> Generate more
          </Button>
        </div>
      </div>

      <Tabs value={activeId ?? rows[0]?.id} onValueChange={setActiveId}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {rows.map((row) => (
            <TabsTrigger
              key={row.id}
              value={row.id}
              className="data-[state=active]:bg-atlas-teal data-[state=active]:text-white"
            >
              <span className="truncate max-w-[200px]">{row.career_title}</span>
              <StatusDot status={row.status} />
            </TabsTrigger>
          ))}
        </TabsList>

        {rows.map((row) => (
          <TabsContent key={row.id} value={row.id} className="mt-4">
            <ResumePreview
              row={row}
              onTemplateChange={async (templateId) => {
                // Persist the template choice on the row so it's remembered if
                // the user comes back later. Switching template is purely a
                // render-side concern, no regeneration needed.
                const { error } = await supabase
                  .from('custom_resumes')
                  .update({ template_id: templateId, updated_at: new Date().toISOString() })
                  .eq('id', row.id);
                if (error) {
                  console.error('Failed to persist template change:', error);
                  toast.error('Could not save template choice.');
                }
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge className="ml-2 h-1.5 w-1.5 bg-atlas-teal p-0" aria-label="Ready" />;
    case 'failed':
      return <Badge className="ml-2 h-1.5 w-1.5 bg-destructive p-0" aria-label="Failed" />;
    case 'processing':
    default:
      return <Loader2 className="ml-2 h-3 w-3 animate-spin" aria-label="Processing" />;
  }
}
