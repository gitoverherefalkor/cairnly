import React from 'react';
import InlineStat from '@/components/journal/InlineStat';
import PullQuote from '@/components/journal/PullQuote';
import type { StatGridEntry, Chapter, Source } from './career-uncertainty-report';

/**
 * Body content for /journal/signs-its-time-to-change-careers.
 *
 * Cairnly Research · Report 03. Every stat traces to a named source; vendor
 * surveys and second-hand figures are flagged in the text and methodology.
 * Geography is labeled per finding (global / Europe / NL / US).
 */

export const description =
  'Every listicle gives you eight signs you need a career change. None of them give you evidence. Here is the research version, including the question the listicles never answer: how to tell a rough patch from a structural mismatch. Fifteen sources, from Gallup to Dutch burnout data.';

export const introContent = (
  <>
    <p>
      Search for "signs you need a career change" and you will find the same list everywhere:
      Sunday dread, boredom, no growth, staying only for the money, envying other people's
      jobs. The lists are not wrong. They are just unsupported. Across the ten top-ranking
      articles on this subject, we did not find a single sign backed by a primary source.
    </p>
    <p>
      This report is the evidence version. It covers how common these feelings actually are,
      in Europe and the Netherlands as well as the US, what they cost when they persist, and
      the question none of the listicles answer: how do you tell a bad week from a bad fit?
      The research has a real answer to that one.
    </p>
  </>
);

export const statGrid: StatGridEntry[] = [
  { number: '12%', description: 'Of European employees are engaged at work. The lowest of any region in the world, and lower than the 20% global average.', source: 'Gallup, State of the Global Workplace 2026' },
  { number: '20.7%', description: 'Of Dutch employees reported burnout complaints in 2025, up from about 14% in 2014. Among women aged 25 to 34 it is 32%.', source: 'TNO / CBS, NEA 2025' },
  { number: '~1 week', description: 'How long the measurable well-being boost of a vacation lasts after returning to work. Rest fixes load. It does not fix fit.', source: 'de Bloom et al., meta-analysis, 2009' },
  { number: '172 studies', description: 'Behind the finding that person-job fit is one of the strongest predictors in work psychology: high fit predicts satisfaction, poor fit predicts quitting.', source: 'Kristof-Brown et al., 2005' },
  { number: '1–2 years', description: 'How long the satisfaction spike of a new job lasts before decaying back toward baseline, when the underlying mismatch moves with you.', source: 'Boswell et al., 2005' },
  { number: '41%', description: 'Of quitters cited lack of career development as a top reason for leaving. Ahead of pay.', source: 'McKinsey, 2022 (6 countries)' },
  { number: '36 studies', description: 'Prospectively link burnout to type 2 diabetes, coronary heart disease, insomnia, and depressive symptoms. Persistent misfit is a health variable.', source: 'Salvagioni et al., PLOS ONE 2017' },
  { number: '9% of GDP', description: 'The estimated global cost of disengagement: roughly $8.9 trillion in lost productivity.', source: 'Gallup, 2024' },
];

