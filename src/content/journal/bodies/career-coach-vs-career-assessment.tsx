import React from 'react';
import InlineStat from '@/components/journal/InlineStat';
import PullQuote from '@/components/journal/PullQuote';
import type { StatGridEntry, Chapter, Source } from './career-uncertainty-report';

/**
 * Body content for /journal/career-coach-vs-career-assessment.
 *
 * Cairnly Research · Report 04. Commercial-intent piece: the reader is
 * deciding how to get help with a career change. Every effect size traces to
 * a named peer-reviewed source; price figures are labeled as directory
 * estimates; industry-commissioned statistics are dated and flagged.
 */

export const description =
  'A career coach runs $75 to $250 an hour, and nobody licenses them. Career tests range from validated science to horoscopes with a spreadsheet. Here is what the peer-reviewed evidence says each can actually do, and a simple rule for choosing. Sixteen sources, including the ones that cut against us.';

export const introContent = (
  <>
    <p>
      If you have decided your career needs to change, the internet offers you two products: a
      human coach, or a test. The pages comparing them are written almost entirely by people
      selling one of the two. We sell one of the two as well, so this report holds itself to a
      higher bar: every claim below traces to peer-reviewed research or clearly labeled
      industry data, including the findings that are inconvenient for us.
    </p>
    <p>
      The short version: both work, for different problems. Coaching has real, measured
      effects, mostly on follow-through. Assessments have real, measured predictive power,
      but only the validated ones, and the market is full of unvalidated ones. And the
      deepest finding in this literature says the order in which you use them matters.
    </p>
  </>
);

export const statGrid: StatGridEntry[] = [
  { number: '$5.34B', description: 'Global coaching industry revenue in 2025, across 122,974 practising coaches. Up 15% in two years.', source: 'ICF / PwC Global Coaching Study 2025' },
  { number: '$75–250', description: 'Typical hourly rate for a US career coach, per the industry\'s own price guides. Multi-month packages run $1,000 to $2,500.', source: 'BetterUp; Thervo; Noomii (directory estimates)' },
  { number: 'Zero', description: 'Jurisdictions that license career coaches. In the US and most of Europe, anyone can use the title tomorrow. Credentials are voluntary.', source: 'US state licensing records; ICF' },
  { number: 'g = 0.74', description: 'Coaching\'s strongest measured effect: goal-directed self-regulation. The evidence for coaching as a follow-through tool is real.', source: 'Theeboom et al., meta-analysis, 2014' },
  { number: '~10%', description: 'How much more accurate structured, data-driven prediction is than unstructured expert judgment, on average, across decades of studies.', source: 'Grove et al., 2000' },
  { number: 'r = .32', description: 'How well interest-job fit predicts job performance. Double the predictive power of interest scores alone. Fit is measurable.', source: 'Nye et al., 2017 (92 studies)' },
  { number: '39–76%', description: 'Of MBTI takers get a different personality type on retest, in published reliability studies. Not all assessments deserve the name.', source: 'Pittenger, 2005' },
  { number: '2009', description: 'The year of the "coaching has 7x ROI" statistic that marketing pages still quote today, without the date, from an industry-commissioned self-report survey.', source: 'ICF Global Coaching Client Study, 2009' },
];

