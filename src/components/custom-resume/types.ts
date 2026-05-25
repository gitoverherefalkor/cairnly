// Shared types for the Custom Résumé feature.
//
// resume_json and cover_letter_json are stored in the custom_resumes table as
// jsonb, so we keep narrow TS types here as the contract that the n8n
// workflow, the edge function, and the react-pdf templates all share.

export type CustomResumeStatus = 'processing' | 'completed' | 'failed';

export interface ResumeContact {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface ResumeExperience {
  title: string;
  company: string;
  location?: string;
  start?: string;
  end?: string;
  current?: boolean;
  bullets: string[];
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  field?: string;
  location?: string;
  start?: string;
  end?: string;
}

export interface ResumeSkillsGrouped {
  technical?: string[];
  tools?: string[];
  soft?: string[];
  languages?: string[];
}

export interface ResumeCertification {
  name: string;
  issuer?: string;
  year?: string;
}

export interface ResumeJson {
  contact: ResumeContact;
  summary: string;
  experience: ResumeExperience[];
  skills_grouped: ResumeSkillsGrouped;
  education: ResumeEducation[];
  certifications?: ResumeCertification[];
  highlights?: string[];
}

export interface CoverLetterJson {
  greeting: string;
  opening: string;
  body_paragraphs: string[];
  closing: string;
}

export interface KeywordCoverage {
  hit: string[];
  missing: string[];
}

// What the wizard collects before kicking off the generation.
export interface CareerSelection {
  section_id: string;
  section_type: string;
  career_title: string;
}

export interface UserOverrides {
  phone?: string;
  email?: string;
  location?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface GenerateRequest {
  report_id: string;
  selected_careers: CareerSelection[];
  template_id: string;
  include_cover_letter: boolean;
  user_overrides?: UserOverrides;
}

export interface GenerateResponse {
  custom_resume_ids: string[];
}

// Template registry — keep the IDs stable, they're persisted in custom_resumes.template_id.
export type TemplateId =
  | 'ats-classic'
  | 'ats-modern'
  | 'designed-minimalist'
  | 'designed-executive'
  | 'designed-creative';

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  category: 'ats' | 'designed';
  builtYet: boolean;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    description: 'Serif headings, traditional structure. Safest for ATS parsers.',
    category: 'ats',
    builtYet: true,
  },
  {
    id: 'ats-modern',
    name: 'ATS Modern',
    description: 'Clean sans-serif, generous spacing. Still ATS-safe.',
    category: 'ats',
    builtYet: true,
  },
  {
    id: 'designed-minimalist',
    name: 'Modern Minimalist',
    description: 'For tech, startup, product, UX roles. Cairnly teal, Inter throughout.',
    category: 'designed',
    builtYet: true,
  },
  // Classic Executive retired — sidebar-heavy layout produced too many
  // edge-case rendering issues (page-2 misalignment, redundant contact
  // block, hardcoded page counts) and didn't earn its keep next to the
  // other four. Keep the ClassicResume component file around in case we
  // want to revive a cleaner version later, just don't expose it here.
  {
    id: 'designed-creative',
    name: 'Bold Creative',
    description: 'For marketing, communications, media. Burnt-sienna accent, asymmetric grid.',
    category: 'designed',
    // Temporarily disabled — handoff to Claude Design for layout fixes
    // (cross-page alignment + section spacing). Will flip back to true
    // once the styling pass lands.
    builtYet: false,
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
