// Custom Résumé results — shown after kicking off generation.
//
// Visual language matches the builder: approach_vis background (set by the
// page wrapper), gold eyebrow, big display heading, glassy dark tabs/cards.
// PDF preview lives in a cream "paper" panel so the rendered résumé reads
// naturally against the dark photo background.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlobProvider, PDFDownloadLink } from '@react-pdf/renderer';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Plus,
} from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { REyebrow, StatusPill, glassCardStyle } from './customResumeV2Shared';
import { TemplateCards } from './TemplateCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomResumes, type CustomResumeRow } from '../hooks/useCustomResumes';
import { getTemplateComponent } from '../templates';
import { CoverLetter } from '../templates/CoverLetter';
import { TEMPLATES, getTemplate, type TemplateId, type ResumeJson, type CoverLetterJson, type KeywordCoverage } from '../types';

interface CustomResumeResultsProps {
  customResumeIds: string[];
  onStartNew: () => void;
}

export const CustomResumeResults: React.FC<CustomResumeResultsProps> = ({
  customResumeIds,
  onStartNew,
}) => {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useCustomResumes({ ids: customResumeIds });
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && rows && rows.length > 0) {
      setActiveId(rows[0].id);
    }
  }, [rows, activeId]);

  if (isLoading || !rows || rows.length === 0) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: FONT_BODY,
        }}
      >
        <Loader2 size={20} className="animate-spin" style={{ marginRight: 10 }} /> Loading your résumés…
      </div>
    );
  }

  const ready = rows.filter((r) => r.status === 'completed').length;
  const inProgress = rows.filter((r) => r.status === 'processing').length;
  const activeRow = rows.find((r) => r.id === activeId) ?? rows[0];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>
      {/* Hero */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 36,
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <REyebrow>YOUR TAILORED RÉSUMÉS</REyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: '-0.02em',
              color: '#fff',
              margin: '12px 0 8px 0',
              lineHeight: 1.05,
            }}
          >
            {ready} of {rows.length} ready
            {inProgress > 0 ? <span style={{ color: PALETTE.goldBright }}>{` · ${inProgress} tailoring`}</span> : null}
          </h1>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Switch templates without re-generating — your tailored content is saved automatically
            and lives in <span style={{ color: PALETTE.tealBright, fontWeight: 700 }}>Saved résumés</span> on
            the dashboard. The style you pick here sticks the next time you open it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PillButton tone="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} /> Dashboard
          </PillButton>
          <PillButton tone="teal" onClick={onStartNew}>
            <Plus size={14} /> Generate more
          </PillButton>
        </div>
      </div>

      {/* Career tabs — only shown when there's more than one to switch between.
          With a single résumé the tabs were just decorative + confused users
          into thinking they did something on click. */}
      {rows.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          {rows.map((row) => {
            const active = row.id === activeRow.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setActiveId(row.id)}
                style={{
                  ...glassCardStyle(active, false),
                  padding: '10px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 800,
                    fontSize: 13,
                    color: '#fff',
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.career_title}
                </span>
                <StatusPill status={row.status as 'processing' | 'completed' | 'failed'} />
              </button>
            );
          })}
        </div>
      )}

      {/* Active panel */}
      <ResumeResultPanel row={activeRow} />
    </div>
  );
};

