// Cover-letter modal — opened from a JobCard.
//
// Flow:
//   1. User picks a saved tailored résumé to anchor the letter's voice.
//   2. Clicking Generate kicks off the edge function, which fires the n8n
//      cover-letter workflow.
//   3. The modal subscribes to the new cover_letters row via Realtime and
//      flips from "Generating…" to a PDF preview + download button when
//      n8n writes status='completed'.
//
// Visual language: dark glassy panel matching the rest of the app (dashboard
// + resume builder use the same palette / FONT_BODY / FONT_DISPLAY).

import React, { useEffect, useMemo, useState } from 'react';
import { BlobProvider } from '@react-pdf/renderer';
import { AlertCircle, Building2, Download, FileText, Loader2, Mail, Sparkles, X } from 'lucide-react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { useCustomResumeList } from '@/components/custom-resume/hooks/useCustomResumeList';
import { CoverLetter } from '@/components/custom-resume/templates/CoverLetter';
import type { ResumeJson, ResumeContact } from '@/components/custom-resume/types';
import type { JobListing } from '@/hooks/useJobSearch';
import { useGenerateCoverLetter } from './hooks/useGenerateCoverLetter';
import { useCoverLetter } from './hooks/useCoverLetter';
import { buildCoverLetterDocxBlob } from './buildCoverLetterDocx';
import type { CoverLetterJson } from './types';

interface CoverLetterModalProps {
  job: JobListing;
  reportId: string;
  onClose: () => void;
  // When set, the modal opens straight into "view existing letter" mode
  // (skips the resume picker / generate step). Used from the pipeline where
  // each saved-job card already knows whether a letter exists for it.
  existingCoverLetterId?: string | null;
}

