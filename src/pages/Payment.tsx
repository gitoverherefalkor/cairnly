import { useEffect, useState } from 'react';
import { CheckoutForm } from '../components/CheckoutForm';
import { useSurvey } from '../hooks/useSurvey';
import { getSurveyIdFromAccessCode, SURVEY_TYPE_MAPPING } from '../components/assessment/constants';
import AuthShell from '@/components/auth/AuthShell';
import AuthNavigation from '@/components/auth/AuthNavigation';

export default function Payment() {
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
      eyebrow="Step 1 of 2 · Checkout"
      title="You're making a smart move."
      subtitle="A small investment of time and money for real clarity on where your career can go next."
      width="xwide"
      footer={<AuthNavigation />}
    >
      <CheckoutForm />
    </AuthShell>
  );
}
