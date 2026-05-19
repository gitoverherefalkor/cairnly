import React from 'react';
import { CheckCircle2, Sparkles, ArrowRight, Lock, Shield, ClipboardCheck } from 'lucide-react';
import Reveal from './Reveal';
import { useGetStarted } from './useGetStarted';

const FEATURES = [
  'Complete personality and career assessment',
  'AI analysis tailored to your goals',
  'Interactive coaching chat with follow-up questions',
  'Up to 14 careers in 4 categories',
  'Role details and localized salary ranges',
  'AI-impact ratings on every suggested role',
  'Dream-job feasibility assessment',
  'Full report incorporating your chat feedback',
];

const PricingSection: React.FC = () => {
  const getStarted = useGetStarted();

  return (
    <section id="pricing" className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden">
      <div
        className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.10)', filter: 'blur(120px)', marginLeft: -200 }}
      />

      <div className="lp-container relative z-10">
        <Reveal
          className="max-w-6xl mx-auto lp-pricing-card rounded-[2.5rem] overflow-hidden grid lg:grid-cols-12"
          style={{ boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5)' }}
        >
          {/* Value list */}
          <div className="lg:col-span-7 p-10 md:p-14 text-[#122E3B]">
            <div className="lp-eyebrow text-[#1F8282] mb-5">The package</div>
            <h2
              className="font-heading font-bold leading-[1.1] mb-10"
              style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', letterSpacing: '-0.012em' }}
            >
              Everything you need to find your <span className="lp-text-teal-grad">right path</span>
            </h2>
            <ul className="space-y-3.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-4 text-[15px] font-bold text-[#374151]">
                  <CheckCircle2 size={20} strokeWidth={2.2} color="#27A1A1" className="shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
              <li className="flex items-start gap-4 text-[15px] font-extrabold pt-3" style={{ color: '#D4A024' }}>
                <Sparkles size={20} strokeWidth={2.2} color="#D4A024" className="shrink-0 mt-0.5" />
                <span>
                  If the suggestions land, we help you land the job{' '}
                  <span className="font-medium italic">(beta)</span>
                </span>
              </li>
            </ul>
          </div>

          {/* Price panel */}
          <div
            className="lg:col-span-5 p-10 md:p-14 flex flex-col justify-center items-center text-center"
            style={{ background: '#F4ECDA', borderLeft: '1px solid rgba(201,182,144,0.6)' }}
          >
            <div
              className="px-5 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-[0.22em] mb-8"
              style={{ background: '#D4A024', color: '#1A1A1A' }}
            >
              Limited offer · Beta Access
            </div>

            <div className="flex items-end gap-4 mb-3">
              <span style={{ color: '#9CA3AF', textDecoration: 'line-through', fontSize: 22, fontWeight: 600 }}>
                €69
              </span>
              <span
                className="font-heading text-[#122E3B]"
                style={{ fontSize: 64, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em' }}
              >
                €39
              </span>
            </div>
            <p className="text-[#6B7F8B] font-bold uppercase tracking-[0.22em] text-[10px] mb-10">
              A one-off payment
            </p>

            <button
              onClick={getStarted}
              className="lp-btn-primary w-full justify-center"
              style={{ fontSize: 18, padding: '18px 28px' }}
            >
              Get Beta Access — €39
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>

            <div className="mt-8 flex items-center justify-center gap-5 text-[#6B7F8B] text-[12px] font-semibold">
              <span className="flex items-center gap-1.5"><Lock size={14} strokeWidth={2} />Stripe</span>
              <span className="flex items-center gap-1.5"><Shield size={14} strokeWidth={2} />GDPR</span>
              <span className="flex items-center gap-1.5"><ClipboardCheck size={14} strokeWidth={2} />No subscription</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default PricingSection;
