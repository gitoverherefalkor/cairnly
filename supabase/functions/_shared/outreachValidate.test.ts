import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateOutgoing, MAX_WORDS } from './outreachValidate.ts';
import { renderInitial } from './outreachInitial.ts';
import { demoLink, renderFollowUp, salutation, templateCheckIn } from './outreachFollowUp.ts';
import { templateRejection } from './outreachRejection.ts';

const initialInput = {
  slug: 'track2',
  bureau: 'Track2 B.V.',
  contactpersoon: 'Mark de Vries',
  categorie: 'D',
  openingshaak: null,
  campaign: 'bureaus-sep26',
  subjectVariant: 'a' as const,
};
const initialOpts = {
  soort: 'initial' as const,
  expectedSalutation: salutation(initialInput),
  demoLink: demoLink('track2', 'bureaus-sep26'),
  maxWords: MAX_WORDS.initial,
};
const chaseInput = {
  slug: 'track2',
  bureau: 'Track2 B.V.',
  contactpersoon: 'Mark de Vries',
  step: 1 as const,
  clicks: 0,
  clickDays: 0,
  openingshaak: null,
  campaign: 'bureaus-sep26',
  codeIssued: false,
};

Deno.test('every approved skeleton passes its own validator', () => {
  assertEquals(validateOutgoing(renderInitial(initialInput), initialOpts), { ok: true, problems: [] });
  for (const input of [chaseInput, { ...chaseInput, clicks: 3, clickDays: 2 }, { ...chaseInput, step: 2 as const }]) {
    const body = renderFollowUp(input);
    const r = validateOutgoing(body, {
      soort: 'chase',
      expectedSalutation: salutation(input),
      demoLink: input.step === 1 && input.clicks === 0 ? demoLink('track2', 'bureaus-sep26') : null,
      maxWords: MAX_WORDS.chase,
    });
    assert(r.ok, `${r.problems.join('; ')}\n${body}`);
  }
  const checkIn = templateCheckIn({ slug: 'x', bureau: 'Track2 B.V.', replierName: 'Mark', theirReply: null, summary: null, codeIssued: false });
  assert(validateOutgoing(checkIn, { soort: 'checkin', expectedSalutation: null, maxWords: MAX_WORDS.checkin }).ok);
  const rejection = templateRejection({ bureau: 'Track2 B.V.', replierName: 'Mark', codeIssued: false });
  assert(validateOutgoing(rejection, { soort: 'reply', expectedSalutation: null, maxWords: MAX_WORDS.reply }).ok);
});

const good = renderInitial(initialInput);
const problemsOf = (body: string) => validateOutgoing(body, initialOpts).problems.join(' | ');

Deno.test('a dash is caught', () => {
  assert(problemsOf(good.replace('geen login nodig', 'geen login nodig — echt')).includes('dash'));
});

Deno.test('a wrong salutation is caught, a Hoi with the same name is fine', () => {
  assert(problemsOf(good.replace('Beste Mark,', 'Beste K.,')).includes('salutation'));
  assertEquals(problemsOf(good.replace('Beste Mark,', 'Hoi Mark,')), '');
});

Deno.test('a missing or altered demo link is caught', () => {
  assert(problemsOf(good.replace('utm_content=track2', 'utm_content=trackX')).includes('demo link'));
});

Deno.test('too long, no signature, "niet X, maar Y", and leftovers are caught', () => {
  assert(problemsOf(good.replace('Fictieve kandidaat', 'extra '.repeat(150) + 'Fictieve kandidaat')).includes('words'));
  assert(problemsOf(good.replace('Groet,\nSjoerd', 'Sjoerd')).includes('signature'));
  assert(problemsOf(good.replace('Fictieve kandidaat, echte output.', 'Het is niet een test, maar een rapport.')).includes('niet X, maar Y'));
  assert(problemsOf(good.replace('Utrecht', 'Utrecht [CODELINK]')).includes('placeholder'));
  assert(problemsOf(good.replace('Utrecht', '{plaats}')).includes('placeholder'));
});

Deno.test('AI tells are caught, whole words only', () => {
  assert(problemsOf(good.replace('Fictieve kandidaat', 'Een naadloze ervaring. Fictieve kandidaat')).includes('generated'));
  assert(problemsOf(good.replace('Fictieve kandidaat', 'Dat speelt een  belangrijke rol. Fictieve kandidaat')).includes('generated'));
  // "uniekheid" is not the word "uniek"; the check must not fire on substrings.
  assertEquals(problemsOf(good.replace('Fictieve kandidaat', 'Uniekheidsdenken. Fictieve kandidaat')), '');
});
