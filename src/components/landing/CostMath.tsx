import React from 'react';
import Reveal from './Reveal';

const CostMath: React.FC = () => (
  <section className="bg-[#FAF5E8] py-20 md:py-24">
    <div className="lp-container">
      <Reveal className="max-w-3xl mx-auto text-center">
        <div className="lp-eyebrow text-[#1F8282] mb-5">The math</div>
        <h2
          className="font-heading font-bold text-[#122E3B] leading-[1.15]"
          style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
        >
          A one-off fee.{' '}
          <br />
          <span className="lp-text-teal-grad">Not a monthly bill, forever.</span>
        </h2>
        <p className="mt-7 text-base md:text-lg text-[#4B6373] font-medium leading-relaxed">
          A subscription pays for ongoing access. Cairnly pays for a finished answer.
        </p>
      </Reveal>
    </div>
  </section>
);

export default CostMath;
