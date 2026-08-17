import React from 'react';

/** A block designed to occupy exactly one printed page — the cover and the
 *  charts page. The narrative does NOT use this: it flows and lets Chromium
 *  paginate, because individual report sections can exceed a page and any
 *  fixed-height container would clip them. See printStyles.ts.
 *
 *  `cover` makes the sheet full-bleed (210×297mm with no padding), which pairs
 *  with the `@page :first { margin: 0 }` rule. Non-cover sheets sit inside the
 *  @page margins and so need no size of their own. */
export const PrintSheet: React.FC<{
  children: React.ReactNode;
  cover?: boolean;
  /** Centres a single chart card vertically on the page. See printStyles.ts for
   *  why charts get one sheet each. */
  chart?: boolean;
}> = ({ children, cover = false, chart = false }) => {
  // `print-sheet--paper` is styled ONLY inside @media screen: it draws the
  // paper edge so a chart sheet can be eyeballed in a normal browser without
  // re-rendering Chromium. The PDF ignores it entirely.
  const className = cover
    ? 'print-sheet print-sheet--cover'
    : `print-sheet print-sheet--paper${chart ? ' print-sheet--chart' : ''}`;
  return <div className={className}>{children}</div>;
};
