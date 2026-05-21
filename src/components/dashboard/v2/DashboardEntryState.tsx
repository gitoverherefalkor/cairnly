// Pre-report dashboard states (handoff prototype: empty-state.jsx).
//  - 'empty'  → paid, assessment never started
//  - 'resume' → assessment in progress
//  - 'chat'   → coach conversation in progress (report not yet generated)

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
  CairnGlyph,
} from './dashboardV2Shared';
import { DashboardAppNav } from './DashboardAppNav';

export type EntryMode = 'empty' | 'resume' | 'chat';

interface ResumeProgress {
  sectionsComplete: number;
  totalSections: number;
}

interface DashboardEntryStateProps {
  mode: EntryMode;
  firstName: string;
  onStart: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  resumeProgress?: ResumeProgress;
}

const ASSESSMENT_SECTIONS = [
  'Career history & ambitions',
  'Personality & decision style',
  'Values & priorities',
  'Work-life & energy',
  'Professional interests',
  'Emotional intelligence',
];

export const DashboardEntryState: React.FC<DashboardEntryStateProps> = ({
  mode,
  firstName,
  onStart,
  onProfile,
  onSignOut,
  resumeProgress,
}) => {
  const name = firstName || 'there';
  const isResume = mode === 'resume';
  const isChat = mode === 'chat';

  const complete = resumeProgress?.sectionsComplete ?? 0;
  const total = resumeProgress?.totalSections ?? ASSESSMENT_SECTIONS.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const headline = isChat
    ? `Your coach is ready, ${name}.`
    : isResume
      ? `Pick up where you left off, ${name}.`
      : `Welcome, ${name}. Let's start.`;

  const sub = isChat
    ? 'Your assessment is in. Finish the conversation with your AI coach to unlock your full report and career matches.'
    : isResume
      ? 'You are partway through. A few sections left, then your coach walks you through the report.'
      : "About 25 minutes, best in one sitting — but everything's auto-saved if you need to pause. You'll cover how you work, what you've done, and where you want to go. Then your AI coach walks you through a personalised report and refines it with you.";

  const ctaLabel = isChat ? 'Continue with your coach' : isResume ? 'Resume assessment' : 'Start your assessment';
  const ctaEyebrow = isChat
    ? 'NEXT STEP · YOUR COACH'
    : isResume
      ? `PROGRESS · ${pct}% COMPLETE`
      : 'NEXT STEP · 25 MINUTES';

  return (
    <LakeBackground intensity="heavy">
      <DashboardAppNav firstName={firstName} onProfile={onProfile} onSignOut={onSignOut} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 80px' }}>
        {/* ─── CTA hero ─── */}
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 88, height: 88, marginBottom: 12 }}>
            <CairnGlyph kind={isChat ? 'capstone' : 'foundation'} size={88} color="rgba(236,228,210,0.95)" accent={PALETTE.goldBright} />
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: PALETTE.goldBright,
              marginBottom: 14,
            }}
          >
            {ctaEyebrow}
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 60,
              letterSpacing: '-0.035em',
              color: '#fff',
              margin: '0 0 16px 0',
              lineHeight: 1.0,
            }}
          >
            {headline}
          </h1>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 17,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.5,
              margin: '0 auto 28px',
              maxWidth: 580,
            }}
          >
            {sub}
          </p>

          {isResume && (
            <div style={{ maxWidth: 480, margin: '0 auto 28px' }}>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 9999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${PALETTE.teal} 0%, ${PALETTE.goldBright} 100%)`,
                    borderRadius: 9999,
                    boxShadow: '0 0 16px rgba(212,160,36,0.4)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                <span>Section {Math.min(complete + 1, total)} of {total} in progress</span>
                <span>{complete} / {total} sections complete</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onStart}
              style={{
                background: PALETTE.gold,
                color: PALETTE.canvasDeep,
                border: 'none',
                padding: '18px 32px',
                borderRadius: 9999,
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                boxShadow: '0 16px 36px -10px rgba(212,160,36,0.55)',
              }}
            >
              {ctaLabel} <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* ─── "When you finish, here's what waits" — ghosted preview ─── */}
        <div style={{ marginTop: 72, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 60,
              background: 'linear-gradient(180deg, rgba(212,160,36,0) 0%, rgba(212,160,36,0.5) 100%)',
            }}
          />
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(212,160,36,0.7)',
              }}
            >
              WHEN YOU FINISH · UNLOCKED
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              opacity: 0.45,
              pointerEvents: 'none',
              filter: 'saturate(0.6)',
            }}
          >
            <GhostCard glyph="halo" title="Personality profile" sub="How you think, lead, and operate" />
            <GhostCard glyph="capstone" title="Top career matches" sub="3 roles tailored to you, AI-impact rated" />
            <GhostCard glyph="pair" title="Alternative paths" sub="Runner-ups + outside-the-box" />
            <GhostCard glyph="distant" title="Dream-job reality check" sub="An honest feasibility check" />
          </div>

          {!isChat && (
            <div
              style={{
                marginTop: 40,
                background: 'rgba(18, 46, 59, 0.55)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 20,
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                The assessment covers, among other things:
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {ASSESSMENT_SECTIONS.map((label, i) => {
                  const done = isResume && i < complete;
                  const current = isResume && i === complete;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {done ? (
                        <CheckCircle2 size={14} color={PALETTE.goldBright} />
                      ) : (
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 9999,
                            border: `1.5px solid ${current ? PALETTE.teal : 'rgba(255,255,255,0.25)'}`,
                            background: current ? PALETTE.teal : 'transparent',
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: done ? 'rgba(255,255,255,0.85)' : current ? '#fff' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 32,
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Progress auto-saved · Safe to close and return later · Full refund if you're not satisfied
        </div>
      </div>
    </LakeBackground>
  );
};

const GhostCard: React.FC<{ glyph: 'capstone' | 'halo' | 'distant' | 'pair'; title: string; sub: string }> = ({
  glyph,
  title,
  sub,
}) => (
  <div
    style={{
      background: 'rgba(18, 46, 59, 0.50)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CairnGlyph kind={glyph} size={36} color="rgba(236,228,210,0.85)" accent={PALETTE.goldBright} />
    </div>
    <div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
        {sub}
      </div>
    </div>
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999 }} />
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, width: '70%' }} />
  </div>
);
