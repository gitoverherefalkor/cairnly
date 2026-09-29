// Dashboard entry points into the post-report coach (/coach). They render
// nothing outside a CoachLinkProvider (see coachLinkContext.tsx), so the
// dashboard looks exactly as before while the coach is switched off.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, MessageCircle, Route as RouteIcon } from 'lucide-react';
import { coachUrl, useCoachNextSteps, type CoachAccess } from '@/hooks/useCoach';
import { useCoachLinks } from './coachLinkContext';
import { PALETTE, FONT_BODY, FONT_DISPLAY } from '@/components/dashboard/v2/dashboardV2Shared';

/** Small text links under a career in the report accordion. */
export const CoachAskLinks: React.FC<{ careerTitle: string | null; dismissed: boolean }> = ({
  careerTitle,
  dismissed,
}) => {
  const links = useCoachLinks();
  const { t } = useTranslation('coach');
  if (!links || !careerTitle) return null;
  return (
    <button
      type="button"
      onClick={() => (dismissed ? links.askSetAside(careerTitle) : links.askCareer(careerTitle))}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 600,
        color: PALETTE.tealBright,
      }}
    >
      <MessageCircle size={14} />
      {dismissed ? t('links.askSetAside') : t('links.askCareer')}
    </button>
  );
};

/** "Your coach" card on the dashboard: next steps, budget, and the way in. */
export const CoachCard: React.FC<{ reportId: string; access: CoachAccess }> = ({ reportId, access }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('coach');
  const { openSteps, setStatus } = useCoachNextSteps(reportId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section
      style={{
        marginBottom: 32,
        borderRadius: 16,
        padding: 24,
        background: 'rgba(18,46,59,0.55)',
        border: `1px solid ${PALETTE.teal}55`,
        color: PALETTE.cream,
      }}
    >
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: PALETTE.tealBright }}>
        {t('card.eyebrow')}
      </div>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, margin: '6px 0 8px', color: PALETTE.creamLight }}>
        {t('card.title')}
      </h3>
      <p style={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, margin: 0, color: 'rgba(236,228,210,0.8)', maxWidth: 640 }}>
        {t('card.body')}
      </p>

      {openSteps.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {openSteps.map((s) => {
            const due = s.check_in_at <= today;
            return (
              <li key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: FONT_BODY, fontSize: 13.5 }}>
                <RouteIcon size={15} color={PALETTE.tealBright} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: PALETTE.creamLight }}>{s.step}</div>
                  <div style={{ fontSize: 12, color: due ? PALETTE.goldBright : 'rgba(236,228,210,0.55)', marginTop: 2 }}>
                    {due
                      ? t('card.checkinDue')
                      : t('steps.checkin', {
                          date: new Date(s.check_in_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
                        })}
                  </div>
                </div>
                {due && (
                  <button
                    type="button"
                    onClick={() => navigate(coachUrl({ entry: 'checkin', context: s.step }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.goldBright, fontSize: 12.5, fontWeight: 600 }}
                  >
                    {t('card.cta')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatus({ id: s.id, status: 'done' })}
                  title={t('steps.done')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(236,228,210,0.6)', padding: 0 }}
                >
                  <CheckCircle2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => navigate(coachUrl({}))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 9999,
            border: 'none',
            cursor: 'pointer',
            background: PALETTE.teal,
            color: '#fff',
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t('card.cta')}
          <ArrowRight size={15} />
        </button>
        <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: 'rgba(236,228,210,0.6)' }}>
          {t('card.left', { remaining: access.remaining, limit: access.limit })}
        </span>
      </div>
    </section>
  );
};
