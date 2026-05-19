import React from 'react';
import Reveal from './Reveal';

const Methodology: React.FC = () => (
  <section
    id="methodology"
    className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
  >
    <div className="lp-container relative z-10">
      <Reveal className="text-center max-w-3xl mx-auto mb-16">
        <div className="lp-eyebrow text-[#D4A024] mb-5">Chapter 03 · Methodology</div>
        <h2
          className="font-heading font-bold leading-[1.12]"
          style={{ fontSize: 'clamp(26px, 3vw, 44px)', letterSpacing: '-0.012em' }}
        >
          Not a formula. Not freestyle AI.{' '}
          <br />
          <span className="lp-text-gold-grad">Something in between.</span>
        </h2>
        <p className="mt-7 text-lg text-white/65 font-medium leading-relaxed">
          Most personality frameworks sort you into a box, then tell you what people in that box
          typically do. Generic AI tools skip the science entirely and improvise. Cairnly does
          neither.
        </p>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
        {/* Old approach */}
        <Reveal
          className="rounded-3xl p-8 md:p-10"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span
            className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase mb-7"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}
          >
            Box, then label
          </span>
          <h3 className="font-heading font-bold text-2xl md:text-3xl text-white mb-5" style={{ letterSpacing: '-0.012em' }}>
            The old approach
          </h3>
          <p className="text-[15px] text-white/65 font-medium leading-relaxed mb-5">
            You answer a fixed set of questions. A formula sorts you into one of a small number of
            types. The report describes what people of <em>that type</em> typically do, not what
            would suit you, with your history, in your life.
          </p>
          <p className="text-[15px] text-white/65 font-medium leading-relaxed">
            The labels are catchy. The science behind some of them is contested. And whether you're
            one letter or another doesn't tell you whether to be a UX designer or a recruiter.
          </p>
        </Reveal>

        {/* Cairnly approach */}
        <Reveal
          className="rounded-3xl p-8 md:p-10"
          style={{
            background: '#FBF6E8',
            border: '1px solid #D4A024',
            color: '#122E3B',
            boxShadow: '0 30px 60px -25px rgba(212,160,36,0.4)',
          }}
        >
          <span
            className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase mb-7"
            style={{ background: '#D4A024', color: '#1A1A1A', letterSpacing: '0.12em' }}
          >
            Foundations + customization
          </span>
          <h3 className="font-heading font-bold text-2xl md:text-3xl text-[#122E3B] mb-5" style={{ letterSpacing: '-0.012em' }}>
            Cairnly's approach
          </h3>
          <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed mb-5">
            Our assessment is built on the validated parts of established psychometric research, the
            work that actually predicts career fit, values alignment, and work preferences.{' '}
            <strong className="text-[#122E3B]">We kept what holds up.</strong>
          </p>
          <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed">
            On top of that, we layer the part formulas can't capture: your actual career history,
            what's energized you, what's drained you, where you're trying to go. Frontier AI, guided
            by working career coaches, reads all of it together and writes a report for{' '}
            <em>this</em> person. Not for a type.
          </p>
        </Reveal>
      </div>

      <Reveal as="div" className="max-w-3xl mx-auto mt-14">
        <p className="text-center text-base md:text-lg text-white/55 italic font-medium leading-relaxed">
          The validated parts of psychometric research, the practical instincts of real career
          coaches, and modern AI that can hold all of it in mind at once. So you get advice that's
          actually about you.
        </p>
      </Reveal>
    </div>
  </section>
);

export default Methodology;