// ── Active panel ──────────────────────────────────────────────
const ResumeResultPanel: React.FC<{ row: CustomResumeRow }> = ({ row }) => {
  const [localTemplate, setLocalTemplate] = useState<TemplateId>(row.template_id as TemplateId);

  useEffect(() => {
    setLocalTemplate(row.template_id as TemplateId);
  }, [row.id, row.template_id]);

  if (row.status === 'processing') {
    return (
      <div
        style={{
          ...glassCardStyle(false, false),
          padding: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Loader2 size={22} className="animate-spin" color={PALETTE.tealBright} />
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: '#fff' }}>
            Tailoring your résumé for {row.career_title}…
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              marginTop: 4,
            }}
          >
            Usually 20–40 seconds. Live updates flow in via Realtime.
          </div>
        </div>
      </div>
    );
  }

  if (row.status === 'failed') {
    return (
      <div
        style={{
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.40)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 18,
          padding: 24,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <AlertCircle size={20} color="#fca5a5" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: '#fff' }}>
            We couldn't generate the résumé for {row.career_title}.
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.70)',
              marginTop: 4,
            }}
          >
            {row.error_message || 'Something went wrong. Try again from the builder.'}
          </div>
        </div>
      </div>
    );
  }

  // status === 'completed'
  // Defensive: older rows stored resume_json/cover_letter_json as a stringified
  // JSON instead of an object (n8n double-encoded the LLM output). Parse-if-string
  // so those rows still render. New rows arrive as objects already.
  const parseIfString = <T,>(v: unknown): T | null => {
    if (typeof v === 'string') {
      try { return JSON.parse(v) as T; } catch { return null; }
    }
    return (v as T) ?? null;
  };
  const resumeJson = parseIfString<ResumeJson>(row.resume_json) as ResumeJson;
  const coverLetterJson = parseIfString<CoverLetterJson>(row.cover_letter_json);
  const coverage = row.keyword_coverage as unknown as KeywordCoverage | null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelHeader
        row={row}
        templateId={localTemplate}
        onTemplateChange={async (id) => {
          setLocalTemplate(id);
          const { error } = await supabase
            .from('custom_resumes')
            .update({ template_id: id, updated_at: new Date().toISOString() })
            .eq('id', row.id);
          if (error) {
            console.error('Failed to persist template change:', error);
            toast.error('Could not save template choice.');
          } else {
            // Tiny success toast so the user can see the change actually
            // persisted. Past sessions opening this résumé will land on the
            // last-selected template, no re-generation needed.
            toast.success('Template saved', { duration: 1500 });
          }
        }}
      />

      <DocumentTabs
        resumeJson={resumeJson}
        coverLetterJson={coverLetterJson}
        templateId={localTemplate}
        careerTitle={row.career_title}
      />

      {coverage && (coverage.hit?.length || coverage.missing?.length) ? (
        <CoveragePanel coverage={coverage} />
      ) : null}
    </div>
  );
};

// ── Panel header (ATS score + template switcher) ─────────────
const PanelHeader: React.FC<{
  row: CustomResumeRow;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
}> = ({ row, templateId, onTemplateChange }) => {
  // 'cards' is the rich form (5 tiles with mini-previews + descriptions) —
  // the default since they explain what each template is for.
  // 'dropdown' is the compact form for users who already know which one
  // they want and just want to flip between fast.
  // Persist the preference per-session so it doesn't reset when the user
  // switches between career tabs.
  const [picker, setPicker] = useState<'dropdown' | 'cards'>(() => {
    try {
      const stored = sessionStorage.getItem('customResume.templatePicker');
      return stored === 'dropdown' ? 'dropdown' : 'cards';
    } catch {
      return 'cards';
    }
  });
  useEffect(() => {
    try { sessionStorage.setItem('customResume.templatePicker', picker); } catch { /* fine */ }
  }, [picker]);

  const score = row.ats_score != null ? Math.round(Number(row.ats_score)) : null;
  const tone = score == null
    ? PALETTE.tealBright
    : score >= 80
      ? '#10B981'
      : score >= 60
        ? PALETTE.goldBright
        : '#F59E0B';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {score != null ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 9999,
              background: `${tone}1A`,
              border: `1px solid ${tone}55`,
              color: tone,
            }}
          >
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: '-0.02em',
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              ATS · {score >= 80 ? 'Strong' : score >= 60 ? 'Decent' : 'Adjacent'}
            </span>
          </div>
        ) : null}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PickerModeToggle mode={picker} onChange={setPicker} />
          {picker === 'dropdown' ? (
            <TemplateSelect value={templateId} onChange={onTemplateChange} />
          ) : null}
        </div>
      </div>
      {picker === 'cards' ? (
        <TemplateCards value={templateId} onChange={onTemplateChange} compact />
      ) : null}
      {/* Honest framing about what the score does and doesn't capture.
          The pill measures keyword fit in the document text. Real ATSes
          ALSO care about parser-friendliness — single-column, plain fonts.
          Adapt the copy to the active template category so the user sees
          relevant context. */}
      <AtsScoreContext templateId={templateId} hasScore={score != null} />
    </div>
  );
};

const AtsScoreContext: React.FC<{ templateId: TemplateId; hasScore: boolean }> = ({
  templateId,
  hasScore,
}) => {
  if (!hasScore) return null;
  const meta = getTemplate(templateId);
  const isDesigned = meta?.category === 'designed';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.5,
        marginTop: -4,
      }}
    >
      <div>
        Score reflects how well the résumé text covers must-have keywords for this
        career. It's a directional smell test, not a real ATS scanner.
      </div>
      {isDesigned ? (
        <div style={{ color: PALETTE.goldBright }}>
          Heads-up: designed templates (columns, custom fonts) can lose 10–20 points
          in real ATSes because parsers garble multi-column layouts. For high-volume
          online applications, use an ATS-safe template.
        </div>
      ) : (
        <div>
          You're on an ATS-safe template — plain text layer, single column,
          everything parses cleanly.
        </div>
      )}
    </div>
  );
};

