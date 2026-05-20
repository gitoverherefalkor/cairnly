import React from 'react';

interface InlineStatProps {
  number: string;
  text: React.ReactNode;
  source: string;
}

/** Gold-tinted inline callout with a big number, used inside chapter bodies. */
const InlineStat: React.FC<InlineStatProps> = ({ number, text, source }) => (
  <div className="lp-stat-inline">
    <div className="lp-stat-inline__num">{number}</div>
    <div className="lp-stat-inline__text">
      {text}
      <span className="lp-src">{source}</span>
    </div>
  </div>
);

export default InlineStat;
