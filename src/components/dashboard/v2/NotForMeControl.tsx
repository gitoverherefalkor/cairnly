import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOff, Undo2 } from 'lucide-react';
import { DISMISS_REASONS, type DismissReason } from '@/hooks/useDismissedCareers';

// "Not for me" — sets a career aside. One click to dismiss, one click to bring
// it back, and a skippable row of reason chips in between. No modal and no
// confirmation: the action is fully reversible, so a confirm step would be
// friction for nothing.

interface Props {
  isDismissed: boolean;
  // Present once dismissed and a reason has been chosen; hides the chip row.
  reason: DismissReason | null;
  // True while a dismiss/restore request is in flight. Disables the button so
  // a double-tap can't fire two inserts against the UNIQUE(report_id,
  // section_id) constraint. Required (not optional): a caller that forgets
  // to wire isDismissing/isRestoring should fail to compile, not silently
  // reintroduce the double-click race this prop exists to prevent.
  busy: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  onReason: (reason: DismissReason) => void;
}

// English fallbacks for the reason chips. The v4.notForMe.reason.* keys land
// in public/locales/{en,nl}/dashboard.json in a later task; until then these
// keep the chips readable instead of showing raw key paths.
const REASON_LABELS: Record<DismissReason, string> = {
  not_interested: 'Not interested',
  wrong_level: 'Wrong level',
  pay_too_low: 'Pay too low',
  already_did: 'Already did this',
  location: 'Location',
  other: 'Something else',
};

const BTN: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(255,255,255,0.14)',
  padding: '6px 12px',
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 150ms ease',
};

export const NotForMeControl: React.FC<Props> = ({
  isDismissed,
  reason,
  busy,
  onDismiss,
  onRestore,
  onReason,
}) => {
  const { t } = useTranslation('dashboard');
  // Show the chips only for the dismissal that just happened in this session,
  // so re-opening an old dismissed card doesn't nag for a reason again.
  const [showChips, setShowChips] = useState(false);

  // True from the moment this component's own dismiss/restore click fires
  // until the resulting isDismissed transition is confirmed below. Lets the
  // effect distinguish "we caused this" from isDismissed flipping for any
  // other reason (refetchOnWindowFocus, another tab, another device) — those
  // must never show the reason chips or steal keyboard focus.
  const initiatedRef = useRef(false);
  const prevDismissedRef = useRef(isDismissed);
  // Points at whichever primary button is currently mounted (dismiss in the
  // undismissed tree, restore in the dismissed tree). The two branches are
  // structurally different element trees, so React unmounts one button and
  // mounts the other on every transition; this ref lets a self-initiated
  // transition hand focus to the newly-mounted button instead of losing it
  // to <body>.
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const wasDismissed = prevDismissedRef.current;
    prevDismissedRef.current = isDismissed;

    if (!wasDismissed && isDismissed) {
      // Dismiss confirmed. Only react if this component is the one that
      // asked for it — otherwise leave chips hidden and focus alone.
      if (initiatedRef.current) {
        initiatedRef.current = false;
        setShowChips(true);
        primaryButtonRef.current?.focus();
      }
    } else if (wasDismissed && !isDismissed) {
      // Restore confirmed, from any source. The chip row never applies to an
      // undismissed card, so hide it unconditionally; only steal focus back
      // to the button if this component was the one that clicked restore.
      setShowChips(false);
      if (initiatedRef.current) {
        initiatedRef.current = false;
        primaryButtonRef.current?.focus();
      }
    }
  }, [isDismissed]);

  if (isDismissed) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          ref={primaryButtonRef}
          disabled={busy}
          style={{ ...BTN, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            initiatedRef.current = true;
            onRestore();
          }}
        >
          <Undo2 size={13} aria-hidden="true" />
          {t('v4.notForMe.restore', { defaultValue: 'Bring it back' })}
        </button>

        {showChips && !reason && (
          <>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {t('v4.notForMe.whyOptional', { defaultValue: 'Why? (optional)' })}
            </span>
            {DISMISS_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                style={{ ...BTN, padding: '5px 10px', fontSize: 11.5 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReason(r);
                  setShowChips(false);
                }}
              >
                {t(`v4.notForMe.reason.${r}`, { defaultValue: REASON_LABELS[r] })}
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      ref={primaryButtonRef}
      disabled={busy}
      style={{ ...BTN, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        initiatedRef.current = true;
        onDismiss();
      }}
    >
      <EyeOff size={13} aria-hidden="true" />
      {t('v4.notForMe.dismiss', { defaultValue: 'Not for me' })}
    </button>
  );
};