// Segmented two-button pill — switches between the compact dropdown and
// the rich card grid. Mirrors the visual language of the small ATS pill
// above so the header has a consistent rhythm of pill controls.
const PickerModeToggle: React.FC<{
  mode: 'dropdown' | 'cards';
  onChange: (next: 'dropdown' | 'cards') => void;
}> = ({ mode, onChange }) => (
  <div
    style={{
      display: 'inline-flex',
      padding: 3,
      borderRadius: 9999,
      background: 'rgba(18,46,59,0.55)',
      border: '1px solid rgba(255,255,255,0.12)',
      gap: 2,
    }}
  >
    <SegmentButton active={mode === 'dropdown'} onClick={() => onChange('dropdown')} ariaLabel="Compact dropdown">
      <List size={14} />
    </SegmentButton>
    <SegmentButton active={mode === 'cards'} onClick={() => onChange('cards')} ariaLabel="Template cards">
      <LayoutGrid size={14} />
    </SegmentButton>
  </div>
);

const SegmentButton: React.FC<{
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ active, onClick, ariaLabel, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={active}
    title={ariaLabel}
    style={{
      width: 32,
      height: 30,
      borderRadius: 9999,
      border: 'none',
      background: active ? PALETTE.teal : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 160ms ease',
    }}
  >
    {children}
  </button>
);

// Cream-on-dark select matching the JobsSearch field style.
const TemplateSelect: React.FC<{ value: TemplateId; onChange: (id: TemplateId) => void }> = ({
  value,
  onChange,
}) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TemplateId)}
      style={{
        height: 38,
        background: PALETTE.cream,
        color: PALETTE.canvasDeep,
        border: `1px solid ${PALETTE.tan}`,
        borderRadius: 9999,
        padding: '0 36px 0 16px',
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 13,
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        cursor: 'pointer',
      }}
    >
      {TEMPLATES.map((t) => (
        <option key={t.id} value={t.id} disabled={!t.builtYet}>
          {t.name}
          {!t.builtYet ? ' (coming soon)' : ''}
        </option>
      ))}
    </select>
    <ChevronDown
      size={14}
      color={PALETTE.canvasDeep}
      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    />
  </div>
);

