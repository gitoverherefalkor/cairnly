import React from 'react';

/** Gold left-border display quote used inside chapter bodies. */
const PullQuote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="lp-pull">{children}</p>
);

export default PullQuote;
