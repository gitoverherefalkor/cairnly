import { DEMO_SURVEY_ROUTE } from '@/demo/constants';

/**
 * Single source of truth for /employers. The booking link and the contact
 * address are the partner channel's, re-exported so a change there reaches
 * both pages.
 */
export { CALENDLY_URL, CONTACT_EMAIL } from '@/components/partners/constants';

export const EMPLOYERS_ROUTE = '/employers';

/**
 * Emma (senior marketing manager, London fintech) is the persona that looks
 * like the tech and scale-up workforce this page is aimed at. Pinned so the
 * deck never cycles to Marcel.
 */
export const EMPLOYER_DEMO_PERSONA = 'emma' as const;

/**
 * "See the assessment" goes to the survey demo, WITHOUT the partner `?p=`
 * tag: that tag switches the demo to white-label copy ("under your logo",
 * "back to the partner page"), which is wrong for an employer.
 */
export const employerAssessmentLink = `${DEMO_SURVEY_ROUTE}?persona=${EMPLOYER_DEMO_PERSONA}`;
