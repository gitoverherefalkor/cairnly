/** The public replay route. */
export const DEMO_ROUTE = '/demo';
/** The persona's finished dashboard, read-only, fed from the same fixture. */
export const DEMO_DASHBOARD_ROUTE = '/demo/dashboard';
/** The persona's job search: frozen results + kanban from the same fixture. */
export const DEMO_JOBS_ROUTE = '/demo/jobs';

/**
 * A persona's finished report as a PDF, rendered from the same report the
 * transcript was frozen from (feedback from the session already folded in).
 * `scripts/demo-render-pdf.mjs` writes `cairnly-demo-<persona>-<lang>.pdf`
 * into public/demo/; `.gitignore` blocks `*.pdf` globally and
 * `!public/demo/*.pdf` carves out this one directory so the files reach the
 * build.
 */
export const demoPdfPath = (personaId: string, language: string) =>
  `/demo/cairnly-demo-${personaId}-${language}.pdf`;

/**
 * The same report as the white-label TEMPLATE for the partner audience
 * (`/demo?p=…`): `[partnernaam]` where the bureau's name goes, no logo.
 * Rendered with `scripts/demo-render-pdf.mjs --partner-name='[partnernaam]'`
 * into public/partners/, which is the one directory `.gitignore` already
 * lets PDFs through for.
 */
export const DEMO_PARTNER_TEMPLATE_PDF_PATH = '/partners/cairnly-voorbeeldrapport-nl-template.pdf';
