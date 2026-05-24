import type { ComponentType } from 'react';
import type { TemplateId, ResumeJson } from '../types';
import { AtsClassic } from './AtsClassic';
import { AtsModern } from './AtsModern';
import { ModernResume } from './ModernResume';
import { ClassicResume } from './ClassicResume';
import { BoldResume } from './BoldResume';

export interface TemplateComponentProps {
  data: ResumeJson;
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
