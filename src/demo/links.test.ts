import { describe, expect, it } from 'vitest';
import { demoLink, demoQuery, readPersonaParam } from './links';

describe('demo links', () => {
  it('carries the partner tag and the persona, nothing else', () => {
    expect(demoQuery('')).toBe('');
    expect(demoQuery('?utm_source=x')).toBe('');
    expect(demoQuery('?p=partners')).toBe('?p=partners');
    expect(demoQuery('?persona=marcel&p=bureau-x&foo=1')).toBe('?p=bureau-x&persona=marcel');
    expect(demoLink('/demo/jobs', '?persona=emma')).toBe('/demo/jobs?persona=emma');
    expect(demoLink('/demo/jobs', '')).toBe('/demo/jobs');
  });

  it('reads only persona ids the demo knows', () => {
    expect(readPersonaParam('?persona=emma')).toBe('emma');
    expect(readPersonaParam('?persona=marcel')).toBe('marcel');
    expect(readPersonaParam('?persona=marloes')).toBeUndefined();
    expect(readPersonaParam('')).toBeUndefined();
  });
});
