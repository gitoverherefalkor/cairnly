/**
 * Maps raw AI-extracted resume data to survey question IDs.
 * Used by both the legacy edge-function flow and the n8n webhook flow.
 *
 * Input: raw AI JSON with field names (name, education, career_history, etc.)
 * Output: object keyed by survey question UUIDs, formatted for survey pre-fill
 */

// Question ID mappings matching the survey structure
const QUESTION_MAPPINGS = {
  name: '11111111-1111-1111-1111-11111111111a',
  region: '11111111-1111-1111-1111-111111111114',
  education: '11111111-1111-1111-1111-111111111116',
  study_subject: '11111111-1111-1111-1111-111111111117',
  years_experience: '11111111-1111-1111-1111-111111111118',
  career_situation: '11111111-1111-1111-1111-111111111119',
  job_title: '11111111-1111-1111-1111-111111111110',
  achievement: '11111111-1111-1111-1111-11111111111f',
  interests: '11111111-1111-1111-1111-111111111120',
  specialized_skills: '44444444-4444-4444-4444-444444444444',
} as const;

// Valid options for multiple choice questions
const SURVEY_OPTIONS = {
  region: [
    'Northern and Western Europe',
    'Southern and Eastern Europe',
    'United Kingdom (London)',
    'United Kingdom (Other)',
    'United States (High-Cost Regions)',
    'United States (Average-Cost Regions)',
    'United States (Lower-Cost Regions)',
    'Canada',
    'Australia and New Zealand',
    'Switzerland'
  ],
  education: [
    'No formal education',
    'High school diploma or equivalent',
    "Associate's degree (e.g., technical college or vocational training)",
    "Bachelor's degree",
    "Master's degree",
    'Doctorate or professional degree (e.g., PhD, MD, JD)'
  ],
  career_situation: [
    'Non-leadership or individual contributor role (no direct reports)',
    'Managerial or leadership role (Managing 1-4 direct reports, focusing on team coordination and supervision)',
    'Senior managerial role (Managing 5 or more direct reports, involved in strategic decision-making and broader team oversight)',
    'Executive function (VP to C-suite roles or equivalent senior leadership positions with comprehensive organizational responsibilities)',
    'Entrepreneur seeking an employed role',
    'Currently on a career break or transition',
    'Looking to re-enter the workforce'
  ]
} as const;

// The resume extraction pipeline (n8n + this mapper) always produces data keyed
// by PRO question UUIDs. Other flavors that keep the CV upload step translate
// those keys to their own question ids at pre-fill time. Pro questions with no
// counterpart in the target survey are dropped (e.g. pronoun, goals, and
// career_situation, whose encore answer choices are transition-specific).
const PRO_TO_ENCORE_QUESTION_IDS: Record<string, string> = {
  '11111111-1111-1111-1111-11111111111a': 'b2b2b2b2-0001-4000-a000-000000000001', // name
  '11111111-1111-1111-1111-111111111113': 'b2b2b2b2-0001-4000-a000-000000000002', // age
  '11111111-1111-1111-1111-111111111114': 'b2b2b2b2-0001-4000-a000-000000000003', // region
  '11111111-1111-1111-1111-111111111116': 'b2b2b2b2-0001-4000-a000-000000000006', // education (same choices)
  '11111111-1111-1111-1111-111111111117': 'b2b2b2b2-0001-4000-a000-000000000007', // study subject
  '11111111-1111-1111-1111-111111111118': 'b2b2b2b2-0002-4000-a000-000000000003', // years experience
  '11111111-1111-1111-1111-111111111110': 'b2b2b2b2-0002-4000-a000-000000000001', // career history
  '11111111-1111-1111-1111-11111111111d': 'b2b2b2b2-0002-4000-a000-000000000002', // career happiness
  '11111111-1111-1111-1111-11111111111f': 'b2b2b2b2-0002-4000-a000-000000000004', // skills & achievements
  '11111111-1111-1111-1111-111111111120': 'b2b2b2b2-0004-4000-a000-000000000005', // interests & hobbies
};

/**
 * Translates a pro-UUID-keyed pre-fill object to the target survey's question
 * ids. Returns the input unchanged for the pro survey; for encore, remaps the
 * keys and drops anything without an encore counterpart.
 */
