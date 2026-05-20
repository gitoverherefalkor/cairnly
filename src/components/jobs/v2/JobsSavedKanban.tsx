// Jobs · Saved — 4-column kanban pipeline (Saved · Applied · Interviewing ·
// Archived). Drag-and-drop via @dnd-kit; column transitions optimistically
// patch the saved_jobs.status column. Per-card status row + mini next-step
// actions follow the handoff spec.

import React from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Calendar, ExternalLink, Lock, Search } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import type { SavedJob, SavedJobStatus } from '@/hooks/useSavedJobs';
import { JEyebrow, matchTone } from './jobsV2Shared';

interface JobsSavedKanbanProps {
  firstName: string;
  savedJobs: SavedJob[];
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onUpdateStatus: (externalJobId: string, status: SavedJobStatus) => void;
  onBackToSearch: () => void;
  onBack: () => void;
  onInvite: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

interface ColumnDef {
  id: SavedJobStatus;
  label: string;
  color: string;
  hint: string;
  emptyHint: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'saved', label: 'Saved', color: '#D4A024', hint: 'Worth a closer look', emptyHint: 'Save jobs from search.' },
  { id: 'applied', label: 'Applied', color: '#27A1A1', hint: 'Out there, in flight', emptyHint: 'Move here once applied.' },
  { id: 'interviewing', label: 'Interviewing', color: '#EFBE48', hint: 'Conversations in progress', emptyHint: 'Drag from Applied.' },
  { id: 'archived', label: 'Archived', color: 'rgba(255,255,255,0.30)', hint: 'Not pursuing, kept for reference', emptyHint: 'Nothing archived yet.' },
];

export const JobsSavedKanban: React.FC<JobsSavedKanbanProps> = ({
  firstName,
  savedJobs,
  resumeUnlocked,
  coverUnlocked,
  onUpdateStatus,
  onBackToSearch,
  onBack,
  onInvite,
  onProfile,
  onSignOut,
}) => {
  // Require a small drag distance before activating so click-to-apply isn't
  // hijacked by a drag intent.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as SavedJobStatus;
    const job = savedJobs.find((j) => j.external_job_id === String(active.id));
    if (!job || job.status === newStatus) return;
    onUpdateStatus(job.external_job_id, newStatus);
  };

  const activeCount = savedJobs.filter((j) => j.status !== 'archived').length;

  return (
    <LakeBackground intensity="normal">
      <DashboardAppNav
        firstName={firstName}
        pageLabel="Your pipeline"
        onProfile={onProfile}
        onSignOut={onSignOut}
        onBack={onBack}
        backLabel="Back to dashboard"
      />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 32px 80px' }}>
        <div
          style={{
            background: 'rgba(18, 46, 59, 0.62)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 18,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          <JEyebrow>YOUR PIPELINE</JEyebrow>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: '#fff' }}>
            {savedJobs.length} {savedJobs.length === 1 ? 'role' : 'roles'} · {activeCount} active
          </span>
          <button
            type="button"
            onClick={onBackToSearch}
            style={{
              marginLeft: 'auto',
              background: PALETTE.teal,
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 8px 18px -6px rgba(39,161,161,0.5)',
            }}
          >
            <Search size={13} /> Back to search
          </button>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                jobs={savedJobs.filter((j) => j.status === col.id)}
                resumeUnlocked={resumeUnlocked}
                coverUnlocked={coverUnlocked}
                onInvite={onInvite}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </LakeBackground>
  );
};

// ── Column ────────────────────────────────────────────────────
const KanbanColumn: React.FC<{
  col: ColumnDef;
  jobs: SavedJob[];
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onInvite: () => void;
}> = ({ col, jobs, resumeUnlocked, coverUnlocked, onInvite }) => {
  const { isOver, setNodeRef } = useDroppable({ id: col.id });
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'rgba(18, 46, 59, 0.62)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: col.color }} />
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {col.label}
            </span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {jobs.length}
            </span>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {col.hint}
          </div>
        </div>
      </div>
      <div
        ref={setNodeRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 80,
          borderRadius: 14,
          padding: jobs.length === 0 ? 0 : 2,
          background: isOver ? 'rgba(39,161,161,0.10)' : 'transparent',
          transition: 'background 120ms ease',
        }}
      >
        {jobs.map((job) => (
          <KanbanJobCard key={job.id} job={job} resumeUnlocked={resumeUnlocked} coverUnlocked={coverUnlocked} onInvite={onInvite} />
        ))}
        {jobs.length === 0 && (
          <div
            style={{
              padding: '24px 14px',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.10)',
              borderRadius: 14,
              fontFamily: FONT_BODY,
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.5,
            }}
          >
            {col.emptyHint}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Card ──────────────────────────────────────────────────────
const KanbanJobCard: React.FC<{
  job: SavedJob;
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onInvite: () => void;
}> = ({ job, resumeUnlocked, coverUnlocked, onInvite }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.external_job_id });
  const tone = matchTone(job.match_score, 'dark');
  const salaryText = formatSavedSalary(job.salary_min, job.salary_max);

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: 'rgba(18, 46, 59, 0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.7 : 1,
        touchAction: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h5
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '-0.01em',
            color: '#fff',
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {job.job_title}
        </h5>
        {job.match_score != null && (
          <span
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              borderRadius: 9999,
              background: `${tone}1f`,
              color: tone,
              border: `1px solid ${tone}44`,
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.02em',
            }}
          >
            {job.match_score}
            <span style={{ opacity: 0.6 }}>/10</span>
          </span>
        )}
      </div>
      {job.company_name && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          {job.company_name}
        </div>
      )}
      {(job.location || salaryText) && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
          {[job.location, salaryText].filter(Boolean).join(' · ')}
        </div>
      )}

      <StatusLine job={job} />

      {(job.status === 'saved' || job.status === 'applied') && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
          {job.status === 'saved' && job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: PALETTE.teal,
                color: '#fff',
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: 9999,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ExternalLink size={11} /> Apply
            </a>
          )}
          <MiniNextStep label="Resume" unlocked={resumeUnlocked} onLocked={onInvite} />
          <MiniNextStep label="Cover" unlocked={coverUnlocked} onLocked={onInvite} />
        </div>
      )}
    </article>
  );
};

