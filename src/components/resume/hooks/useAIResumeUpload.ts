
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mapExtractedDataToSurvey } from '../utils/resumeDataMapper';

// Resume extraction is proxied through a Supabase Edge Function
// (eliminates CORS issues and hides the n8n webhook URL from the client)

// Question 4d ("topics or fields you know far more about than most people")
// is an interests-style question a CV can't reliably answer — the n8n parser
// tends to just echo the skills list into it. Never pre-fill it from a resume.
const SKIP_PREFILL_QUESTION_IDS = new Set([
  '44444444-4444-4444-4444-444444444444',
]);

interface UseAIResumeUploadProps {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export const useAIResumeUpload = ({ onSuccess, onError }: UseAIResumeUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  // Holds a user-facing message when processing fails, so the UI can render an
  // explicit "try again" state instead of a spinner that never resolves.
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const uploadAndProcess = async (file: File) => {
    if (!user) {
      onError?.('User not authenticated');
      return;
    }

    setError(null);
    setIsUploading(true);
    setIsProcessing(true);

    try {
      // Step 1: Upload file to Supabase Storage
      console.log('[ResumeUpload] Uploading file to Supabase Storage...');
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[ResumeUpload] Storage upload failed:', uploadError);
        throw new Error('Failed to upload file. Please try again.');
      }

      console.log('[ResumeUpload] File uploaded:', uploadData.path);

      // NOTE: resume_uploaded_at is intentionally NOT stamped here. It used to be
      // set right after the file landed in storage — but that meant a failed parse
      // (e.g. a .docx the n8n parser can't read) still flipped the durable "resume
      // done" flag, skipping the user past the upload step with zero pre-fill data.
      // We now stamp it only after parsing actually succeeds (see below).

      // Step 2: Get a signed URL (expires in 5 minutes — enough for n8n to download)
      const { data: urlData, error: signError } = await supabase.storage
        .from('resumes')
        .createSignedUrl(filePath, 300);

      if (signError || !urlData?.signedUrl) {
        console.error('[ResumeUpload] Failed to create signed URL:', signError);
        throw new Error('Failed to prepare file for processing. Please try again.');
      }

      const fileUrl = urlData.signedUrl;
      console.log('[ResumeUpload] Signed URL created (expires in 5 min)');

      setIsUploading(false);
      // Still processing (AI extraction happening in n8n)

      // Step 3: Call edge function proxy (which forwards to n8n server-side — no CORS issues)
      console.log('[ResumeUpload] Calling edge function for AI extraction...');
      const { data: n8nResult, error: fnError } = await supabase.functions.invoke('forward-resume-to-n8n', {
        body: { file_url: fileUrl, user_id: user.id }
      });

      if (fnError) {
        console.error('[ResumeUpload] Edge function error:', fnError);
        throw new Error('Resume processing failed. Please try again.');
      }

      console.log('[ResumeUpload] Edge function response:', n8nResult);

      // Step 4: Extract survey data from n8n response
      // The webhook returns: {success, message, data: {resume_parsed_data: {uuid: {value: ...}}}}
      // Or sometimes arrays/direct formats — handle all cases
      let payload = n8nResult;

      // Unwrap arrays if present
      while (Array.isArray(payload)) {
        payload = payload[0];
      }

      // Unwrap {data: ...} wrapper from Respond to Webhook node
      if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        payload = payload.data;
      }

      // Unwrap arrays inside data too
      while (Array.isArray(payload)) {
        payload = payload[0];
      }

      console.log('[ResumeUpload] Final payload keys:', Object.keys(payload || {}));

      let surveyPreFillData: Record<string, any>;

      if (payload?.parsed_raw) {
        // Option A: parsed_raw exists — use frontend mapper
        console.log('[ResumeUpload] Using parsed_raw with frontend mapper');
        surveyPreFillData = mapExtractedDataToSurvey(payload.parsed_raw);
      } else if (payload?.resume_parsed_data) {
        // Option B: n8n already mapped to UUIDs — unwrap {value: ...} wrappers
        console.log('[ResumeUpload] Using pre-mapped resume_parsed_data from n8n');
        surveyPreFillData = {};
        for (const [questionId, wrapper] of Object.entries(payload.resume_parsed_data)) {
          if (SKIP_PREFILL_QUESTION_IDS.has(questionId)) continue;
          surveyPreFillData[questionId] = (wrapper as any)?.value ?? wrapper;
        }
      } else {
        console.error('[ResumeUpload] No parsed_raw or resume_parsed_data found. Keys:', Object.keys(payload || {}));
        throw new Error('Resume processing returned unexpected data format.');
      }

      const result = {
        success: true,
        aiParsedData: surveyPreFillData,
        surveyPreFillData: surveyPreFillData,
        fieldsExtracted: Object.keys(surveyPreFillData).length,
        rawData: payload?.parsed_raw || payload
      };

      // Parsing succeeded — NOW stamp the durable "resume done" signal that the
      // dashboard and pre-survey upload gate read. Stamping here (not on file
      // upload) means a failed parse leaves the user on the upload step so they
      // can retry, instead of being skipped past it with no pre-fill data.
      // Also clear the raw resume text (data minimisation); the structured
      // resume_parsed_data is kept for survey pre-fill.
      await supabase
        .from('profiles')
        .update({
          resume_uploaded_at: new Date().toISOString(),
          resume_data: null,
        } as any)
        .eq('id', user.id);

      setProcessingResult(result);
      setHasProcessed(true);
      onSuccess?.(result);

    } catch (err: any) {
      console.error('[ResumeUpload] Error processing resume:', err);
      const message = err?.message || 'Failed to process resume';
      setError(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setHasProcessed(false);
    setProcessingResult(null);
    setError(null);
  };

  return {
    isUploading,
    isProcessing,
    hasProcessed,
    setHasProcessed,
    processingResult,
    error,
    uploadAndProcess,
    resetState
  };
};
