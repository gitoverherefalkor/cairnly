import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import marcelJson from './fixtures/marcel.nl.json';
import emmaJson from './fixtures/emma.en.json';
import { demoSurvey, initialResponses, resolveQuestion, surveyPersona } from './survey';
import type { DemoFixture } from './types';
import type { DemoPersonaId } from './loadFixture';

// The three questions /demo/survey shows, frozen by demo-export-survey.mjs.
// They are rendered by the REAL QuestionRenderer, so what matters is that the
// frozen rows still carry everything that component reads, that each persona's
// answer is the shape its question type expects, and that the "see what this
// became" links point at messages that exist in the committed transcripts.
const FIXTURES: Record<DemoPersonaId, DemoFixture> = {
  marcel: marcelJson as unknown as DemoFixture,
  emma: emmaJson as unknown as DemoFixture,
};
const localeSurvey = (lang: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/demo.json`), 'utf8')).surveyDemo;

describe('demo survey fixture', () => {
  it('holds the three intended question types, in order', () => {
    expect(demoSurvey.questions.map((q) => q.type)).toEqual([
      'career_happiness',
      'ranking',
      'multiple_choice',
    ]);
    // career_happiness reads the roles through allResponses; without the
    // linked question its card renders empty.
    const happiness = demoSurvey.questions[0];
    expect(happiness.config?.linkedQuestionId).toBe(demoSurvey.context[0].id);
    expect(demoSurvey.context[0].type).toBe('career_history');
    // The schedule question is the one with the non-negotiable rider.
    expect(demoSurvey.questions[2].config?.non_negotiable_rider).toBeTruthy();
    // The ranking question needs its choices; they stay English (they are the
    // stored answer) with the translations alongside.
    expect(demoSurvey.questions[1].config?.choices?.length).toBeGreaterThanOrEqual(8);
  });

  it('resolves a question into the language the visitor reads', () => {
    for (const row of demoSurvey.questions) {
      const en = resolveQuestion(row, 'en');
      const nl = resolveQuestion(row, 'nl');
      expect(en.label).toBe(row.label);
      expect(nl.label).not.toBe(en.label); // every one of the three is translated
      // The answer values never change with the language.
      expect(nl.config.choices).toEqual(en.config.choices);
      if (row.translations?.nl?.choices) {
        expect(Object.keys(nl.choiceLabels ?? {}).length).toBe(
          Object.keys(row.translations.nl.choices).length,
        );
      }
    }
    // The rider is display text, so it follows the language too.
    expect(resolveQuestion(demoSurvey.questions[2], 'nl').config.non_negotiable_rider).not.toBe(
      resolveQuestion(demoSurvey.questions[2], 'en').config.non_negotiable_rider,
    );
  });

  it.each(['marcel', 'emma'] as DemoPersonaId[])('%s: answers match their question types', (id) => {
    const persona = surveyPersona(id)!;
    const responses = initialResponses(id);
    expect(persona.language).toBe(FIXTURES[id].persona.language);
    expect(persona.resume.fileName).toMatch(/\.pdf$/i);
    expect(persona.resume.fieldsExtracted).toBeGreaterThan(0);

    const [happiness, ranking, schedule] = demoSurvey.questions;
    // career_history: the roles the résumé filled in.
    const roles = responses[demoSurvey.context[0].id] as Array<{ title: string }>;
    expect(Array.isArray(roles) && roles.length).toBeGreaterThanOrEqual(2);
    // career_happiness: one rating per role, each with a reason.
    const ratings = responses[happiness.id] as Array<{ happiness: string; reason: string }>;
    expect(ratings.length).toBe(roles.length);
    for (const r of ratings) {
      expect(Number(r.happiness)).toBeGreaterThanOrEqual(1);
      expect(Number(r.happiness)).toBeLessThanOrEqual(10);
      expect(r.reason.length).toBeGreaterThan(20);
    }
    // ranking: a subset of the question's own choices, in order.
    const ranked = responses[ranking.id] as string[];
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    for (const choice of ranked) expect(ranking.config?.choices).toContain(choice);
    // schedule: one of its choices, and the persona ticked the rider.
    expect(schedule.config?.choices).toContain(responses[schedule.id]);
    expect((responses.__non_negotiables as Record<string, boolean>)[schedule.id]).toBe(true);
  });

  it.each(['marcel', 'emma'] as DemoPersonaId[])('%s: every payoff link points at a real message', (id) => {
    const persona = surveyPersona(id)!;
    const ids = new Set(FIXTURES[id].messages.map((m) => m.id));
    const questionIds = demoSurvey.questions.map((q) => q.id);
    expect(Object.keys(persona.focus).sort()).toEqual([...questionIds].sort());
    for (const [questionId, messageId] of Object.entries(persona.focus)) {
      expect(ids.has(messageId), `${id}: focus for ${questionId}`).toBe(true);
    }
  });

  it('has its page copy in both languages', () => {
    for (const lang of ['nl', 'en']) {
      const s = localeSurvey(lang);
      expect(s?.seo?.title, lang).toBeTruthy();
      expect(s?.nav?.label, lang).toBeTruthy();
      expect(s?.intro?.title, lang).toBeTruthy();
      expect(s?.resume?.note, lang).toContain('{{name}}');
      expect(s?.questionCard?.eyebrow, lang).toContain('{{current}}');
      for (const key of ['happiness', 'ranking', 'schedule']) {
        expect(s?.payoff?.[key], `${lang} payoff.${key}`).toBeTruthy();
      }
      expect(s?.rest?.toChat, lang).toContain('{{name}}');
    }
  });
});
