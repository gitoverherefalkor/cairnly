// Cream top bar for the v2 dashboard screens. Sticky, matches the production
// editorial palette. The "discuss with coach" action from the prototype nav is
// intentionally dropped — the coach is a one-shot conversation (handoff README,
// § Removed from prior dashboard).

import React from 'react';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import { PALETTE, FONT_BODY, LOGO_INVERTED_URL } from './dashboardV2Shared';

interface DashboardAppNavProps {
  firstName: string;
  pageLabel?: string;
  onProfile: () => void;
  onSignOut: () => void;
  // Optional back-link on the far left. Used by sub-pages (e.g. /jobs) that
  // want a clear path back to /dashboard.
  onBack?: () => void;
  backLabel?: string;
}

export const DashboardAppNav: React.FC<DashboardAppNavProps> = ({
  firstName,
  pageLabel = 'Dashboard',
  onProfile,
  onSignOut,
  onBack,
  backLabel = 'Back',
}) => (
  <header
    style={{
      background: PALETTE.cream,
      borderBottom: `1px solid ${PALETTE.tan}`,
      padding: '10px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px 6px 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 13,
            color: PALETTE.inkMuted,
          }}
        >
          <ArrowLeft size={16} /> {backLabel}
        </button>
      )}
      <img src={LOGO_INVERTED_URL} alt="Cairnly" style={{ height: 44, width: 'auto' }} />
      <span style={{ color: PALETTE.tan }}>|</span>
      <span style={{ fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14, color: PALETTE.inkMuted }}>
        {pageLabel}
      </span>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={onProfile}
        style={{
          background: '#fff',
          color: PALETTE.ink,
          border: `1px solid ${PALETTE.tan}`,
          padding: '8px 14px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        <User size={14} /> {firstName || 'Profile'}
      </button>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        style={{
          background: 'transparent',
          color: PALETTE.inkMuted,
          border: `1px solid ${PALETTE.tan}`,
          padding: '8px 10px',
          borderRadius: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <LogOut size={14} />
      </button>
    </div>
  </header>
);
