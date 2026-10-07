import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PrintClosing } from './PrintClosing';

// useReferralStatus (for UNLOCK_LADDER) imports the Supabase client and,
// through useAuth, the site's i18n setup; both need a browser or env vars.
// The closing page uses neither, so they are stubbed.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/i18n', () => ({ default: {} }));

// An employer paid for a seat, so the employee's closing page may promise the
// tools but never money back. A bureau's ending still wins over it.
describe('PrintClosing endings', () => {
  it('employee ending (en): privacy promise, tools, no refunds', () => {
    const html = renderToStaticMarkup(<PrintClosing lang="en" sponsored />);
    expect(html).toContain('they will never see this report');
    expect(html).toContain('Tailor Cover Letters');
    expect(html).toContain('offered to you by your employer');
    expect(html).not.toMatch(/refund|money back/i);
  });

  it('employee ending (nl): no refunds', () => {
    const html = renderToStaticMarkup(<PrintClosing lang="nl" sponsored />);
    expect(html).toContain('ziet nooit dit rapport');
    expect(html).not.toMatch(/geld terug|terugbetaling/i);
  });

  it('consumer ending keeps the refund ladder', () => {
    expect(renderToStaticMarkup(<PrintClosing lang="en" />)).toMatch(/refund/i);
  });

  it('a partner ending wins over sponsored', () => {
    const html = renderToStaticMarkup(<PrintClosing lang="en" partnerName="Bureau X" sponsored />);
    expect(html).toContain('your advisor at Bureau X');
    expect(html).not.toContain('offered to you by your employer');
  });
});
