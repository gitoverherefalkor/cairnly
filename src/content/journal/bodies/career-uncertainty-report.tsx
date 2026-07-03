import React from 'react';
import InlineStat from '@/components/journal/InlineStat';
import PullQuote from '@/components/journal/PullQuote';

/**
 * Body content for /journal/career-uncertainty-report.
 *
 * The page shell in src/pages/JournalArticle.tsx renders the metadata from
 * the article registry (hero + share card) and pulls these exports into the
 * prose column, the eight-cell stat grid, and the sources block.
 */

export const description =
  "Across 81 countries, 690,000 fifteen-year-olds, 140-country workplaces, and decades of meta-analyses, the data points the same way: career unease is the rule, not the exception. Here's what we found, and why we built Cairnly for the gap it leaves behind.";

export const introContent = (
  <p>
    If you feel uncertain about your career, you are in good company. Most people do, most of the
    time, in most countries. The data below is not meant to depress you. It is meant to show that
    the unease you feel is not a personal failing, it is a shared condition of modern work. And it
    is exactly the gap Cairnly was built to close.
  </p>
);

export interface StatGridEntry {
  number: string;
  description: string;
  source: string;
}

export const statGrid: StatGridEntry[] = [
  { number: '1 in 4', description: 'Dutch workers aged 25 to 34 report burn-out complaints. 1 in 5 across all ages.', source: 'NEA / CBS-TNO 2024' },
  { number: 'Just 13%', description: 'Of European employees are engaged at work. 20% worldwide.', source: 'Gallup, State of the Global Workplace 2026' },
  { number: '40%', description: 'Of workers felt a lot of stress yesterday. Just 34% are thriving in life.', source: 'Gallup 2026' },
  { number: 'Two thirds', description: 'Of workers have career regrets. Half regret the career they chose.', source: 'Resume Now, International Career Regrets 2024' },
  { number: '1 in 3', description: 'Dutch students regret their study choice. 35% of US graduates would now choose a different field.', source: 'Studiekeuze123 2021 · Federal Reserve 2024' },
  { number: '9 out of 10', description: 'Gen Z & Millennials say purpose matters more than promotion. Only 6% want to "become a leader."', source: 'Deloitte Gen Z & Millennial Survey 2025' },
  { number: '39%', description: 'Of existing skills will be transformed or outdated by 2030. 59% of workers need retraining.', source: 'WEF Future of Jobs Report 2025' },
  { number: '90 thousand', description: "Hours of your life you'll spend at work. A third of your waking adult life.", source: 'Pryce-Jones / Naber, Gettysburg College' },
];

export interface Chapter {
  id: string;
  num: string;
  shortTitle: string;
  title: string;
  content: React.ReactNode;
}