export const chapters: Chapter[] = [
  {
    id: 's1',
    num: '01',
    shortTitle: 'The signs, with numbers',
    title: 'The classic signs are real. Here is how common they actually are.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The standard warning signs deserve their reputation. Persistent dread, disengagement,
          boredom, a growth ceiling, values that clash with the work. What the listicles never
          tell you is prevalence, and prevalence changes how you read your own situation.
        </p>
        <p>
          Gallup surveyed over 140,000 workers for its 2026 global report. Worldwide,{' '}
          <strong>20% of employees are engaged</strong> at work. In Europe it is{' '}
          <strong>12%, the lowest of any region on earth</strong>. Forty percent of workers
          globally felt a lot of stress the previous day, a level that has held since 2020 and
          sits far above the ~31% of 2009. Europeans are also among the least likely to quit,
          which means millions are staying put while disengaged.
        </p>
        <InlineStat
          number="20.7%"
          text="of Dutch employees reported burnout complaints in 2025, up from about 14% a decade earlier. Among women aged 25 to 34, it is one in three."
          source="TNO / CBS, Nationale Enquête Arbeidsomstandigheden 2025"
        />
        <p>
          The Netherlands illustrates the pattern in high resolution. One in five Dutch
          employees reports burnout complaints, and the trend has climbed for a decade
          (TNO/CBS national working-conditions survey). As for the famous "Sunday scaries":
          the widely quoted claim that 80% of professionals get them comes from a single 2018
          LinkedIn vendor poll of about 1,000 Americans, never peer-reviewed. We cite it here
          so you know where it comes from, not because it deserves the authority it gets.
        </p>
        <p>
          So if you recognise yourself in the signs, the first data point is this: you are not
          an outlier, and feeling this way is not, by itself, proof that your career is wrong.
          Which raises the question the listicles skip.
        </p>
      </>
    ),
  },
  {
    id: 's2',
    num: '02',
    shortTitle: 'Bad week or bad fit?',
    title: 'The question that matters: does rest fix it?',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Everyone has stretches of dread and exhaustion. The research offers a usable way to
          tell temporary strain from structural mismatch, and it starts with a definition. The
          World Health Organization classifies burnout as an occupational phenomenon
          "resulting from <strong>chronic</strong> workplace stress that has not been
          successfully managed." Chronic is the key word. A brutal quarter is not burnout. A
          brutal quarter that never ends is.
        </p>
        <p>
          The sharpest diagnostic in the literature is what vacations do, and fail to do. A
          meta-analysis of holiday studies (de Bloom et al., 2009) found that vacations
          reliably improve health and well-being, and that the effect{' '}
          <strong>fades within about one week of returning to work</strong>.
        </p>
        <PullQuote>
          Strain that responds to rest is <strong>load</strong>. Strain that rest never
          touches is <strong>structure</strong>. Some post-holiday deflation is universal. The
          signal is whether time off ever restores you at all.
        </PullQuote>
        <p>
          Burnout research adds a second marker. In Maslach's model, the three dimensions of
          burnout are exhaustion, cynicism, and reduced efficacy, and it is{' '}
          <strong>cynicism</strong>, the growing mental distance from the work itself, that
          most strongly predicts leaving (Maslach &amp; Leiter, <em>World Psychiatry</em>,
          2016). Tired but still caring usually points to workload. No longer caring points
          somewhere deeper.
        </p>
      </>
    ),
  },
  {
    id: 's3',
    num: '03',
    shortTitle: 'New job, same mismatch',
    title: 'Why a new employer often resets the clock instead of fixing the problem.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Most people who act on the signs change employers, not careers. The research on what
          happens next is humbling. Longitudinal studies tracking workers through voluntary
          job changes found a consistent shape: satisfaction dips before the quit, spikes in
          the new role, then <strong>decays back toward the old baseline within one to two
          years</strong>. Researchers call it the honeymoon-hangover effect (Boswell, Boudreau
          &amp; Tichy, <em>Journal of Applied Psychology</em>, 2005).
        </p>
        <InlineStat
          number="1–2 years"
          text="is how long the new-job satisfaction spike typically lasts before returning to baseline, when the underlying mismatch comes along to the new employer."
          source="Boswell et al., Journal of Applied Psychology, 2005"
        />
        <p>
          The explanation is uncomfortable but useful: if the mismatch lives in <em>you and
          the work itself</em>, it moves with you. Person-job fit is one of the most studied
          constructs in organizational psychology. A meta-analysis of 172 studies found fit
          strongly predicts satisfaction and commitment, and poor fit strongly predicts the
          intention to quit (Kristof-Brown, Zimmerman &amp; Johnson, <em>Personnel
          Psychology</em>, 2005). Changing the logo on your badge does not change the fit.
        </p>
        <p>
          The counterweight, in fairness: not every mismatch requires a career change. When
          the problem is task-level or relational, reshaping your current role demonstrably
          works. A meta-analysis of 122 samples covering more than 35,000 workers found job
          crafting meaningfully improves engagement and performance (Rudolph et al.,{' '}
          <em>Journal of Vocational Behavior</em>, 2017). Crafting reaches tasks, boundaries
          and relationships. What it cannot reach is a values-level or field-level mismatch.
          That distinction decides whether you need a better version of this job or a
          different direction entirely.
        </p>
      </>
    ),
  },
  {
    id: 's4',
    num: '04',
    shortTitle: 'What staying costs',
    title: 'Ignoring the signs has a price. It is measurable.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The comfortable assumption is that staying in a poor-fit job is the safe, free
          option. The evidence says it is neither. A systematic review of 36 prospective
          studies linked burnout to elevated risk of type 2 diabetes, coronary heart disease,
          hospitalisation for cardiovascular disorder, insomnia, and depressive symptoms
          (Salvagioni et al., <em>PLOS ONE</em>, 2017). US research puts the aggregate toll of
          workplace stressors at roughly 120,000 excess deaths per year and up to $190 billion
          in healthcare costs (Goh, Pfeffer &amp; Zenios, <em>Management Science</em>, 2015;
          US data).
        </p>
        <p>
          The financial ledger runs the same direction. In the Netherlands, TNO estimated
          work-stress absenteeism costs employers around <strong>€3.1 billion per year</strong>{' '}
          (2020 figure). For individuals, staying has a quiet wage cost too: in Pew's analysis
          of US workers in 2021–22, the median job stayer lost 1.7% in real earnings while the
          median switcher gained 9.7%. That premium has narrowed since, but the direction of
          the finding stands: inertia is not free.
        </p>
        <p>
          And the most common trigger for finally leaving is not a dramatic collapse. In
          McKinsey's six-country study of the post-2021 quit wave, the top reason, cited by{' '}
          <strong>41% of leavers</strong>, was lack of career development and advancement.
          Ahead of pay. The growth-ceiling sign, in other words, is the one that most often
          converts into an exit.
        </p>
      </>
    ),
  },
  {
    id: 's5',
    num: '05',
    shortTitle: 'Reading your own signs',
    title: 'A structured way to read your own situation.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Pull the research together and the signs sort into a sequence rather than a
          checklist. First: is it chronic? Weeks and quarters pass; structural mismatch
          persists through them (the WHO's chronicity test). Second: does rest reach it? If a
          real break restores you, you are managing load. If it never does, you are looking at
          structure (the vacation test). Third: where does the mismatch live? Burnout
          researchers use six areas to locate it: workload, control, reward, community,
          fairness, and values (Maslach &amp; Leiter). Workload and community problems are
          often fixable in place, the job-crafting route. Values and the nature of the work
          itself are field-level. No amount of crafting turns the wrong field into the right
          one.
        </p>
        <p>
          That third step is where most people get stuck, because it requires an accurate
          picture of who you are, not just what annoys you. It is also exactly the step the
          honeymoon-hangover research warns about skipping: leave without a diagnosis and the
          mismatch tends to come along. Cairnly's assessment exists for that step. It maps
          your personality, skills and goals to concrete careers, so that if the signs are
          telling you something structural, you know what direction "different" should
          actually point.
        </p>
        <p>
          The signs are common. The dread is measurable. And the difference between a rough
          patch and a wrong path is not a feeling, it is a pattern. Now you know how to read
          it.
        </p>
      </>
    ),
  },
];