export const chapters: Chapter[] = [
  {
    id: 's1',
    num: '01',
    shortTitle: 'The market, priced',
    title: 'What career coaching costs, and who is allowed to sell it.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Coaching is a large and fast-growing industry. The International Coaching
          Federation's 2025 global study, run by PwC across 127 countries, counts{' '}
          <strong>122,974 practising coaches generating $5.34 billion</strong> in annual
          revenue, up 15% in two years. Keep in mind the source: the ICF is the industry's own
          trade body, and these are practitioner-survey estimates, not audited figures.
        </p>
        <p>
          What does it cost you? US price guides, including the ones published by coaching
          companies themselves, put career coaching at{' '}
          <strong>$75 to $250 per hour</strong>, with multi-month packages between $1,000 and
          $2,500 and executive rates far higher. These are directory estimates with
          undisclosed methodology, so treat them as a range, not a statistic. Reliable
          consumer pricing for continental Europe barely exists in published form; that data
          gap is real and worth knowing about.
        </p>
        <InlineStat
          number="Zero"
          text="jurisdictions license career coaches. No exam, no register, no legal requirement. The title is unprotected in the US and most of Europe, including the Netherlands."
          source="US state licensing records; ICF (credentials are voluntary)"
        />
        <p>
          The number that should shape how you shop is the third one. Coaching is an
          unregulated profession. There are excellent coaches, and the ICF's voluntary
          credential signals real training. But nothing stops anyone from selling career
          coaching tomorrow, which makes the evidence question below more than academic.
        </p>
      </>
    ),
  },
  {
    id: 's2',
    num: '02',
    shortTitle: 'Does coaching work?',
    title: 'Coaching works. Mostly on follow-through, and mostly measured on executives.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Three peer-reviewed meta-analyses have pooled the coaching-effectiveness research,
          and they agree on direction. Theeboom and colleagues (2014) found coaching improves{' '}
          <strong>goal-directed self-regulation (g = 0.74)</strong>, performance and skills
          (0.60), work attitudes (0.54), and well-being (0.46). Jones, Woods and Guillaume
          (2016) found a moderate overall effect (δ = 0.36) and, usefully for anyone
          comparing formats, <strong>no difference between e-coaching and face-to-face</strong>.
          Sonesh and colleagues (2015) found stronger effects on the coach-client
          relationship than on actual goal attainment (g = .32 vs .11).
        </p>
        <p>
          Read together: the strongest, most consistent case for coaching is as a{' '}
          <strong>follow-through technology</strong>. Self-regulation, commitment, momentum.
          The weakest case is coaching as a way to figure out <em>what</em> you should do.
        </p>
        <p>
          Now the caveats, which the coaching industry's own marketing rarely offers. Nearly
          all of this research covers workplace and executive coaching, usually employer-paid.
          There is <strong>no meta-analysis of consumer career-change coaching</strong>, the
          product a private career changer actually buys. Primary studies are often small and
          self-report-heavy. And the famous claims you will meet while shopping, "median 7x
          ROI," "86% of companies recouped their investment," trace to a single
          industry-commissioned, self-reported client survey from <strong>2009</strong>.
          Marketing pages still quote it today, undated. When a number is doing that much
          selling, its birth certificate matters.
        </p>
      </>
    ),
  },
  {
    id: 's3',
    num: '03',
    shortTitle: 'Do assessments work?',
    title: 'Assessments work too. But only the validated ones, and the market is flooded.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The assessment question splits in two, because "career test" covers everything from
          six decades of validated measurement science to a listicle with a progress bar.
        </p>
        <p>
          The validated tradition first. A meta-analysis spanning 60 years of research (Nye et
          al., 2012, updated 2017 with 92 studies) found that vocational interests predict job
          performance and persistence, and that the predictive power lives in the{' '}
          <strong>match between person and job (r = .32), double that of interest scores
          alone (r = .16)</strong>. Person-job fit more broadly, across 172 studies, is among
          the strongest predictors in work psychology: fit correlates around .56 with job
          satisfaction, and poor fit predicts the intention to quit (Kristof-Brown et al.,
          2005). Fit is not a vibe. It is one of the most replicated measurements in the field.
        </p>
        <InlineStat
          number="39–76%"
          text="of MBTI test-takers receive a different four-letter type when retested, in published reliability studies, sometimes within five weeks. Validated instruments measure traits on continuous scales instead of sorting people into boxes."
          source="Pittenger, Consulting Psychology Journal, 2005"
        />
        <p>
          Then the flooded market. The best-known career test in the world, the MBTI, has
          published retest reliability so weak that a large share of takers change type within
          weeks, and a US National Research Council review (1991) found the evidence for its
          usefulness in career counselling lacking. Instruments built on the Big Five model,
          by contrast, measure traits continuously and hold up under meta-analysis. The
          practical test when evaluating any assessment: does it cite validity research, and
          does it measure on scales rather than sorting you into a type?
        </p>
        <p>
          One finding cuts against our own product category, and belongs in the open: the
          link between interest fit and <em>felt job satisfaction</em> is more modest than
          the link with performance and persistence (Hoff et al., 2020). Assessments are
          better at predicting where you will perform and stay than at guaranteeing you will
          feel happy. Anyone who promises the latter is overselling, including us if we ever
          do.
        </p>
      </>
    ),
  },
  {
    id: 's4',
    num: '04',
    shortTitle: 'Structure beats intuition',
    title: 'The deepest finding: structured prediction beats expert judgment.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Underneath the coach-versus-assessment question sits one of the oldest and most
          uncomfortable results in applied psychology. When researchers compare structured,
          data-driven prediction against the unstructured judgment of experienced
          professionals, across medicine, education, hiring and counselling,{' '}
          <strong>the structured approach wins on average by about 10%</strong>, and expert
          judgment substantially outperforms it in only a small minority of studies (Grove et
          al., <em>Psychological Assessment</em>, 2000). The result held regardless of the
          judge's experience. Later work extended it to hiring and admissions decisions
          (Kuncel et al., 2013), where mechanically combining the data beat holistic expert
          review again.
        </p>
        <PullQuote>
          One detail stings for the "just talk to someone" approach: expert judgment
          performed <strong>worse</strong> when it leaned on interview impressions. The
          conversation felt informative. It measurably wasn't.
        </PullQuote>
        <p>
          Be precise about what this does and does not say. It is a finding about{' '}
          <em>prediction</em>: given information about a person, structured methods map it to
          outcomes more accurately than intuition does. It says nothing against what coaching
          measurably provides, accountability, motivation, and follow-through, none of which
          are prediction problems. The two literatures are not in conflict. They describe two
          different jobs.
        </p>
      </>
    ),
  },
  {
    id: 's5',
    num: '05',
    shortTitle: 'Which do you need?',
    title: 'A simple rule: diagnose with structure, execute with support.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Put the four chapters together and the decision stops being a brand choice and
          becomes a sequencing question.
        </p>
        <p>
          If you do not yet know <strong>what</strong> would fit you better, that is a
          prediction problem. The evidence says to solve it with structured measurement:
          validated instruments, systematically combined, before anyone's intuition (including
          your own) gets to render a verdict. An open conversation is a poor measurement
          device, however good it feels.
        </p>
        <p>
          If you already know what you are aiming for and the problem is{' '}
          <strong>getting there</strong>, that is a follow-through problem, and it is exactly
          where the coaching meta-analyses show the strongest effects. Accountability,
          self-regulation, momentum. This is also where the human relationship earns its
          hourly rate.
        </p>
        <p>
          Cairnly is built on that sequence, so you can weigh our interest here yourself. The
          assessment does the structured-measurement step: validated instruments mapped to
          specific careers, not a four-letter box. The coach conversation comes after, on top
          of your results, at a fraction of what an hourly engagement costs. Whether you use
          us or not, the evidence supports one rule of thumb: <strong>never pay for
          follow-through help before the diagnosis, and never accept a diagnosis from an
          unstructured chat.</strong> The order is the product.
        </p>
      </>
    ),
  },
];

