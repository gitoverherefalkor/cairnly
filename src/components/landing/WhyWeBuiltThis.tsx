import React from 'react';
import Reveal from './Reveal';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

const WhyWeBuiltThis: React.FC = () => (
  <section
    id="about"
    className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
  >
    <div className="absolute right-[-20px] md:right-[20px] top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.09]">
      <img src={CairnSymbolInvert} alt="" className="w-[210px] md:w-[270px] h-auto" />
    </div>
    <div className="lp-container relative z-10">
      <Reveal className="max-w-3xl">
        <div className="lp-eyebrow text-[#D4A024] mb-6">Why we built this</div>
        <h2
          className="font-heading font-bold leading-[1.1]"
          style={{ fontSize: 'clamp(28px, 3.5vw, 52px)', letterSpacing: '-0.015em' }}
        >
          Most careers{' '}
          <br />
          aren't really <span className="lp-text-gold-grad">chosen</span>.
        </h2>
        <div className="mt-10 space-y-6 text-lg text-white/75 font-medium leading-relaxed">
          <p>
            They're inherited from a decision someone made at 16, before they knew themselves well
            enough to make it. A general direction shaped a major. A major shaped a first job. A
            first job shaped the next ten. By the time you look up, you might be a department
            manager when you'd have made a better entrepreneur, or a builder, or something you've
            never even considered.
          </p>
          <p>
            We built Cairnly because the tools for asking that question properly didn't exist.
            Personality tests give you a label. Coaching takes months and costs thousands. Free
            quizzes give you what you paid for. So we built one assessment, honest about its
            methods, that takes who you actually are now and gives you specific roles to go look at
            on Monday. No subscription, no roster of upsells. One clear answer, then we get out of
            your way.
          </p>
        </div>
        <div className="mt-12 flex items-center gap-3 text-white/40">
          <div className="h-px w-12 bg-white/20" />
          <span className="text-[12px] uppercase tracking-[0.22em] font-bold">
            The Cairnly team, Utrecht
          </span>
        </div>
      </Reveal>
    </div>
  </section>
);

export default WhyWeBuiltThis;
