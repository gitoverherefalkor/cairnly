/** The public replay route. */
export const DEMO_ROUTE = '/demo';

/**
 * The persona's finished report as a PDF, rendered from the same report the
 * transcript was frozen from (feedback from the session already folded in).
 * `.gitignore` blocks `*.pdf` globally; `!public/demo/*.pdf` carves out this
 * one directory so the file reaches the build.
 */
export const DEMO_PDF_PATH = '/demo/cairnly-demo-marloes-nl.pdf';

/**
 * The same report as the white-label TEMPLATE for the partner audience
 * (`/demo?p=…`): `[partnernaam]` where the bureau's name goes, no logo.
 * Rendered with `scripts/demo-render-pdf.mjs --partner-name='[partnernaam]'`
 * into public/partners/, which is the one directory `.gitignore` already
 * lets PDFs through for.
 */
export const DEMO_PARTNER_TEMPLATE_PDF_PATH = '/partners/cairnly-voorbeeldrapport-nl-template.pdf';