export const sources: Source[] = [
  { n: 1, content: <><strong>Gallup.</strong> State of the Global Workplace 2026. (141,444 employed respondents, data collected 2025: engagement, stress, regional comparisons.)</> },
  { n: 2, content: <><strong>Gallup.</strong> State of the Global Workplace 2024. (Global cost of low engagement, ~$8.9 trillion / 9% of global GDP.)</> },
  { n: 3, content: <><strong>World Health Organization.</strong> "Burn-out an 'occupational phenomenon'." ICD-11 classification, May 2019.</> },
  { n: 4, content: <><strong>TNO / CBS.</strong> Nationale Enquête Arbeidsomstandigheden (NEA), 2025 burnout-complaint figures, via RIVM/VZinfo. Netherlands.</> },
  { n: 5, content: <><strong>TNO.</strong> Work-stress absenteeism cost estimate (~€3.1 billion/year). 2020. Netherlands.</> },
  { n: 6, content: <><strong>Salvagioni, D. A. J., et al.</strong> "Physical, psychological and occupational consequences of job burnout: a systematic review of prospective studies." <em>PLOS ONE</em>, 12(10). 2017. (36 prospective studies.)</> },
  { n: 7, content: <><strong>Goh, J., Pfeffer, J., &amp; Zenios, S.</strong> "The Relationship Between Workplace Stressors and Mortality and Health Costs in the United States." <em>Management Science</em>, 62(2). 2015. (Meta-analysis of 228 studies; US.)</> },
  { n: 8, content: <><strong>Kristof-Brown, A. L., Zimmerman, R. D., &amp; Johnson, E. C.</strong> "Consequences of individuals' fit at work: a meta-analysis." <em>Personnel Psychology</em>, 58(2). 2005. (172 studies, 836 effect sizes.)</> },
  { n: 9, content: <><strong>de Bloom, J., et al.</strong> "Do we recover from vacation? Meta-analysis of vacation effects on health and well-being." <em>Journal of Occupational Health</em>, 51(1). 2009.</> },
  { n: 10, content: <><strong>Boswell, W. R., Boudreau, J. W., &amp; Tichy, J.</strong> "The relationship between employee job change and job satisfaction: the honeymoon-hangover effect." <em>Journal of Applied Psychology</em>, 90(5). 2005. (Replicated 2009.)</> },
  { n: 11, content: <><strong>Rudolph, C. W., et al.</strong> "Job crafting: A meta-analysis of relationships with individual differences, job characteristics, and work outcomes." <em>Journal of Vocational Behavior</em>, 102. 2017. (122 samples, 35,670 workers.)</> },
  { n: 12, content: <><strong>Maslach, C., &amp; Leiter, M. P.</strong> "Understanding the burnout experience: recent research and its implications for psychiatry." <em>World Psychiatry</em>, 15(2). 2016. (Cynicism as the pivotal turnover dimension; six areas of worklife.)</> },
  { n: 13, content: <><strong>McKinsey &amp; Company.</strong> The Great Attrition. 2022. (n=13,382 across six countries; top quit reasons.)</> },
  { n: 14, content: <><strong>Pew Research Center.</strong> "Majority of U.S. Workers Changing Jobs Are Seeing Real Wage Gains." July 2022. US.</> },
  { n: 15, content: <><strong>LinkedIn / Harris Poll.</strong> "Sunday scaries" survey. 2018. (n=1,017 US professionals; vendor poll, cited with that caveat.)</> },
];

export const methodology =
  "We compiled this report from research published between 2005 and 2026, prioritising peer-reviewed meta-analyses, government and WHO classifications, and large-sample surveys over vendor polls. Vendor figures that circulate widely (the LinkedIn \"Sunday scaries\" poll, the FlexJobs career-change surveys) are either flagged with their provenance or excluded. Dutch figures come from the TNO/CBS national working-conditions survey via RIVM; the €3.1 billion absenteeism estimate is TNO's 2020 figure and likely conservative today. Where the evidence base is American (workplace mortality costs, wage effects of switching), we say so. The numbers here are not Cairnly's; the framing of why they matter for career fit is.";
