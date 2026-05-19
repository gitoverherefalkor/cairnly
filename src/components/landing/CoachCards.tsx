import React from 'react';
import { FileText, Sparkles, MessageSquare } from 'lucide-react';
import Reveal from './Reveal';

const CoachCards: React.FC = () => (
  <section className="bg-[#FAF5E8] py-24 md:py-32">
    <div className="lp-container">
      <div className="lp-chapter-rule mb-14">
        <span className="lp-chapter-rule__dot" />
      </div>

      <Reveal className="text-center max-w-3xl mx-auto mb-16">
        <div className="lp-eyebrow text-[#1F8282] mb-5">The chat that comes with your report</div>
        <h2
          className="font-heading font-bold text-[#122E3B] leading-[1.12]"
          style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
        >
          If something doesn't fit, tell it.{' '}
          <br />
          <span className="lp-text-teal-grad">The report adapts.</span>
        </h2>
        <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed">
          Every Cairnly report comes with an interactive coaching chat, but not the kind that bills
          you monthly to be your friend. It's a refinement loop. A way to challenge the AI when
          something doesn't ring true, so the final report actually does.
        </p>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-center max-w-6xl mx-auto">
        {/* Static PDF */}
        <Reveal className="md:py-2">
          <div
            className="rounded-2xl p-7 md:p-8"
            style={{ background: 'rgba(18,46,59,0.04)', border: '1px solid rgba(201,182,144,0.6)' }}
          >
            <div className="text-[#6B7F8B] mb-5">
              <FileText size={32} strokeWidth={1.6} />
            </div>
            <h4 className="font-heading font-extrabold text-lg text-[#6B7F8B] mb-3">A static PDF</h4>
            <p className="text-[14px] text-[#6B7F8B] font-medium leading-relaxed">
              Reads you once, prints an answer, walks away. If a recommendation feels wrong, your
              only option is to ignore it.
            </p>
          </div>
        </Reveal>

        {/* Cairnly (highlighted) */}
        <Reveal style={{ transform: 'scale(1.04)' }}>
          <div
            className="rounded-2xl p-8 md:p-10 relative"
            style={{
              background: '#FBF6E8',
              border: '1px solid #D4A024',
              boxShadow: '0 32px 60px -20px rgba(18,46,59,0.18), 0 0 0 6px rgba(212,160,36,0.12)',
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ background: '#D4A024', color: '#1A1A1A' }}
            >
              Cairnly
            </div>
            <div className="text-[#27A1A1] mb-5">
              <Sparkles size={34} strokeWidth={1.6} />
            </div>
            <h4 className="font-heading font-bold text-xl md:text-2xl text-[#122E3B] mb-3" style={{ letterSpacing: '-0.01em' }}>
              A Cairnly report
            </h4>
            <p className="text-[15px] text-[#122E3B] font-semibold leading-relaxed">
              Comes with a chat that has one job:{' '}
              <span className="text-[#1F8282]">sharpen the answer</span>. Push back. Say "actually,
              I'd hate that one" or "tell me more about runner-up #2." The final report incorporates
              your feedback. Then you take it and go.
            </p>
          </div>
        </Reveal>

        {/* Subscription chat */}
        <Reveal className="md:py-2">
          <div
            className="rounded-2xl p-7 md:p-8"
            style={{ background: 'rgba(18,46,59,0.04)', border: '1px solid rgba(201,182,144,0.6)' }}
          >
            <div className="text-[#6B7F8B] mb-5">
              <MessageSquare size={32} strokeWidth={1.6} />
            </div>
            <h4 className="font-heading font-extrabold text-lg text-[#6B7F8B] mb-3">A subscription chat</h4>
            <p className="text-[14px] text-[#6B7F8B] font-medium leading-relaxed">
              Stays available forever. Designed to keep you logging in. Great for company. Less
              great for closing the question.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal as="div" className="max-w-3xl mx-auto mt-14">
        <p className="text-center text-base md:text-lg text-[#4B6373] italic font-medium leading-relaxed">
          It's the difference between a report <em>about</em> you and a report <em>with</em> you.
          And once it's right, it stays right.
        </p>
      </Reveal>
    </div>
  </section>
);

export default CoachCards;
