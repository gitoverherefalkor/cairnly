// Drift alarm between the two copies of the translation glossary:
//   scripts/i18n-glossary.json          — editable source of truth (UI sync)
//   supabase/functions/_shared/glossary.ts — mirror bundled into edge functions
// Edge functions can't import files outside supabase/functions/, so the values
// are mirrored. This test fails the moment the two diverge: edit both together.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DO_NOT_TRANSLATE, PREFERRED, RULES } from '../../supabase/functions/_shared/glossary';

const json = JSON.parse(
  readFileSync(resolve(__dirname, '../../scripts/i18n-glossary.json'), 'utf-8'),
);

describe('glossary mirror stays in sync with scripts/i18n-glossary.json', () => {
  it('do_not_translate matches', () => {
    expect([...DO_NOT_TRANSLATE]).toEqual(json.do_not_translate);
  });
  it('preferred terms match', () => {
    expect(PREFERRED).toEqual(json.preferred);
  });
  it('per-language rules match', () => {
    expect(RULES).toEqual(json.rules);
  });
});
