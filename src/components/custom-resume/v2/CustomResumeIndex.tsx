// Index view at /custom-resume (when no ?ids= URL param) — shows the user's
// past tailored résumés grouped by career, with View / Delete actions. Sits
// above the Builder UI so the user lands on a page that both surfaces past
// work and lets them start a new one.

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { PageSection, StatusPill, glassCardStyle, REyebrow } from './customResumeV2Shared';
import {
  useCustomResumeList,
  useDeleteCustomResume,
} from '../hooks/useCustomResumeList';
import type { CustomResumeRow } from '../hooks/useCustomResumes';
import { getTemplate } from '../types';
import { toast } from 'sonner';

interface CustomResumeIndexProps {
  onView: (id: string) => void;
}

export const CustomResumeIndex: React.FC<CustomResumeIndexProps> = ({ onView }) => {
  const { data: rows, isLoading } = useCustomResumeList();
  const del = useDeleteCustomResume();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Group by career_title. Most recent generation per career bubbles to the
  // top of each group; groups themselves are ordered by their freshest row.
  const grouped = useMemo(() => groupByCareer(rows ?? []), [rows]);

  if (isLoading) {
    return (
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '40px 32px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'rgba(255,255,255,0.55)',
          fontFamily: FONT_BODY,
          fontSize: 13,
        }}
      >
        <Loader2 size={16} className="animate-spin" /> Loading saved résumés…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    // No empty state here — when the user has no saved résumés we just skip
    // this section entirely and they go straight into the builder. (See
    // CustomResume.tsx where this component is rendered only when count > 0.)
    return null;
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 0' }}>
      <PageSection
        eyebrow="YOUR SAVED RÉSUMÉS"
        rightSlot={
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.7)',
              padding: '6px 12px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {collapsed ? `Show ${rows.length}` : 'Hide list'}
          </button>
        }
      >
        {!collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {grouped.map((group) => (
              <CareerGroup
                key={group.career_title}
                career={group.career_title}
                rows={group.rows}
                onView={onView}
                onAskDelete={(id) => setConfirmDelete(id)}
                isDeleting={del.isPending && confirmDelete === null}
              />
            ))}
          </div>
        ) : null}
      </PageSection>

      {confirmDelete ? (
        <DeleteConfirmModal
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const id = confirmDelete;
            setConfirmDelete(null);
            try {
              await del.mutateAsync(id);
              toast.success('Résumé deleted.');
            } catch (e) {
              toast.error('Could not delete. Please try again.');
            }
          }}
        />
      ) : null}
    </div>
  );
};

interface CareerGroup {
  career_title: string;
  rows: CustomResumeRow[];
}

function groupByCareer(rows: CustomResumeRow[]): CareerGroup[] {
  const byCareer = new Map<string, CustomResumeRow[]>();
  for (const r of rows) {
    const list = byCareer.get(r.career_title) ?? [];
    list.push(r);
    byCareer.set(r.career_title, list);
  }
  // Each row list arrives already sorted desc by created_at (the query orders
  // it that way). Sort groups themselves by their freshest row.
  return Array.from(byCareer.entries())
    .map(([career_title, rows]) => ({ career_title, rows }))
    .sort(
      (a, b) =>
        new Date(b.rows[0].created_at).getTime() - new Date(a.rows[0].created_at).getTime(),
    );
}

const CareerGroup: React.FC<{
  career: string;
  rows: CustomResumeRow[];
  onView: (id: string) => void;
  onAskDelete: (id: string) => void;
  isDeleting: boolean;
}> = ({ career, rows, onView, onAskDelete, isDeleting }) => {
  return (
    <div style={{ ...glassCardStyle(false, false), padding: 18, cursor: 'default' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <FileText size={16} color={PALETTE.tealBright} style={{ flexShrink: 0 }} />
        <h3
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 16,
            color: '#fff',
            margin: 0,
            lineHeight: 1.2,
            flex: 1,
          }}
        >
          {career}
        </h3>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {rows.length} {rows.length === 1 ? 'résumé' : 'résumés'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <ResumeRow
            key={row.id}
            row={row}
            onView={onView}
            onAskDelete={onAskDelete}
            isDeleting={isDeleting}
          />
        ))}
      </div>
    </div>
  );
};

const ResumeRow: React.FC<{
  row: CustomResumeRow;
  onView: (id: string) => void;
  onAskDelete: (id: string) => void;
  isDeleting: boolean;
}> = ({ row, onView, onAskDelete, isDeleting }) => {
  const meta = getTemplate(row.template_id);
  const created = new Date(row.created_at);
  const ats = row.ats_score != null ? Math.round(Number(row.ats_score)) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'rgba(18,46,59,0.45)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        flexWrap: 'wrap',
      }}
    >
      <StatusPill status={row.status as 'processing' | 'completed' | 'failed'} />
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12.5,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        {meta?.name ?? row.template_id}
      </span>
      {ats != null ? (
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11.5,
            fontWeight: 700,
            color: ats >= 80 ? '#10B981' : ats >= 60 ? PALETTE.goldBright : '#F59E0B',
          }}
        >
          ATS {ats}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11.5,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.42)',
          marginLeft: 'auto',
        }}
      >
        {created.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>

      <button
        type="button"
        onClick={() => onView(row.id)}
        disabled={row.status === 'failed'}
        style={{
          background: row.status === 'failed' ? 'transparent' : 'rgba(39,161,161,0.18)',
          color: row.status === 'failed' ? 'rgba(255,255,255,0.3)' : PALETTE.tealBright,
          border: `1px solid ${row.status === 'failed' ? 'rgba(255,255,255,0.10)' : 'rgba(39,161,161,0.35)'}`,
          padding: '6px 12px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: row.status === 'failed' ? 'not-allowed' : 'pointer',
        }}
      >
        <ExternalLink size={12} /> View
      </button>
      <button
        type="button"
        onClick={() => onAskDelete(row.id)}
        disabled={isDeleting}
        title="Delete this résumé"
        style={{
          background: 'transparent',
          color: 'rgba(255,255,255,0.4)',
          border: '1px solid rgba(255,255,255,0.10)',
          padding: 6,
          borderRadius: 9999,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

const DeleteConfirmModal: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ onCancel, onConfirm }) => (
  <div
    role="dialog"
    aria-modal="true"
    onClick={onCancel}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(7,15,20,0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: PALETTE.canvas,
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20,
        padding: 28,
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6)',
      }}
    >
      <REyebrow color="#fca5a5">DELETE THIS RÉSUMÉ</REyebrow>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: 'rgba(255,255,255,0.78)',
          lineHeight: 1.5,
          margin: '12px 0 22px',
        }}
      >
        This permanently removes the tailored résumé from your saved list. You can
        always re-generate one for the same career later — but the ATS score and
        any text edits will be lost.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '10px 18px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);