export const chapters: Chapter[] = [
  {
    id: 's1',
    num: '01',
    shortTitle: 'Uncertainty starts early',
    title: 'Career uncertainty starts early and rarely resolves itself.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Across 81 countries and roughly 690,000 fifteen-year-olds in the OECD's PISA 2022 dataset
          and 2025 follow-up, <strong>39% had no clear career plans</strong>. That share has grown
          by more than half since 2018. In the same study, one in three students said school had
          not taught them anything useful for a future job.
        </p>
        <InlineStat
          number="39%"
          text="of fifteen-year-olds in 81 countries have no clear career plans. Up by more than half since 2018."
          source="OECD, The State of Global Teenage Career Preparation, 2025"
        />
        <p>
          The drift continues into adulthood. Research published in <em>Social Forces</em> (Staff,
          Harris, Sabates &amp; Briddell, 2010) found that young people with uncertain career
          ambitions earn meaningfully lower hourly wages later in life than peers who had a
          direction, even after controlling for education and family background. Uncertainty is
          not just a feeling, it has a price.
        </p>
      </>
    ),
  },
  {
    id: 's2',
    num: '02',
    shortTitle: "Work isn't working",
    title: 'Work, for most people, is not working.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Gallup's <em>State of the Global Workplace 2026</em> surveyed workers in more than 140
          countries. The findings:
        </p>
        <ul>
          <li>Only <strong>20% of employees worldwide</strong> feel engaged at work. 64% are not engaged. 16% are actively disengaged.</li>
          <li>In Europe, only <strong>13% feel engaged.</strong> The lowest of any region.</li>
          <li>Only <strong>34% of employees are "thriving"</strong> in life. 40% felt a lot of stress the previous day. 22% felt lonely.</li>
          <li>Manager engagement dropped from 27% to 22%, the steepest single-year decline Gallup has recorded for managers.</li>
        </ul>
        <p>In the United States, engagement fell to 31% in 2024, the lowest level in a decade (Gallup, January 2025).</p>
        <PullQuote>
          The economic cost of all this disengagement is estimated at roughly{' '}
          <strong>$8.9 trillion globally</strong>, around 9% of world GDP.
        </PullQuote>
        <p className="lp-source">Source: Gallup, 2025.</p>
      </>
    ),
  },
  {
    id: 's3',
    num: '03',
    shortTitle: 'Career regret is common',
    title: 'Most people regret a career choice they already made.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          A 2024 international survey of 1,000 workers across the US, UK, France, and Germany
          (Resume Now, <em>International Career Regrets Study</em>) found:
        </p>
        <ul>
          <li><strong>66% of workers carry career regret.</strong></li>
          <li>50% regret the career they chose.</li>
          <li>40% regret not making a full career change when they had the chance.</li>
          <li>Regret peaks mid-career: 70% of Millennials, 69% of Gen X.</li>
        </ul>
        <p>
          Career also ranks as the single most-regretted domain of life across decades of research
          (Roese &amp; Summerville, 2005, <em>Personality and Social Psychology Bulletin</em>).
        </p>
        <p>
          Study choice tells the same story.{' '}
          <strong>35% of US college graduates would now choose a different major</strong> (Federal
          Reserve, <em>Economic Well-Being of U.S. Households in 2023</em>). In the Netherlands,
          roughly 1 in 3 students reports doubts or regret about their study choice
          (Studiekeuze123 / 3FM survey, 2021, supported by ResearchNed Startmonitor data).
        </p>
      </>
    ),
  },
  {
    id: 's4',
    num: '04',
    shortTitle: 'The Netherlands picture',
    title: 'The Netherlands: satisfied on the surface, exhausted underneath.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Dutch workers consistently rank among the most satisfied in the world. ADP's 2024{' '}
          <em>People at Work</em> survey found Dutch employees prize fun at work more than any
          other workforce. Roughly{' '}
          <strong>77–79% of Dutch workers call themselves (very) satisfied with their job</strong>{' '}
          (CBS, <em>De arbeidsmarkt in cijfers 2024</em>).
        </p>
        <p>And yet:</p>
        <ul>
          <li><strong>20.2% of Dutch workers</strong> report burn-outklachten in 2024, up from 13.4% in 2015 (NEA / CBS-TNO 2024).</li>
          <li>Among 25- to 34-year-olds, that rises to roughly 26%. Among young Dutch women in that age bracket, 29%.</li>
          <li>16% of Dutch employees have a "stressvolle baan" (high demands combined with low autonomy). Half of them expect their job to be less enjoyable five years from now.</li>
          <li>23% of Dutch workers say work caused or contributed to their last sick leave (CBS 2024).</li>
        </ul>
        <PullQuote>Job satisfaction and quiet exhaustion can live in the same person. Often they do.</PullQuote>
      </>
    ),
  },
  {
    id: 's5',
    num: '05',
    shortTitle: 'Europe is struggling',
    title: 'Europe as a whole is struggling more, not less.',
    content: (
      <ul style={{ marginTop: '1.4em' }}>
        <li><strong>29% of EU workers</strong> report work-related stress, depression, or anxiety (EU-OSHA, 2025).</li>
        <li>46% experience severe time pressure or work overload.</li>
        <li>44% of European employees say their work stress has increased since COVID-19.</li>
        <li>More than 80% of European workers find their work useful, but inequalities in job quality across the seven Eurofound dimensions remain wide (Eurofound, <em>European Working Conditions Survey 2024</em>).</li>
      </ul>
    ),
  },
  {
    id: 's6',
    num: '06',
    shortTitle: 'Why people actually leave',
    title: "Why people actually leave. It's not their boss.",
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The popular line that "people quit bosses, not companies" does not hold up to scrutiny.
          Culture Amp's own 2018 and 2023 analyses of millions of employee survey responses found
          that the direct manager explains only around <strong>12% of intent-to-leave</strong>,
          while <strong>52% is driven by development opportunities and growth</strong>.
        </p>
        <p>
          McKinsey's <em>Great Attrition</em> study (n=13,000+ across six countries, 2022) gives
          the cleaner picture. The top reasons people quit:
        </p>
        <ul>
          <li><strong>41%:</strong> lack of career development or advancement</li>
          <li><strong>36%:</strong> inadequate compensation</li>
          <li><strong>34%:</strong> uncaring or uninspiring leaders</li>
          <li><strong>31%:</strong> lack of meaningful work</li>
        </ul>
        <p>
          Pew Research found the same pattern: 63% of US workers who quit in 2021 cited "no
          opportunities for advancement" as a key factor.
        </p>
        <PullQuote>Lack of growth, not bad bosses, is the number one reason people walk.</PullQuote>
      </>
    ),
  },
  {
    id: 's7',
    num: '07',
    shortTitle: 'Values misalignment',
    title: 'Values misalignment is the quiet killer.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Decades of meta-analytic research show that when a person's values clash with their
          organization's, the consequences are predictable and large. Kristof-Brown, Zimmerman
          &amp; Johnson's foundational <em>Personnel Psychology</em> meta-analysis (2005, updated
          2023) found that person-organization fit correlates:
        </p>
        <ul>
          <li><strong>+.44</strong> with job satisfaction</li>
          <li><strong>+.51</strong> with organizational commitment</li>
          <li><strong>−.35</strong> with intent to quit</li>
        </ul>
        <p>Translated: misalignment roughly halves job satisfaction and roughly doubles the urge to leave.</p>
      </>
    ),
  },
  {
    id: 's8',
    num: '08',
    shortTitle: 'The work is changing',
    title: 'The work itself is changing under our feet.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The World Economic Forum's <em>Future of Jobs Report 2025</em> projects:
        </p>
        <ul>
          <li><strong>39% of existing skill sets</strong> will be transformed or become outdated by 2030.</li>
          <li>59% of the global workforce will need retraining by 2030.</li>
          <li>11% are unlikely to receive that training (roughly 120 million workers at risk).</li>
          <li>Net employment effect: 170 million new jobs created, 92 million displaced, +78 million net.</li>
        </ul>
        <p>US workers are not optimistic about how this will land. Pew Research (February 2025, n=5,273) found:</p>
        <ul>
          <li><strong>52% of US workers</strong> are worried about the future impact of AI in the workplace.</li>
          <li>32% believe AI will lead to fewer job opportunities for them long term.</li>
        </ul>
      </>
    ),
  },
  {
    id: 's9',
    num: '09',
    shortTitle: 'Young workers want different',
    title: 'Young workers want something different. They are not getting it.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Deloitte's 2025 <em>Gen Z &amp; Millennial Survey</em> (n=23,482 across 44 countries) found:
        </p>
        <ul>
          <li><strong>89% of Gen Z and 92% of Millennials</strong> say a sense of purpose is important to their job satisfaction.</li>
          <li>44% of Gen Z and 45% of Millennials have already left a role because it lacked purpose.</li>
          <li>Only 6% of young workers say reaching a leadership position is their primary career goal.</li>
          <li>36% of Gen Z feel exhausted all or most of the time. 42% say burnout often prevents them from performing.</li>
        </ul>
        <PullQuote>
          A generation that prioritizes meaning over title is colliding with workplaces still
          optimized for the opposite.
        </PullQuote>
      </>
    ),
  },
  {
    id: 's10',
    num: '10',
    shortTitle: 'Career change intent',
    title: 'Career change intent is at a structural high.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Randstad's <em>Workmonitor 2026</em> (n=27,062 workers and 1,225 employers across 35
          markets, including the Netherlands) found:
        </p>
        <ul>
          <li><strong>72% of employers</strong> now call the traditional corporate ladder "outdated."</li>
          <li>38% of talent aim for a "portfolio career" built from multiple roles, sectors, or formats.</li>
          <li>For the first time in Workmonitor's 22-year history, work-life balance (83%) overtook pay (82%) as the number one job motivator.</li>
          <li>44% have quit a job because of a toxic workplace, up 33% year over year.</li>
          <li>41% would quit if their employer didn't offer development opportunities.</li>
          <li>30% don't trust their managers.</li>
        </ul>
        <p>PwC's <em>Global Hopes &amp; Fears 2025</em> (n=49,843 in 48 countries) adds nuance:</p>
        <ul>
          <li>Only <strong>56% feel they have found a meaningful career.</strong></li>
          <li>Only 53% feel optimistic about the future of their role (just 43% of non-managers vs. 72% of executives).</li>
        </ul>
        <p>
          FlexJobs <em>State of the Workplace 2026</em> found that{' '}
          <strong>43% of workers are actively trying to change career fields this year.</strong>
        </p>
      </>
    ),
  },
  {
    id: 's11',
    num: '11',
    shortTitle: 'Insecurity & mental health',
    title: 'Job insecurity quietly erodes mental health.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The APA's <em>Work in America 2025</em> survey (Harris Poll for APA, n=2,017) found that
          job insecurity significantly affects the stress levels of{' '}
          <strong>54% of US workers</strong>. That fits a 30-year body of evidence linking insecure
          work to anxiety, depression, and psychosomatic complaints (De Witte, Pienaar &amp; De
          Cuyper, 2016, <em>Australian Psychologist</em>; Sverke, Hellgren &amp; Näswall, 2002).
        </p>
        <p>McKinsey Health Institute's 15- and 30-country burnout studies (2022–2023) add the operational consequence:</p>
        <ul>
          <li><strong>1 in 4 employees globally</strong> reports burnout symptoms.</li>
          <li>Workers with high burnout are 6 times more likely to leave within 3–6 months.</li>
          <li>Toxic workplace behaviour predicts over 60% of the variance in burnout.</li>
        </ul>
        <p>
          The WHO's ICD-11 (in effect since 2022) formally recognizes burnout as an occupational
          phenomenon, defined by energy depletion, mental distance from work, and reduced
          professional efficacy.
        </p>
      </>
    ),
  },
  {
    id: 's12',
    num: '12',
    shortTitle: "What managers don't do",
    title: "Career development is the thing most managers don't actually do.",
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Deloitte's 2025 <em>Global Human Capital Trends</em> (~13,000 leaders globally) found
          that managers spend roughly{' '}
          <strong>
            40% of their time on problem-solving and administrative tasks, and only 13% developing
            their team members
          </strong>
          .
        </p>
        <p>LinkedIn's 2025 <em>Workplace Learning Report</em> found:</p>
        <ul>
          <li>Only <strong>36% of organisations qualify as "career development champions."</strong></li>
          <li>31% have limited career development efforts.</li>
          <li>33% have no career development initiatives at all.</li>
        </ul>
        <PullQuote>
          The thing employees most want, and the thing that most predicts whether they stay, is
          the thing two thirds of employers are not doing.
        </PullQuote>
      </>
    ),
  },
  {
    id: 's13',
    num: '13',
    shortTitle: 'The market response',
    title: 'The market is responding, but slowly.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The US job training and career counselling industry was worth{' '}
          <strong>$17.1 billion in 2025</strong>, with growth of around 1.4% year over year and a
          five-year CAGR of 1.1% across roughly 15,200 businesses (IBISWorld, 2025).
        </p>
        <p>
          There is clearly money flowing in. There is much less evidence that it is reaching the
          people who need it most: the mid-career professional in Utrecht who can't tell whether
          the gnawing feeling is a bad month or a wrong path. That is the gap.
        </p>
      </>
    ),
  },
  {
    id: 's14',
    num: '14',
    shortTitle: 'The headline takeaway',
    title: 'The headline takeaway.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The average person spends roughly{' '}
          <strong>90,000 hours of their life at work</strong>, about a third of their waking adult
          life (Pryce-Jones, <em>Happiness at Work</em>, 2010; popularised in research by Andrew
          Naber, Gettysburg College).
        </p>
        <PullQuote>
          If you feel uncertain about how those hours are being spent, you are not the exception.
          You are the rule.
        </PullQuote>
        <p>Cairnly exists because that rule should not be acceptable.</p>
      </>
    ),
  },
];

