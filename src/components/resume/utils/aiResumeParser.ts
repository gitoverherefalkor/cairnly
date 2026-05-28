import { supabase } from '@/integrations/supabase/client';
import { mapExtractedDataToSurvey } from './resumeDataMapper';

// Sanitize text to prevent JSON parsing issues
function sanitizeForJson(text: string): string {
  return text
    // Replace smart quotes with regular quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Replace em-dashes and en-dashes with regular dashes
    .replace(/[\u2013\u2014]/g, '-')
    // Replace other problematic Unicode
    .replace(/[\u2022\u2023\u2043]/g, '-') // bullets
    .replace(/[\u00A0]/g, ' ') // non-breaking space
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Limit consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const parseResumeWithAI = async (resumeText: string): Promise<Record<string, any>> => {
  // Sanitize the resume text first
  const cleanedText = sanitizeForJson(resumeText);

  // Truncate if too long (keep first 8000 chars to avoid token limits)
  const truncatedText = cleanedText.length > 8000
    ? cleanedText.substring(0, 8000) + '\n[... truncated for processing]'
    : cleanedText;

  const prompt = `Parse this LinkedIn profile/resume and extract data as JSON.

RESUME:
${truncatedText}

Extract these fields (use null if not found):

{
  "name": "Full name",
  "education": "MUST be one of: No formal education | High school diploma or equivalent | Associate's degree (e.g., technical college or vocational training) | Bachelor's degree | Master's degree | Doctorate or professional degree (e.g., PhD, MD, JD)",
  "study_subject": "Field of study",
  "years_experience": number (calculate from earliest job year to 2026),
  "region": "MUST be one of: Northern and Western Europe | Southern and Eastern Europe | United Kingdom (London) | United Kingdom (Other) | United States (High-Cost Regions) | United States (Average-Cost Regions) | United States (Lower-Cost Regions) | Canada | Australia and New Zealand | Switzerland",
  "career_history": [
    { "title": "Job title", "companyName": "Company name", "sector": "Industry sector", "startMonth": "Jan", "startYear": 2020, "endMonth": null, "endYear": null, "isCurrent": true },
    { "title": "...", "companyName": "...", "sector": "...", "startMonth": "Mar", "startYear": 2018, "endMonth": "Dec", "endYear": 2019, "isCurrent": false }
  ],
  "career_situation": "MUST be one of: Non-leadership or individual contributor role (no direct reports) | Managerial or leadership role (Managing 1-4 direct reports, focusing on team coordination and supervision) | Senior managerial role (Managing 5 or more direct reports, involved in strategic decision-making and broader team oversight) | Executive function (VP to C-suite roles or equivalent senior leadership positions with comprehensive organizational responsibilities) | Entrepreneur seeking an employed role | Currently on a career break or transition | Looking to re-enter the workforce",
  "top_skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8", "Skill 9"],
  "certifications": ["Certification 1", "Certification 2"],
  "achievements": [
    { "text": "Achievement description summarized in 1-2 sentences", "company": "Company Name", "year": 2022 }
  ]
}

RULES:
- Netherlands/Germany/France/Belgium = Northern and Western Europe
- Founder/CEO/COO/CTO = Executive function
- career_history should have 1-5 entries, most recent first (current role first)
- Extract actual company names (e.g., "Google", "Stripe", "Acme Corp")
- sector examples: Technology, Legal Tech, FinTech, Healthcare, Consulting, Retail, Manufacturing, Media, SaaS
- startMonth/startYear/endMonth/endYear: Extract from job dates (e.g., "Jan 2020 - Present" → startMonth: "Jan", startYear: 2020, endMonth: null, endYear: null, isCurrent: true)
- Month format MUST be 3-letter ENGLISH abbreviation: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- DUTCH CV CONVENTIONS: If the CV is in Dutch, dates use dd-mm-yyyy (e.g. "01-2020" or "januari 2020"). Translate Dutch month names to English abbreviations: januari/jan→Jan, februari/feb→Feb, maart/mrt→Mar, april/apr→Apr, mei→May, juni/jun→Jun, juli/jul→Jul, augustus/aug→Aug, september/sep→Sep, oktober/okt→Oct, november/nov→Nov, december/dec→Dec. Dutch "Heden" or "Nu" means "Present" — set isCurrent: true, endMonth: null, endYear: null. Dutch section headers: "Werkervaring"=Work Experience, "Opleiding"=Education, "Vaardigheden"=Skills, "Certificeringen"/"Diploma's"=Certifications.
- isCurrent: true if job says "Present", "Heden", "Nu", or is the current/most recent role, false otherwise
- top_skills: Extract ALL professional skills in the exact order they appear on the CV (e.g., from a "Skills" or "Top Skills" section). Preserve the candidate's own ordering — do NOT reorder or rank them. Max 9 skills. If the CV has fewer, return fewer.
- certifications: Extract from certifications/licenses section. Max 3 certifications.
- achievements: Extract notable accomplishments from job descriptions, intro summary, or achievements section. Include company name and year when available. Focus on concrete results (founded company, led team, achieved X%, etc).
- Return ONLY valid JSON, no markdown, no explanation`;

  try {
    const { data, error } = await supabase.functions.invoke('parse-resume-ai', {
      body: {
        resumeText: truncatedText,
        prompt
      }
    });

    if (error) {
      console.error('AI parsing error:', error);
      throw new Error('Failed to parse resume with AI');
    }

    if (!data.success) {
      console.error('AI parsing failed:', data.error);
      throw new Error(data.error || 'Failed to parse resume');
    }

    const extractedData = data.extractedData;
    console.log('Extracted data from AI:', extractedData);

    // Use the shared mapping function for survey question formatting
    return mapExtractedDataToSurvey(extractedData);

  } catch (error: any) {
    console.error('Error parsing resume with AI:', error);
    throw new Error('Failed to parse resume with AI: ' + error.message);
  }
};
