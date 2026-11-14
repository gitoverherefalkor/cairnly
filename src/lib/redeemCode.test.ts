import { describe, it, expect } from 'vitest';
import { normaliseAccessCode, signupPathForCode } from './redeemCode';

describe('redeem an access code without a link', () => {
  it('accepts a code typed in lower case or with spaces', () => {
    expect(normaliseAccessCode(' hn4r-ff3a-t783-dumr ')).toBe('HN4R-FF3A-T783-DUMR');
    expect(normaliseAccessCode('HN4R FF3A T783 DUMR')).toBe('HN4R-FF3A-T783-DUMR');
    expect(normaliseAccessCode('HN4R - FF3A-T783-DUMR')).toBe('HN4R-FF3A-T783-DUMR');
  });

  it('sends a valid code into the normal code-link signup, in the visitor language', () => {
    expect(signupPathForCode('HN4R-FF3A-T783-DUMR', 'nl-NL')).toBe('/auth?flow=signup&code=HN4R-FF3A-T783-DUMR&lang=nl');
    expect(signupPathForCode('ACME-1', 'en')).toBe('/auth?flow=signup&code=ACME-1&lang=en');
    expect(signupPathForCode('ACME-1', 'de')).toBe('/auth?flow=signup&code=ACME-1&lang=en');
  });
});