export const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
  job,
  reportId,
  onClose,
  existingCoverLetterId = null,
}) => {
  const { data: savedResumes, isLoading: resumesLoading } = useCustomResumeList();
  const completedResumes = useMemo(
    () => (savedResumes ?? []).filter((r) => r.status === 'completed'),
    [savedResumes],
  );

  // Pre-select the most recent completed résumé. User can change it before
  // generating. After generation kicks off, the picker locks.
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedResumeId && completedResumes.length > 0) {
      setSelectedResumeId(completedResumes[0].id);
    }
  }, [completedResumes, selectedResumeId]);

  // Seed coverLetterId from the existing-letter prop so the modal jumps
  // straight to the preview without re-generating.
  const [coverLetterId, setCoverLetterId] = useState<string | null>(existingCoverLetterId);
  const generate = useGenerateCoverLetter();
  const letterQuery = useCoverLetter({ id: coverLetterId });
  const letterRow = letterQuery.data;

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync({
        reportId,
        job,
        sourceResumeId: selectedResumeId,
      });
      setCoverLetterId(result.cover_letter_id);
    } catch {
      // toast shown by the hook
    }
  };

  // Pull the contact block off the chosen résumé so the letter PDF can
  // render with the user's name + contact line, even before the row's own
  // resume_json (if any) is back.
  //
  // Older custom_resumes rows store resume_json as a stringified JSON blob
  // instead of a parsed object (see CustomResumeResults.parseIfString). We
  // mirror that defense here — without it, `resumeJson.contact` is undefined
  // and the CoverLetter PDF crashes on `contact.email`.
  const sourceResumeJson = useMemo<ResumeJson | null>(() => {
    if (!selectedResumeId) return null;
    const row = completedResumes.find((r) => r.id === selectedResumeId);
    const raw = row?.resume_json;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ResumeJson;
      } catch {
        return null;
      }
    }
    return raw as unknown as ResumeJson;
  }, [selectedResumeId, completedResumes]);

  const status = letterRow?.status ?? (coverLetterId ? 'processing' : 'idle');

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8, 22, 28, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          // Bumped from 880 → 1120 so the PDF iframe can render at near
          // letter-paper aspect; the letter itself was too cramped to read.
          maxWidth: 1120,
          maxHeight: '95vh',
          background: 'rgba(18, 46, 59, 0.96)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: PALETTE.goldBright,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Cover letter
            </div>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: '-0.015em',
                color: '#fff',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {job.title}
            </h2>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Building2 size={13} /> {job.company}
              {job.location ? <span style={{ opacity: 0.55 }}>· {job.location}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.65)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {status === 'idle' && (
            <SetupView
              completedResumes={completedResumes}
              resumesLoading={resumesLoading}
              selectedResumeId={selectedResumeId}
              onSelectResume={setSelectedResumeId}
              isGenerating={generate.isPending}
              onGenerate={handleGenerate}
            />
          )}

          {status === 'processing' && <ProcessingView />}

          {status === 'failed' && (
            <FailedView errorMessage={letterRow?.error_message} onClose={onClose} />
          )}

          {status === 'completed' && letterRow?.letter_json && sourceResumeJson && (
            <CompletedView
              // letter_json can come back stringified if n8n's Supabase node
              // sent JSON.stringify(...) into a JSONB column. parseIfString
              // narrows it back to a real CoverLetterJson object.
              letterJson={parseIfString<CoverLetterJson>(letterRow.letter_json)}
              resumeJson={sourceResumeJson}
              job={job}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Setup: pick résumé + generate ─────────────────────────────
const SetupView: React.FC<{
  completedResumes: Array<{ id: string; career_title: string; created_at: string }>;
  resumesLoading: boolean;
  selectedResumeId: string | null;
  onSelectResume: (id: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}> = ({
  completedResumes,
  resumesLoading,
  selectedResumeId,
  onSelectResume,
  isGenerating,
  onGenerate,
}) => {
  if (resumesLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
        <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
        Loading your saved résumés…
      </div>
    );
  }

  if (completedResumes.length === 0) {
    return (
      <div style={{ padding: '8px 4px' }}>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.5,
            marginTop: 0,
          }}
        >
          You don't have any tailored résumés yet. Generate one first so we can match the letter's
          voice to your résumé.
        </p>
        <a
          href="/custom-resume"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: PALETTE.gold,
            color: PALETTE.canvasDeep,
            padding: '10px 18px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Tailor a résumé first
        </a>
      </div>
    );
  }

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 8,
        }}
      >
        Voice your letter after this résumé
      </label>
      <select
        value={selectedResumeId ?? ''}
        onChange={(e) => onSelectResume(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 12,
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 600,
          appearance: 'none',
        }}
      >
        {completedResumes.map((r) => (
          <option key={r.id} value={r.id} style={{ background: PALETTE.canvasDeep }}>
            {r.career_title}
          </option>
        ))}
      </select>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12.5,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.5,
          margin: '10px 0 24px',
        }}
      >
        We'll use the chosen résumé's tone, experience, and contact details, and tailor the letter
        to this specific posting's role + organization.
      </p>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating || !selectedResumeId}
        style={{
          background: isGenerating || !selectedResumeId ? 'rgba(212,160,36,0.45)' : PALETTE.gold,
          color: PALETTE.canvasDeep,
          border: 'none',
          padding: '14px 24px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          cursor: isGenerating || !selectedResumeId ? 'not-allowed' : 'pointer',
          boxShadow: '0 14px 32px -10px rgba(212,160,36,0.55)',
        }}
      >
        {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {isGenerating ? 'Starting…' : 'Generate cover letter'}
      </button>
    </div>
  );
};

// ── Processing ────────────────────────────────────────────────
const ProcessingView: React.FC = () => (
  <div style={{ padding: '36px 12px', textAlign: 'center' }}>
    <Loader2 size={28} className="animate-spin" color={PALETTE.goldBright} style={{ margin: '0 auto 14px' }} />
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 20,
        color: '#fff',
        marginBottom: 6,
      }}
    >
      Writing your cover letter…
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        color: 'rgba(255,255,255,0.6)',
        maxWidth: 460,
        margin: '0 auto',
        lineHeight: 1.55,
      }}
    >
      Typically takes 20–30 seconds. We're reading the posting, picking the strongest evidence from
      your résumé, and drafting a letter tuned to this employer.
    </div>
  </div>
);

// ── Failed ────────────────────────────────────────────────────
const FailedView: React.FC<{ errorMessage: string | null | undefined; onClose: () => void }> = ({
  errorMessage,
  onClose,
}) => (
  <div style={{ padding: '24px 12px', textAlign: 'center' }}>
    <AlertCircle size={28} color="#ef4444" style={{ margin: '0 auto 12px' }} />
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 6 }}>
      Generation failed
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 13.5,
        color: 'rgba(255,255,255,0.65)',
        maxWidth: 460,
        margin: '0 auto 20px',
        lineHeight: 1.5,
      }}
    >
      {errorMessage || 'Something went wrong while writing your cover letter. Please try again.'}
    </div>
    <button
      type="button"
      onClick={onClose}
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.18)',
        padding: '10px 20px',
        borderRadius: 9999,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Close
    </button>
  </div>
);

