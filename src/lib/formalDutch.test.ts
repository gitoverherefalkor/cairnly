import { describe, it, expect } from 'vitest';
import { deepMerge } from './formalDutch';

describe('deepMerge (formal Dutch overrides)', () => {
  it('replaces only the overridden strings', () => {
    const base = { a: 'Je account', b: { c: 'Heb je', d: 'blijft' } };
    expect(deepMerge(base, { b: { c: 'Heeft u' } })).toEqual({ a: 'Je account', b: { c: 'Heeft u', d: 'blijft' } });
  });
  it('merges index keys into arrays', () => {
    const base = { cards: [{ t: 'A', sub: 'je' }, { t: 'B', sub: 'x' }] };
    expect(deepMerge(base, { cards: { '0': { sub: 'u' } } })).toEqual({ cards: [{ t: 'A', sub: 'u' }, { t: 'B', sub: 'x' }] });
  });
});
