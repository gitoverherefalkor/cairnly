/**
 * Single source of truth for the partner-channel pages (/partners and
 * /partners/voorbeeldrapport). Everything a human might want to swap without
 * touching markup lives here.
 */

/** Booking link on the pilot CTA. Swap the slug here if the event changes. */
export const CALENDLY_URL = 'https://calendly.com/sjoerd-bethehitl/30min';

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

/** Radar chart lifted from the specimen report. Optional: the hero renders a
 *  dashed placeholder frame until this file exists. */
export const RADAR_IMAGE_PATH = '/partners/partner-radar-voorbeeld.png';

/** Route of the specimen page, referenced from the hero CTA and the back link. */
export const SAMPLE_ROUTE = '/partners/voorbeeldrapport';
