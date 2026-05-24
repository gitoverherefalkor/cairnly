// Shared font registration for the designed résumé templates.
//
// react-pdf needs TTF / OTF / WOFF (no WOFF2). The four families below are
// vendored as static files in public/fonts/cairnly-resume/ so PDF generation
// doesn't depend on a CDN at render time.
//
// Inter is registered once as a variable font — react-pdf reads the wght axis
// when a numeric fontWeight is requested, so 400/500/600/700 all resolve from
// the same file.

import { Font } from '@react-pdf/renderer';

let registered = false;

export function registerDesignedFonts(): void {
  if (registered) return;
  registered = true;

  // Italics use the regular files as fallback (faux italic — no slant) so
  // react-pdf's font shaper doesn't crash when text inherits italic from a
  // parent. The two places we actually request italic visually (Classic
  // company names, Bold degree labels) currently render upright; swap in
  // real italic font files here if you want true italics.
  Font.register({
    family: 'Inter',
    fonts: [
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 400 },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 500 },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 600 },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 700 },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 400, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 500, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 600, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/Inter-Variable.ttf', fontWeight: 700, fontStyle: 'italic' },
    ],
  });

  Font.register({
    family: 'Source Serif 4',
    fonts: [
      { src: '/fonts/cairnly-resume/SourceSerif4-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/cairnly-resume/SourceSerif4-SemiBold.ttf', fontWeight: 600 },
      { src: '/fonts/cairnly-resume/SourceSerif4-Regular.ttf', fontWeight: 400, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/SourceSerif4-SemiBold.ttf', fontWeight: 600, fontStyle: 'italic' },
    ],
  });

  Font.register({
    family: 'Bricolage Grotesque',
    fonts: [
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Regular.otf', fontWeight: 400 },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Medium.otf', fontWeight: 500 },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-SemiBold.otf', fontWeight: 600 },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Bold.otf', fontWeight: 700 },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Regular.otf', fontWeight: 400, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Medium.otf', fontWeight: 500, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-SemiBold.otf', fontWeight: 600, fontStyle: 'italic' },
      { src: '/fonts/cairnly-resume/BricolageGrotesque-Bold.otf', fontWeight: 700, fontStyle: 'italic' },
    ],
  });

  Font.register({
    family: 'JetBrains Mono',
    fonts: [
      { src: '/fonts/cairnly-resume/JetBrainsMono-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/cairnly-resume/JetBrainsMono-Regular.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  });

  // Disable hyphenation across the board — résumé bullets and contact
  // strings shouldn't break mid-word.
  Font.registerHyphenationCallback((word) => [word]);
}
