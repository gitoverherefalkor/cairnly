import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Fire-and-forget engagement tracking for the reminder email system.
 * All calls are non-blocking — errors are logged but never disrupt the UI.
 */
export function useEngagementTracking() {
  const { user } = useAuth();

  const upsert = useCallback(
    (fields: Record<string, unknown>) => {
      if (!user?.id) return;

      // Fire-and-forget — don't await
      supabase
        .from('user_engagement_tracking' as any)
        .upsert(
          { user_id: user.id, ...fields, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.warn('[engagement-tracking] upsert failed:', error.message);
        });
    },
    [user?.id]
  );

  /** Called when the user answers their first survey question */
  const trackSurveyStart = useCallback(() => {
    const now = new Date().toISOString();
    upsert({
      survey_started_at: now,
      survey_last_activity_at: now,
    });
  }, [upsert]);

  /** Called on survey section changes */
  const trackSurveyProgress = useCallback(
    (sectionIndex: number, totalSections: number) => {
      upsert({
        survey_last_activity_at: new Date().toISOString(),
        survey_last_section: sectionIndex,
        survey_total_sections: totalSections,
      });
    },
    [upsert]
  );

  /**
   * Stores question-level survey progress so the reminder email can show the
   * SAME number as the dashboard. `progress` is the SurveyProgress object from
   * computeSurveyProgress (questionsAnswered / totalQuestions / sectionsComplete
   * / totalSections). Fire-and-forget, debounced by the caller.
   */
  const trackSurveyQuestionProgress = useCallback(
    (progress: Record<string, number>) => {
      upsert({
        survey_last_activity_at: new Date().toISOString(),
        survey_progress: progress,
      });
    },
    [upsert]
  );

  /** Called when the survey is submitted */
  const trackSurveyComplete = useCallback(() => {
    upsert({
      survey_completed_at: new Date().toISOString(),
      survey_last_activity_at: new Date().toISOString(),
    });
  }, [upsert]);

  /** Called when the user starts or resumes a chat session */
  const trackChatStart = useCallback(() => {
    const now = new Date().toISOString();
    upsert({
      chat_started_at: now,
      chat_last_activity_at: now,
    });
  }, [upsert]);

  /** Called when a new section is detected in chat messages */
  const trackChatActivity = useCallback(
    (sectionIndex: number) => {
      upsert({
        chat_last_activity_at: new Date().toISOString(),
        chat_last_section_index: sectionIndex,
      });
    },
    [upsert]
  );

  /** Called when the chat session is completed (ClosingCard shown) */
  const trackChatComplete = useCallback(() => {
    upsert({
      chat_completed_at: new Date().toISOString(),
      chat_last_activity_at: new Date().toISOString(),
      // Force section index to max — even if counter detection missed sections,
      // the completion marker is authoritative (all 11 sections were covered)
      chat_last_section_index: 10,
    });
  }, [upsert]);

  /** Called when a user who has completed chat visits the dashboard */
  const trackDashboardVisit = useCallback(() => {
    upsert({
      dashboard_visited_after_chat_at: new Date().toISOString(),
    });
  }, [upsert]);

  return {
    trackSurveyStart,
    trackSurveyProgress,
    trackSurveyQuestionProgress,
    trackSurveyComplete,
    trackChatStart,
    trackChatActivity,
    trackChatComplete,
    trackDashboardVisit,
  };
}
