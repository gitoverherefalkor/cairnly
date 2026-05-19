import React from 'react';
import { Navigation, MessageSquare, BarChart3, CheckCircle2 } from 'lucide-react';
import Reveal from './Reveal';

const PILLARS = [
  {
    num: '01',
    Icon: Navigation,
    title: 'Not another personality test',
    body: 'Personality tests give you a four-letter label. Cairnly gives you specific job titles: your best fits, runner-ups, and one out-of-the-box option you wouldn\'t have considered.',
  },
  {
    num: '02',
    Icon: MessageSquare,
    title: 'Interactive, not static',
    body: 'Every report comes with a coaching chat. If a recommendation doesn\'t land, push back. The report adapts until it actually fits.',
  },
  {
    num: '03',
    Icon: BarChart3,
    title: 'Future-aware',
    body: 'Every suggested role includes an honest read on how AI is set to reshape it. We tell you what\'s likely to grow and what\'s likely to shrink.',
  },
  {
    num: '04',
    Icon: CheckCircle2,
    title: 'Honest, not flattering',
    body: 'Real reality checks on challenges, trade-offs, and the skills you\'d need to develop. We\'re not here to cheerlead. We\'re here to help you choose well.',
  },
];

const Pillars: React.FC = () => (
  <section className="bg-[#FAF5E8] py-24 md:py-32">
    <div className="lp-container">
      <div className="lp-chapter-rule mb-14">
        <span className="lp-chapter-rule__dot" />
      </div>

      <Reveal className="text-center max-w-3xl mx-auto mb-16">
        <div className="lp-eyebrow text-[#1F8282] mb-5">Why Cairnly is different</div>
        <h2
          className="font-heading font-bold text-[#122E3B] leading-[1.12]"
          style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
        >
          Four things we got tired of <span className="lp-text-gold-grad">not</span> seeing anywhere else.
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {PILLARS.map(({ num, Icon, title, body }) => (
          <Reveal
            key={num}
            className="lp-pillar-card relative p-8 md:p-10 rounded-2xl"
            style={{ background: '#FBF6E8', border: '1px solid #C9B690' }}
          >
            <div className="flex items-start justify-between mb-6">
              <span className="font-heading font-black text-[44px] text-[#C9B690] leading-none">{num}</span>
              <Icon size={32} strokeWidth={1.8} className="opacity-80" color="#27A1A1" />
            </div>
            <h3
              className="font-heading font-extrabold text-2xl md:text-[24px] text-[#122E3B] mb-3"
              style={{ letterSpacing: '-0.01em' }}
            >
              {title}
            </h3>
            <p className="text-[15px] text-[#4B6373] leading-relaxed font-medium">{body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Pillars;
