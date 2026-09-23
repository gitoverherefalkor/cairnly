import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { textToHtml } from './outreachHtml.ts';
import {
  agencyName,
  buildCheckInMessage,
  demoLink,
  firstName,
  parseFollowUp,
  renderFollowUp,
  salutation,
  templateCheckIn,
  type CheckInInput,
  type FollowUpInput,
} from './outreachFollowUp.ts';

const base: FollowUpInput = {
  slug: 'mepd',
  bureau: 'MEPD',
  contactpersoon: null,
  step: 1,
  clicks: 0,
  clickDays: 0,
  openingshaak: null,
  campaign: 'bureaus-sep26',
  codeIssued: false,
};
const make = (over: Partial<FollowUpInput>): FollowUpInput => ({ ...base, ...over });

Deno.test('firstName takes the first word of a real name only', () => {
  assertEquals(firstName('Mark de Vries'), 'Mark');
  assertEquals(firstName('Monique van Wagenberg'), 'Monique');
  assertEquals(firstName(null), null);
  assertEquals(firstName('   '), null);
  assertEquals(firstName('M'), null);
  // Real rows from the seed: initials and two-people cells must not become a name.
  assertEquals(firstName('K. Dalm; Clemens van Gemert'), null);
  assertEquals(firstName('J.W. Bakker'), null);
  assertEquals(firstName('Lydia en Johan'), 'Lydia');
});

Deno.test('agencyName says the name out loud, not as the Chamber of Commerce writes it', () => {
  assertEquals(agencyName('Bureau VolZin B.V.'), 'Bureau VolZin');
  assertEquals(agencyName('Riforce B.V.'), 'Riforce');
  assertEquals(agencyName('Nieuwe Koers BV'), 'Nieuwe Koers');
  assertEquals(agencyName('HR Consultancy BV (HRC)'), 'HR Consultancy');
  assertEquals(agencyName('Vroegindeweij & de Visser Personeelsdiensten B.V.'), 'Vroegindeweij & de Visser Personeelsdiensten');
  assertEquals(agencyName('MEPD'), 'MEPD');
  assertEquals(agencyName('Mens & Zo B.V.'), 'Mens & Zo');
});

Deno.test('salutation falls back to the agency when there is no contact', () => {
  assertEquals(salutation({ contactpersoon: 'Frank van Emmerik', bureau: 'Passus' }), 'Beste Frank,');
  assertEquals(salutation({ contactpersoon: null, bureau: 'MEPD' }), 'Beste team van MEPD,');
  assertEquals(salutation({ contactpersoon: 'K. Dalm; Clemens van Gemert', bureau: 'Riforce B.V.' }), 'Beste team van Riforce,');
});

Deno.test('the demo link still attributes the click to this agency', () => {
  const link = demoLink('mepd', 'bureaus-sep26');
  assertStringIncludes(link, 'utm_content=mepd');
  assertStringIncludes(link, 'utm_campaign=bureaus-sep26');
  assertStringIncludes(link, 'persona=marcel');
  // An agency seeded without a campaign still lands on the default batch.
  assertStringIncludes(demoLink('x', null), 'utm_campaign=bureaus-sep26');
});

Deno.test('every skeleton signs off and asks at most one question', () => {
  const variants = [
    renderFollowUp(make({ clicks: 3 })),
    renderFollowUp(make({ clicks: 0 })),
    renderFollowUp(make({ step: 2 })),
    renderFollowUp(make({ clicks: 2, codeIssued: true })),
  ];
  for (const body of variants) {
    assertEquals(body.endsWith('Groet,\nSjoerd'), true, body);
    // One question to the READER. A "?" inside the demo URL is not a question.
    const prose = body.replace(/https?:\/\/\S+/g, '');
    assertEquals((prose.match(/\?/g) ?? []).length <= 1, true, body);
    // House style: no em-dashes in anything that leaves the building.
    assertEquals(body.includes('—'), false, body);
  }
});

Deno.test('the skeleton matches the situation', () => {
  assertStringIncludes(renderFollowUp(make({ clicks: 1, clickDays: 2 })), 'is geopend');
  assertStringIncludes(renderFollowUp(make({ clicks: 4 })), 'een paar keer is bekeken');
  // Never opened: no claim that they looked, and the link comes along again.
  const quiet = renderFollowUp(make({ clicks: 0 }));
  assertEquals(quiet.includes('bekeken'), false);
  assertStringIncludes(quiet, 'utm_content=mepd');
  // A code already went out, so do not offer a second one.
  assertStringIncludes(renderFollowUp(make({ clicks: 1, codeIssued: true })), 'blijft gewoon geldig');
  assertEquals(renderFollowUp(make({ clicks: 1, codeIssued: true })).includes('stuur ik je een gratis testcode'), false);
  // Second chase is the goodbye, whatever they did.
  assertStringIncludes(renderFollowUp(make({ step: 2, clicks: 9 })), 'laatste keer');
});

