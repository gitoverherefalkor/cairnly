import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckoutForm } from '../components/CheckoutForm';
import { useSurvey } from '../hooks/useSurvey';
import { getSurveyIdFromAccessCode, SURVEY_TYPE_MAPPING } from '../components/assessment/constants';
import AuthShell from '@/components/auth/AuthShell';
import AuthNavigation from '@/components/auth/AuthNavigation';

export default function Payment() {
  const { t } = useTranslation('payment');
  // Try to get accessCodeData from assessment session
  const defaultSurveyId = SURVEY_TYPE_MAPPING['Office / Business Pro - 2025 v1 EN'];
  const [accessCodeData, setAccessCodeData] = useState<any>(null);
  const [surveyId, setSurveyId] = useState<string>(defaultSurveyId);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('assessment_session');
      if (stored) {
        const session = JSON.parse(stored);
        if (session?.accessCodeData) {
          setAccessCodeData(session.accessCodeData);
          setSurveyId(getSurveyIdFromAccessCode(session.accessCodeData));
        }
      }
    } catch {}
  }, []);

  // useSurvey is kept so future copy can reference it; current shell title is static.
  useSurvey(surveyId);

  return (
    <AuthShell
      eyebrow={t('shell.eyebrow')}
      title={t('shell.title')}
      subtitle={t('shell.subtitle')}
      width="xwide"
      footer={<AuthNavigation />}
    >
      <CheckoutForm />
    </AuthShell>
  );
}
