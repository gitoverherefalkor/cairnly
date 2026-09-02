/** The public replay route. */
export const DEMO_ROUTE = '/demo';

/**
 * The persona's finished report as a PDF, rendered from the same report the
 * transcript was frozen from (feedback from the session already folded in).
 * `.gitignore` blocks `*.pdf` globally; `!public/demo/*.pdf` carves out this
 * one directory so the file reaches the build.
 */
export const DEMO_PDF_PATH = '/demo/cairnly-demo-marloes-nl.pdf';
