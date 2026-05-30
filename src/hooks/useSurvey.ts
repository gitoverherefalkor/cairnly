
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export interface Question {
  id: string;
  type: string;
  label: string;
  required: boolean;
  allow_multiple: boolean;
  allow_other: boolean;
  order_num: number;
  min_selections?: number;
  max_selections?: number;
  config: {
    choices?: string[];
    min?: number;
    max?: number;
    description?: string;
    max_length?: number;
  };
  /**
   * Display-only map of the ENGLISH choice string → its translation in the
   * active language. config.choices stays English (it is the submitted answer
   * value); the renderer shows choiceLabels[choice] but submits choice.
   * Empty for English or when no translation exists. See LOCALIZATION_PLAYBOOK.md.
   */
  choiceLabels?: Record<string, string>;
  /**
   * Display-only label maps for the skills_achievements languages sub-card.
   * Keyed by the English value; the renderer shows the translation but the
   * stored value (language name / proficiency value) stays English.
   */
  langLabels?: {
    presets?: Record<string, string>;
    other?: Record<string, string>;
    proficiency?: Record<string, string>;
  };
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  order_num: number;
  questions: Question[];
}

export interface Survey {
  id: string;
  title: string;
  sections: Section[];
}

interface QuestionTranslation {
  label?: string;
  description?: string;
  choices?: Record<string, string>;
  languages_presets?: Record<string, string>;
  languages_other?: Record<string, string>;
  languages_proficiency_levels?: Record<string, string>;
}
interface SectionTranslation { title?: string; description?: string; }

export const useSurvey = (surveyId: string) => {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  return useQuery({
    // Language is part of the key so switching language re-applies translations.
    queryKey: ['survey', surveyId, lang],
    // Don't fire when there's no id yet (e.g. the dashboard resolves the draft's
    // survey id asynchronously). Avoids an erroring `.eq('id','')` query.
    enabled: !!surveyId,
    queryFn: async (): Promise<Survey> => {
      // Single query using Supabase's relational select (PostgREST foreign key traversal).
      // `translations` is fetched alongside English content; coalescing happens below.
      const { data: survey, error } = await supabase
        .from('surveys')
        .select(`
          id, title,
          survey_sections(
            id, title, description, order_num, translations,
            questions(
              id, type, label, required, allow_multiple, allow_other,
              order_num, min_selections, max_selections, config, translations
            )
          )
        `)
        .eq('id', surveyId)
        .single();

      if (error) throw error;

      const useTranslations = lang !== 'en';

      // Transform the nested response to match our interfaces
      const sections: Section[] = (survey.survey_sections || [])
        .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
        .map((section: any) => {
          const st: SectionTranslation = useTranslations ? (section.translations?.[lang] ?? {}) : {};
          return {
            id: section.id,
            // Display-only: title/description are not answer values.
            title: st.title || section.title || '',
            description: st.description || section.description || undefined,
            order_num: section.order_num || 0,
            questions: (section.questions || [])
              .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
              .map((q: any) => {
                const qt: QuestionTranslation = useTranslations ? (q.translations?.[lang] ?? {}) : {};
                const baseConfig =
                  typeof q.config === 'object' && q.config !== null
                    ? (q.config as Question['config'])
                    : {};
                return {
                  id: q.id,
                  type: q.type,
                  // Display-only overrides. config.choices stays English (it is the value).
                  label: qt.label || q.label,
                  required: q.required || false,
                  allow_multiple: q.allow_multiple || false,
                  allow_other: q.allow_other || false,
                  order_num: q.order_num || 0,
                  min_selections: q.min_selections || undefined,
                  max_selections: q.max_selections || undefined,
                  config: {
                    ...baseConfig,
                    description: qt.description || baseConfig.description,
                  },
                  choiceLabels: qt.choices ?? {},
                  langLabels: useTranslations
                    ? {
                        presets: qt.languages_presets ?? {},
                        other: qt.languages_other ?? {},
                        proficiency: qt.languages_proficiency_levels ?? {},
                      }
                    : undefined,
                } as Question;
              })
          };
        });

      return {
        id: survey.id,
        title: survey.title,
        sections
      };
    }
  });
};