// ── Completed: PDF preview + download ─────────────────────────
const CompletedView: React.FC<{
  letterJson: CoverLetterJson;
  resumeJson: ResumeJson;
  job: JobListing;
}> = ({ letterJson, resumeJson, job }) => {
  // The PDF template dereferences `contact.email` etc. unconditionally —
  // older résumés may not have a contact block at all, so synthesize a
  // minimal one rather than letting the renderer crash.
  const contact = resumeJson.contact ?? { name: 'Applicant' };
  const safeName = (contact.name || 'Cover_Letter').replace(/[^\w\-]+/g, '_');
  const safeCompany = job.company.replace(/[^\w\-]+/g, '_');
  const baseFileName = `${safeName}__${safeCompany}__cover_letter`;
  const pdfFileName = `${baseFileName}.pdf`;
  const docxFileName = `${baseFileName}.docx`;

  const doc = (
    <CoverLetter letter={letterJson} contact={contact} careerTitle={job.title} />
  );

  return (
    <div>
      <BlobProvider document={doc}>
        {({ url, loading, error }) => (
          <div
            style={{
              background: '#f4efe2',
              borderRadius: 14,
              overflow: 'hidden',
              // Use most of the viewport — the modal already grows to 95vh,
              // and the header + actions take ~180px. This puts the letter
              // at a readable size on laptop and desktop screens.
              height: 'min(75vh, 880px)',
              minHeight: 540,
              position: 'relative',
              marginBottom: 16,
              boxShadow: '0 18px 50px -20px rgba(0,0,0,0.6)',
            }}
          >
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PALETTE.canvasDeep,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <Loader2 size={16} className="animate-spin" />
                Preparing preview…
              </div>
            )}
            {error && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b91c1c',
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                Couldn't render preview. You can still download below.
              </div>
            )}
            {url && (
              <iframe
                src={url}
                title="Cover letter preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            )}
          </div>
        )}
      </BlobProvider>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <BlobProvider document={doc}>
          {({ url, loading }) =>
            url && !loading ? (
              <a
                href={url}
                download={pdfFileName}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: PALETTE.gold,
                  color: PALETTE.canvasDeep,
                  padding: '12px 22px',
                  borderRadius: 9999,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: 'none',
                  boxShadow: '0 14px 32px -10px rgba(212,160,36,0.55)',
                }}
              >
                <Download size={14} />
                Download PDF
              </a>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(212,160,36,0.45)',
                  color: PALETTE.canvasDeep,
                  padding: '12px 22px',
                  borderRadius: 9999,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                <Loader2 size={14} className="animate-spin" /> Preparing PDF…
              </span>
            )
          }
        </BlobProvider>

        <DocxDownloadButton letter={letterJson} contact={contact} fileName={docxFileName} />

        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <Mail size={13} /> Open job posting
          </a>
        )}
      </div>
    </div>
  );
};

// Secondary action: DOCX download. Builds the blob lazily on click so we
// don't pay the docx package cost upfront, and revokes the object URL
// after the click to keep memory tidy.
const DocxDownloadButton: React.FC<{
  letter: CoverLetterJson;
  contact: ResumeContact;
  fileName: string;
}> = ({ letter, contact, fileName }) => {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await buildCoverLetterDocxBlob(letter, contact);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        padding: '12px 18px',
        borderRadius: 9999,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 13,
        border: `1px solid ${PALETTE.goldBright}`,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.75 : 1,
      }}
      title="Download as Word (.docx) — opens natively in Word, Pages, and Google Docs"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      {busy ? 'Building DOCX…' : 'Download DOCX'}
    </button>
  );
};

// ── Helpers ───────────────────────────────────────────────────
// Older Supabase rows sometimes store JSONB as a stringified blob (when n8n
// sends JSON.stringify(...) into a JSONB column). This narrows it back to a
// real object whatever the storage shape is. Mirrors the same defense in
// CustomResumeResults.tsx.
function parseIfString<T>(value: unknown): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value as T;
}
