// Step 2 of the wizard: template choice + cover letter toggle.
//
// Cards are gated on the TEMPLATES.builtYet flag — unbuilt cards render as
// disabled "Coming soon"; built ones are selectable.

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { TEMPLATES, type TemplateId } from '../types';

interface TemplateAndOptionsStepProps {
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  includeCoverLetter: boolean;
  onCoverLetterChange: (next: boolean) => void;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  careersCount: number;
  // Cover letter is gated on the 3-referral tier. When the user only has
  // the resume unlock (2 referrals), the checkbox stays disabled and shows
  // a "Invite 1 more friend" hint.
  coverLetterUnlocked: boolean;
  referralsToCoverLetter: number; // how many more invites needed
}

export function TemplateAndOptionsStep({
  templateId,
  onTemplateChange,
  includeCoverLetter,
  onCoverLetterChange,
  onBack,
  onGenerate,
  isGenerating,
  careersCount,
  coverLetterUnlocked,
  referralsToCoverLetter,
}: TemplateAndOptionsStepProps) {
  const atsTemplates = TEMPLATES.filter((t) => t.category === 'ats');
  const designedTemplates = TEMPLATES.filter((t) => t.category === 'designed');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Choose a template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ATS-safe templates are designed to pass through software screeners cleanly. You can
          switch templates later without re-generating.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> ATS-safe
          <Badge variant="outline" className="ml-1 border-atlas-teal/40 text-[10px]">
            Recommended
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {atsTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              selected={templateId === t.id}
              disabled={false}
              onClick={() => onTemplateChange(t.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Designed
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {designedTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              selected={templateId === t.id}
              disabled={!t.builtYet}
              onClick={() => onTemplateChange(t.id)}
            />
          ))}
        </div>
      </div>

      <Card className={`border-dashed ${!coverLetterUnlocked ? 'opacity-75' : ''}`}>
        <CardContent className="flex items-start gap-3 p-4">
          <Checkbox
            id="cover-letter"
            checked={coverLetterUnlocked && includeCoverLetter}
            disabled={!coverLetterUnlocked}
            className="mt-0.5 data-[state=checked]:bg-atlas-teal data-[state=checked]:border-atlas-teal"
            onCheckedChange={(c) => onCoverLetterChange(c === true)}
          />
          <label
            htmlFor="cover-letter"
            className={`flex-1 ${coverLetterUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-2 font-medium">
              Also write a cover letter for each career
              {!coverLetterUnlocked && (
                <Badge variant="outline" className="gap-1 border-atlas-orange/40 text-[10px] text-atlas-orange">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {coverLetterUnlocked ? (
                <>Drafted from your assessment narrative and the tailored résumé. Free to keep or discard.</>
              ) : (
                <>
                  Invite {referralsToCoverLetter} more friend{referralsToCoverLetter === 1 ? '' : 's'} to unlock — they
                  get {/* discount handled by share copy elsewhere */}a discount, you get cover letters thrown in
                  with every résumé you generate.
                </>
              )}
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button variant="ghost" onClick={onBack} disabled={isGenerating}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="bg-atlas-teal hover:bg-atlas-teal/90"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              Generate {careersCount} résumé{careersCount === 1 ? '' : 's'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  name: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function TemplateCard({ name, description, selected, disabled, onClick }: TemplateCardProps) {
  return (
    <Card
      onClick={disabled ? undefined : onClick}
      className={`transition ${
        selected
          ? 'border-atlas-teal bg-atlas-teal/5'
          : disabled
            ? 'opacity-60'
            : 'cursor-pointer hover:border-atlas-teal/50'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="font-medium">{name}</div>
          {disabled ? (
            <Badge variant="outline" className="text-[10px]">
              Coming soon
            </Badge>
          ) : selected ? (
            <Badge className="bg-atlas-teal text-[10px]">Selected</Badge>
          ) : null}
        </div>
        <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}
