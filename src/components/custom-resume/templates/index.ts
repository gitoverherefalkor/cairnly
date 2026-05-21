import type { ComponentType } from 'react';
import type { TemplateId, ResumeJson } from '../types';
import { AtsClassic } from './AtsClassic';
import { AtsModern } from './AtsModern';

export interface TemplateComponentProps {
  data: ResumeJson;
}

// Templates not yet built fall through to AtsClassic at render time, so the
// UI never crashes if a stale template_id is in the DB.
export const TEMPLATE_COMPONENTS: Record<TemplateId, ComponentType<TemplateComponentProps>> = {
  'ats-classic': AtsClassic,
  'ats-modern': AtsModern,
  // Designed templates land here as they ship.
  'designed-minimalist': AtsClassic,
  'designed-executive': AtsClassic,
  'designed-creative': AtsClassic,
};

export function getTemplateComponent(id: string): ComponentType<TemplateComponentProps> {
  return TEMPLATE_COMPONENTS[id as TemplateId] ?? AtsClassic;
}
