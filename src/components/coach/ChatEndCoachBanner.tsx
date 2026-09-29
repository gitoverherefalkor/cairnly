// Shown under a finished first chat: the chat itself is closed, but the
// post-report coach (/coach) is where the conversation can continue.
// Renders nothing while the coach is switched off.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { useCoachAccess, coachUrl } from '@/hooks/useCoach';

export const ChatEndCoachBanner: React.FC<{ reportId: string }> = ({ reportId }) => {
  const { t } = useTranslation('coach');
  const navigate = useNavigate();
  const { available } = useCoachAccess(reportId);
  if (!available) return null;
  return (
    <div className="px-4 py-3 bg-atlas-teal/5 border-t border-atlas-teal/20 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex-1 text-sm text-gray-700">
        <span className="font-semibold text-atlas-navy">{t('chatEnd.title')}</span> {t('chatEnd.body')}
      </div>
      <button
        type="button"
        onClick={() => navigate(coachUrl({}))}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-atlas-teal text-white px-4 py-2 text-sm font-semibold hover:bg-atlas-teal/90"
      >
        <MessageCircle className="h-4 w-4" />
        {t('chatEnd.cta')}
      </button>
    </div>
  );
};
