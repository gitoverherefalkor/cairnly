import React from 'react';
import InlineStat from '@/components/journal/InlineStat';
import PullQuote from '@/components/journal/PullQuote';
import type { StatGridEntry, Chapter, Source } from './career-uncertainty-report';

/**
 * Body content for /journal/career-change-at-30-40-50.
 *
 * Cairnly Research · Report 02. Every stat below traces to a named primary
 * source; stats we could only verify second-hand are flagged as such in the
 * text and in the methodology note. See the research brief in the PR that
 * introduced this file for the source-verification trail.
 */

export const description =
  'The internet says it\'s never too late to change careers. The data is more interesting. The famous "5-to-7 careers" number was never measured, the pay-cut fear is mostly wrong, ageism is real but wrong about you — and staying put carries its own risk. Fourteen sources, no pep talk.';

export const introContent = (
  <>
    <p>
      Type "career change at 40" into a search engine and you get two things: reassurance that
      it's never too late, and a listicle of fields to switch into. What you almost never get is
      data. So we went looking for it — through labour statistics bureaus, longitudinal studies
      that track tens of thousands of workers for decades, and the largest hiring field
      experiment ever run. Some of what we found supports the reassurance. Some of it
      complicates it. All of it is more useful than a pep talk.
    </p>
    <p>
      One note before the numbers: whether you're 30, 40, or 55, the pattern in the research is
      the same — the direction of the switch matters more than the age at which you make it.
      That's the part nobody measures for you, and the part worth getting right.
    </p>
  </>
);

export const statGrid: StatGridEntry[] = [
  { number: 'Never', description: 'The number of times the "average person changes careers 5–7 times" claim has been measured. The US Bureau of Labor Statistics says it has never estimated it.', source: 'BLS, National Longitudinal Surveys FAQ' },
  { number: '12.7', description: 'Jobs the average American born 1957–64 held between ages 18 and 56. Jobs — not careers. Careers, nobody counts.', source: 'BLS, NLSY79, 2023' },
  { number: '~50%', description: 'Of workers who change employers also change occupation in the same move. Half of all job-hopping is quiet career change.', source: 'Pew Research Center, 2022' },
  { number: '+9.7%', description: 'Median real wage gain for workers who switched employers in 2021–22. The median stayer lost 1.7% to inflation.', source: 'Pew Research Center, 2022' },
  { number: '56%', description: 'Of workers over 50 in long-held, stable jobs are laid off or pushed out at least once before they choose to retire.', source: 'ProPublica / Urban Institute, 2018' },
  { number: '1 in 10', description: 'Of those pushed-out workers ever again earn as much as they did before. Waiting has a price tag too.', source: 'ProPublica / Urban Institute, 2018' },
  { number: '89%', description: 'Of employers say their midcareer (45+) hires perform as well as or better than younger hires. The same employers rate 45+ applicants their worst-prepared pool.', source: 'Generation & OECD, 2023' },
  { number: '45', description: 'Average age of the founders of the fastest-growing 0.1% of new US companies. A 50-year-old founder outperforms a 30-year-old at 1.8x.', source: 'Azoulay et al., AER: Insights, 2020' },
];

