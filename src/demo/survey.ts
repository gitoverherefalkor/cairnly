// The three survey questions the public demo shows (/demo/survey), frozen by
// scripts/demo-export-survey.mjs together with both personas' real answers.
//
// The questions are stored the way the database holds them: English label and
// choices, translations alongside. resolveQuestion() merges them for the
// visitor's language EXACTLY as useSurvey does at runtime, so the demo renders
// the same object the real assessment renders, through the real
// QuestionRenderer — no copy of the survey UI anywhere.
import type { Question } from '@/hooks/useSurvey';
import surveyJson from './fixtures/survey.json';
import type { DemoPersonaId } from './loadFixture';

interface QuestionTranslation {
  label?: string;
  description?: string;
  non_negotiable_rider?: string;
  choices?: Record<string, string>;
  languages_presets?: Record<string, string>;
  languages_other?: Record<string, string>;
  languages_proficiency_levels?: Record<string, string>;
}

/** A question row as the database holds it. */
export interface DemoQuestionRow {
  id: string;
  type: string;
  label: string;
  required: boolean | null;
  allow_multiple: boolean | null;
  allow_other: boolean | null;
  order_num: number | null;
  min_selections: number | null;
  max_selections: number | null;
  config: Question['config'] | null;
  translations: Record<string, QuestionTranslation> | null;
  /** Where this question sits in the real assessment, for the card's eyebrow. */
  placement?: { section: number; sectionTitle: string; current: number; total: number };
}

export interface DemoSurveyPersona {
  language: string;
  firstName: string;
  resume: { fileName: string; fileSizeBytes: number; fieldsExtracted: number };
  // questionId → the persona's own answer, plus the __non_negotiables sidecar.
  answers: Record<string, unknown>;
  // questionId → the chat message where that answer paid off.
  focus: Record<string, string>;
}

export interface DemoSurveyFixture {
  meta: { exportedAt: string; questionIds: string[]; contextIds: string[] };
  questions: DemoQuestionRow[];
  context: DemoQuestionRow[];
  personas: Record<string, DemoSurveyPersona>;
}

export const demoSurvey = surveyJson as unknown as DemoSurveyFixture;

/**
 * The runtime Question for a language. Mirrors the mapping in useSurvey:
 * label/description/rider are display-only overrides, `config.choices` stays
 * English because it IS the stored answer, and the translated choice labels
 * ride along in `choiceLabels`.
 */
export function resolveQuestion(row: DemoQuestionRow, lang: string | undefined): Question {
  const short = (lang || 'en').slice(0, 2).toLowerCase();
  const useTranslations = short !== 'en';
  const qt: QuestionTranslation = useTranslations ? (row.translations?.[short] ?? {}) : {};
  const baseConfig = (row.config ?? {}) as Question['config'];
  return {
    id: row.id,
    type: row.type,
    label: qt.label || row.label,
    required: row.required || false,
    allow_multiple: row.allow_multiple || false,
    allow_other: row.allow_other || false,
    order_num: row.order_num || 0,
    min_selections: row.min_selections || undefined,
    max_selections: row.max_selections || undefined,
    config: {
      ...baseConfig,
      description: qt.description || baseConfig.description,
      non_negotiable_rider: qt.non_negotiable_rider || baseConfig.non_negotiable_rider,
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
}

/** The persona's answers, ready to seed the demo's local response state. */
export function initialResponses(personaId: DemoPersonaId): Record<string, unknown> {
  return { ...(demoSurvey.personas[personaId]?.answers ?? {}) };
}

export function surveyPersona(personaId: DemoPersonaId): DemoSurveyPersona | undefined {
  return demoSurvey.personas[personaId];
}
