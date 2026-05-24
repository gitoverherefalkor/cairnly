// Renders one custom_resumes row: ATS score badge, live PDF preview, and
// download buttons. Handles the three statuses (processing / completed /
// failed) and switches templates on the fly without re-rendering the row.

import { useMemo, useState } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Loader2, AlertCircle, FileText, Mail } from 'lucide-react';
import { getTemplateComponent } from './templates';
import { CoverLetter } from './templates/CoverLetter';
import { TEMPLATES, type TemplateId, type ResumeJson, type CoverLetterJson, type KeywordCoverage } from './types';
import type { CustomResumeRow } from './hooks/useCustomResumes';

interface ResumePreviewProps {
  row: CustomResumeRow;
  onTemplateChange?: (templateId: TemplateId) => void;
}

export function ResumePreview({ row, onTemplateChange }: ResumePreviewProps) {
  const [localTemplate, setLocalTemplate] = useState<TemplateId>(row.template_id as TemplateId);

  // The row.status flows in from Realtime; gate on it before showing the preview.
  if (row.status === 'processing') {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-atlas-teal" />
          <div>
            <div className="font-medium text-foreground">
              Tailoring your résumé for {row.career_title}…
            </div>
            <div className="text-sm">This usually takes 20–40 seconds.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (row.status === 'failed') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <div className="font-medium">
              We couldn't generate the résumé for {row.career_title}.
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {row.error_message || 'Something went wrong. Please try again.'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // status === 'completed'
  const resumeJson = row.resume_json as unknown as ResumeJson;
  const coverLetterJson = row.cover_letter_json as unknown as CoverLetterJson | null;
  const coverage = row.keyword_coverage as unknown as KeywordCoverage | null;

  return (
    <div className="space-y-4">
      <ResumeHeader
        row={row}
        coverage={coverage}
        templateId={localTemplate}
        onTemplateChange={(id) => {
          setLocalTemplate(id);
          onTemplateChange?.(id);
        }}
      />

      <Tabs defaultValue="resume" className="w-full">
        <TabsList>
          <TabsTrigger value="resume">
            <FileText className="mr-2 h-4 w-4" /> Résumé
          </TabsTrigger>
          {coverLetterJson ? (
            <TabsTrigger value="cover-letter">
              <Mail className="mr-2 h-4 w-4" /> Cover letter
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="resume" className="space-y-3">
          <ResumePdfPanel resumeJson={resumeJson} templateId={localTemplate} careerTitle={row.career_title} />
        </TabsContent>

        {coverLetterJson ? (
          <TabsContent value="cover-letter" className="space-y-3">
            <CoverLetterPanel
              letter={coverLetterJson}
              contact={resumeJson.contact}
              careerTitle={row.career_title}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      {coverage && (coverage.hit?.length || coverage.missing?.length) ? (
        <KeywordCoveragePanel coverage={coverage} />
      ) : null}
    </div>
  );
}

interface ResumeHeaderProps {
  row: CustomResumeRow;
  coverage: KeywordCoverage | null;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
}

function ResumeHeader({ row, templateId, onTemplateChange }: ResumeHeaderProps) {
  const score = row.ats_score != null ? Math.round(Number(row.ats_score)) : null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {score != null ? (
        <Badge
          className={
            score >= 80
              ? 'bg-atlas-teal text-white'
              : score >= 60
                ? 'bg-atlas-gold text-white'
                : 'bg-atlas-orange text-white'
          }
        >
          ATS score · {score}/100
        </Badge>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Template:</span>
        <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id} disabled={!t.builtYet}>
                {t.name}
                {!t.builtYet ? ' (coming soon)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface ResumePdfPanelProps {
  resumeJson: ResumeJson;
  templateId: TemplateId;
  careerTitle: string;
}

function ResumePdfPanel({ resumeJson, templateId, careerTitle }: ResumePdfPanelProps) {
  const TemplateComponent = useMemo(() => getTemplateComponent(templateId), [templateId]);
  const docElement = useMemo(
    () => <TemplateComponent data={resumeJson} />,
    [TemplateComponent, resumeJson],
  );

  const fileName = useMemo(() => {
    const name = resumeJson.contact?.name?.replace(/\s+/g, '_') || 'resume';
    const career = careerTitle.replace(/[^a-zA-Z0-9]+/g, '_');
    return `${name}_${career}_resume.pdf`;
  }, [resumeJson.contact?.name, careerTitle]);

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <PDFViewer
          showToolbar={false}
          style={{ width: '100%', height: 720, border: 0, background: 'transparent' }}
        >
          {docElement}
        </PDFViewer>
      </div>
      <div className="flex justify-end">
        <PDFDownloadLink document={docElement} fileName={fileName}>
          {({ loading }) => (
            <Button disabled={loading} className="bg-atlas-teal hover:bg-atlas-teal/90">
              <Download className="mr-2 h-4 w-4" />
              {loading ? 'Preparing…' : 'Download PDF'}
            </Button>
          )}
        </PDFDownloadLink>
      </div>
    </>
  );
}

interface CoverLetterPanelProps {
  letter: CoverLetterJson;
  contact: ResumeJson['contact'];
  careerTitle: string;
}

function CoverLetterPanel({ letter, contact, careerTitle }: CoverLetterPanelProps) {
  const docElement = useMemo(
    () => <CoverLetter letter={letter} contact={contact} careerTitle={careerTitle} />,
    [letter, contact, careerTitle],
  );

  const fileName = useMemo(() => {
    const name = contact?.name?.replace(/\s+/g, '_') || 'cover_letter';
    const career = careerTitle.replace(/[^a-zA-Z0-9]+/g, '_');
    return `${name}_${career}_cover_letter.pdf`;
  }, [contact?.name, careerTitle]);

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <PDFViewer
          showToolbar={false}
          style={{ width: '100%', height: 720, border: 0, background: 'transparent' }}
        >
          {docElement}
        </PDFViewer>
      </div>
      <div className="flex justify-end">
        <PDFDownloadLink document={docElement} fileName={fileName}>
          {({ loading }) => (
            <Button disabled={loading} className="bg-atlas-teal hover:bg-atlas-teal/90">
              <Download className="mr-2 h-4 w-4" />
              {loading ? 'Preparing…' : 'Download PDF'}
            </Button>
          )}
        </PDFDownloadLink>
      </div>
    </>
  );
}

function KeywordCoveragePanel({ coverage }: { coverage: KeywordCoverage }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="font-medium">Keyword coverage</div>
        {coverage.hit?.length ? (
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Hit ({coverage.hit.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {coverage.hit.map((k) => (
                <Badge key={k} variant="outline" className="border-atlas-teal/40 text-atlas-teal">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {coverage.missing?.length ? (
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Consider adding ({coverage.missing.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {coverage.missing.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="border-atlas-orange/40 text-atlas-orange"
                >
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