export const chapters: Chapter[] = [
  {
    id: 's1',
    num: '01',
    shortTitle: 'The 5-to-7-careers myth',
    title: 'The most famous career-change statistic was never measured.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          You have probably heard that the average person changes careers five to seven times.
          It appears in career books, coaching websites, and keynote slides. It has one problem:
          nobody has ever measured it. The US Bureau of Labor Statistics — the institution that
          would be the source for such a number — states on its own FAQ page that it{' '}
          <strong>"never has attempted to estimate the number of times people change
          careers,"</strong> because researchers can't even agree on what counts as one.
        </p>
        <p>
          Here is what <em>is</em> measured. Americans born between 1957 and 1964 held an
          average of <strong>12.7 jobs between ages 18 and 56</strong> (BLS, NLSY79). Among
          workers who change employers, <strong>roughly half also change occupation</strong> in
          the same move, and 48% change industry (Pew Research Center analysis of Current
          Population Survey data, 2022). Half of all job-hopping, in other words, is quiet
          career change.
        </p>
        <InlineStat
          number="17% → 7%"
          text="Annual job mobility drops from about 17% of workers under 30 to about 7% by age 45. Career change at midlife is real — and genuinely counter-normative."
          source="OECD Employment Outlook 2025"
        />
        <p>
          But mobility falls steeply with age: 4.4% of workers aged 16–24 switch employers in a
          typical month, against 1.9% of those 55–64 (Pew, 2022). So the honest version of the
          motivational stat is this: career change at 30 is common, at 40 it is normal but no
          longer the norm, and at 50 you are doing something most peers won't. That doesn't make
          it unwise. It makes the <em>how</em> matter more.
        </p>
      </>
    ),
  },
  {
    id: 's2',
    num: '02',
    shortTitle: 'The pay-cut myth',
    title: 'A pay cut is not the default outcome. Staying put has a wage cost too.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The most common fear about a midlife career change is the guaranteed pay cut. The
          data says otherwise. In Pew's analysis of 2021–22 CPS data,{' '}
          <strong>60% of workers who changed employers saw their real, inflation-adjusted
          earnings rise</strong>. The median switcher gained 9.7% in real terms. The median
          worker who stayed put <em>lost</em> 1.7% to inflation over the same year.
        </p>
        <InlineStat
          number="+9.7%"
          text="Median real earnings gain for job switchers in 2021–22, while the median stayer lost 1.7%. Sixty percent of switchers came out ahead of inflation."
          source="Pew Research Center, 2022"
        />
        <p>
          Age blunts the premium but doesn't erase it: across OECD countries, voluntary job
          changers aged 45–54 averaged <strong>7.4% wage growth</strong>, and 55–64s about 3.5%
          (OECD, <em>Promoting Better Career Choices for Longer Working Lives</em>, 2024).
        </p>
        <p>
          Two honest caveats. First, a full field-switch into an entry-level role often means an{' '}
          <em>initial</em> dip before recovery — the American Institute for Economic Research
          found many successful post-45 switchers took a temporary pay cut on the way in.
          Second, more recent payroll data (Bank of America Institute, 2026 — which we could
          only verify second-hand) suggests the switcher premium has thinned for Gen X and
          Boomer workers in the current market. The claim that survives all of it: a pay cut is
          a scenario to plan for, not a law of nature — and the "safe" choice of staying is not
          free either.
        </p>
      </>
    ),
  },
  {
    id: 's3',
    num: '03',
    shortTitle: 'The ageism paradox',
    title: 'Ageism is real. It is also mostly wrong about you.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          We won't pretend the road is flat. In the largest hiring field experiment ever
          conducted — <strong>more than 40,000 fictitious resumes</strong> sent to real job
          openings — older applicants received significantly fewer callbacks, with the
          strongest evidence of discrimination against older women (Neumark, Burn &amp; Button,
          published in the <em>Journal of Political Economy</em>, 2019). Among workers over 50
          themselves, 91% say age discrimination is common, and 15% say their age cost them a
          specific job within the past two years (AARP, 2022).
        </p>
        <p>And yet the same employers' own experience contradicts their screening behaviour:</p>
        <PullQuote>
          Hiring managers rate candidates 45+ as their <strong>worst-prepared applicant
          pool</strong> — while <strong>89% say their midcareer hires perform as well as or
          better</strong> than younger colleagues, and 83% say they learn as quickly or faster.
        </PullQuote>
        <p className="lp-source">Source: Generation &amp; OECD, The Midcareer Opportunity, 2023 (8-country employer survey).</p>
        <p>
          The "older workers can't retrain" story fails the same test. Participation in adult
          learning falls from over 60% at ages 25–29 to roughly a third by the early sixties
          (OECD, <em>Education at a Glance 2025</em>) — but the drop tracks employer investment
          and access, not measured learning ability. The gap is opportunity, not capacity. For
          a career changer, the practical conclusion is specific: the barrier sits at the
          screening stage, so switches that route around cold applications — networks, referrals,
          demonstrable skills, adjacent-field moves — are disproportionately effective after 45.
        </p>
      </>
    ),
  },
  {
    id: 's4',
    num: '04',
    shortTitle: 'Waiting is also a risk',
    title: 'The riskiest plan is assuming you can simply stay.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Career-change advice usually weighs the risk of moving against the safety of staying.
          The longest-running data we have says that framing is wrong. The Health and
          Retirement Study has tracked about 20,000 Americans since 1992. ProPublica and the
          Urban Institute's analysis of it found that{' '}
          <strong>56% of workers over 50 in long-held, stable jobs are laid off or pushed out
          at least once</strong> before they intend to retire — and only{' '}
          <strong>one in ten</strong> of them ever again earns what they did before.
        </p>
        <InlineStat
          number="56%"
          text="of over-50s in stable jobs get laid off or pushed out at least once before retirement. Only 1 in 10 ever recovers their previous earnings."
          source="ProPublica / Urban Institute, 2018"
        />
        <p>
          A career change on your own timeline, with runway and a direction, is one kind of
          risk. The same change forced on you at 54 by a restructuring is a much worse one. The
          people best protected from the second scenario are the ones who treated their career
          as something to steer before someone else steered it for them.
        </p>
        <p>
          Switching can go wrong too, and it's worth knowing how often: among workers who quit
          during the Great Resignation, about <strong>26% regretted it</strong>, and 42% said
          the new job didn't live up to expectations (Joblist survey data, 2022 — survey-grade,
          not government statistics). Look at <em>why</em> and the pattern is consistent:
          regret follows switches made <em>away from</em> something — a bad manager, burnout, a
          salary bump grabbed in haste — rather than <em>toward</em> something that fits. And
          for one more data point against the too-late story: the average founder of the
          fastest-growing 0.1% of US startups is <strong>45 years old</strong>, and a
          50-year-old founder is 1.8 times more likely to build a top-performing company than a
          30-year-old (Azoulay, Jones, Kim &amp; Miranda, <em>American Economic Review:
          Insights</em>, 2020).
        </p>
      </>
    ),
  },
  {
    id: 's5',
    num: '05',
    shortTitle: 'What actually predicts success',
    title: 'What separates the switches that work from the ones people regret.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Put the fourteen sources together and the picture is surprisingly consistent. Age is
          a weak predictor of whether a career change succeeds. Planning and direction are
          strong ones. In Indeed's survey of workers who made dramatic career changes —
          marketing to engineering, teaching to finance —{' '}
          <strong>83% planned the move in advance</strong>, typically spending{' '}
          <strong>around eleven months</strong> weighing it before jumping. These weren't leaps
          of faith. They were researched exits.
        </p>
        <p>
          The failures cluster on the other side: switches made in a burnout spiral, toward
          whatever was nearest, defined by what the person was escaping rather than where they
          were going. The Joblist regret numbers live almost entirely in that group.
        </p>
        <p>
          Which is the honest case for doing the diagnostic work first. Not because a test says
          so, but because the data does: the single thing the successful switchers had that the
          regretful ones didn't was a <strong>clear, specific picture of what would fit them
          better</strong> — before they handed in notice. That picture is exactly what Cairnly's
          assessment is built to produce: who you are, mapped to concrete careers worth those
          eleven months of consideration. Whether you're 30, 40, or 55, the research says the
          same thing. It's not too late. It's just not a coin flip either — and it rewards the
          people who aim.
        </p>
      </>
    ),
  },
];