export const sources: Source[] = [
  { n: 1, content: <><strong>International Coaching Federation / PwC.</strong> 2025 ICF Global Coaching Study. (10,000+ participants, 127 countries; revenue, practitioner counts.) Industry-commissioned.</> },
  { n: 2, content: <><strong>International Coaching Federation.</strong> 2023 ICF Global Coaching Study, executive summary. (Coach income and regional revenue estimates.)</> },
  { n: 3, content: <><strong>IBISWorld.</strong> US market-size estimates 2025: Business Coaching, Life Coaches, Job Training &amp; Career Counseling. (Categories overlap; none maps exactly to consumer career coaching.)</> },
  { n: 4, content: <><strong>BetterUp; Thervo; Noomii.</strong> Career-coaching price guides, 2024–2026. (Directory estimates with undisclosed methodology; cited as ranges only.)</> },
  { n: 5, content: <><strong>Theeboom, T., Beersma, B., &amp; van Vianen, A. E. M.</strong> "Does coaching work? A meta-analysis on the effects of coaching on individual level outcomes in an organizational context." <em>Journal of Positive Psychology</em>, 9(1). 2014.</> },
  { n: 6, content: <><strong>Jones, R. J., Woods, S. A., &amp; Guillaume, Y. R. F.</strong> "The effectiveness of workplace coaching: A meta-analysis of learning and performance outcomes from coaching." <em>Journal of Occupational and Organizational Psychology</em>, 89. 2016.</> },
  { n: 7, content: <><strong>Sonesh, S. C., et al.</strong> "The power of coaching: a meta-analytic investigation." <em>Coaching: An International Journal of Theory, Research and Practice</em>, 8(2). 2015.</> },
  { n: 8, content: <><strong>International Coach Federation / PwC / Association Resource Centre.</strong> Global Coaching Client Study. 2009. (Origin of the recycled "7x ROI" and "86% recouped" claims; self-reported, industry-commissioned.)</> },
  { n: 9, content: <><strong>Grove, W. M., Zald, D. H., Lebow, B. S., Snitz, B. E., &amp; Nelson, C.</strong> "Clinical versus mechanical prediction: A meta-analysis." <em>Psychological Assessment</em>, 12(1). 2000.</> },
  { n: 10, content: <><strong>Kuncel, N. R., Klieger, D. M., Connelly, B. S., &amp; Ones, D. S.</strong> "Mechanical versus clinical data combination in selection and admissions decisions: A meta-analysis." <em>Journal of Applied Psychology</em>, 98(6). 2013.</> },
  { n: 11, content: <><strong>Nye, C. D., Su, R., Rounds, J., &amp; Drasgow, F.</strong> "Vocational interests and performance: A quantitative summary of over 60 years of research." <em>Perspectives on Psychological Science</em>, 7(4). 2012.</> },
  { n: 12, content: <><strong>Nye, C. D., Su, R., Rounds, J., &amp; Drasgow, F.</strong> "Interest congruence and performance: Revisiting recent meta-analytic findings." <em>Journal of Vocational Behavior</em>, 98. 2017. (92 studies, 1,858 correlations.)</> },
  { n: 13, content: <><strong>Kristof-Brown, A. L., Zimmerman, R. D., &amp; Johnson, E. C.</strong> "Consequences of individuals' fit at work: a meta-analysis." <em>Personnel Psychology</em>, 58(2). 2005. (172 studies, 836 effect sizes.)</> },
  { n: 14, content: <><strong>Pittenger, D. J.</strong> "Cautionary comments regarding the Myers-Briggs Type Indicator." <em>Consulting Psychology Journal: Practice and Research</em>, 57(3). 2005. Supported by <strong>Stein, R., &amp; Swan, A. B.</strong> "Evaluating the validity of Myers-Briggs Type Indicator theory." <em>Social and Personality Psychology Compass</em>. 2019.</> },
  { n: 15, content: <><strong>National Research Council (Druckman, D., &amp; Bjork, R. A., eds.).</strong> <em>In the Mind's Eye: Enhancing Human Performance.</em> National Academies Press. 1991. (Review finding evidence for MBTI's counselling utility lacking.)</> },
  { n: 16, content: <><strong>Hoff, K. A., et al.</strong> "Interest fit and job satisfaction: A systematic review and meta-analysis." <em>Journal of Vocational Behavior</em>. 2020. (The fit-satisfaction link is more modest than fit-performance; cited against our own interest.)</> },
];

export const methodology =
  "We compiled this report from peer-reviewed meta-analyses, industry studies, and published price guides from 2000 to 2026. Industry-commissioned figures (ICF market studies, the 2009 client survey) are labeled as such and never presented as independent research. Price figures are directory estimates with undisclosed methodology and are cited as ranges. Where the evidence base does not cover the consumer career-change buyer, we say so rather than borrow executive-coaching findings silently. We sell a career assessment; sources 14 through 16 include findings that limit what assessments, ours included, can honestly promise. The numbers here are not Cairnly's; the framing of why they matter for career fit is.";
