import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Loader2,
  Upload,
  FileText,
  CheckCircle,
  X,
  Info,
  ChevronDown,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useAIResumeUpload } from '../resume/hooks/useAIResumeUpload';
import { useToast } from '@/hooks/use-toast';

interface PreSurveyUploadProps {
  onContinue: () => void;
  /**
   * Public demo (/demo/survey) only: render this step as a résumé that has
   * ALREADY been read, with nothing wired to the backend — no upload, no
   * parse call, no localStorage. The real app never passes it, so the live
   * step is untouched. Values are the frozen persona's (file name, size and
   * the field count the parser reported).
   */
  demoPreset?: { fileName: string; fileSizeBytes: number; fieldsExtracted: number };
}

// Animated illustration showing resume → auto-fill value proposition.
// Lives on a dark-glass strip above the cream card so the dark bg shows through.
const ResumeAutoFillAnimation = () => {
  const { t } = useTranslation('survey');
  return (
  <div className="w-full max-w-xl mt-6">
    <div
      className="flex items-center justify-center gap-3 sm:gap-5 rounded-2xl border border-white/10 backdrop-blur-[14px] px-5 sm:px-7 py-4 sm:py-5"
      style={{ background: 'rgba(18, 46, 59, 0.45)' }}
    >
      {/* Step 1: Resume drops in */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="relative w-[52px] h-16 rounded-lg flex items-center justify-center"
          style={{ background: '#FDFBF2', border: '1px solid rgba(201,182,144,0.6)' }}
        >
          <FileText className="h-5 w-5" style={{ color: '#122E3B' }} />
          <div
            className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-atlas-teal"
            style={{ border: '2px solid rgba(18, 46, 59, 0.6)' }}
          >
            <Upload className="h-2.5 w-2.5 text-white" />
          </div>
        </div>
        <span className="text-[11px] font-semibold text-white/70">{t('preSurveyUpload.illustration.upload')}</span>
      </div>

      <ArrowRight className="h-4 w-4 text-white/40" />

      {/* Step 2: AI processing */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="w-[52px] h-16 rounded-lg flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(39,161,161,0.16), rgba(57,137,175,0.16))',
            border: '1px solid rgba(39,161,161,0.32)',
          }}
        >
          <Sparkles className="h-5 w-5 animate-pulse" style={{ color: '#2ABFBF' }} />
        </div>
        <span className="text-[11px] font-semibold text-white/70">{t('preSurveyUpload.illustration.aiReads')}</span>
      </div>

      <ArrowRight className="h-4 w-4 text-white/40" />

      {/* Step 3: Auto-filled fields */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-col gap-2 w-[140px]">
          {[
            { pct: 70, label: t('preSurveyUpload.illustration.jobTitles') },
            { pct: 55, label: t('preSurveyUpload.illustration.skills') },
            { pct: 40, label: t('preSurveyUpload.illustration.achievements') },
          ].map(({ pct, label }, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: '#2ABFBF',
                    opacity: 0.85,
                    animation: `bar-fill 1.2s ease-out ${0.4 + i * 0.2}s both`,
                  }}
                />
              </div>
              <span className="text-[9.5px] font-semibold text-white/55 whitespace-nowrap">
                {label}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] font-semibold text-white/70">Auto-filled</span>
      </div>
    </div>

    <style>{`
      @keyframes bar-fill {
        from { width: 0%; opacity: 0; }
        to { opacity: 1; }
      }
    `}</style>
  </div>
  );
};

export const PreSurveyUpload: React.FC<PreSurveyUploadProps> = ({ onContinue, demoPreset }) => {
  const { t } = useTranslation('survey');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [hasUploadedResume, setHasUploadedResume] = React.useState(false);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [showLinkedInTip, setShowLinkedInTip] = React.useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const {
    isUploading,
    isProcessing: aiProcessing,
    hasProcessed,
    processingResult,
    error,
    uploadAndProcess,
    resetState,
  } = useAIResumeUpload({
    onSuccess: (data) => {
      if (data && data.surveyPreFillData) {
        sessionStorage.setItem('resume_parsed_data', JSON.stringify(data.surveyPreFillData));
        localStorage.setItem('resume_parsed_data', JSON.stringify(data.surveyPreFillData));
        localStorage.setItem('resume_parsed_timestamp', new Date().toISOString());
        setHasUploadedResume(true);
        toast({
          title: t('preSurveyUpload.toast.completeTitle'),
          description: t('preSurveyUpload.toast.completeExtracted', { count: data.fieldsExtracted }),
        });
      } else if (data && data.aiParsedData) {
        sessionStorage.setItem('resume_parsed_data', JSON.stringify(data.aiParsedData));
        localStorage.setItem('resume_parsed_data', JSON.stringify(data.aiParsedData));
        localStorage.setItem('resume_parsed_timestamp', new Date().toISOString());
        setHasUploadedResume(true);
        toast({
          title: t('preSurveyUpload.toast.completeTitle'),
          description: t('preSurveyUpload.toast.completeReady'),
        });
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast({
        title: t('preSurveyUpload.toast.failedTitle'),
        description: error || t('preSurveyUpload.toast.failedBody'),
        variant: 'destructive',
      });
      setIsProcessing(false);
    },
  });

  const validateAndSetFile = (file: File): boolean => {
    // The demo's frozen file is the only one this step ever shows.
    if (demoPreset) return false;
    // PDF only — the n8n resume parser (WF0.1) can't read Word/text files and
    // fails downstream if anything else gets through.
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      toast({
        title: t('preSurveyUpload.toast.pdfOnlyTitle'),
        description: t('preSurveyUpload.toast.pdfOnlyBody'),
        variant: 'destructive',
      });
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('preSurveyUpload.toast.tooLargeTitle'),
        description: t('preSurveyUpload.toast.tooLargeBody'),
        variant: 'destructive',
      });
      return false;
    }

    setUploadedFile(file);
    setShowSkipConfirm(false);
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (demoPreset) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateAndSetFile(file)) return;
    resetState();
    setIsProcessing(true);
    uploadAndProcess(file);
  };

  const handleRemoveFile = () => {
    if (demoPreset) return;
    setUploadedFile(null);
    setHasUploadedResume(false);
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSkipClick = () => {
    setShowSkipConfirm(true);
  };

  const handleSkipConfirmed = () => {
    if (!demoPreset) localStorage.setItem('pre_survey_upload_complete', 'true');
    onContinue();
  };

  const handleContinue = () => {
    // The demo owns its own "continue"; it must not claim the real step.
    if (!demoPreset) localStorage.setItem('pre_survey_upload_complete', 'true');
    onContinue();
  };

  const isBusy = isProcessing || aiProcessing;
  const isContinueDisabled = demoPreset ? false : isBusy || !hasUploadedResume;

  // In demo mode the card shows the frozen file in its processed state; the
  // real state hooks stay untouched (and idle, since nothing can upload).
  const shownFile: { name: string; size: number } | null = demoPreset
    ? { name: demoPreset.fileName, size: demoPreset.fileSizeBytes }
    : uploadedFile;
  const shownProcessed = demoPreset ? true : hasProcessed;
  const shownFields = demoPreset ? demoPreset.fieldsExtracted : processingResult?.fieldsExtracted;
  const pickFile = () => {
    if (demoPreset) return;
    fileInputRef.current?.click();
  };

  return (
    // In the demo this step is one section of a longer page, so it drops its
    // own full-screen canvas and wordmark and keeps only the card.
    <div className={demoPreset ? '' : 'min-h-screen survey-bg'}>
      <div
        className={
          demoPreset
            ? 'flex flex-col items-center px-0 pt-2 pb-2'
            : 'min-h-screen flex flex-col items-center px-6 pt-12 pb-12'
        }
      >
        {!demoPreset && (
          /* Cairnly wordmark on dark bg */
          <a href="/" className="inline-flex mb-6">
            <img
              src="/logos/cairnly-logo-white.png"
              alt="Cairnly"
              className="h-12 sm:h-14 w-auto"
            />
          </a>
        )}

        {/* Gold editorial eyebrow */}
        <span
          className="font-heading uppercase text-[11px] mb-3"
          style={{ color: '#EFBE48', letterSpacing: '0.24em', fontWeight: 700 }}
        >
          {t('preSurveyUpload.eyebrow')}
        </span>

        {/* Big white headline */}
        <h1
          className="font-heading text-center text-white text-[28px] sm:text-[36px] m-0 max-w-2xl"
          style={{
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            textWrap: 'pretty' as any,
          }}
        >
          {t('preSurveyUpload.title')}
        </h1>

        <p
          className="text-center mt-3.5 max-w-lg text-[15px]"
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontWeight: 500,
            lineHeight: 1.5,
            textWrap: 'pretty' as any,
          }}
        >
          {t('preSurveyUpload.subtitle')}
        </p>

        {/* Animated illustration on dark-glass strip */}
        <ResumeAutoFillAnimation />

        {/* Cream form card */}
        <div
          className="relative overflow-hidden w-full mt-6 rounded-[22px] border"
          style={{
            maxWidth: 640,
            background: '#FDFBF2',
            borderColor: 'rgba(201, 182, 144, 0.6)',
            boxShadow: '0 30px 60px -24px rgba(0,0,0,0.55)',
            padding: '28px 32px 24px',
          }}
        >
          {/* Soft gold radial bloom top-right */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              top: -60,
              right: -60,
              width: 280,
              height: 280,
              background:
                'radial-gradient(circle, rgba(212,160,36,0.18) 0%, rgba(212,160,36,0) 70%)',
            }}
          />

          <div className="relative">
            {/* Blue info alert */}
            <div
              className="rounded-xl flex items-start gap-2.5 mb-5"
              style={{
                background: 'rgba(57, 137, 175, 0.08)',
                border: '1px solid rgba(57, 137, 175, 0.24)',
                padding: '12px 16px',
              }}
            >
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#2563EB' }} />
              <span
                className="text-[13px] font-medium leading-snug"
                style={{ color: '#1F2937' }}
              >
                {t('preSurveyUpload.editableNotice')}
              </span>
            </div>

            {/* Upload area */}
            <div
              className="rounded-[14px] mb-5 transition-colors"
              style={
                isDragOver
                  ? {
                      border: '2px dashed rgba(39,161,161,0.5)',
                      background: 'rgba(39,161,161,0.06)',
                      padding: shownFile ? '18px 22px' : '32px 28px',
                    }
                  : shownFile && shownProcessed
                    ? {
                        border: '2px dashed rgba(34,197,94,0.5)',
                        background: 'rgba(34,197,94,0.04)',
                        padding: '18px 22px',
                      }
                    : {
                        border: '2px dashed rgba(201,182,144,0.7)',
                        background: '#F5EFE2',
                        padding: shownFile ? '18px 22px' : '32px 28px',
                      }
              }
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && validateAndSetFile(file)) {
                  resetState();
                  setIsProcessing(true);
                  uploadAndProcess(file);
                }
              }}
            >
              {shownFile ? (
                <>
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={
                        shownProcessed
                          ? {
                              background: 'rgba(34, 197, 94, 0.14)',
                              border: '1px solid rgba(34, 197, 94, 0.32)',
                            }
                          : error && !isProcessing
                            ? {
                                background: 'rgba(220, 38, 38, 0.12)',
                                border: '1px solid rgba(220, 38, 38, 0.32)',
                              }
                            : {
                                background: 'rgba(212, 160, 36, 0.18)',
                                border: '1px solid rgba(212, 160, 36, 0.32)',
                              }
                      }
                    >
                      {shownProcessed ? (
                        <CheckCircle className="h-5 w-5" style={{ color: '#16A34A' }} />
                      ) : error && !isProcessing ? (
                        <AlertTriangle className="h-5 w-5" style={{ color: '#DC2626' }} />
                      ) : (
                        <FileText className="h-5 w-5" style={{ color: '#C8891A' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] font-bold truncate"
                        style={{ color: '#122E3B' }}
                      >
                        {shownFile.name}
                      </p>
                      <p
                        className="text-[12px] font-medium mt-0.5"
                        style={{ color: shownProcessed ? '#15803D' : '#6B7F8B' }}
                      >
                        {(shownFile.size / 1024 / 1024).toFixed(2)} MB
                        {shownProcessed && ' · Processed'}
                        {isProcessing && ' · Processing…'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      disabled={isProcessing}
                      className="text-[#6B7F8B] hover:bg-transparent hover:text-[#122E3B]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div
                    className="mt-3 pt-3 text-[13px] font-semibold"
                    style={{
                      borderTop: shownProcessed
                        ? '1px solid rgba(34, 197, 94, 0.24)'
                        : error && !isProcessing
                          ? '1px solid rgba(220, 38, 38, 0.24)'
                          : '1px solid rgba(201,182,144,0.5)',
                      color: shownProcessed
                        ? '#15803D'
                        : error && !isProcessing
                          ? '#B91C1C'
                          : '#C8891A',
                    }}
                  >
                    {shownProcessed ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5" style={{ color: '#16A34A' }} />
                        {shownFields
                          ? t('preSurveyUpload.status.extracted', { count: shownFields })
                          : t('preSurveyUpload.status.processed')}
                      </span>
                    ) : error && !isProcessing ? (
                      <div className="flex flex-col gap-2.5">
                        <span className="flex items-start gap-2 leading-snug">
                          <AlertTriangle
                            className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                            style={{ color: '#DC2626' }}
                          />
                          {t('preSurveyUpload.status.readError')}
                        </span>
                        <div>
                          <Button
                            size="sm"
                            onClick={() => pickFile()}
                            className="rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[13px] px-4"
                          >
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                            {t('preSurveyUpload.status.tryAnother')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Extracting information from your resume…
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className="text-center cursor-pointer"
                  onClick={() => pickFile()}
                >
                  <Upload
                    className="mx-auto"
                    style={{
                      color: isDragOver ? '#27A1A1' : '#9CA3AF',
                      width: 36,
                      height: 36,
                      strokeWidth: 1.8,
                    }}
                  />
                  <p
                    className="text-[15px] font-bold mt-3"
                    style={{ color: '#122E3B' }}
                  >
                    {isDragOver ? t('preSurveyUpload.dropzone.dragging') : t('preSurveyUpload.dropzone.idle')}
                  </p>
                  <p
                    className="text-[13px] font-medium mt-1.5"
                    style={{ color: '#6B7F8B' }}
                  >
                    {isDragOver
                      ? ''
                      : t('preSurveyUpload.dropzone.hint')}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                  />
                </div>
              )}
            </div>

            {/* Skip Confirmation Warning (amber) */}
            {showSkipConfirm && (
              <div
                className="rounded-[14px] p-[18px] mb-5 animate-in fade-in"
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.32)',
                }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="h-5 w-5 mt-0.5 flex-shrink-0"
                    style={{ color: '#D97706' }}
                  />
                  <div className="flex-1">
                    <p
                      className="text-[14.5px] font-bold m-0"
                      style={{ color: '#92400E' }}
                    >
                      {t('preSurveyUpload.skipConfirm.title')}
                    </p>
                    <p
                      className="text-[13.5px] font-medium mt-1.5 mb-3.5 leading-snug"
                      style={{ color: '#92400E' }}
                    >
                      {t('preSurveyUpload.skipConfirm.bodyBefore')}{' '}
                      <strong>{t('preSurveyUpload.skipConfirm.bodyMinutes')}</strong>{' '}
                      {t('preSurveyUpload.skipConfirm.bodyAfter')}
                    </p>
                    <div className="flex gap-2.5">
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowSkipConfirm(false);
                          pickFile();
                        }}
                        className="rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[13px] px-4"
                      >
                        {t('preSurveyUpload.skipConfirm.upload')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkipConfirmed}
                        className="rounded-full font-semibold text-[13px] hover:bg-transparent"
                        style={{ color: '#92400E' }}
                      >
                        {t('preSurveyUpload.skipConfirm.confirm')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LinkedIn Export Tip - Collapsible */}
            {!showSkipConfirm && (
              <div
                className="rounded-xl mb-0"
                style={{
                  background: 'rgba(18, 46, 59, 0.04)',
                  border: '1px solid rgba(201, 182, 144, 0.6)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowLinkedInTip(!showLinkedInTip)}
                  className="w-full flex items-center justify-between text-left p-[14px_18px]"
                >
                  <span
                    className="text-[13.5px] font-semibold"
                    style={{ color: '#122E3B' }}
                  >
                    {t('preSurveyUpload.linkedIn.toggle')}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showLinkedInTip ? 'rotate-180' : ''
                    }`}
                    style={{ color: '#6B7F8B' }}
                  />
                </button>

                {showLinkedInTip && (
                  <div className="px-[18px] pb-4 pt-0">
                    <div
                      className="flex flex-col gap-1.5 text-[13px] font-medium"
                      style={{ color: '#4B6373', lineHeight: 1.6 }}
                    >
                      <div>
                        <span className="font-bold" style={{ color: '#122E3B' }}>
                          1.
                        </span>{' '}
                        {t('preSurveyUpload.linkedIn.step1')}
                      </div>
                      <div>
                        <span className="font-bold" style={{ color: '#122E3B' }}>
                          2.
                        </span>{' '}
                        {t('preSurveyUpload.linkedIn.step2')}
                      </div>
                      <div>
                        <span className="font-bold" style={{ color: '#122E3B' }}>
                          3.
                        </span>{' '}
                        {t('preSurveyUpload.linkedIn.step3')}
                      </div>
                    </div>
                    <div
                      className="mt-3 pt-3"
                      style={{ borderTop: '1px solid rgba(201,182,144,0.5)' }}
                    >
                      <img
                        src="/uploads/linkedin-save-to-pdf-more-menu.png"
                        alt={t('preSurveyUpload.linkedIn.imageAlt')}
                        className="w-48 mx-auto rounded shadow-sm"
                      />
                      <p
                        className="text-[12px] mt-3 text-center italic"
                        style={{ color: '#6B7F8B' }}
                      >
                        {t('preSurveyUpload.linkedIn.note')}
                      </p>
                    </div>
                    {/* We'd love a one-click "Import from LinkedIn" — LinkedIn's
                        API doesn't expose full profile data to third parties,
                        so a manual PDF export is the only path available. */}
                    <p
                      className="text-[12px] mt-3 text-center"
                      style={{ color: '#27A1A1' }}
                    >
                      {t('preSurveyUpload.linkedIn.apology')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer action buttons */}
            <div
              className={`flex ${showSkipConfirm ? 'justify-end' : 'justify-between'} items-center mt-5 pt-4`}
              style={{ borderTop: '1px solid rgba(201,182,144,0.5)' }}
            >
              {/* Skip trigger. Hidden once the "Are you sure?" confirm is open —
                  otherwise users click this dead duplicate instead of the real
                  "Yes, skip anyway" action inside the amber box and give up. */}
              {!showSkipConfirm && (
                <Button
                  variant="ghost"
                  onClick={handleSkipClick}
                  disabled={isBusy}
                  className="font-semibold text-[13px] hover:bg-transparent"
                  style={{ color: '#6B7F8B' }}
                >
                  {t('preSurveyUpload.skip')}
                </Button>
              )}
              <Button
                onClick={handleContinue}
                disabled={isContinueDisabled}
                size="lg"
                className={
                  isContinueDisabled
                    ? 'rounded-full font-bold text-[14px] px-6 bg-atlas-teal/45 text-white cursor-not-allowed'
                    : 'rounded-full font-bold text-[14px] px-6 bg-atlas-teal text-white hover:bg-atlas-teal/90 shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]'
                }
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('preSurveyUpload.cta.processing')}
                  </>
                ) : hasUploadedResume ? (
                  <>
                    {t('preSurveyUpload.cta.continue')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    {t('preSurveyUpload.cta.upload')}
                    <Upload className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
