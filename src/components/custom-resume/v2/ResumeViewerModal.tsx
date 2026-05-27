// Lightweight in-page modal listing every saved tailored résumé for a given
// career (matched by career_title). Each row links out to the full
// /custom-resume?ids=<id> view in a new tab so the user can preview /
// download / switch templates there without losing their pipeline context.
//
// We intentionally do NOT render the PDF preview in-modal — that would mean
// re-implementing the template + react-pdf machinery that /custom-resume
// already does well. The "open full view" link is a single click and
// preserves the pipeline tab.

import React, { useEffect } from 'react';
import { FileText, X, ExternalLink } from 'lucide-react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { TEMPLATES } from '../types';
import type { CustomResumeRow } from '../hooks/useCustomResumes';

interface ResumeViewerModalProps {
  careerTitle: string;
  resumes: CustomResumeRow[];
  onClose: () => void;
}

export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  careerTitle,
  resumes,
  onClose,
}) => {
  // Close on ESC, like the cover-letter modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tailored résumés for ${careerTitle}`}
      onClick={(e) => {
        // Click on the backdrop closes the modal; click inside the panel does not.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 22, 32, 0.66)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        style={{
          background: PALETTE.cream,
          borderRadius: 22,
          padding: 28,
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 30px 70px -20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: PALETTE.inkSoft,
            padding: 6,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <FileText size={18} color={PALETTE.gold} />
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: PALETTE.gold,
            }}
          >
            Tailored résumés
          </span>
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 22,
            color: PALETTE.canvasDeep,
            margin: '4px 0 6px 0',
            lineHeight: 1.2,
          }}
        >
          {careerTitle}
        </h2>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 500,
            color: PALETTE.inkMuted,
            margin: '0 0 18px 0',
          }}
        >
          {resumes.length === 1
            ? "You've tailored one résumé for this career."
            : `You've tailored ${resumes.length} résumés for this career — pick which one to open.`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resumes.map((r) => {
            const templateName = TEMPLATES.find((t) => t.id === r.template_id)?.name || r.template_id;
            const created = r.created_at
              ? new Date(r.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '';
            const ats = typeof r.ats_score === 'number' ? Math.round(r.ats_score) : null;
            return (
              <a
                key={r.id}
                href={`/custom-resume?ids=${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#fff',
                  border: `1px solid ${PALETTE.tan}`,
                  textDecoration: 'none',
                  color: PALETTE.canvasDeep,
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14.5 }}>
                    {templateName}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 12,
                      fontWeight: 500,
                      color: PALETTE.inkMuted,
                      marginTop: 2,
                    }}
                  >
                    {[ats != null ? `ATS ${ats}` : null, created].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: PALETTE.gold,
                    color: PALETTE.canvasDeep,
                    padding: '8px 14px',
                    borderRadius: 9999,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 12.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Open <ExternalLink size={12} />
                </span>
              </a>
            );
          })}
        </div>

        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 500,
            color: PALETTE.inkSoft,
            margin: '18px 0 0 0',
          }}
        >
          Opens in a new tab so your pipeline stays open. Download + template switching live there.
        </p>
      </div>
    </div>
  );
};
