// Drift alarm between the pinned heading translations (which the
// translate-section prompt enforces on every translated report) and the
// frontend's exact-match consumers of those strings:
//   - the subsection icon dictionary (chat + dashboard + PDF)
//   - the share-quote anchor groups (dashboard + PDF pull quotes)
// If someone edits a pin without updating the icon map (or vice versa),
// Dutch reports would silently lose icons/quotes — this test fails instead.
import { describe, it, expect } from 'vitest';
import { HEADING_PINS } from '../../supabase/functions/_shared/headingPins';
import { iconForSubsection } from '../components/chat/subsectionIcons';

const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/["“”]/g, '').replace(/\s+/g, ' ');

describe('heading pins ↔ icon map consistency (nl)', () => {
  const pins = HEADING_PINS.nl;

  it('every pinned heading whose English form has an icon resolves in the icon map', () => {
    const missing: string[] = [];
    for (const [en, nl] of Object.entries(pins)) {
      const enIcon = iconForSubsection(en);
      if (!enIcon) continue; // titles and non-icon headings
      if (iconForSubsection(nl) !== enIcon) missing.push(`${en} -> ${nl}`);
    }
    expect(missing).toEqual([]);
  });

  it('pins cover the headings the dashboard extraction relies on', () => {
    // These exact NL strings are matched by extractSubsectionContent calls in
    // DashboardV4 and the SHARE_QUOTE_ANCHORS in dashboardV2Shared.
    expect(pins['Overview']).toBe('Overzicht');
    expect(pins['Alignment with your ambitions']).toBe('Aansluiting bij je ambities');
    expect(pins['Why this role fits you']).toBe('Waarom deze rol bij je past');
    expect(pins['Key Insight']).toBe('Belangrijkste inzicht');
    expect(pins['Why this might be a fit']).toBe('Waarom dit bij je past');
    expect(normalize(pins['Feasibility Rating'])).toBe('haalbaarheidsscore');
  });

  it('AI-impact headings pin to the string the chat regexes were widened for', () => {
    expect(pins['How AI will impact this role']).toBe('AI-impact op deze rol');
    expect(pins['AI Impact on this role']).toBe('AI-impact op deze rol');
  });
});
