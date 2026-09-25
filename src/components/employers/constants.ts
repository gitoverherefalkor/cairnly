import { DEMO_DASHBOARD_ROUTE } from '@/demo/constants';

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

/** "See a finished report": Emma's read-only dashboard, no partner tag. */
export const employerReportLink = `${DEMO_DASHBOARD_ROUTE}?persona=${EMPLOYER_DEMO_PERSONA}`;

/**
 * The "What your employee sees" block quotes the start screen of a
 * company-sponsored assessment word for word. That screen does NOT exist yet
 * (2026-09-25): there is no employer concept in the code, codes only carry a
 * partner_id. Keep this false until the line is really on the start screen,
 * or the page promises something the product doesn't do.
 */
export const SHOW_EMPLOYEE_SCREEN_QUOTE = false;