export interface Source {
  n: number;
  content: React.ReactNode;
}

export const sources: Source[] = [
  { n: 1, content: <><strong>OECD.</strong> The State of Global Teenage Career Preparation. 2025. (PISA 2022 follow-up, 81 countries, ~690,000 fifteen-year-olds.)</> },
  { n: 2, content: <><strong>Staff, J., Harris, A., Sabates, R., &amp; Briddell, L.</strong> "Uncertainty in early occupational aspirations: Role exploration or aimlessness?" <em>Social Forces</em>, 89(2), 659–683. 2010.</> },
  { n: 3, content: <><strong>Gallup.</strong> State of the Global Workplace 2026. (140+ countries.) Plus US Engagement Trends, January 2025.</> },
  { n: 4, content: <><strong>Resume Now.</strong> International Career Regrets Study 2024. (n=1,000 across US, UK, France, Germany.)</> },
  { n: 5, content: <><strong>Roese, N. J., &amp; Summerville, A.</strong> "What we regret most… and why." <em>Personality and Social Psychology Bulletin</em>, 31(9), 1273–1285. 2005.</> },
  { n: 6, content: <><strong>Federal Reserve.</strong> Economic Well-Being of U.S. Households in 2023. 2024.</> },
  { n: 7, content: <><strong>Studiekeuze123 / 3FM.</strong> Survey on study-choice regret. 2021. Supported by ResearchNed <em>Startmonitor</em> data.</> },
  { n: 8, content: <><strong>ADP.</strong> People at Work 2024: A Global Workforce View.</> },
  { n: 9, content: <><strong>CBS (Statistics Netherlands).</strong> <em>De arbeidsmarkt in cijfers</em>. 2024.</> },
  { n: 10, content: <><strong>NEA / CBS-TNO.</strong> Nationale Enquête Arbeidsomstandigheden 2024.</> },
  { n: 11, content: <><strong>EU-OSHA.</strong> Workforce well-being statistics. 2025.</> },
  { n: 12, content: <><strong>Eurofound.</strong> European Working Conditions Survey 2024.</> },
  { n: 13, content: <><strong>Culture Amp.</strong> Manager impact analyses. 2018 &amp; 2023.</> },
  { n: 14, content: <><strong>McKinsey &amp; Company.</strong> The Great Attrition. 2022. (n=13,000+ across six countries.)</> },
  { n: 15, content: <><strong>Pew Research Center.</strong> Reasons US workers quit. 2022. Plus AI in the Workplace, February 2025 (n=5,273).</> },
  { n: 16, content: <><strong>Kristof-Brown, A. L., Zimmerman, R. D., &amp; Johnson, E. C.</strong> "Consequences of individuals' fit at work." <em>Personnel Psychology</em>, 58(2), 281–342. 2005, updated 2023.</> },
  { n: 17, content: <><strong>World Economic Forum.</strong> Future of Jobs Report 2025.</> },
  { n: 18, content: <><strong>Deloitte.</strong> Gen Z &amp; Millennial Survey 2025. (n=23,482 across 44 countries.)</> },
  { n: 19, content: <><strong>Randstad.</strong> Workmonitor 2026. (n=27,062 workers, 1,225 employers, 35 markets.)</> },
  { n: 20, content: <><strong>PwC.</strong> Global Hopes &amp; Fears Workforce Survey 2025. (n=49,843 in 48 countries.)</> },
  { n: 21, content: <><strong>FlexJobs.</strong> State of the Workplace 2026.</> },
  { n: 22, content: <><strong>American Psychological Association.</strong> Work in America 2025. Harris Poll for APA (n=2,017).</> },
  { n: 23, content: <><strong>De Witte, H., Pienaar, J., &amp; De Cuyper, N.</strong> "Review of 30 years of longitudinal studies on the association between job insecurity and health and well-being." <em>Australian Psychologist</em>, 51(1), 18–31. 2016.</> },
  { n: 24, content: <><strong>Sverke, M., Hellgren, J., &amp; Näswall, K.</strong> Meta-analysis of job insecurity research. 2002.</> },
  { n: 25, content: <><strong>McKinsey Health Institute.</strong> Global burnout studies, 15 and 30 countries. 2022–2023.</> },
  { n: 26, content: <><strong>World Health Organization.</strong> ICD-11 burnout definition (occupational phenomenon, in effect since 2022).</> },
  { n: 27, content: <><strong>Deloitte.</strong> Global Human Capital Trends 2025. (~13,000 leaders.)</> },
  { n: 28, content: <><strong>LinkedIn.</strong> Workplace Learning Report 2025.</> },
  { n: 29, content: <><strong>IBISWorld.</strong> US Job Training and Career Counselling industry report. 2025.</> },
  { n: 30, content: <><strong>Pryce-Jones, J.</strong> <em>Happiness at Work</em>. Wiley-Blackwell, 2010. (Popularised in research attributed to Andrew Naber, Gettysburg College.)</> },
];

export const methodology =
  "We compiled this report from publicly available research published between 2002 and 2026, prioritising large-sample longitudinal studies, peer-reviewed meta-analyses, and government statistics over single-employer surveys. Where studies disagreed, we report both. Where a finding is contested (e.g. manager-as-quit-driver), we say so. The numbers here are not Cairnly's; the framing of why they matter for career fit is.";
