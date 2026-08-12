import type { ComponentType } from 'react';
import type { TemplateId, ResumeJson } from '../types';
import { AtsClassic } from './AtsClassic';
import { AtsModern } from './AtsModern';
import { ModernResume } from './ModernResume';
import { ClassicResume } from './ClassicResume';
import { BoldResume } from './BoldResume';

export interface TemplateComponentProps {
  data: ResumeJson;
  /**
   * Language the résumé body was generated in (WF9 writes it in the user's
   * `preferred_language`). Drives the section headings only; omitting it keeps
   * the previous English output.
   */
  lang?: string | null;
}

export const TEMPLATE_COMPONENTS: Record<TemplateId, ComponentType<TemplateComponentProps>> = {
  'ats-classic': AtsClassic,
  'ats-modern': AtsModern,
  'designed-minimalist': ModernResume,
  'designed-executive': ClassicResume,
  'designed-creative': BoldResume,
};

export function getTemplateComponent(id: string): ComponentType<TemplateComponentProps> {
  return TEMPLATE_COMPONENTS[id as TemplateId] ?? AtsClassic;
}
