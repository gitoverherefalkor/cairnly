import { useEffect, useRef } from 'react';
import { translatePreFillForSurvey } from '@/components/resume/utils/resumeDataMapper';
import { mergePrefillSources } from '@/components/survey/utils/mergePrefillSources';

interface UseAIResumePreFillProps {
  isSessionLoaded: boolean;
  responses: Record<string, any>;
  setResponses: (responses: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  surveyId: string;
}

export const useAIResumePreFill = ({
  isSessionLoaded,
  responses,
  setResponses,
  surveyId
}: UseAIResumePreFillProps) => {
  const hasAttemptedPreFill = useRef(false);

  useEffect(() => {
    // Only run once when session is loaded and we haven't attempted prefill yet
    if (!isSessionLoaded || hasAttemptedPreFill.current) {
      return;
    }

    // Check if we have any existing responses (except empty objects)
    const existingResponseKeys = Object.keys(responses).filter(key =>
      responses[key] !== undefined &&
      responses[key] !== null &&
      responses[key] !== ''
    );
    if (existingResponseKeys.length > 0) {
      hasAttemptedPreFill.current = true;
      return;
    }

    // Pre-fill has two independent sources:
    // - resume_parsed_data (resume upload; session first, localStorage fallback)
    // - intake_prefill_data (landing-page intake chat; localStorage only)
    const readJson = (raw: string | null, label: string): Record<string, any> | null => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error(`[Pre-fill] Failed to parse ${label} data:`, e);
        return null;
      }
    };
    const resumeData =
      readJson(sessionStorage.getItem('resume_parsed_data'), 'sessionStorage resume') ??
      readJson(localStorage.getItem('resume_parsed_data'), 'localStorage resume');
    const intakeData = readJson(localStorage.getItem('intake_prefill_data'), 'intake chat');
    if (!resumeData && !intakeData) {
      hasAttemptedPreFill.current = true;
      return;
    }
    // Each source might be in either format:
    // 1. Direct UUID mapping: { "11111111-1111-1111-1111-111111111112": "Sjoerd Geurts" }
    // 2. Field name mapping: { "name": "Sjoerd Geurts" }
    // Normalize both to UUID keys, then merge (resume wins per key).
    const toUuidKeys = (parsedData: Record<string, any>): Record<string, any> => {
      let preFillResponses: Record<string, any> = {};
      const hasUUIDs = Object.keys(parsedData).some(key =>
        key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      );
      if (hasUUIDs) {
        // Data is already mapped to question IDs, use directly
        preFillResponses = { ...parsedData };
      } else {
      // Data needs to be mapped from field names to question IDs
      // Based on your survey question IDs from the logs:
      const fieldToQuestionIdMap: Record<string, string> = {
        // Personal Information
        'name': '11111111-1111-1111-1111-11111111111a',
        'full_name': '11111111-1111-1111-1111-11111111111a',
        'pronoun': '11111111-1111-1111-1111-11111111111b',
        'age': '11111111-1111-1111-1111-111111111113',
        // Location
        'region': '11111111-1111-1111-1111-111111111114',
        'location': '11111111-1111-1111-1111-111111111114',
        // Goals
        'goals': '11111111-1111-1111-1111-111111111115',
        'primary_goals': '11111111-1111-1111-1111-111111111115',
        // Education
        'education': '11111111-1111-1111-1111-111111111116',
        'education_level': '11111111-1111-1111-1111-111111111116',
        'study_subject': '11111111-1111-1111-1111-111111111117',
        'major': '11111111-1111-1111-1111-111111111117',
        // Experience
        'years_experience': '11111111-1111-1111-1111-111111111118',
        'professional_experience': '11111111-1111-1111-1111-111111111118',
        // Career
        'career_situation': '11111111-1111-1111-1111-111111111119',
        'job_title': '11111111-1111-1111-1111-111111111110',
        'current_role': '11111111-1111-1111-1111-111111111110',
        // Company
        'role_happiness': '11111111-1111-1111-1111-11111111111d',
        // Industry & Skills
        'achievement': '11111111-1111-1111-1111-11111111111f',
        'interests': '11111111-1111-1111-1111-111111111120',
        'hobbies': '11111111-1111-1111-1111-111111111120',
      };
      // Map the fields to question IDs
      Object.entries(parsedData).forEach(([fieldName, value]) => {
        const questionId = fieldToQuestionIdMap[fieldName];
        if (questionId && value !== undefined && value !== null && value !== '') {
          preFillResponses[questionId] = value;
        }
      });
      }
      return preFillResponses;
    };
    let preFillResponses: Record<string, any> =
      mergePrefillSources(
        resumeData ? toUuidKeys(resumeData) : null,
        intakeData ? toUuidKeys(intakeData) : null,
      ) ?? {};
    // Handle special transformations
    Object.entries(preFillResponses).forEach(([questionId, value]) => {
      // Convert years of experience to number if needed
      if (questionId === '11111111-1111-1111-1111-111111111118' && typeof value === 'string') {
        const years = parseInt(value, 10);
        if (!isNaN(years)) {
          preFillResponses[questionId] = years;
        }
      }
      // Handle array fields (convert to string if needed)
      // EXCEPT for career_history which needs to stay as an array of objects
      // EXCEPT for skills_achievements which needs to stay as an object
      // EXCEPT for interests_hobbies which needs to stay as an object
      // EXCEPT for the multi-select choice questions the intake chat
      // pre-fills (primary goals, obstacles, short/long-term goals), whose
      // answers are arrays of choice strings
      if (Array.isArray(value) &&
          questionId !== '11111111-1111-1111-1111-111111111110' &&
          questionId !== '11111111-1111-1111-1111-11111111111f' &&
          questionId !== '11111111-1111-1111-1111-111111111120' &&
          questionId !== '11111111-1111-1111-1111-111111111115' &&
          questionId !== '77777777-7777-7777-7777-777777777773' &&
          questionId !== '77777777-7777-7777-7777-777777777771' &&
          questionId !== '77777777-7777-7777-7777-777777777772') {
        preFillResponses[questionId] = value.join(', ');
      }
      // skills_achievements (11111111-1111-1111-1111-11111111111f) should stay as object
      // with topSkills, certifications, and achievements properties
      // interests_hobbies (11111111-1111-1111-1111-111111111120) should stay as object
      // with interests array property
    });
    // The extraction pipeline keys everything by PRO question ids. If this
    // survey is a different flavor that keeps the CV step (encore), remap the
    // keys to that survey's question ids; unmapped questions are dropped.
    preFillResponses = translatePreFillForSurvey(surveyId, preFillResponses);
    // Update the responses with the pre-filled data
    if (Object.keys(preFillResponses).length > 0) {
      setResponses(prev => ({
        ...prev,
        ...preFillResponses
      }));
      // Mark in storage that we've completed pre-fill
      sessionStorage.setItem('ai_prefill_completed', 'true');
    }
    hasAttemptedPreFill.current = true;
  }, [isSessionLoaded, responses, setResponses, surveyId]);

  // Cleanup function to clear resume data after successful prefill
  useEffect(() => {
    return () => {
      // Only clear if we successfully pre-filled
      const prefillCompleted = sessionStorage.getItem('ai_prefill_completed');
      if (prefillCompleted === 'true') {
        sessionStorage.removeItem('resume_parsed_data');
        sessionStorage.removeItem('ai_prefill_completed');
      }
    };
  }, []);
}; 