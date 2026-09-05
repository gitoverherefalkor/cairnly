import { DEMO_ROUTE } from '@/demo/constants';

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
 * The demo, as the partner page links to it: always Marcel (the Dutch
 * candidate, the persona a bureau's caseload looks like) and always tagged
 * `?p=partners`, which switches the demo's CTAs to the pilot call, serves the
 * white-label PDF template and attributes the visit.
 */
export const PARTNER_DEMO_PERSONA = 'marcel' as const;
export const PARTNER_DEMO_SEARCH = '?p=partners';
export const partnerDemoLink = (route: string = DEMO_ROUTE) =>
  `${route}${PARTNER_DEMO_SEARCH}&persona=${PARTNER_DEMO_PERSONA}`;

/** Route of the specimen page, referenced from the hero CTA and the back link. */
export const SAMPLE_ROUTE = '/partners/voorbeeldrapport';

/**
 * The live landing page of the specimen partner, linked from the "this is
 * what your candidate sees" block. Same bureau as the sample PDF. No code on
 * the link: a prospect should see the page, not start an assessment.
 */
export const CANDIDATE_START_EXAMPLE_PATH = '/p/voorbeeld';
