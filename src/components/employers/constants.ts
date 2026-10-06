import { DEMO_DASHBOARD_ROUTE } from '@/demo/constants';
import { personaForLanguage, type DemoPersonaId } from '@/demo/loadFixture';

/**
 * Single source of truth for /employers. The booking link and the contact
 * address are the partner channel's, re-exported so a change there reaches
 * both pages.
 */
export { CALENDLY_URL, CONTACT_EMAIL } from '@/components/partners/constants';

export const EMPLOYERS_ROUTE = '/employers';

/**
 * One persona per page language, pinned so the deck never cycles. English:
 * Emma (senior marketing manager, London fintech), who looks like the tech and
 * scale-up workforce the English page is aimed at. Dutch: Marcel (team leader
 * at an insurer), because his whole session is in Dutch and a Dutch HR reader
 * should see a conversation they can read.
 */
export const employerDemoPersona = (language: string | undefined): DemoPersonaId => personaForLanguage(language);

/** "See a finished report": the persona's read-only dashboard, no partner tag. */
export const employerReportLink = (persona: DemoPersonaId) => `${DEMO_DASHBOARD_ROUTE}?persona=${persona}`;

/**
 * Where "Get a trial code" mails to. Tasha runs the employers channel and
 * answers these herself, from Ops > Employers (2026-10-06). The rest of the
 * page keeps the general CONTACT_EMAIL.
 */
export const TRIAL_EMAIL = 'natasha@cairnly.io';

/**
 * The "What your employee sees" block quotes the start screen of a
 * company-sponsored assessment word for word. Since 2026-10-06 that line is
 * really there: a seat code (Ops > Employers) shows SponsoredNotice on the
 * assessment's first screen, and SponsoredNotice.test.ts keeps the two texts
 * identical. Set this back to false if that notice ever goes away.
 */
export const SHOW_EMPLOYEE_SCREEN_QUOTE = true;