const StatusLine: React.FC<{ job: SavedJob }> = ({ job }) => {
  if (job.status === 'saved') {
    const days = daysAgo(job.saved_at);
    const provenance = job.from_career ? ` · from "${job.from_career}"` : '';
    return (
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
        Saved {days}{provenance}
      </div>
    );
  }
  if (job.status === 'applied') {
    const days = daysAgo(job.applied_at || job.saved_at);
    return (
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: PALETTE.teal }}>
        Applied {days}
        {job.note ? ` · ${job.note}` : ''}
      </div>
    );
  }
  if (job.status === 'interviewing') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 9999,
          background: 'rgba(212,160,36,0.20)',
          color: PALETTE.goldBright,
          border: '1px solid rgba(212,160,36,0.40)',
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 11,
          alignSelf: 'flex-start',
        }}
      >
        <Calendar size={11} /> {job.stage || 'Interview scheduled'}
      </div>
    );
  }
  // archived
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 11,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.4)',
        fontStyle: 'italic',
      }}
    >
      {job.archived_reason || 'Archived'}
    </div>
  );
};

const MiniNextStep: React.FC<{ label: string; unlocked: boolean; onLocked: () => void }> = ({
  label,
  unlocked,
  onLocked,
}) => (
  <button
    type="button"
    onClick={() => {
      if (!unlocked) onLocked();
    }}
    style={{
      background: 'transparent',
      color: unlocked ? '#fff' : 'rgba(255,255,255,0.5)',
      border: `1px solid ${unlocked ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)'}`,
      padding: '5px 10px',
      borderRadius: 9999,
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: 11,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      cursor: 'pointer',
    }}
  >
    {!unlocked && <Lock size={10} />}
    {label}
  </button>
);

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1w ago' : `${weeks}w ago`;
}

function formatSavedSalary(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '';
  const k = (n: number) => Math.round(n / 1000);
  if (min != null && max != null && max > min) return `${k(min)}–${k(max)}k`;
  const v = (min ?? max) as number;
  return `${k(v)}k`;
}
