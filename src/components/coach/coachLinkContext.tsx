// Link context for the post-report coach. Kept free of dashboard imports so
// the shared dashboard pills (MovePill) can read it without an import cycle.
//
// CoachLinkProvider is mounted by DashboardV4 only when the coach is
// available (kill switch on, first chat finished, not the read-only demo).
// Consumers render their old, non-clickable form when there is no provider.

import React, { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildFeasibilityQuestion } from '@/lib/moveScale';
import { coachUrl } from '@/lib/coachUrl';

interface CoachLinks {
  /** One click on a Move pill: sends the feasibility question for that career. */
  askMove: (careerTitle: string, moveLevel: string | null) => void;
  /** Opens the coach with an editable draft about a career. */
  askCareer: (careerTitle: string) => void;
  /** Opens the coach after a "Not for me", with an editable draft. */
  askSetAside: (careerTitle: string) => void;
}

const CoachLinkContext = createContext<CoachLinks | null>(null);

export const useCoachLinks = () => useContext(CoachLinkContext);

export const CoachLinkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('coach');
  const value: CoachLinks = {
    askMove: (title, level) =>
      navigate(coachUrl({ entry: 'move', context: title, ask: buildFeasibilityQuestion(title, level, i18n.language) })),
    askCareer: (title) =>
      navigate(coachUrl({ entry: 'career', context: title, draft: t('links.draftCareer', { title }) })),
    askSetAside: (title) =>
      navigate(coachUrl({ entry: 'set_aside', context: title, draft: t('links.draftSetAside', { title }) })),
  };
  return <CoachLinkContext.Provider value={value}>{children}</CoachLinkContext.Provider>;
};

