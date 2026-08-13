import React from 'react';

/** One A4 sheet. Padding is inside the fixed 210×297mm box, so content never
 *  pushes the sheet taller and creates a stray blank page.
 *
 *  `footer` renders as an absolutely-positioned strip pinned to the bottom of
 *  the sheet. `.print-page` is already `position: relative` (printStyles.ts),
 *  and absolute positioning keeps the footer out of normal flow so it cannot
 *  grow the sheet. It sits at bottom 8mm, inside the 18mm padding band, so it
 *  never collides with body content. Omit it and nothing changes. */
export const PrintPage: React.FC<{
  children: React.ReactNode;
  padded?: boolean;
  footer?: React.ReactNode;
}> = ({ children, padded = true, footer }) => (
  <div className="print-page" style={{ padding: padded ? '18mm 16mm' : 0 }}>
    {children}
    {footer && (
      <div
        style={{
          position: 'absolute',
          left: '16mm',
          right: '16mm',
          bottom: '8mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {footer}
      </div>
    )}
  </div>
);
