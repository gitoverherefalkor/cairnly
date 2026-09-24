// The answer to a clear "no, thank you". Boilerplate on purpose.
//
// Sjoerd's rule (2026-09-11, decision C; automated 2026-09-24): a rejection
// gets a short thank-you and, if no code went out yet, the offer of a free
// test code should they change their mind. After a code went out, ask once
// why it did not fit, with four choices so answering costs one letter.
//
// These go out without a human reading them, and only when the rejection is
// unambiguous (see outreachRouting.ts). No model touches the text: a template
// cannot misread a mail. Dutch, no dashes.

import { agencyName, firstName } from './outreachFollowUp.ts';

export interface RejectionInput {
  bureau: string;
  /** Display name of whoever wrote the rejection, from the From header. */
  replierName: string | null;
  codeIssued: boolean;
}

export function templateRejection(input: RejectionInput): string {
  const name = firstName(input.replierName);
  const greeting = name ? `Hoi ${name},` : `Beste team van ${agencyName(input.bureau)},`;
  const middle = input.codeIssued
    ? [
        'Dank voor je reactie, helder.',
        '',
        'Mag ik vragen waarom het niet paste? Eén letter terugmailen is genoeg: (a) te weinig tijd, (b) past niet bij onze aanpak, (c) prijs, (d) anders.',
      ]
    : [
        'Dank voor je reactie, helder. Jammer, maar goed om te weten.',
        '',
        'Mocht je je later bedenken: laat het weten, dan stuur ik je een gratis testcode, zonder voorwaarden.',
      ];
  return [greeting, '', ...middle, '', 'Groet,', 'Sjoerd'].join('\n');
}
