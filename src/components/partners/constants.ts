/**
 * Single source of truth for the partner-channel pages (/partners and
 * /partners/voorbeeldrapport). Everything a human might want to swap without
 * touching markup lives here.
 */

/** Booking link on the pilot CTA. Swap the slug here if the event changes. */
export const CALENDLY_URL = 'https://calendly.com/sjoerd-bethehitl/new-meeting';

/** Public contact address used in the pilot paragraph. */
export const CONTACT_EMAIL = 'info@cairnly.io';

/**
 * The specimen report served on /partners/voorbeeldrapport. This is the
 * white-labelled variant (partner "Loopbaanbureau Voorbeeld", logo on the
 * cover and in every running header) rather than the `[partnernaam]`
 * template, so a prospect sees a finished document instead of a mail merge.
 * See partners/README.md for how the specimens are rendered.
 *
 * ⚠️ `.gitignore` blocks `*.pdf` globally; `!public/partners/*.pdf` carves out
 * this one path. Without that negation the file never reaches Vercel.
 */
export const SAMPLE_PDF_PATH = '/partners/cairnly-voorbeeldrapport-nl.pdf';

/**
 * Hero carousel slides. Deliberately raw screen captures rather than cropped
 * artwork: the PDF viewer's page rail around the chart is the thing that tells
 * a prospect they are looking at a real report, not a marketing graphic.
 *
 * Adding one is three steps: drop the file in `public/partners/`, add a line
 * here, and add `hero.slides.<key>.{alt,meta}` to both partners locale files.
 * A slide whose file is missing is dropped from the carousel at runtime, so
 * an entry can be declared before the screenshot exists.
 */
export interface PartnerSlide {
  /** Path under public/. */
  src: string;
  /** Key under `hero.slides` in the partners namespace. */
  key: string;
}

export const PARTNER_SLIDES: PartnerSlide[] = [
  { src: '/partners/partner-radar-voorbeeld.png', key: 'radar' },
  { src: '/partners/partner-dashboard-voorbeeld.png', key: 'dashboard' },
];

/** Route of the specimen page, referenced from the hero CTA and the back link. */
export const SAMPLE_ROUTE = '/partners/voorbeeldrapport';
