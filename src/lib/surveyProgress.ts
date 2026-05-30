import { isQuestionAnswered } from '@/components/survey/questionValidation';

// License / access-code questions are not part of the answerable survey and
// must not count toward progress. Mirror of the skip filter in
// useSurveyState.shouldSkipQuestion — keep the two in sync.
const LICENSE_KEY_INDICATORS = ['license', 'access code', 'verification code', 'license key'];

function shouldSkipQuestion(question: { label?: string }): boolean {
  const text = question?.label?.toLowerCase() || '';
  return LICENSE_KEY_INDICATORS.some((indicator) => text.includes(indicator));
}

export interface SurveyProgress {
  questionsAnswered: number;
  totalQuestions: number;
  sectionsComplete: number;
  totalSections: number;
}

type MinimalSurvey = { sections: Array<{ questions: any[] }> };

/**
 * Compute assessment progress from a draft answer payload + the survey
 * structure, using the EXACT same "answered" / "section complete" rules as the
 * live survey (useSurveyState.applyFromDb): a question counts via
 * isQuestionAnswered, and a section is complete only when every non-skipped
 * question in it is answered.
 *
 * Returns null when we don't yet have both the survey and the responses, so
 * callers can fall back to a coarser estimate.
 */
export function computeSurveyProgress(
  survey: MinimalSurvey | null | undefined,
  responses: Record<string, any> | null | undefined,
): SurveyProgress | null {
  if (!survey?.sections?.length || !responses) return null;

  let totalQuestions = 0;
  let questionsAnswered = 0;
  let sectionsComplete = 0;

  for (const section of survey.sections) {
    const questions = (section.questions || []).filter((q: any) => !shouldSkipQuestion(q));
    // An empty section can't be "complete" in a meaningful sense.
    let sectionAllAnswered = questions.length > 0;
    for (const q of questions) {
      totalQuestions++;
      if (isQuestionAnswered(q, responses[q.id])) {
        questionsAnswered++;
      } else {
        sectionAllAnswered = false;
      }
    }
    if (sectionAllAnswered) sectionsComplete++;
  }

  return { questionsAnswered, totalQuestions, sectionsComplete, totalSections: survey.sections.length };
}
