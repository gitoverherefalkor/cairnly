import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// /employers quotes the employer-paid notice "word for word". This keeps that
// promise true: the page quote and the line on the assessment's first screen
// must be the same string in every language.
const read = (lang: string, ns: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/${ns}.json`), 'utf8'));

describe('employer-paid notice', () => {
  for (const lang of ['en', 'nl']) {
    it(`matches the /employers quote (${lang})`, () => {
      const notice = read(lang, 'survey').sponsored?.notice;
      expect(notice).toBeTruthy();
      expect(notice).toBe(read(lang, 'employers').employeeSees.quote);
    });
  }
});
