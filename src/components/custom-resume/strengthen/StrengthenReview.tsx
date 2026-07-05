// One-at-a-time Strengthen review panel. Every decision (accept / edit /
// skip) is staged client-side through the reviewState reducer; nothing
// touches the résumé until "Apply my changes" sends one batch to the
// resume-strengthen edge function. Visual language: glass shell like the
// results cards, with the card being worked on in survey cream so it reads
// as "the thing in your hands".
import { useMemo, useReducer, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Undo2, X } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { initReviewState, reviewReducer, buildApplyPayload, projectedScore } from './reviewState';
import { useStrengthen } from './useStrengthen';
import type { StrengthIssue, StrengthReview } from './types';

// Survey-card cream tokens (match the builder/survey cards).
const CREAM = '#F6F0E2';
const CREAM_BORDER = '#C9B690';
const INK_ON_CREAM = '#243b30';
const SOFT_ON_CREAM = '#5E5142';
const TEAL_ON_CREAM = '#1F8282';

const truncate = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function StrengthenReview({
  customResumeId,
  review,
  onClose,
  onApplied,
}: {
  customResumeId: string;
  review: StrengthReview;
  onClose: () => void;
  onApplied: () => void;
}) {
  // keyPrefix: this file's keys live under strengthen.* in resume.json
  const { t } = useTranslation('resume', { keyPrefix: 'strengthen' });
  const [state, dispatch] = useReducer(reviewReducer, review, initReviewState);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Unsaved-draft confirm is scoped to the issue id it was raised for, so a
  // cursor change underneath it (e.g. Undo on a done row) retires the bar
  // instead of leaving it pointing at the wrong card.
  const [confirmUnsavedFor, setConfirmUnsavedFor] = useState<string | null>(null);
  // One-tap "Edit" mode: which issue is being edited + a per-card text buffer
  // (same pattern as `drafts`), so re-seeding one card's edit text can never
  // clobber another card's in-progress edit.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexts, setEditTexts] = useState<Record<string, string>>({});
  const { apply, busy, error } = useStrengthen(customResumeId);

  const byId = useMemo(() => new Map(review.issues.map((i) => [i.id, i])), [review.issues]);
  const current = state.cursor ? byId.get(state.cursor) ?? null : null;
  const doneIds = state.queue.filter((id) => state.staged[id]?.action === 'apply');
  const upNext = state.queue.filter((id) => id !== state.cursor && !state.staged[id]);
  const stagedCount = Object.values(state.staged).filter((d) => d.action === 'apply').length;
  const position = state.cursor ? state.queue.indexOf(state.cursor) + 1 : state.queue.length;
  const draft = current ? drafts[current.id] ?? '' : '';

  const handleUndo = (id: string) => {
    setConfirmUnsavedFor(null);
    // Restore the user's edited text so undoing an edited one-tap doesn't
    // silently throw their words away. needs_input drafts survive in
    // `drafts` already, so only the one-tap edit path needs re-seeding.
    // Only the undone card's buffer is written; if another card is mid-edit,
    // its text and edit focus stay untouched — the restored text simply waits
    // in editTexts until the user reaches this card.
    const staged = state.staged[id];
    const issue = byId.get(id);
    if (staged?.user_input && issue?.card_type === 'one_tap') {
      const restored = staged.user_input;
      setEditTexts((m) => ({ ...m, [id]: restored }));
      if (editingId === null) setEditingId(id);
    }
    dispatch({ type: 'undo', id });
  };

  const handleApply = async () => {
    const hasUnsavedDraft =
      current?.card_type === 'needs_input' && !!draft.trim() && !state.staged[current.id];
    if (hasUnsavedDraft && current && confirmUnsavedFor !== current.id) {
      setConfirmUnsavedFor(current.id);
      return;
    }
    setConfirmUnsavedFor(null);
    const payload = buildApplyPayload(state);
    if (payload.length === 0) {
      onClose();
      return;
    }
    const res = await apply(payload);
    if (res) {
      onApplied();
      onClose(); // row refresh arrives via Realtime; banner shows remaining wins
    }
  };

  return (
    <section style={panelStyle} aria-label={t('review.title')}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={eyebrowStyle}>{t('review.eyebrow')}</span>
          <h2 style={titleStyle}>{t('review.title')}</h2>
          <p style={introStyle}>{t('review.intro')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('review.close')} style={closeXStyle}>
          <X size={16} />
        </button>
      </div>

      {state.queue.length === 0 ? (
        // Review arrived with nothing pending — congrats row instead of cards.
        <div style={allDoneRowStyle}>
          <span style={tickCircleStyle}>
            <Check size={13} color="#fff" />
          </span>
          <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
            {t('review.allDone')}
          </span>
          <button type="button" onClick={onClose} style={ghostPillStyle}>
            {t('review.close')}
          </button>
        </div>
      ) : (
        <>
          {/* Progress row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {state.queue.map((id) => {
                const staged = state.staged[id];
                const isCurrent = id === state.cursor;
                return (
                  <span
                    key={id}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      flexShrink: 0,
                      background:
                        staged?.action === 'apply'
                          ? PALETTE.teal
                          : isCurrent
                            ? PALETTE.goldBright
                            : 'rgba(255,255,255,0.22)',
                      opacity: staged?.action === 'skip' ? 0.45 : 1,
                    }}
                  />
                );
              })}
            </div>
            <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
              {t('review.progress', { current: position, total: state.queue.length })}
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: PALETTE.tealBright }}>
              {t('review.scoreArrow', { from: projectedScore(review, state), to: review.score_potential })}
            </span>
          </div>

          {/* Done rows — staged applies, undoable until Apply fires */}
          {doneIds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {doneIds.map((id) => {
                const issue = byId.get(id);
                if (!issue) return null;
                return (
                  <div key={id} style={doneRowStyle}>
                    <span style={tickCircleStyle}>
                      <Check size={13} color="#fff" />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'rgba(255,255,255,0.80)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <strong style={{ fontWeight: 700, color: '#fff' }}>{t(`review.flag_${issue.flag}`)}</strong>
                      {' · '}
                      {truncate(issue.original_text)}
                    </span>
                    <button type="button" onClick={() => handleUndo(id)} style={undoButtonStyle}>
                      <Undo2 size={12} /> {t('review.undo')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Current card */}
          {current && (
            <div style={creamCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={flagTagStyle}>{t(`review.flag_${current.flag}`)}</span>
                <span style={typeChipStyle}>
                  {t(current.card_type === 'one_tap' ? 'review.oneTap' : 'review.needsInput')}
                </span>
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  fontWeight: 500,
                  color: SOFT_ON_CREAM,
                  textDecoration: 'line-through',
                  lineHeight: 1.5,
                  marginTop: 12,
                }}
              >
                {current.original_text}
              </div>

              {current.card_type === 'one_tap' ? (
                <OneTapBody
                  issue={current}
                  editing={editingId === current.id}
                  editText={editTexts[current.id] ?? ''}
                  onEditTextChange={(v) => setEditTexts((m) => ({ ...m, [current.id]: v }))}
                  onStartEdit={() => {
                    setEditingId(current.id);
                    // Seed from the suggestion only when this card has no
                    // buffer yet — a buffer from an earlier edit or an undo
                    // restore takes precedence.
                    setEditTexts((m) =>
                      current.id in m ? m : { ...m, [current.id]: current.suggested_text ?? '' },
                    );
                  }}
                  onAccept={() => {
                    setConfirmUnsavedFor(null);
                    dispatch({ type: 'accept', id: current.id });
                  }}
                  onSaveEdit={() => {
                    setConfirmUnsavedFor(null);
                    dispatch({ type: 'accept', id: current.id, user_input: editTexts[current.id] ?? '' });
                    setEditingId(null);
                  }}
                  onSkip={() => {
                    setConfirmUnsavedFor(null);
                    if (editingId === current.id) setEditingId(null);
                    dispatch({ type: 'skip', id: current.id });
                  }}
                />
              ) : (
                <NeedsInputBody
                  issue={current}
                  draft={draft}
                  onDraftChange={(v) => setDrafts((d) => ({ ...d, [current.id]: v }))}
                  onSave={() => {
                    setConfirmUnsavedFor(null);
                    dispatch({ type: 'accept', id: current.id, user_input: draft });
                  }}
                  onSkip={() => {
                    setConfirmUnsavedFor(null);
                    dispatch({ type: 'skip', id: current.id });
                  }}
                />
              )}
            </div>
          )}

          {/* Up-next peek */}
          {upNext.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...smallLabelStyle, color: 'rgba(255,255,255,0.45)' }}>
                {t('review.upNext', { count: upNext.length })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {upNext.map((id) => {
                  const issue = byId.get(id);
                  if (!issue) return null;
                  return (
                    <div key={id} style={upNextRowStyle}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t(`review.flag_${issue.flag}`)}
                      </span>
                      <span style={upNextTagStyle}>
                        {t(issue.card_type === 'one_tap' ? 'review.oneTap' : 'review.needsInput')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Apply error — keep staging intact so the user can just retry */}
          {error && !busy && (
            <div style={errorPillStyle} role="alert">
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Footer: unsaved-draft confirm swaps in for the Apply CTA. The
              bar only renders while the card it was raised for is still the
              current one — any cursor change retires it. */}
          {confirmUnsavedFor !== null && confirmUnsavedFor === state.cursor ? (
            <div style={confirmBarStyle}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: PALETTE.goldBright }}>
                  {t('review.unsavedTitle')}
                </div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  {t('review.unsavedBody')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={busy}
                  style={{ ...tealPillDarkStyle, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  {t('review.unsavedApply')}
                </button>
                <button type="button" onClick={() => setConfirmUnsavedFor(null)} style={ghostPillStyle}>
                  {t('review.unsavedBack')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 18 }}>
              <button
                type="button"
                onClick={handleApply}
                disabled={busy}
                style={{ ...tealPillDarkStyle, padding: '12px 20px', opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? t('review.applying') : t('review.applyCta')}
              </button>
              {stagedCount > 0 && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}>
                  {t('review.applyCount', { count: stagedCount })}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Current-card bodies ───────────────────────────────────────

const OneTapBody = ({
  issue,
  editing,
  editText,
  onEditTextChange,
  onStartEdit,
  onAccept,
  onSaveEdit,
  onSkip,
}: {
  issue: StrengthIssue;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: () => void;
  onAccept: () => void;
  onSaveEdit: () => void;
  onSkip: () => void;
}) => {
  // keyPrefix: this file's keys live under strengthen.* in resume.json
  const { t } = useTranslation('resume', { keyPrefix: 'strengthen' });
  return (
    <div style={{ marginTop: 12 }}>
      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          aria-label={t('review.edit')}
          rows={3}
          style={{ ...creamInputStyle, resize: 'vertical', minHeight: 72 }}
        />
      ) : (
        <div style={tealBoxStyle}>{issue.suggested_text}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {editing ? (
          <button type="button" onClick={onSaveEdit} disabled={!editText.trim()} style={tealPillCreamStyle(!editText.trim())}>
            {t('review.accept')}
          </button>
        ) : (
          <>
            <button type="button" onClick={onAccept} style={tealPillCreamStyle(false)}>
              {t('review.acceptSuggestion')}
            </button>
            <button type="button" onClick={onStartEdit} style={ghostPillCreamStyle}>
              {t('review.edit')}
            </button>
          </>
        )}
        <button type="button" onClick={onSkip} style={quietButtonStyle}>
          {t('review.skip')}
        </button>
      </div>
    </div>
  );
};

const NeedsInputBody = ({
  issue,
  draft,
  onDraftChange,
  onSave,
  onSkip,
}: {
  issue: StrengthIssue;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) => {
  // keyPrefix: this file's keys live under strengthen.* in resume.json
  const { t } = useTranslation('resume', { keyPrefix: 'strengthen' });
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: INK_ON_CREAM, lineHeight: 1.5 }}>
        {issue.question}
      </div>
      <div style={{ ...smallLabelStyle, color: SOFT_ON_CREAM, marginTop: 12 }}>{t('review.yourAnswer')}</div>
      <input
        type="text"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={issue.example}
        aria-label={t('review.yourAnswer')}
        style={{ ...creamInputStyle, marginTop: 6 }}
      />
      {issue.example ? (
        <button type="button" onClick={() => onDraftChange(issue.example ?? '')} style={linkButtonStyle}>
          {t('review.useExample')}
        </button>
      ) : null}
      {issue.preview_template ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...smallLabelStyle, color: TEAL_ON_CREAM }}>{t('review.yourNewLine')}</div>
          <div style={{ ...tealBoxStyle, marginTop: 6 }}>
            {issue.preview_template.replace('{answer}', draft || '…')}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" onClick={onSave} disabled={!draft.trim()} style={tealPillCreamStyle(!draft.trim())}>
          {t('review.accept')}
        </button>
        <button type="button" onClick={onSkip} style={quietButtonStyle}>
          {t('review.skip')}
        </button>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: 'rgba(18,46,59,0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18,
  padding: 20,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: PALETTE.goldBright,
};

const titleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 22,
  letterSpacing: '-0.01em',
  color: '#fff',
  margin: '8px 0 6px 0',
  lineHeight: 1.15,
};

const introStyle: CSSProperties = {
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.72)',
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 640,
};

const closeXStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9999,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.65)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const smallLabelStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
};

const tickCircleStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 9999,
  background: PALETTE.teal,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const doneRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 12px',
  borderRadius: 10,
  background: 'rgba(39,161,161,0.12)',
  border: '1px solid rgba(39,161,161,0.30)',
};

const undoButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  borderRadius: 9999,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.24)',
  color: 'rgba(255,255,255,0.80)',
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 11.5,
  cursor: 'pointer',
  flexShrink: 0,
};

const creamCardStyle: CSSProperties = {
  background: CREAM,
  border: `1px solid ${CREAM_BORDER}`,
  borderRadius: 14,
  padding: 18,
  marginTop: 14,
};

const flagTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 9999,
  background: 'rgba(212,160,36,0.16)',
  border: '1px solid rgba(212,160,36,0.45)',
  color: PALETTE.gold,
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const typeChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 9999,
  background: 'rgba(39,161,161,0.12)',
  border: '1px solid rgba(39,161,161,0.40)',
  color: TEAL_ON_CREAM,
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const tealBoxStyle: CSSProperties = {
  background: 'rgba(39,161,161,0.10)',
  border: '1px solid rgba(39,161,161,0.34)',
  borderRadius: 10,
  padding: '10px 12px',
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  fontWeight: 500,
  color: INK_ON_CREAM,
  lineHeight: 1.5,
};

const creamInputStyle: CSSProperties = {
  width: '100%',
  background: '#fff',
  border: `1px solid ${CREAM_BORDER}`,
  borderRadius: 9,
  padding: '10px 12px',
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  fontWeight: 500,
  color: INK_ON_CREAM,
  outline: 'none',
  boxSizing: 'border-box',
};

const linkButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '6px 0 0 0',
  color: TEAL_ON_CREAM,
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 12.5,
  textDecoration: 'underline',
  cursor: 'pointer',
};

const tealPillCreamStyle = (disabled: boolean): CSSProperties => ({
  background: PALETTE.teal,
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 9999,
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

const ghostPillCreamStyle: CSSProperties = {
  background: 'transparent',
  color: INK_ON_CREAM,
  border: `1px solid ${CREAM_BORDER}`,
  padding: '10px 18px',
  borderRadius: 9999,
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const quietButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '10px 6px',
  color: SOFT_ON_CREAM,
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 12.5,
  cursor: 'pointer',
  marginLeft: 'auto',
};

const upNextRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '7px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  fontFamily: FONT_BODY,
  fontSize: 12.5,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.55)',
};

const upNextTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 9px',
  borderRadius: 9999,
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'rgba(255,255,255,0.45)',
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: 9.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const errorPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 9999,
  background: 'rgba(239,68,68,0.18)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.42)',
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 12.5,
  marginTop: 14,
};

const confirmBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(212,160,36,0.14)',
  border: '1px solid rgba(212,160,36,0.42)',
  marginTop: 18,
};

const tealPillDarkStyle: CSSProperties = {
  background: PALETTE.teal,
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 9999,
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const ghostPillStyle: CSSProperties = {
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.24)',
  padding: '10px 18px',
  borderRadius: 9999,
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const allDoneRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(39,161,161,0.12)',
  border: '1px solid rgba(39,161,161,0.30)',
  marginTop: 18,
};
