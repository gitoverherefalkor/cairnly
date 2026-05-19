import React from 'react';
import Reveal from './Reveal';

interface Row {
  name: string;
  quiz: string;
  aiSub: string;
  coach: string;
  cairnly: React.ReactNode;
}

const ROWS: Row[] = [
  {
    name: 'What you walk away with',
    quiz: 'A personality type. Broad category, generic suggestions.',
    aiSub: 'A dashboard to log into. Keep exploring while billed monthly.',
    coach: 'Ongoing sessions. Direction emerges over weeks.',
    cairnly: (
      <>
        <strong>A finished answer.</strong> Named job titles: top fits, runner-ups, and one
        out-of-the-box option.
      </>
    ),
  },
  {
    name: "What it's based on",
    quiz: 'A short quiz. Formula-driven.',
    aiSub: 'A quiz + AI bundle. Methodology rarely disclosed.',
    coach: "A coach's experience. Varies per coach.",
    cairnly: (
      <>
        <strong>Your full picture.</strong> Career history, skills, values, and what's made you
        happy or miserable, analyzed with frontier AI, built with career coaches.
      </>
    ),
  },
  {
    name: 'How specific the advice is',
    quiz: '"You like helping people." Trait-level.',
    aiSub: '"Consider HR roles." Category-level matches.',
    coach: 'Depends on the session. Conversational.',
    cairnly: (
      <>
        <strong>Specific roles, salary, day-to-day.</strong> With a personalized reason each one
        fits <em>you</em>.
      </>
    ),
  },
  {
    name: 'Next steps you leave with',
    quiz: 'A PDF to read. You figure out what to do.',
    aiSub: 'A login and a job feed. As long as you keep paying.',
    coach: 'Action items per session. Plus more sessions.',
    cairnly: (
      <>
        <strong>A full roadmap to land it.</strong> Matched live openings, plus a tailored resume
        and cover letter for each.
      </>
    ),
  },
  {
    name: 'Time to clarity',
    quiz: '10 minutes. But shallow.',
    aiSub: 'Ongoing. Designed for continued engagement.',
    coach: 'Weeks to months. Across scheduled sessions.',
    cairnly: (
      <>
        <strong>One sitting.</strong> Done before a coach could fit you in.
      </>
    ),
  },
  {
    name: 'What it costs',
    quiz: 'Free–€50. One-off.',
    aiSub: '€20–€30 per month. ~€240–€360 per year.',
    coach: '€80–€280 per month. Or €80–€150 per session.',
    cairnly: (
      <>
        <strong>€39.</strong> One-off. No subscription, ever.
      </>
    ),
  },
];

const ComparisonTable: React.FC = () => (
  <section className="bg-[#ECE4D2] py-24 md:py-32">
    <div className="lp-container">
      <Reveal className="max-w-3xl mb-14">
        <div className="lp-eyebrow text-[#1F8282] mb-5">A side-by-side</div>
        <h2
          className="font-heading font-bold text-[#122E3B] leading-[1.12]"
          style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
        >
          Built for the question{' '}
          <br />"<span className="lp-text-teal-grad">what should I actually do next?</span>"
        </h2>
        <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed max-w-2xl">
          Some tools box you into a personality type. Others charge you monthly to keep exploring.
          Cairnly is built for one job: turn who you actually are into specific roles you could go
          land. Once. Done.
        </p>
      </Reveal>

      {/* Desktop table */}
      <Reveal className="hidden lg:block overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(201,182,144,0.5)' }}>
        <table className="lp-compare-table">
          <thead>
            <tr>
              <th style={{ width: '18%', paddingLeft: 28 }} />
              <th>
                Personality<br />quizzes{' '}
                <span className="block lp-row-name font-medium text-[#6B7F8B]">16Personalities, MBTI</span>
              </th>
              <th>
                AI career<br />subscriptions{' '}
                <span className="block lp-row-name font-medium text-[#6B7F8B]">Monthly platforms</span>
              </th>
              <th>
                Coaching<br />subscriptions{' '}
                <span className="block lp-row-name font-medium text-[#6B7F8B]">Human career coaching</span>
              </th>
              <th className="lp-compare-cairnly-top" style={{ paddingTop: 20 }}>
                <span className="text-[#1F8282]">Cairnly</span>
                <span className="block lp-row-name font-medium text-[#6B7F8B]">One assessment, full answer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const cairnlyClass =
                'lp-compare-cairnly' + (i === ROWS.length - 1 ? ' lp-compare-cairnly-bottom' : '');
              return (
                <tr key={row.name}>
                  <td style={{ paddingLeft: 28 }}>
                    <div className="lp-row-name">{row.name}</div>
                  </td>
                  <td><p>{row.quiz}</p></td>
                  <td><p>{row.aiSub}</p></td>
                  <td><p>{row.coach}</p></td>
                  <td className={cairnlyClass}><p>{row.cairnly}</p></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Reveal>

      {/* Mobile stacked cards */}
      <Reveal className="lg:hidden space-y-4">
        <div className="rounded-2xl p-6" style={{ background: '#FBF6E8', border: '1px solid #D4A024' }}>
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em] mb-3"
            style={{ background: '#D4A024', color: '#1A1A1A' }}
          >
            Cairnly
          </div>
          <ul className="space-y-3 text-[14px] text-[#122E3B] font-medium">
            <li><strong>Walk away with:</strong> A finished answer with named job titles.</li>
            <li><strong>Based on:</strong> Your full picture, history, skills, values, AI + coaches.</li>
            <li><strong>Specificity:</strong> Specific roles, salary, day-to-day, fit reasons.</li>
            <li><strong>Next steps:</strong> Matched openings + tailored resume + cover letter.</li>
            <li><strong>Time to clarity:</strong> One sitting.</li>
            <li><strong>Cost:</strong> €39. One-off. Forever.</li>
          </ul>
        </div>
        {[
          {
            t: 'Personality quizzes (MBTI, 16Personalities)',
            items: ['A personality type, broad category.', 'A short formula-driven quiz.', '"You like helping people." Trait-level.', 'A PDF. Figure it out.', '10 minutes. Free–€50.'],
          },
          {
            t: 'AI career subscriptions',
            items: ['A dashboard. Keep exploring while billed.', 'Quiz + AI bundle. Methodology unclear.', 'Category-level matches.', 'A login and a job feed, as long as you pay.', 'Ongoing. €20–€30/mo, ~€240–€360/yr.'],
          },
          {
            t: 'Coaching subscriptions',
            items: ['Ongoing sessions. Direction over weeks.', "A coach's experience. Varies per coach.", 'Conversational, depends on session.', 'Action items + more sessions.', 'Weeks–months. €80–€280/mo.'],
          },
        ].map((card) => (
          <details
            key={card.t}
            className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(201,182,144,0.7)' }}
          >
            <summary className="font-heading font-black text-[#122E3B] cursor-pointer">{card.t}</summary>
            <ul className="mt-3 space-y-2 text-[14px] text-[#4B6373] font-medium">
              {card.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </details>
        ))}
      </Reveal>

      <Reveal as="div" className="max-w-3xl mx-auto mt-14">
        <p className="text-center text-base md:text-lg text-[#122E3B] font-bold">
          Pay once for a clear answer, not every month to keep looking for one.
        </p>
      </Reveal>
    </div>
  </section>
);

export default ComparisonTable;
