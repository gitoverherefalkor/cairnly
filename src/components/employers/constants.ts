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
 * The "What your employee sees" block quotes the start screen of a
 * company-sponsored assessment word for word. That screen does NOT exist yet
 * (2026-09-25): there is no employer concept in the code, codes only carry a
 * partner_id. Keep this false until the line is really on the start screen,
 * or the page promises something the product doesn't do.
 */
export const SHOW_EMPLOYEE_SCREEN_QUOTE = false;
