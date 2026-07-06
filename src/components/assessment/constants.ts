
// Survey type mapping
export const SURVEY_TYPE_MAPPING: Record<string, string> = {
  'Office / Business Pro - 2025 v1 EN': '00000000-0000-0000-0000-000000000001',
  'Starter - First Serious Job - 2026 v1 EN': '00000000-0000-0000-0000-000000000002',
  'Encore - Post-Career Direction - 2026 v1 EN': '00000000-0000-0000-0000-000000000003',
};

// Starter flavor (cairnly.io/starter): first/second-job seekers. Starter access
// codes carry the survey_type above; this id gates flavor-specific behavior
// (e.g. skipping the CV upload step, routing to the starter n8n chain).
export const STARTER_SURVEY_ID = '00000000-0000-0000-0000-000000000002';
export const STARTER_SURVEY_TYPE = 'Starter - First Serious Job - 2026 v1 EN';

// Encore flavor (cairnly.io/encore): pensioners / pre-retirees. Keeps the CV
// upload step (their careers are the evidence) but pre-fill is translated to
// encore question ids; routing goes to the encore n8n chain.
export const ENCORE_SURVEY_ID = '00000000-0000-0000-0000-000000000003';
export const ENCORE_SURVEY_TYPE = 'Encore - Post-Career Direction - 2026 v1 EN';

// Convenience: resolve a survey id to its flavor for flavor-aware UI branches.
export type SurveyFlavor = 'pro' | 'starter' | 'encore';
export const getFlavorFromSurveyId = (surveyId: string | null | undefined): SurveyFlavor => {
  if (surveyId === STARTER_SURVEY_ID) return 'starter';
  if (surveyId === ENCORE_SURVEY_ID) return 'encore';
  return 'pro';
};

export const getSurveyIdFromAccessCode = (accessCodeData: any): string => {
  if (!accessCodeData) {
    console.error('No access code data provided to getSurveyIdFromAccessCode');
    return SURVEY_TYPE_MAPPING['Office / Business Pro - 2025 v1 EN'];
  }

  const surveyType = accessCodeData?.survey_type || 'Office / Business Pro - 2025 v1 EN';
  const surveyId = SURVEY_TYPE_MAPPING[surveyType] || SURVEY_TYPE_MAPPING['Office / Business Pro - 2025 v1 EN'];
  return surveyId;
};
