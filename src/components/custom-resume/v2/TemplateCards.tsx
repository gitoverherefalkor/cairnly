// Visual template-picker: a row of cards with a stylised miniature preview
// and a short description per template. Shared between the Custom Résumé
// builder and the Results screen — the Results screen can toggle between
// this and the compact dropdown.

import React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { glassCardStyle } from './customResumeV2Shared';
import { TEMPLATES, type TemplateId } from '../types';

interface TemplateCardsProps {
  value: TemplateId;
  onChange: (next: TemplateId) => void;
  // Tighter spacing for use inside the Results screen (where vertical
  // real-estate is already shared with the PDF preview).
  compact?: boolean;
}

export const TemplateCards: React.FC<TemplateCardsProps> = ({
  value,
  onChange,
  compact = false,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: compact ? 10 : 12,
    }}
  >
    {TEMPLATES.map((t) => (
      <TemplateTile
        key={t.id}
        templateId={t.id}
        name={t.name}
        description={t.description}
        category={t.category}
        selected={value === t.id}
        disabled={!t.builtYet}
        onClick={() => t.builtYet && onChange(t.id)}
        compact={compact}
      />
    ))}
  </div>
);

const TemplateTile: React.FC<{
  templateId: TemplateId;
  name: string;
  description: string;
  category: 'ats' | 'designed';
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  compact: boolean;
}> = ({ templateId, name, description, category, selected, disabled, onClick, compact }) => (
  <button
    type="button"
    onClick={!disabled ? onClick : undefined}
    disabled={disabled}
    style={{
      ...glassCardStyle(selected, disabled),
      padding: compact ? 12 : 14,
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 6 : 8,
      minHeight: compact ? 148 : 168,
    }}
  >
    <TemplateThumbnail templateId={templateId} selected={selected} disabled={disabled} compact={compact} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      {category === 'ats' ? (
        <FileText size={11} color={selected ? PALETTE.tealBright : PALETTE.goldBright} />
      ) : (
        <Sparkles size={11} color={selected ? PALETTE.tealBright : PALETTE.goldBright} />
      )}
      <span
        title={
          category === 'ats'
            ? 'ATS = Applicant Tracking System. Plain-text-friendly layout that scanners parse reliably.'
            : 'Visually designed layout with custom typography and colour.'
        }
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: selected ? PALETTE.tealBright : PALETTE.goldBright,
          cursor: 'help',
        }}
      >
        {category === 'ats' ? 'ATS*-safe' : 'Designed'}
      </span>
      {disabled && (
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: FONT_BODY,
            fontSize: 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.42)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Soon
        </span>
      )}
    </div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: compact ? 13 : 14,
        color: '#fff',
        lineHeight: 1.2,
      }}
    >
      {name}
    </div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: compact ? 11 : 11.5,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.4,
      }}
    >
      {description}
    </div>
  </button>
);

// Stylised miniature preview — abstract stripes that hint at the layout.
// Avoids rendering a real react-pdf preview here (heavy, slow); the user
// sees the actual PDF preview live next to this picker.
const TemplateThumbnail: React.FC<{
  templateId: TemplateId;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
}> = ({ templateId, selected, disabled, compact }) => {
  const themes: Record<TemplateId, { paper: string; ink: string; accent: string; layout: 'single' | 'two-col' | 'sidebar-right' | 'asym' }> = {
    'ats-classic': { paper: '#FAF7F0', ink: '#1F2937', accent: '#1F2937', layout: 'single' },
    'ats-modern': { paper: '#FFFFFF', ink: '#202020', accent: PALETTE.teal, layout: 'single' },
    'designed-minimalist': { paper: '#FFFFFF', ink: '#0F172A', accent: PALETTE.teal, layout: 'single' },
    'designed-executive': { paper: '#F1E9D7', ink: '#1A2B3A', accent: '#5B2A3E', layout: 'two-col' },
    'designed-creative': { paper: '#FFF8EE', ink: '#1F2937', accent: '#B85B2A', layout: 'asym' },
  };
  const t = themes[templateId];
  const tint = selected ? 'rgba(39,161,161,0.35)' : disabled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)';

  return (
    <div
      style={{
        height: compact ? 58 : 70,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        background: t.paper,
        boxShadow: `inset 0 0 0 1px ${tint}`,
        padding: 6,
        display: 'flex',
        flexDirection: t.layout === 'two-col' ? 'row' : 'column',
        gap: t.layout === 'two-col' ? 4 : 3,
      }}
    >
      {t.layout === 'two-col' ? (
        <>
          <div style={{ width: 22, background: t.accent + '22', borderRadius: 3, padding: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Bar color={t.accent} w="80%" h={2} />
            <Bar color={t.ink + '40'} w="60%" h={1.5} />
            <Bar color={t.ink + '40'} w="70%" h={1.5} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Bar color={t.ink} w="65%" h={3} />
            <Bar color={t.accent} w="35%" h={1.5} />
            <div style={{ height: 1 }} />
            <Bar color={t.ink + '60'} w="92%" h={1.2} />
            <Bar color={t.ink + '60'} w="88%" h={1.2} />
            <Bar color={t.ink + '60'} w="78%" h={1.2} />
          </div>
        </>
      ) : t.layout === 'asym' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Bar color={t.accent} w="34%" h={4} />
            <Bar color={t.ink} w="40%" h={2} />
          </div>
          <Bar color={t.ink + '60'} w="95%" h={1.2} />
          <Bar color={t.ink + '60'} w="92%" h={1.2} />
          <Bar color={t.accent} w="20%" h={1.5} />
          <Bar color={t.ink + '60'} w="88%" h={1.2} />
        </>
      ) : (
        <>
          <Bar color={t.ink} w="50%" h={3} />
          <Bar color={t.accent} w="28%" h={1.5} />
          <div style={{ height: 1 }} />
          <Bar color={t.ink + '60'} w="96%" h={1.2} />
          <Bar color={t.ink + '60'} w="92%" h={1.2} />
          <Bar color={t.ink + '60'} w="86%" h={1.2} />
          <Bar color={t.ink + '60'} w="90%" h={1.2} />
        </>
      )}
    </div>
  );
};

const Bar: React.FC<{ color: string; w: string; h: number }> = ({ color, w, h }) => (
  <div style={{ background: color, width: w, height: h, borderRadius: 1 }} />
);