export const sources: Source[] = [
  { n: 1, content: <><strong>US Bureau of Labor Statistics.</strong> National Longitudinal Surveys, Frequently Asked Questions ("Number of jobs held in a lifetime" / statement that BLS has never estimated career changes). Page last modified March 2025. bls.gov/nls</> },
  { n: 2, content: <><strong>US Bureau of Labor Statistics.</strong> Number of Jobs, Labor Market Experience, and Earnings Growth: NLSY79 news release, August 2023; NLSY97 news release, April 2024.</> },
  { n: 3, content: <><strong>Pew Research Center.</strong> "Majority of U.S. Workers Changing Jobs Are Seeing Real Wage Gains." July 2022. (Analysis of Current Population Survey data: wage outcomes, occupation/industry switching, mobility by age.)</> },
  { n: 4, content: <><strong>OECD.</strong> Employment Outlook 2025, chapters on workforce ageing and job mobility. 2025.</> },
  { n: 5, content: <><strong>OECD.</strong> Promoting Better Career Choices for Longer Working Lives. 2024. (Wage growth of voluntary job changers by age, OECD countries 2010–20.)</> },
  { n: 6, content: <><strong>OECD.</strong> Education at a Glance 2025 — adult participation in education and training by age.</> },
  { n: 7, content: <><strong>Neumark, D., Burn, I., &amp; Button, P.</strong> "Is It Harder for Older Workers to Find Jobs? New and Improved Evidence from a Field Experiment." <em>Journal of Political Economy</em>, 127(2). 2019. (NBER Working Paper 21669; 40,000+ resumes.)</> },
  { n: 8, content: <><strong>ProPublica &amp; Urban Institute (Johnson, R.).</strong> "If You're Over 50, Chances Are the Decision to Leave a Job Won't Be Yours." December 2018. (Analysis of the Health and Retirement Study, ~20,000 participants tracked since 1992.)</> },
  { n: 9, content: <><strong>AARP Research.</strong> Age discrimination among workers 50-plus. 2022. (n=2,945 adults 50+.)</> },
  { n: 10, content: <><strong>Generation &amp; OECD.</strong> The Midcareer Opportunity: Meeting the Challenges of an Ageing Workforce. October 2023. (Employer and jobseeker survey across 8 countries.)</> },
  { n: 11, content: <><strong>Azoulay, P., Jones, B., Kim, J. D., &amp; Miranda, J.</strong> "Age and High-Growth Entrepreneurship." <em>American Economic Review: Insights</em>, 2(1). 2020. (US Census administrative data.)</> },
  { n: 12, content: <><strong>American Institute for Economic Research.</strong> New Careers for Older Workers. 2015. (Self-selected survey of attempted post-45 career changers; self-reported success — see methodology note.)</> },
  { n: 13, content: <><strong>Indeed.</strong> Career Change Report. 2019. (n=662 US workers who made dramatic career changes; often misquoted — "39" is the average age of respondents, not "the average age of career change.")</> },
  { n: 14, content: <><strong>Joblist.</strong> Job Market Report, 2022 (quit-regret figures, verified via World Economic Forum coverage). Plus <strong>Bank of America Institute</strong> payroll analysis on the fading switcher premium, June 2026 (verified second-hand only).</> },
];

export const methodology =
  "We compiled this report from publicly available research published between 2015 and 2026, prioritising government statistics, peer-reviewed studies, and large longitudinal datasets over vendor surveys. Every statistic was traced to its primary source where possible; the two figures we could only verify second-hand (Joblist regret rates; Bank of America Institute 2026 payroll data) are flagged as such in the text. Where a widely quoted number turned out to have no measurable origin — the \"5-to-7 careers\" claim, the misread \"average career change age of 39\" — we say so rather than repeat it. The self-reported 82% success rate from AIER's 2015 survey is cited with its limitations: a self-selected sample, self-defined success, and a decade of age. The numbers here are not Cairnly's; the framing of why they matter for career fit is.";
