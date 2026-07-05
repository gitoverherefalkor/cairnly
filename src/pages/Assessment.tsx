
import React from 'react';
import { SurveyForm } from '@/components/survey/SurveyForm';
import { AssessmentWelcome } from '@/components/survey/AssessmentWelcome';
import { AssessmentLayout } from '@/components/assessment/AssessmentLayout';
import { AssessmentCompletion } from '@/components/assessment/AssessmentCompletion';
import { PreSurveyUpload } from '@/components/assessment/PreSurveyUpload';
import { useAssessmentLogic } from '@/components/assessment/useAssessmentLogic';
import { STARTER_SURVEY_ID } from '@/components/assessment/constants';
import { AssessmentSessionProvider } from '@/components/assessment/AssessmentSessionContext';
import { useProfile } from '@/hooks/useProfile';

const AssessmentPage = () => {
  const {
    isCompleted,
    isVerified,
    showPreSurveyUpload,
    sessionToken,
    accessCodeData,
    authLoading,
    isRecovering,
    user,
    getSurveyIdFromAccessCode,
    handleAccessCodeVerified,
    handlePreSurveyUploadComplete,
    handleSurveyComplete,
    handleExitAssessment,
  } = useAssessmentLogic();

  const { profile, isLoading: profileLoading } = useProfile();

  // PreSurveyUpload is the optional CV upload screen between access-code
  // verification and the actual survey. We consider it "complete" if either:
  // - localStorage flag is set (user previously uploaded or explicitly skipped
  //   on this device), OR
  // - profile.resume_uploaded_at is set in the DB (user uploaded a CV at any
  //   point, on any device — no need to prompt again).
  // This prevents the upload screen popping back up for returning users on
  // fresh devices when they've already uploaded a CV.
  const hasResumeOnServer = !!profile?.resume_uploaded_at;
  const preSurveyUploadComplete =
    localStorage.getItem('pre_survey_upload_complete') === 'true' || hasResumeOnServer;

  // Show loading while checking auth or profile, or while recovering a
  // logged-in user's access code from the database — otherwise the
  // access-code entry screen would flash before recovery completes.
  if (authLoading || profileLoading || isRecovering) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-atlas-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Authentication required. Please sign in.</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return <AssessmentCompletion />;
  }

  if (!isVerified || !sessionToken) {
    return (
      <AssessmentWelcome 
        onVerified={handleAccessCodeVerified}
      />
    );
  }

  const surveyId = getSurveyIdFromAccessCode(accessCodeData);

  // Starter flavor: skip the CV upload step. The audience mostly has no CV yet,
  // and the resume pre-fill mapper only knows the pro survey's question ids.
  const isStarter = surveyId === STARTER_SURVEY_ID;

  // Always show pre-survey upload step after verification, unless explicitly completed
  if (!isStarter && !preSurveyUploadComplete) {
    return <PreSurveyUpload onContinue={handlePreSurveyUploadComplete} />;
  }

  if (!surveyId) {
    console.error('No survey ID found');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: No survey found. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <AssessmentLayout onExit={handleExitAssessment}>
      <SurveyForm
        surveyId={surveyId}
        onComplete={handleSurveyComplete}
        accessCodeData={accessCodeData}
      />
    </AssessmentLayout>
  );
};

const Assessment = () => (
  <AssessmentSessionProvider>
    <AssessmentPage />
  </AssessmentSessionProvider>
);

export default Assessment;
