import { describe, expect, it } from 'vitest';
import { partnerLandingPath, partnerSignupPath, readPartnerLang } from './partnerLinks';

describe('partner links', () => {
  it('builds the signup handoff with code and language', () => {
    expect(partnerSignupPath('ABCD-EFGH-JKLM-NPQR', 'nl')).toBe(
      '/auth?flow=signup&code=ABCD-EFGH-JKLM-NPQR&lang=nl',
    );
    expect(partnerSignupPath('ABCD-EFGH-JKLM-NPQR', 'en')).toBe(
      '/auth?flow=signup&code=ABCD-EFGH-JKLM-NPQR&lang=en',
    );
  });

  it('still hands over without a code, so the candidate can type one', () => {
    expect(partnerSignupPath(null, 'nl')).toBe('/auth?flow=signup&lang=nl');
    expect(partnerSignupPath('', 'nl')).toBe('/auth?flow=signup&lang=nl');
  });

  it('encodes a code that somehow carries odd characters', () => {
    expect(partnerSignupPath('A B&C', 'en')).toBe('/auth?flow=signup&code=A%20B%26C&lang=en');
  });

  it('builds the landing path the partner hands out', () => {
    expect(partnerLandingPath('bureau-x', 'ABCD-EFGH-JKLM-NPQR', 'nl')).toBe(
      '/p/bureau-x?code=ABCD-EFGH-JKLM-NPQR&lang=nl',
    );
  });

  it('reads only languages the site supports', () => {
    expect(readPartnerLang('nl')).toBe('nl');
    expect(readPartnerLang('nl-NL')).toBe('nl');
    expect(readPartnerLang('en')).toBe('en');
    expect(readPartnerLang('de')).toBe('en');
    expect(readPartnerLang(null)).toBe('en');
  });
});