// ── Tabs: Résumé / Cover letter ───────────────────────────────
const DocumentTabs: React.FC<{
  resumeJson: ResumeJson;
  coverLetterJson: CoverLetterJson | null;
  templateId: TemplateId;
  careerTitle: string;
}> = ({ resumeJson, coverLetterJson, templateId, careerTitle }) => {
  const [tab, setTab] = useState<'resume' | 'cover-letter'>('resume');
  const hasCover = !!coverLetterJson;

  return (
    <div>
      {/* Doc-type tabs — only when there's a cover letter to switch to.
          Without one, a lone "Résumé" tab is dead chrome. */}
      {hasCover && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <TabButton active={tab === 'resume'} onClick={() => setTab('resume')}>
            <FileText size={13} /> Résumé
          </TabButton>
          <TabButton active={tab === 'cover-letter'} onClick={() => setTab('cover-letter')}>
            <Mail size={13} /> Cover letter
          </TabButton>
        </div>
      )}
      {tab === 'resume' ? (
        <PdfFrame
          doc={<ResumeDoc templateId={templateId} data={resumeJson} />}
          fileName={fileNameFor(resumeJson.contact?.name, careerTitle, 'resume')}
        />
      ) : (
        coverLetterJson && (
          <PdfFrame
            doc={<CoverLetter letter={coverLetterJson} contact={resumeJson.contact} careerTitle={careerTitle} />}
            fileName={fileNameFor(resumeJson.contact?.name, careerTitle, 'cover_letter')}
          />
        )
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      ...glassCardStyle(active, false),
      padding: '8px 14px',
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: 12.5,
      color: active ? '#fff' : 'rgba(255,255,255,0.72)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    {children}
  </button>
);

// Memoised template-component lookup so switching tabs doesn't unnecessarily
// re-create the doc tree.
const ResumeDoc: React.FC<{ templateId: TemplateId; data: ResumeJson }> = ({ templateId, data }) => {
  const TemplateComponent = useMemo(() => getTemplateComponent(templateId), [templateId]);
  return <TemplateComponent data={data} />;
};

const PdfFrame: React.FC<{ doc: React.ReactElement; fileName: string }> = ({ doc, fileName }) => (
  // BlobProvider renders the doc once and hands us {url, blob, loading, error}.
  // We embed the blob URL ourselves so we can show an explicit loading state
  // and surface errors — PDFViewer used to fail silently and leave a black box.
  <BlobProvider document={doc}>
    {({ url, loading, error }) => (
      <div
        style={{
          background: 'rgba(18, 46, 59, 0.55)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 18,
          padding: 12,
        }}
      >
        <div
          style={{
            position: 'relative',
            background: '#f4efe2',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 12,
            boxShadow: '0 18px 50px -20px rgba(0,0,0,0.6)',
            height: 780,
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
                gap: 10,
                color: PALETTE.canvasDeep,
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Loader2 size={16} className="animate-spin" /> Rendering preview…
            </div>
          )}
          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 24,
                textAlign: 'center',
                color: PALETTE.canvasDeep,
                fontFamily: FONT_BODY,
                fontSize: 13,
              }}
            >
              <AlertCircle size={20} color="#b91c1c" />
              <div style={{ fontWeight: 700 }}>Preview couldn't render.</div>
              <div style={{ fontSize: 12, color: PALETTE.inkSoft }}>
                You can still download the PDF below.
              </div>
            </div>
          )}
          {url && !error && (
            <iframe
              src={url}
              title="Résumé preview"
              style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
            />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PDFDownloadLink document={doc} fileName={fileName}>
            {({ loading: dlLoading }) => (
              <button
                type="button"
                disabled={dlLoading}
                style={{
                  background: PALETTE.gold,
                  color: PALETTE.canvasDeep,
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: 9999,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 13.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: dlLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 24px -8px rgba(212,160,36,0.5)',
                  opacity: dlLoading ? 0.7 : 1,
                }}
              >
                <Download size={14} /> {dlLoading ? 'Preparing…' : 'Download PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>
    )}
  </BlobProvider>
);

// ── Keyword coverage ──────────────────────────────────────────
const CoveragePanel: React.FC<{ coverage: KeywordCoverage }> = ({ coverage }) => (
  <div
    style={{
      ...glassCardStyle(false, false),
      padding: 18,
    }}
  >
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 800,
        fontSize: 13,
        color: '#fff',
        marginBottom: 12,
        letterSpacing: '0.02em',
      }}
    >
      Keyword coverage
    </div>
    {coverage.hit?.length ? (
      <KeywordRow label={`Hit (${coverage.hit.length})`} items={coverage.hit} accent={PALETTE.tealBright} bgTint="rgba(39,161,161,0.12)" border="rgba(39,161,161,0.40)" />
    ) : null}
    {coverage.missing?.length ? (
      <KeywordRow
        label={`Consider adding (${coverage.missing.length})`}
        items={coverage.missing}
        accent={PALETTE.goldBright}
        bgTint="rgba(212,160,36,0.12)"
        border="rgba(212,160,36,0.40)"
      />
    ) : null}
  </div>
);

const KeywordRow: React.FC<{
  label: string;
  items: string[];
  accent: string;
  bgTint: string;
  border: string;
}> = ({ label, items, accent, bgTint, border }) => (
  <div style={{ marginBottom: 10 }}>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((k) => (
        <span
          key={k}
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 9999,
            background: bgTint,
            color: accent,
            border: `1px solid ${border}`,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 11.5,
            whiteSpace: 'nowrap',
          }}
        >
          {k}
        </span>
      ))}
    </div>
  </div>
);

// ── Pill button (reused by hero) ──────────────────────────────
const PillButton: React.FC<{
  tone: 'ghost' | 'teal';
  onClick: () => void;
  children: React.ReactNode;
}> = ({ tone, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: tone === 'teal' ? 'rgba(39,161,161,0.20)' : 'transparent',
      color: '#fff',
      border:
        tone === 'teal'
          ? '1px solid rgba(39,161,161,0.42)'
          : '1px solid rgba(255,255,255,0.16)',
      padding: '10px 16px',
      borderRadius: 9999,
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: 13,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

// ── File name helper ──────────────────────────────────────────
function fileNameFor(name: string | undefined, careerTitle: string, kind: 'resume' | 'cover_letter') {
  const cleanName = (name ?? 'Resume').replace(/\s+/g, '_');
  const cleanCareer = careerTitle.replace(/[^a-zA-Z0-9]+/g, '_');
  return `${cleanName}_${cleanCareer}_${kind}.pdf`;
}