export const translatePreFillForSurvey = (
  surveyId: string,
  preFill: Record<string, any>,
): Record<string, any> => {
  const ENCORE_SURVEY_ID = '00000000-0000-0000-0000-000000000003';
  if (surveyId !== ENCORE_SURVEY_ID) return preFill;

  const translated: Record<string, any> = {};
  for (const [questionId, value] of Object.entries(preFill)) {
    const encoreId = PRO_TO_ENCORE_QUESTION_IDS[questionId];
    if (encoreId) translated[encoreId] = value;
  }
  return translated;
};

// Empty career entry template for padding
const EMPTY_CAREER_ENTRY = {
  title: '',
  companyName: '',
  companySize: '',
  companyCulture: '',
  sector: '',
  yearsInRole: '',
  startMonth: '',
  startYear: '',
  endMonth: '',
  endYear: '',
  isCurrent: false
};

/**
 * Maps raw AI-extracted data to survey question IDs with proper formatting.
 * Handles validation of multiple choice fields, career history padding,
 * skills/achievements formatting, and interests formatting.
 */
export const mapExtractedDataToSurvey = (extractedData: Record<string, any>): Record<string, any> => {
  const surveyData: Record<string, any> = {};

  // Name (text field)
  if (extractedData.name) {
    surveyData[QUESTION_MAPPINGS.name] = extractedData.name;
  }

  // Region - validate against allowed options
  if (extractedData.region) {
    const matchedRegion = SURVEY_OPTIONS.region.find(r =>
      r.toLowerCase() === extractedData.region?.toLowerCase() ||
      extractedData.region?.toLowerCase().includes(r.toLowerCase())
    );
    if (matchedRegion) {
      surveyData[QUESTION_MAPPINGS.region] = matchedRegion;
    }
  }

  // Education - validate and map with fuzzy matching
  if (extractedData.education) {
    const edu = extractedData.education.toLowerCase();
    let matchedEducation: string | undefined;

    if (edu.includes('doctorate') || edu.includes('phd') || edu.includes('md') || edu.includes('jd')) {
      matchedEducation = SURVEY_OPTIONS.education[5];
    } else if (edu.includes('master')) {
      matchedEducation = SURVEY_OPTIONS.education[4];
    } else if (edu.includes('bachelor')) {
      matchedEducation = SURVEY_OPTIONS.education[3];
    } else if (edu.includes('associate')) {
      matchedEducation = SURVEY_OPTIONS.education[2];
    } else if (edu.includes('high school') || edu.includes('diploma')) {
      matchedEducation = SURVEY_OPTIONS.education[1];
    }

    if (matchedEducation) {
      surveyData[QUESTION_MAPPINGS.education] = matchedEducation;
    }
  }

  // Study subject (text field)
  if (extractedData.study_subject) {
    surveyData[QUESTION_MAPPINGS.study_subject] = extractedData.study_subject;
  }

  // Years experience (number)
  if (extractedData.years_experience !== undefined && extractedData.years_experience !== null) {
    const years = typeof extractedData.years_experience === 'string'
      ? parseInt(extractedData.years_experience, 10)
      : extractedData.years_experience;
    if (!isNaN(years)) {
      surveyData[QUESTION_MAPPINGS.years_experience] = years;
    }
  }

  // Career situation - validate with fuzzy matching
  if (extractedData.career_situation) {
    const situation = extractedData.career_situation.toLowerCase();
    let matchedSituation: string | undefined;

    // First try exact match
    matchedSituation = SURVEY_OPTIONS.career_situation.find(s =>
      s.toLowerCase() === situation
    );

    // Fallback to fuzzy matching
    if (!matchedSituation) {
      if (situation.includes('executive') || situation.includes('c-suite') || situation.includes('vp')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[3];
      } else if (situation.includes('entrepreneur')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[4];
      } else if (situation.includes('senior') && situation.includes('manager')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[2];
      } else if (situation.includes('manager') || situation.includes('leadership')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[1];
      } else if (situation.includes('individual') || situation.includes('non-leadership')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[0];
      } else if (situation.includes('break') || situation.includes('transition')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[5];
      } else if (situation.includes('re-enter') || situation.includes('reenter')) {
        matchedSituation = SURVEY_OPTIONS.career_situation[6];
      }
    }

    if (matchedSituation) {
      surveyData[QUESTION_MAPPINGS.career_situation] = matchedSituation;
    }
  }

  // Career history - keep all roles (overflow beyond 5 shown greyed out in UI)
  if (extractedData.career_history && Array.isArray(extractedData.career_history)) {
    const validHistory = extractedData.career_history
      .filter((entry: any) => entry && entry.title)
      .map((entry: any) => ({
        title: entry.title || '',
        companyName: entry.companyName || '',
        companySize: entry.companySize || '',  // AI-estimated, user can override
        companyCulture: '',  // User must select manually
        sector: entry.sector || '',
        yearsInRole: entry.yearsInRole || '',
        startMonth: entry.startMonth || '',
        startYear: entry.startYear || '',
        endMonth: entry.isCurrent ? '' : (entry.endMonth || ''),
        endYear: entry.isCurrent ? '' : (entry.endYear || ''),
        isCurrent: entry.isCurrent || false
      }));

    // No padding - only send filled entries
    surveyData[QUESTION_MAPPINGS.job_title] = validHistory;
  }

  // Skills & Achievements - format as combined object
  const skillsAchievementsData: {
    topSkills: string[];
    certifications: string[];
    achievements: Array<{ company: string; yearRange: string; text: string }>;
  } = {
    topSkills: ['', '', '', '', '', '', '', '', ''],
    certifications: ['', '', ''],
    achievements: []
  };

  // Top skills - take up to 9, preserving CV order (first 3 are the "active" top 3 sent to scoring)
  if (extractedData.top_skills && Array.isArray(extractedData.top_skills)) {
    extractedData.top_skills.slice(0, 9).forEach((skill: string, index: number) => {
      if (skill && index < 9) {
        skillsAchievementsData.topSkills[index] = skill;
      }
    });
  }

  // Certifications - take up to 3
  if (extractedData.certifications && Array.isArray(extractedData.certifications)) {
    extractedData.certifications.slice(0, 3).forEach((cert: string, index: number) => {
      if (cert && index < 3) {
        skillsAchievementsData.certifications[index] = cert;
      }
    });
  }

  // Achievements - group by company into per-company objects for the per-company textarea UI
  if (extractedData.achievements && Array.isArray(extractedData.achievements)) {
    const grouped: Record<string, { texts: string[]; year?: string }> = {};
    extractedData.achievements
      .filter((a: any) => a && a.text)
      .forEach((a: any) => {
        const company = a.company || 'Other';
        if (!grouped[company]) grouped[company] = { texts: [], year: a.year };
        grouped[company].texts.push(a.text);
      });
    skillsAchievementsData.achievements = Object.entries(grouped).map(([company, data]) => ({
      company,
      yearRange: data.year || '',
      // Add bullet points when multiple achievements per company
      text: data.texts.length > 1
        ? data.texts.map(t => `• ${t}`).join('\n')
        : data.texts[0] || ''
    }));
  }

  // Only add skills/achievements if we have any data
  if (skillsAchievementsData.topSkills.some(s => s) ||
      skillsAchievementsData.certifications.some(c => c) ||
      skillsAchievementsData.achievements.length > 0) {
    surveyData[QUESTION_MAPPINGS.achievement] = skillsAchievementsData;
  }

  // Interests - format as object with array of 3 entries
  if (extractedData.interests) {
    let interestsArray: string[] = [];
    if (typeof extractedData.interests === 'string') {
      interestsArray = extractedData.interests
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s)
        .slice(0, 3);
    } else if (Array.isArray(extractedData.interests)) {
      interestsArray = extractedData.interests.slice(0, 3);
    }
    // Pad to 3 entries
    while (interestsArray.length < 3) {
      interestsArray.push('');
    }
    surveyData[QUESTION_MAPPINGS.interests] = { interests: interestsArray };
  }

  console.log('[ResumeMapper] Mapped survey data:', surveyData);
  return surveyData;
};
