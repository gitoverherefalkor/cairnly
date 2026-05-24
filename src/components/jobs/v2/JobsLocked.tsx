// Jobs · Locked — gate shown to users who haven't earned the tier-1 referral.
// Mirrors the dashboard's invite-to-unlock vocabulary.

import React from 'react';
import { ArrowRight, FilePlus, FileText, Search } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
  CairnGlyph,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';

interface JobsLockedProps {
  firstName: string;
  referralCode: string | null;
  onBack: () => void;
  onShare: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

export const JobsLocked: React.FC<JobsLockedProps> = ({
  firstName,
  referralCode,
  onBack,
  onShare,
  onProfile,
  onSignOut,
}) => (
  <LakeBackground intensity="heavy">
    <DashboardAppNav
      firstName={firstName}
      pageLabel="Find Open Roles"
      onProfile={onProfile}
      onSignOut={onSignOut}
      onBack={onBack}
      backLabel="Back to dashboard"
    />

    <div style={{ maxWidth: 920, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <CairnGlyph kind="distant" size={96} color="rgba(236,228,210,0.92)" accent={PALETTE.goldBright} />
      </div>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: PALETTE.goldBright,
        }}
      >
        STEP 1 · 1 FRIEND TO UNLOCK
      </span>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 56,
          letterSpacing: '-0.035em',
          color: '#fff',
          margin: '14px 0 14px 0',
          lineHeight: 1.0,
        }}
      >
        Help one friend find their path, unlock yours.
      </h1>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 17,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.78)',
          lineHeight: 1.55,
          margin: '0 auto 36px',
          maxWidth: 620,
        }}
      >
        Job openings refresh daily and stay matched to your top 3 careers. As soon as one friend you invite
        joins Cairnly, this page opens.
      </p>

      <div
        style={{
          background: 'rgba(18, 46, 59, 0.55)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: 18,
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          maxWidth: 540,
          margin: '0 auto 56px',
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.20)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 9999,
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flex: 1,
          }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Your code
          </span>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 18,
              fontWeight: 700,
              color: PALETTE.goldBright,
              letterSpacing: '0.14em',
            }}
          >
            {referralCode ?? '· · ·'}
          </span>
        </div>
        <button
          type="button"
          onClick={onShare}
          style={{
            background: PALETTE.gold,
            color: PALETTE.canvasDeep,
            border: 'none',
            padding: '14px 22px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 12px 28px -8px rgba(212,160,36,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          Share <ArrowRight size={15} />
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          WHEN UNLOCKED · YOU CAN
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, textAlign: 'left' }}>
        {(
          [
            {
              icon: <Search size={18} />,
              t: 'Find live openings',
              d: 'Refreshed daily, matched to your top 3 careers + runner-ups, ranked by an AI score against your profile.',
            },
            {
              icon: <FileText size={18} />,
              t: 'Tailor your resume',
              d: 'On any saved job. Opens after a second invited friend joins.',
            },
            {
              icon: <FilePlus size={18} />,
              t: 'Generate cover letters',
              d: 'On any saved job. Opens after a third invited friend joins.',
            },
          ] as const
        ).map((step, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(18, 46, 59, 0.50)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {step.icon}
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 15,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {step.t}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12.5,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.45,
              }}
            >
              {step.d}
            </div>
          </div>
        ))}
      </div>
    </div>
  </LakeBackground>
);
