import React, { useState } from 'react';
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
  // section_id) constraint.
  busy?: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  onReason: (reason: DismissReason) => void;
}

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
  busy = false,
  onDismiss,
  onRestore,
  onReason,
}) => {
  const { t } = useTranslation('dashboard');
  // Show the chips only for the dismissal that just happened in this session,
  // so re-opening an old dismissed card doesn't nag for a reason again.
  const [showChips, setShowChips] = useState(false);

  if (isDismissed) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          style={{ ...BTN, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setShowChips(false);
            onRestore();
          }}
        >
          <Undo2 size={13} />
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
                {t(`v4.notForMe.reason.${r}`)}
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
      disabled={busy}
      style={{ ...BTN, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        setShowChips(true);
        onDismiss();
      }}
    >
      <EyeOff size={13} />
      {t('v4.notForMe.dismiss', { defaultValue: 'Not for me' })}
    </button>
  );
};
