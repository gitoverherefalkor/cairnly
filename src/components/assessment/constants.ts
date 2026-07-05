
// Survey type mapping
export const SURVEY_TYPE_MAPPING: Record<string, string> = {
  'Office / Business Pro - 2025 v1 EN': '00000000-0000-0000-0000-000000000001',
  'Starter - First Serious Job - 2026 v1 EN': '00000000-0000-0000-0000-000000000002',
};

// Starter flavor (cairnly.io/starter): first/second-job seekers. Starter access
// codes carry the survey_type above; this id gates flavor-specific behavior
// (e.g. skipping the CV upload step, routing to the starter n8n chain).
export const STARTER_SURVEY_ID = '00000000-0000-0000-0000-000000000002';
export const STARTER_SURVEY_TYPE = 'Starter - First Serious Job - 2026 v1 EN';

export const getSurveyIdFromAccessCode = (accessCodeData: any): string => {
  if (!accessCodeData) {
    console.error('No access code data provided to getSurveyIdFromAccessCode');
    return SURVEY_TYPE_MAPPING['Office / Business Pro - 2025 v1 EN'];
  }

  const surveyType = accessCodeData?.survey_type || 'Office / Business Pro - 2025 v1 EN';
  const surveyId = SURVEY_TYPE_MAPPING[surveyType] || SURVEY_TYPE_MAPPING['Office / Business Pro - 2025 v1 EN'];
  return surveyId;
};