Deno.test('parseFollowUp rejects a generation that lost the signature', () => {
  const ok = { content: [{ type: 'tool_use', name: 'write_follow_up', input: { body: 'Beste Mark,\n\nHoi.\n\nGroet,\nSjoerd' } }] };
  assertStringIncludes(parseFollowUp(ok) ?? '', 'Beste Mark');
  assertEquals(parseFollowUp({ content: [{ type: 'text' }] }), null);
  assertEquals(parseFollowUp({ content: [{ type: 'tool_use', name: 'write_follow_up', input: { body: 'Beste Mark, tot ziens' } }] }), null);
  // A thinking block in front must not hide the tool call.
  const thought = { content: [{ type: 'thinking' }, { type: 'tool_use', name: 'write_follow_up', input: { body: 'Hoi.\n\nGroet,\nSjoerd' } }] };
  assertStringIncludes(parseFollowUp(thought) ?? '', 'Groet');
});

Deno.test('the quiet chase carries both links, and survives the trip to HTML', () => {
  const quiet = renderFollowUp(make({ clicks: 0 }));
  // Written as markdown so the model has something it can copy verbatim.
  assertStringIncludes(quiet, '[demo van een sessie](');
  assertStringIncludes(quiet, '[onze partnerpagina](https://cairnly.io/partners)');

  const html = textToHtml(quiet);
  // The reader sees a name, not a query string, and the slug still rides along.
  assertStringIncludes(html, '>demo van een sessie</a>');
  assertStringIncludes(html, 'utm_content=mepd');
  assertStringIncludes(html, '>onze partnerpagina</a>');
  // No markdown leaks into the mail.
  assertEquals(html.includes('[demo van een sessie]'), false);
});

Deno.test('the chase that did get a click keeps its single link-free ask', () => {
  const clicked = renderFollowUp(make({ clicks: 2 }));
  assertEquals(clicked.includes('http'), false);
});

Deno.test('the chase only claims to have seen them look when the evidence carries it', () => {
  // One click on one day can still be a late scanner: no claim.
  const dun = renderFollowUp(make({ clicks: 1, clickDays: 1 }));
  assertEquals(dun.includes('Ik zag dat'), false);
  assertStringIncludes(dun, 'Korte opvolging op mijn mail van vorige week.');
  // ...and the opening line is not doubled now that it carries the whole load.
  assertEquals(dun.split('Korte opvolging').length - 1, 1);

  // Two clicks, or clicks on two days, is beyond what a scanner does.
  assertStringIncludes(renderFollowUp(make({ clicks: 2, clickDays: 1 })), 'een paar keer is bekeken');
  assertStringIncludes(renderFollowUp(make({ clicks: 1, clickDays: 2 })), 'Ik zag dat de demo bij jullie is geopend');
});

const checkIn: CheckInInput = {
  slug: 'denieuwekracht',
  bureau: 'De Nieuwe Kracht B.V.',
  replierName: null,
  theirReply: 'Hoi Sjoerd, dank je wel voor je toelichting! Ik ga dit meegeven aan mijn collega\'s.',
  summary: "Judith legt vraag intern neer, collega's nemen later contact op.",
  codeIssued: false,
};

Deno.test('the check-in asks exactly one question and signs off', () => {
  for (const input of [checkIn, { ...checkIn, codeIssued: true }, { ...checkIn, replierName: 'Judith Asselbergs' }]) {
    const body = templateCheckIn(input);
    assertEquals((body.match(/\?/g) ?? []).length, 1);
    assertEquals(/Groet,\nSjoerd$/.test(body), true);
    assertEquals(body.includes('—'), false);
  }
});

Deno.test('the check-in greets the person who replied, or the team', () => {
  assertStringIncludes(templateCheckIn({ ...checkIn, replierName: 'Judith Asselbergs' }), 'Hoi Judith,');
  assertStringIncludes(templateCheckIn(checkIn), 'Beste team van De Nieuwe Kracht,');
});

Deno.test('the check-in does not offer a second test code', () => {
  assertEquals(templateCheckIn({ ...checkIn, codeIssued: true }).includes('gratis testcode'), false);
  assertStringIncludes(templateCheckIn(checkIn), 'gratis testcode');
});

Deno.test('the check-in prompt carries their reply and the skeleton', () => {
  const msg = buildCheckInMessage(checkIn);
  assertStringIncludes(msg, 'meegeven aan mijn collega');
  assertStringIncludes(msg, 'is het al ter sprake gekomen?');
});
