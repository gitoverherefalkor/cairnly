// Pre-report dashboard states (handoff prototype: empty-state.jsx).
//  - 'empty'  → paid, assessment never started
//  - 'resume' → assessment in progress
//  - 'chat'   → coach conversation in progress (report not yet generated)
//  - 'failed' → answers submitted but report generation failed; offer a retry

import React from 'react';
import { ArrowRight, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from './dashboardV2Shared';
import { DashboardAppNav } from './DashboardAppNav';
import cairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

export type EntryMode = 'empty' | 'resume' | 'chat' | 'failed';

interface ResumeProgress {
  sectionsComplete: number;
  totalSections: number;
  // Optional finer-grained progress: drives the % eyebrow and the bar so a
  // user on the last question of the last section reads ~98% instead of 86%.
  questionsAnswered?: number;
  totalQuestions?: number;
}

interface DashboardEntryStateProps {
  mode: EntryMode;
  firstName: string;
  onStart: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  resumeProgress?: ResumeProgress;
  // Only used in 'failed' mode: re-run report generation from saved answers.
  onRetry?: () => void;
  isRetrying?: boolean;
  // Starter flavor (cairnly.io/starter, first-job seekers): different survey,
  // shorter timing, and copy that doesn't assume a work history.
  isStarter?: boolean;
}

// Mirrors the survey_sections table in DB order. Update both together when
// sections change in Supabase.
const ASSESSMENT_SECTIONS = [
  'Intake questions',
  'Personality & decision-making',
  'Values & motivations',
  'Professional interests & skills',
  'Work environment & team preferences',
  'Emotional intelligence',
  'Career goals & development',
];

// Starter survey sections (survey 00000000-...-0002), DB order.
const STARTER_SECTIONS = [
  'Getting to know you',
  'How you operate',
  'What drives you',
  'Interests and strengths',
  'Where you work best',
  'Practical reality',
  'Looking ahead',
];

export const DashboardEntryState: React.FC<DashboardEntryStateProps> = ({
  mode,
  firstName,
  onStart,
  onProfile,
  onSignOut,
  resumeProgress,
  onRetry,
  isRetrying = false,
  isStarter = false,
}) => {
  const name = firstName || 'there';
  const isResume = mode === 'resume';
  const isChat = mode === 'chat';
  const isFailed = mode === 'failed';

  const sections = isStarter ? STARTER_SECTIONS : ASSESSMENT_SECTIONS;

  const complete = resumeProgress?.sectionsComplete ?? 0;
  const total = resumeProgress?.totalSections ?? sections.length;
  // Prefer question-level ratio when available — section-level ratio is too
  // coarse (1 of 7 sections done jumps the bar in 14% chunks).
  const answered = resumeProgress?.questionsAnswered;
  const totalQs = resumeProgress?.totalQuestions;
  const pct =
    typeof answered === 'number' && typeof totalQs === 'number' && totalQs > 0
      ? Math.min(100, Math.round((answered / totalQs) * 100))
      : total > 0
        ? Math.round((complete / total) * 100)
        : 0;

  const headline: React.ReactNode = isFailed
    ? `We hit a snag, ${name}.`
    : isChat
      ? `Your coach is ready, ${name}.`
      : isResume
        ? `Pick up where you left off, ${name}.`
        : (
            <>
              Welcome, {name}.
              <br />
              Let's start.
            </>
          );

  const sub = isFailed
    ? 'Your answers are saved, so nothing is lost. We could not finish generating your report this time. You can start it again right now.'
    : isChat
      ? 'Your assessment is in. Finish the conversation with your AI coach to unlock your full report and career matches.'
      : isResume
        ? 'You are partway through. A few sections left, then your coach walks you through the report.'
        : isStarter
          ? 'In the assessment we cover how you operate, what you enjoy, and where you want to go. No work experience needed: side jobs, school, and projects all count as real evidence. Best in one sitting, and your answers are auto-saved. After this, your AI coach walks you through a personalised report and refines it with you.'
          : "In the assessment we cover how you work, what you've done, and where you want to go. Best in one sitting, but if you want to take a break, rest assured that your answers are auto-saved for you. After this, your AI coach walks you through a personalised report and refines it with you.";

  const ctaLabel = isChat ? 'Continue with your coach' : isResume ? 'Resume assessment' : 'Start your assessment';
  const ctaEyebrow = isFailed
    ? 'REPORT · ACTION NEEDED'
    : isChat
      ? 'NEXT STEP · YOUR COACH'
      : isResume
        ? `PROGRESS · ${pct}% COMPLETE`
        : isStarter
          ? 'NEXT STEP · 20 MINUTES'
          : 'NEXT STEP · 25 MINUTES';

  return (
    <LakeBackground intensity="heavy">
      <DashboardAppNav firstName={firstName} onProfile={onProfile} onSignOut={onSignOut} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 80px' }}>
        {/* ─── CTA hero ─── */}
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <img
              src={cairnSymbolInvert}
              alt=""
              aria-hidden
              style={{ height: 44, width: 'auto', opacity: 0.9 }}
            />
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
                {complete >= total ? (
                  <span style={{ width: '100%', textAlign: 'center' }}>
                    All {total} sections done — submit to finish
                  </span>
                ) : (
                  <>
                    <span>Section {complete + 1} of {total} in progress</span>
                    <span>{complete} / {total} sections complete</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={isFailed ? onRetry : onStart}
              disabled={isFailed && isRetrying}
              style={{
                background: PALETTE.gold,
                color: PALETTE.canvasDeep,
                border: 'none',
                padding: '18px 32px',
                borderRadius: 9999,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                cursor: isFailed && isRetrying ? 'default' : 'pointer',
                opacity: isFailed && isRetrying ? 0.75 : 1,
                boxShadow: '0 16px 36px -10px rgba(212,160,36,0.55)',
              }}
            >
              {isFailed ? (
                isRetrying ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Trying again...
                  </>
                ) : (
                  <>
                    Try again <RefreshCw size={18} />
                  </>
                )
              ) : (
                <>
                  {ctaLabel} <ArrowRight size={18} />
                </>
              )}
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
              // Responsive without media queries: 4-up on desktop, collapses to
              // 2-up on mobile so the cards never overflow the viewport.
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 16,
              opacity: 0.45,
              pointerEvents: 'none',
              filter: 'saturate(0.6)',
            }}
          >
            {isStarter ? (
              <>
                <GhostCard title="Personality profile" sub="How you operate, decide, and learn" />
                <GhostCard title="Career directions" sub="3 directions that fit you, AI-aware" />
                <GhostCard title="Alternative paths" sub="Runner-ups + outside-the-box" />
                <GhostCard title="Entry game plan" sub="How to get in without experience" />
              </>
            ) : (
              <>
                <GhostCard title="Personality profile" sub="How you think, lead, and operate" />
                <GhostCard title="Top career matches" sub="3 roles tailored to you, AI-impact rated" />
                <GhostCard title="Alternative paths" sub="Runner-ups + outside-the-box" />
                <GhostCard title="Dream-job reality check" sub="An honest feasibility check" />
              </>
            )}
          </div>

          {!isChat && !isFailed && (
            <div
              // Left-aligned on mobile (centering looks cramped there); centered
              // and width-capped on desktop for the balanced 4 / 3 chip split.
              className="items-start sm:items-center"
              style={{
                marginTop: 40,
                // Centered box, width tuned so exactly four sections fit the
                // top row (they need ~832px), pushing "Work environment & team
                // preferences" onto the bottom row for a balanced 4 / 3 split.
                // A fifth chip would need ~1143px, so it always wraps here.
                maxWidth: 920,
                marginLeft: 'auto',
                marginRight: 'auto',
                background: 'rgba(18, 46, 59, 0.55)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 20,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div
                className="text-left sm:text-center"
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                The assessment covers, among other things:
              </div>
              <div
                className="justify-start sm:justify-center"
                style={{
                  display: 'flex',
                  gap: '14px 28px',
                  flexWrap: 'wrap',
                }}
              >
                {sections.map((label, i) => {
                  const done = isResume && i < complete;
                  const current = isResume && i === complete;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {done ? (
                        <CheckCircle2 size={15} color={PALETTE.goldBright} />
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
                          fontSize: 14,
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
          Progress auto-saved · Safe to close and return later
        </div>
      </div>
    </LakeBackground>
  );
};

const GhostCard: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
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
      textAlign: 'center',
    }}
  >
    <div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
        {sub}
      </div>
    </div>
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999 }} />
    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, width: '70%', margin: '0 auto' }} />
  </div>
);
