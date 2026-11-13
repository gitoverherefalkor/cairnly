
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getSurveyIdFromAccessCode } from '../constants';

export const useSurveyCompletion = () => {
  const [isCompleted, setIsCompleted] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation('survey');

  const handleSurveyComplete = async (
    responses: Record<string, any>,
    accessCodeData: any,
    onSessionClear: () => void
  ) => {
    if (!accessCodeData || !user) {
      console.error('Missing required data for survey completion:', { accessCodeData, user });
      toast({
        title: t('submitToast.errorTitle'),
        description: t('submitToast.missingData'),
        variant: "destructive",
      });
      return;
    }

    const surveyId = getSurveyIdFromAccessCode(accessCodeData);

    try {
      // Call forward-to-n8n edge function which creates the report and triggers n8n workflow
      const { data, error: edgeFunctionError } = await supabase.functions.invoke('forward-to-n8n', {
        body: {
          user_id: user.id,
          user_email: user.email,
          payload: {
            responses,
            accessCode: accessCodeData?.code,
            completedAt: new Date().toISOString(),
            surveyType: accessCodeData?.survey_type,
            access_code_id: accessCodeData?.id,
            survey_id: surveyId,
          }
        }
      });

      if (edgeFunctionError) {
        console.error('Error calling forward-to-n8n:', edgeFunctionError);
        throw edgeFunctionError;
      }

      // usage_count increment is owned by useSurveySubmission.markAccessCodeAsUsed
      // (atomic via consume_access_code RPC). Don't re-increment here.

      onSessionClear();
      
      toast({
        title: t('submitToast.completeTitle'),
        description: t('submitToast.completeDescription'),
      });
      
      setIsCompleted(true);
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: t('submitToast.warningTitle'),
        description: t('submitToast.savedButReportFailed'),
        variant: "destructive",
      });
      setIsCompleted(true); // Still mark as completed even if report save failed
    }
  };

  return {
    isCompleted,
    handleSurveyComplete,
    setIsCompleted
  };
};
