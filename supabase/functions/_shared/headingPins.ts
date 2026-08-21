// Pinned heading + title translations for report sections.
//
// The frontend matches subsection headings against exact strings (the icon
// dictionary in src/components/chat/subsectionIcons.ts, the share-quote
// anchors in dashboardV2Shared.tsx, the sidebar's altTitles). Free
// translation of headings would be correct prose but would un-anchor those
// lookups, so translate-section pins every known heading to ONE fixed
// translation per language. Prose stays free; headings are vocabulary.
//
// The Dutch strings are copied from the subheader tables of the old live n8n
// prompts wherever those existed (so they match what NL users already saw and
// what subsectionIcons.ts already contains), and completed for the headings
// the old prompts never pinned (top-3/runner-up careers, exec summary).
//
// A vitest drift test (src/lib/headingPins.test.ts) asserts every pinned NL
// heading whose English form has an icon also resolves in the icon map.
//
// Adding a language: add a map under its code. Keys are the canonical English
// strings exactly as the generators emit them.

export const HEADING_PINS: Record<string, Record<string, string>> = {
  nl: {
    // ── Section titles (report_sections.title) ──
    'Understanding Your Approach': 'Jouw aanpak begrijpen',
    'Strengths and How to Grow Them': 'Sterke punten en hoe je ze ontwikkelt',
    'Areas for Development': 'Ontwikkelpunten',
    'Aligning with Your Values': 'Aansluiten bij je waarden',
    'Executive Summary': 'Samenvatting',

    // ── Personality subheaders (WF1) ──
    'Personality and Interaction Style': 'Persoonlijkheid en interactiestijl',
    'Your Conflict Style': 'Je conflictstijl',
    'Impact in Different Environments': 'Impact in verschillende omgevingen',
    'Identifying Your Core Strengths': 'Je kernkwaliteiten in kaart',
    'How You Think': 'Hoe je denkt',
    'Leveraging Strengths in Your Career': 'Je sterke punten benutten in je loopbaan',
    'Understanding Potential Growth Areas': 'Inzicht in je groeigebieden',
    'Implications for Your Growth': 'Wat dit betekent voor je groei',
    'Your Growth Edge': 'Je volgende groeistap',
    'Identifying Your Core Values': 'Je kernwaarden in kaart',
    'Values in Career Decisions': 'Waarden in loopbaankeuzes',
    'Key Insight': 'Belangrijkste inzicht',

    // ── Executive summary subheaders (WF7) ──
    'Professional Identity': 'Professionele identiteit',
    'Key Strengths & Growth Areas': 'Sterke punten & groeigebieden',
    'Career Direction': 'Loopbaanrichting',
    'Path Forward': 'De weg vooruit',

    // ── Top-career / runner-up subheaders (WF4/WF3) ──
    'Overview': 'Overzicht',
    'Why this role fits you': 'Waarom deze rol bij je past',
    "What you'll actually do": 'Wat je daadwerkelijk gaat doen',
    'What works for you': 'Wat voor jou werkt',
    'The Reality Check': 'De realiteitscheck',
    'The practical stuff': 'De praktische kant',
    'How AI will impact this role': 'AI-impact op deze rol',
    'Future-proof skills': 'Toekomstbestendige vaardigheden',
    'Alignment with your ambitions': 'Aansluiting bij je ambities',

    // ── Outside-the-box subheaders (WF3) ──
    'Why this might be a fit': 'Waarom dit bij je past',
    'Path Type & Reality': 'Type pad & realiteit',
    'AI Impact on this role': 'AI-impact op deze rol',

    // ── Dream-job subheaders (WF4) ──
    'Feasibility Rating': 'Haalbaarheidsscore',
    'Personality & Energy Fit': 'Aansluiting op persoonlijkheid en energie',
    'The "Executive Version" Suggestion': 'De executive-versie',
    'Industry Outlook & Regional Trends': 'Sectorvooruitzichten en regionale trends',
    'Steps for Pursuing This Role': 'Stappen om deze rol na te streven',
  },
};
