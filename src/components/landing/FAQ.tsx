import React from 'react';
import { Plus } from 'lucide-react';
import Reveal from './Reveal';

const FAQS = [
  {
    q: "Isn't this just ChatGPT in a wrapper?",
    a: 'No. The assessment is built on validated psychometric research and refined with working career coaches. The AI is the engine that processes your specific history and responses against that foundation, it isn\'t improvising. Generic AI tools skip the science. We don\'t.',
    open: true,
  },
  {
    q: 'How is this different from career coaching?',
    a: "Coaching is excellent for executing a direction once you've picked one. But it costs €80–€280 a month indefinitely while you figure out what that direction is. Cairnly is the clarity step that comes before coaching is worth paying for. Roughly half the price of a single coaching session, for the full picture.",
  },
  {
    q: 'How is this different from monthly AI career platforms?',
    a: "Subscription platforms are designed to keep you exploring. We're designed to give you a finished answer. After two months at €25/month, you've paid more than a Cairnly assessment, and you're still being billed. We give you one clear answer, you take it and act on it.",
  },
  {
    q: "What if the recommendations don't feel right?",
    a: 'Push back. The coaching chat exists precisely for that. If a role doesn\'t fit, tell it, and the report adapts. By the time the report is finalized, your feedback is already in it.',
  },
  {
    q: 'Is my data safe?',
    a: 'GDPR-compliant, European servers, payments handled by Stripe (we never see your card), and one-click delete at any time. Your data is yours.',
  },
  {
    q: 'How long does it take?',
    a: 'One sitting. Most people complete the assessment and chat in under an hour. The full report is yours immediately.',
  },
];

const FAQ: React.FC = () => (
  <section className="bg-[#ECE4D2] py-24 md:py-32">
    <div className="lp-container">
      <Reveal className="max-w-3xl mb-14">
        <div className="lp-eyebrow text-[#1F8282] mb-5">Common questions</div>
        <h2
          className="font-heading font-bold text-[#122E3B] leading-[1.12]"
          style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
        >
          Anything still <span className="lp-text-teal-grad">unclear?</span>
        </h2>
      </Reveal>

      <Reveal className="max-w-3xl">
        {FAQS.map((item) => (
          <details key={item.q} className="lp-faq" open={item.open}>
            <summary>
              {item.q}
              <Plus className="lp-chev" size={20} strokeWidth={2.4} color="#27A1A1" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </Reveal>
    </div>
  </section>
);

export default FAQ;
