/**
 * Single source of truth for "is this question hidden right now?".
 * Used by the live survey (useSurveyState) and the dashboard progress
 * calculation (surveyProgress), so both count the same questions.
 *
 * A question is hidden when:
 *  1. it is a legacy license / access-code question, or
 *  2. its config has a `show_if` rule that the given answers don't meet.
 *     Example (Encore 5.2, partner's hopes):
 *       show_if: { question_id: "<5.1 id>", not_in: ["I don't have a partner"] }
 *     `in` works the other way round: show only when one of those is picked.
 *     Answer values are the stored (English) choice values.
 */
const LICENSE_KEY_INDICATORS = ['license', 'access code', 'verification code', 'license key'];

type ShowIfRule = { question_id?: string; in?: string[]; not_in?: string[] };

export function isQuestionSkipped(
  question: { label?: string; config?: any },
  answers: Record<string, any> | null | undefined,
): boolean {
  const text = question?.label?.toLowerCase() || '';
  if (LICENSE_KEY_INDICATORS.some((indicator) => text.includes(indicator))) return true;

  const rule: ShowIfRule | undefined = question?.config?.show_if;
  if (!rule?.question_id) return false;

  const raw = answers?.[rule.question_id];
  const picked: string[] = Array.isArray(raw)
    ? raw.map(String)
    : raw != null && raw !== ''
      ? [String(raw)]
      : [];
  if (Array.isArray(rule.not_in) && picked.some((v) => rule.not_in!.includes(v))) return true;
  if (Array.isArray(rule.in) && !picked.some((v) => rule.in!.includes(v))) return true;
  return false;
}
