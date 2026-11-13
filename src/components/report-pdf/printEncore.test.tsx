import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/i18n', () => ({ default: {} }));

import { PrintClosing } from './PrintClosing';
import { PrintChapterDivider } from './PrintChapterDivider';
import { PrintEncoreContext } from './printFlavor';
import { V4CareerMapSVG } from '@/components/dashboard/v2/V4CareerMapSVG';

// The PDF renderer has no browser flag, so Encore must come from the data.
describe('Encore print framing', () => {
  it('career map uses Encore Dutch labels when told so, Pro labels otherwise', () => {
    const encore = renderToStaticMarkup(<V4CareerMapSVG points={[]} lang="nl" encore />);
    expect(encore).toContain('BESTE KANS');
    expect(encore).toContain('LIEVER NIET');
    expect(encore).not.toContain('SWEET SPOT');
    const pro = renderToStaticMarkup(<V4CareerMapSVG points={[]} lang="nl" encore={false} />);
    expect(pro).toContain('SWEET SPOT');
  });

  it('closing page: Encore Dutch in "u", no Pro tool ladder', () => {
    const html = renderToStaticMarkup(<PrintClosing lang="nl" encore />);
    expect(html).toContain('U weet waar u staat.');
    expect(html).not.toMatch(/Tailor|geld terug|\bje\b/i);
  });

  it('chapter divider follows the Encore context', () => {
    const html = renderToStaticMarkup(
      <PrintEncoreContext.Provider value>
        <PrintChapterDivider chapter="careers" lang="nl" />
      </PrintEncoreContext.Provider>,
    );
    expect(html).toContain('Richtingen voor wat hierna komt');
    expect(html).not.toMatch(/\b(je|jouw)\b/i);
  });
});
