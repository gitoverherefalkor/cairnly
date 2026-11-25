/**
 * Guards against English leaking into the Dutch (and Encore "u") app.
 *
 * 1. Every key in en/<ns>.json exists in nl/<ns>.json and the other way round.
 * 2. Every nl-formal/<ns>.json override is listed in FORMAL_NAMESPACES (else it
 *    is never loaded) and only overrides keys that exist in nl.
 * 3. Logged-in pages that are fully translated stay that way: no hardcoded
 *    English sentences in their JSX. Add a file here once it is translated.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FORMAL_NAMESPACES } from './formalDutch';

const LOCALES = join(process.cwd(), 'public/locales');
const read = (lng: string, ns: string) => JSON.parse(readFileSync(join(LOCALES, lng, ns), 'utf-8'));

function keyPaths(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe('locale files', () => {
  const namespaces = readdirSync(join(LOCALES, 'en')).filter((f) => f.endsWith('.json'));

  it.each(namespaces)('en and nl have the same keys in %s', (ns) => {
    const en = new Set(keyPaths(read('en', ns)));
    const nl = new Set(keyPaths(read('nl', ns)));
    expect([...en].filter((k) => !nl.has(k))).toEqual([]);
    expect([...nl].filter((k) => !en.has(k))).toEqual([]);
  });

  const formalFiles = readdirSync(join(LOCALES, 'nl-formal')).filter((f) => f.endsWith('.json'));

  it.each(formalFiles)('nl-formal/%s is loaded and only overrides existing nl keys', (ns) => {
    expect(FORMAL_NAMESPACES).toContain(ns.replace('.json', ''));
    const nl = new Set(keyPaths(read('nl', ns)));
    expect(keyPaths(read('nl-formal', ns)).filter((k) => !nl.has(k))).toEqual([]);
  });
});

// Files a Dutch user reaches after signing in that are fully translated.
const TRANSLATED_FILES = [
  'src/pages/Profile.tsx',
  'src/pages/AuthConfirm.tsx',
  'src/components/chat/ClosingCard.tsx',
  'src/components/resume/ResumeUploadCard.tsx',
];

// A JSX text line of 3+ words starting with a capital, or such text between
// tags, or an English sentence in a title/placeholder/aria-label attribute.
const HARDCODED = [
  /^\s+[A-Z][a-z']+( [A-Za-z',.!?…/-]+){2,}\s*$/,
  />\s*[A-Z][a-z']+( [A-Za-z',.!?…/-]+){2,}\s*</,
  /\b(title|description|placeholder|aria-label)="[A-Z][a-z]+ [a-z]+/,
];

describe('no hardcoded English in translated pages', () => {
  it.each(TRANSLATED_FILES)('%s', (file) => {
    const hits = readFileSync(join(process.cwd(), file), 'utf-8')
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
      .filter(({ line }) => HARDCODED.some((re) => re.test(line)))
      .map(({ line, n }) => `${n}: ${line.trim()}`);
    expect(hits).toEqual([]);
  });
});
