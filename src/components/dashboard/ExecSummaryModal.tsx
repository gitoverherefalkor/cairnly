import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';

interface ExecSummaryModalProps {
  content: string;
  onClose: () => void;
  // Kept for callsite compatibility but no longer used — the old "Explore
  // Your Report" CTA navigated to /report, which has been retired. Closing
  // the modal already returns the user to the populated dashboard.
  onViewReport?: () => void;
}

// Parse inline <strong>/<em>/<b>/<i> tags into React elements.
function renderInlineHtml(text: string): React.ReactNode {
  const parts = text.split(/(<strong>.*?<\/strong>|<em>.*?<\/em>|<b>.*?<\/b>|<i>.*?<\/i>)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const strongMatch = part.match(/^<(?:strong|b)>(.*?)<\/(?:strong|b)>$/);
    if (strongMatch) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: PALETTE.canvasDeep }}>
          {strongMatch[1]}
        </strong>
      );
    }
    const emMatch = part.match(/^<(?:em|i)>(.*?)<\/(?:em|i)>$/);
    if (emMatch) return <em key={i}>{emMatch[1]}</em>;
    return part;
  });
}

// Render exec-summary content. Handles <h5> sub-headings (rendered as a
// gold eyebrow tag) and inline HTML in paragraphs.
function renderExecContent(content: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  content.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const h5Match = trimmed.match(/^<h5>(?:<strong>)?(.*?)(?:<\/strong>)?<\/h5>$/);
    if (h5Match) {
      elements.push(
        <h3
          key={index}
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.tealDeep,
            margin: '18px 0 8px 0',
          }}
        >
          {h5Match[1]}
        </h3>
      );
      return;
    }

    elements.push(
      <p
        key={index}
        style={{
          fontFamily: FONT_BODY,
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.6,
          color: PALETTE.ink,
          margin: '0 0 12px 0',
        }}
      >
        {renderInlineHtml(trimmed)}
      </p>
    );
  });

  return elements;
}

export const ExecSummaryModal: React.FC<ExecSummaryModalProps> = ({ content, onClose }) => {
  // Esc + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8, 22, 29, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PALETTE.cream,
          borderRadius: 24,
          border: `1px solid ${PALETTE.tan}`,
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)',
          maxWidth: 680,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '28px 32px 20px',
            borderBottom: '1px solid rgba(201, 182, 144, 0.5)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: PALETTE.tealDeep,
              }}
            >
              EXECUTIVE SUMMARY
            </div>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '-0.02em',
                color: PALETTE.canvasDeep,
                margin: '8px 0 6px 0',
                lineHeight: 1.15,
              }}
            >
              A snapshot of where you are.
            </h2>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13.5,
                fontWeight: 500,
                color: PALETTE.inkMuted,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              The shortest read of your career profile. The full breakdown sits below in the report sections.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: `1px solid ${PALETTE.tan}`,
              borderRadius: 9999,
              padding: 8,
              cursor: 'pointer',
              color: PALETTE.inkMuted,
              display: 'inline-flex',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 28px' }}>
          {renderExecContent(content)}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 32px',
            borderTop: '1px solid rgba(201, 182, 144, 0.5)',
            background: 'rgba(255,255,255,0.30)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: PALETTE.teal,
              color: '#fff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: '0 10px 22px -8px rgba(39,161,161,0.5)',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
