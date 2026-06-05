// Cream top bar for the v2 dashboard screens. Sticky, matches the production
// editorial palette. The "discuss with coach" action from the prototype nav is
// intentionally dropped — the coach is a one-shot conversation (handoff README,
// § Removed from prior dashboard).

import React from 'react';
import { ArrowLeft, LogOut, User } from 'lucide-react';
import { PALETTE, FONT_BODY, LOGO_WORDMARK_URL } from './dashboardV2Shared';

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
    className="px-4 sm:px-8"
    style={{
      background: PALETTE.cream,
      borderBottom: `1px solid ${PALETTE.tan}`,
      paddingTop: 10,
      paddingBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}
  >
    <div className="gap-3 sm:gap-5" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 4px 6px 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 13,
            color: PALETTE.inkMuted,
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
          {/* Label hidden on mobile to keep the nav on one line; arrow remains. */}
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
      )}
      <img
        src={LOGO_WORDMARK_URL}
        alt="Cairnly"
        className="h-9 sm:h-11"
        style={{ width: 'auto', flexShrink: 0 }}
      />
      {/* Divider + page label collapse on mobile where horizontal room is tight. */}
      <span className="hidden sm:inline" style={{ color: PALETTE.tan }}>|</span>
      <span
        className="hidden sm:inline"
        style={{ fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14, color: PALETTE.inkMuted }}
      >
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
