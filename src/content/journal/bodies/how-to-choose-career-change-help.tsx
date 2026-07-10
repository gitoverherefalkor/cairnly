import React from 'react';
import InlineStat from '@/components/journal/InlineStat';
import PullQuote from '@/components/journal/PullQuote';
import type { StatGridEntry, Chapter, Source } from './career-uncertainty-report';

/**
 * Body content for /journal/how-to-choose-career-change-help.
 *
 * Cairnly Research · Report 05 — the buyer's guide. Names real companies, so
 * the sourcing bar is highest here: every company fact comes from that
 * company's own site or an attributed third party, access-dated 2026-07-10.
 * Reviewer complaints are attributed to reviewers, never stated as fact.
 * Cairnly appears in the comparison table with explicit disclosure.
 */

export const description =
  "Career-change help runs from a free government test to a $280-a-month coaching subscription, and the market has no referee. Coaching is unlicensed, most tests never publish evidence, and one major platform won't tell you its price without a sales call. A field guide to choosing, every claim sourced. Including where we fit, disclosed.";

const cellTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 12px',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: '#213F4F',
  color: '#F4ECDA',
  borderBottom: '2px solid #C9B690',
  whiteSpace: 'nowrap',
};
const cellTd: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  verticalAlign: 'top',
  borderBottom: '1px solid rgba(201,182,144,0.5)',
  lineHeight: 1.45,
};

export const introContent = (
  <>
    <p>
      Deciding to change careers is hard enough. Then comes the second decision: what kind of
      help to buy, in a market that runs from a free government questionnaire to a coaching
      subscription north of €250 a month, with no licensing body, no standard labels, and
      review pages written mostly by the sellers. We published the evidence on coaching and
      assessments separately (
      <a href="/journal/career-coach-vs-career-assessment" style={{ color: '#1F8282', fontWeight: 600 }}>Report 04</a>
      ). This guide applies it to the actual market.
    </p>
    <p>
      One disclosure before anything else: Cairnly is a product in this market, and it appears
      in the comparison table below, labeled as ours. Every fact about a named company comes
      from that company's own website or an attributed third-party source, checked on 10 July
      2026. Prices change; where we could not verify a price from the company's own pages, we
      say so.
    </p>
  </>
);

export const statGrid: StatGridEntry[] = [
  { number: 'Free–$280', description: 'The monthly spread for career-change help, from a validated government test at zero to coaching-marketplace subscriptions.', source: 'Company sites & directories, July 2026' },
  { number: '$0', description: "The price of the O*NET Interest Profiler: 20+ years of research, a published technical manual, funded by the US Department of Labor.", source: 'O*NET / US DOL' },
  { number: '600 hours', description: 'Of documented career work required for the Dutch Noloc register. Hours legally required to call yourself a "career coach": zero.', source: 'Noloc; ICF (credentials voluntary)' },
  { number: 'Unpublished', description: "BetterUp's individual-plan pricing. You learn the price after you engage. Hidden pricing is a documented consumer red flag.", source: 'betterup.com, checked July 2026' },
  { number: '$18.95', description: 'One-time cost of the Self-Directed Search, the most-researched career interest test in existence.', source: 'PAR / self-directed-search.com' },
  { number: 'Zero', description: 'AI coaching apps with published effectiveness evidence. The category is new; the marketing is ahead of the science.', source: 'Vendor sites surveyed, July 2026' },
  { number: '899+', description: 'Psychological tests independently reviewed by COTAN, the Dutch test-review board. A checkable register most buyers never hear about.', source: 'COTAN' },
  { number: '1–2 years', description: "How long a new job's satisfaction boost lasts when the underlying mismatch was never diagnosed. Buy the diagnosis first.", source: 'Boswell et al., 2005' },
];

export const chapters: Chapter[] = [
  {
    id: 's1',
    num: '01',
    shortTitle: 'The map',
    title: 'The market, mapped: seven ways to buy career help.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Everything on offer falls into seven categories. The table gives the shape of each;
          the chapters after it give you three filters that sort the good from the expensive.
        </p>
        <div style={{ overflowX: 'auto', margin: '1.6em 0 0.4em' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, background: '#FBF6E8', borderRadius: 8 }}>
            <thead>
              <tr>
                <th style={cellTh}>Option</th>
                <th style={cellTh}>Typical price</th>
                <th style={cellTh}>Model</th>
                <th style={cellTh}>Validated assessment?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cellTd}><strong>Coaching marketplaces</strong><br />e.g. Strawberry.me</td>
                <td style={cellTd}>≈$280/month, as reported in third-party comparisons (July 2026)</td>
                <td style={cellTd}>Subscription, human coach</td>
                <td style={cellTd}>No; intake quiz is for coach matching</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>Enterprise coaching, individual tier</strong><br />BetterUp</td>
                <td style={cellTd}>Not published; ~$279/month reported Feb 2024</td>
                <td style={cellTd}>Subscription, human coaches + AI</td>
                <td style={cellTd}>Proprietary development assessment; not a career-matching instrument</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>Coach directories</strong><br />e.g. Noomii</td>
                <td style={cellTd}>$75–250/hour, set by each coach</td>
                <td style={cellTd}>Per session or package</td>
                <td style={cellTd}>No</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>Certified career counselors</strong><br />NCDA CCC (US), Noloc register (NL)</td>
                <td style={cellTd}>$75–250/hour; Dutch trajectories commonly €800–3,000</td>
                <td style={cellTd}>Per session</td>
                <td style={cellTd}>Often administer validated tests</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>AI coaching apps</strong><br />e.g. CareerClimb, Lauren</td>
                <td style={cellTd}>$10–29/month</td>
                <td style={cellTd}>Subscription, AI</td>
                <td style={cellTd}>No; no published effectiveness evidence</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>Career tests</strong><br />O*NET, SDS, CliftonStrengths, MAPP, Truity, CareerExplorer</td>
                <td style={cellTd}>Free to ~$150, one-time</td>
                <td style={cellTd}>One-time</td>
                <td style={cellTd}>Varies wildly; see chapter 03</td>
              </tr>
              <tr>
                <td style={cellTd}><strong>DIY books</strong><br />Parachute, Designing Your Life</td>
                <td style={cellTd}>$20–32</td>
                <td style={cellTd}>One-time</td>
                <td style={cellTd}>No</td>
              </tr>
              <tr style={{ background: 'rgba(212,160,36,0.09)' }}>
                <td style={cellTd}><strong>Cairnly</strong> (that's us)</td>
                <td style={cellTd}>€39, one-time</td>
                <td style={cellTd}>Assessment mapped to specific careers + AI coach on your results</td>
                <td style={cellTd}>Yes; built on validated instruments (see our methodology)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="lp-source">All prices checked 10 July 2026 against company sites where available; two figures rely on attributed third-party reporting, as noted.</p>
        <p>
          Three patterns worth seeing in that table. Subscriptions dominate the human end of
          the market. Validated measurement is rare everywhere. And the price of an option has
          no visible relationship to the evidence behind it.
        </p>
      </>
    ),
  },
  {
    id: 's2',
    num: '02',
    shortTitle: 'Filter 1: credentials',
    title: 'Filter one: check the register, because nobody else checks it for you.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          As we documented in{' '}
          <a href="/journal/career-coach-vs-career-assessment" style={{ color: '#1F8282', fontWeight: 600 }}>Report 04</a>,
          no jurisdiction licenses career coaches. The floor is whatever a platform sets for
          itself. Strawberry.me, to its credit, states that its coaches are ICF-certified.
          Directories like Noomii list tens of thousands of coaches with lighter vetting, and
          nothing stops an uncredentialed coach from selling directly.
        </p>
        <p>
          The registers that do exist are checkable in minutes, and the bars differ sharply.
          An ICF ACC credential requires 60 hours of training and 100 hours of coaching; a US
          NCDA Certified Career Counselor requires a <strong>graduate counseling degree</strong>{' '}
          plus supervised experience; the Dutch Noloc register requires{' '}
          <strong>600+ hours of documented career work</strong> in the prior three years, a
          portfolio assessment, a code of conduct with a complaints procedure, and
          re-certification every four years. All three have public lookup directories. If a
          provider claims a credential, spend the two minutes.
        </p>
        <p>
          One caveat the coaching research itself insists on: studies find that the quality of
          the working relationship predicts coaching outcomes better than the coach's
          credentials do. Treat a register as an accountability floor, an ethics code and a
          complaints procedure, not a guarantee of results. It filters out the worst; it does
          not rank the best.
        </p>
      </>
    ),
  },
  {
    id: 's3',
    num: '03',
    shortTitle: 'Filter 2: validity',
    title: 'Filter two: no technical manual, no purchase.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          "Career test" is an unprotected phrase covering both of these things: instruments
          refined across decades of published research, and quizzes engineered to feel
          insightful behind a paywall. The professional standards bodies (the APA's testing
          standards in the US, the EFPA review model in Europe) agree on the dividing line: a
          real instrument documents its reliability, validity, and norms in a published
          technical manual.
        </p>
        <InlineStat
          number="899+"
          text="tests independently reviewed by COTAN, the Dutch committee that rates psychological tests on norms, reliability, and validity. If you are buying a test in the Netherlands, this register exists for you."
          source="COTAN documentatie (cotandocumentatie.nl)"
        />
        <p>
          Applying that line to the shelf: the <strong>O*NET Interest Profiler</strong> is
          free, government-funded, and publishes a full technical manual. The{' '}
          <strong>Self-Directed Search</strong> ($18.95) is the most-researched interest
          instrument in the field. <strong>CliftonStrengths</strong> publishes a technical
          report, with the caveat that it is a strengths tool, not a career matcher.{' '}
          <strong>MAPP</strong> publishes a validity study on its own site. Popular free tests
          like <strong>CareerExplorer</strong> and <strong>Truity</strong> claim validation,
          but we could not find a public technical manual for either. And the best-known test
          of all, the MBTI, has published retest reliability weak enough that a large share of
          takers change type within weeks (see{' '}
          <a href="/journal/career-coach-vs-career-assessment" style={{ color: '#1F8282', fontWeight: 600 }}>Report 04</a>
          ). Independent reviewers of several paywalled tests report the same arc: long quiz,
          generic results, payment gate to see the rest. The manual question sorts all of this
          in one move.
        </p>
      </>
    ),
  },
  {
    id: 's4',
    num: '04',
    shortTitle: 'Filter 3: the exit',
    title: 'Filter three: read the exit before the entrance.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          Most career help is now sold as a subscription, and the complaint patterns in public
          reviews cluster on the way out, not the way in. On Trustpilot, Strawberry.me holds a
          strong 4.8 across 483 reviews (July 2026), and its recent critical reviews cluster
          on billing: reviewers report per-session pricing operating as a recurring monthly
          charge and refund requests answered with account credits rather than money.
          BetterUp shows the opposite split: an A+ accreditation from the Better Business
          Bureau alongside a 2.7 on Trustpilot from just 18 reviews, several disputing session
          credits that expired after 30 days; a review base that small proves little either
          way, so we show you both. Notably, reviewers on both platforms consistently praise
          the coaches themselves. The friction lives in the billing machinery. We report all
          of this as reviewer accounts, not findings.
        </p>
        <p>
          Two structural rules protect you regardless. In the Netherlands and the EU,
          regulators require that a subscription taken out online can be cancelled online
          (ACM guidance), and Dutch law caps post-term notice periods at one month. In the US,
          federal law requires a simple cancellation mechanism for auto-renewing
          subscriptions. If you cannot find the cancellation path before you buy, that is your
          answer.
        </p>
        <PullQuote>
          A useful default: pay <strong>one-time</strong> for diagnosis, and subscribe only to
          execution support you are actively using. The diagnosis does not need a renewal
          date.
        </PullQuote>
      </>
    ),
  },
  {
    id: 's5',
    num: '05',
    shortTitle: 'The decision path',
    title: 'Putting it together: a decision path instead of a brand choice.',
    content: (
      <>
        <p style={{ marginTop: '1.4em' }}>
          The evidence from our earlier reports gives the sequence: structured measurement for
          the "what fits me" question, human support for the follow-through (
          <a href="/journal/career-coach-vs-career-assessment" style={{ color: '#1F8282', fontWeight: 600 }}>Report 04</a>
          ), and a diagnosis before any leap, because an undiagnosed mismatch follows you to
          the next employer (
          <a href="/journal/signs-its-time-to-change-careers" style={{ color: '#1F8282', fontWeight: 600 }}>Report 03</a>
          ). Applied to the table:
        </p>
        <p>
          <strong>If you have no budget:</strong> start with the O*NET Interest Profiler. It
          is free and better validated than most paid tests. Its limits: US-framed occupation
          lists and no guidance layer on top of the scores. In the Netherlands, UWV's werk.nl
          offers free orientation tests too; the fine print on the page notes they are
          supplied by the commercial test site 123test.nl, so the manual question from
          chapter 03 applies there as well.
        </p>
        <p>
          <strong>If you want a human in the room:</strong> choose a registered professional
          over an unregistered coach at the same price, and verify the register entry. In the
          Netherlands that means Noloc; in the US, NCDA. Expect €800 to €3,000 for a full
          Dutch trajectory, and ask whether validated instruments are part of it.
        </p>
        <p>
          <strong>If you are considering a coaching subscription:</strong> apply all three
          filters first: credentials on a public register, evidence for the method, and a
          visible exit. Then buy it for what the research says it is good at, momentum and
          accountability, after you know your direction.
        </p>
        <p>
          <strong>Where we sit, disclosed:</strong> Cairnly is the one-time-diagnosis option
          in the table: €39 for a validated assessment mapped to specific careers, with an AI
          coach to work through the results. We built it to fill the cell the market left
          empty, structured measurement first, guidance on top, no renewal date. Judge us by
          the same filters we just handed you. That is what they are for.
        </p>
      </>
    ),
  },
];

export const sources: Source[] = [
  { n: 1, content: <><strong>Strawberry.me.</strong> FAQ and site content (coach certification, matching model). Accessed 10 July 2026. Pricing (~$280/month) per third-party comparisons (CareerClimb, 2026); not verified from Strawberry.me's own pages.</> },
  { n: 2, content: <><strong>BetterUp.</strong> Individual plans support documentation (Plus/Premium session structure). Accessed 10 July 2026. Consumer pricing unpublished on betterup.com; ~$279/month reported by MentorCruise, February 2024.</> },
  { n: 3, content: <><strong>Noomii.</strong> Help pages and cost guides ($75–250/hour typical). Accessed 10 July 2026.</> },
  { n: 4, content: <><strong>CareerClimb (careerclimb.app); TextLauren (textlauren.com).</strong> Pricing and product pages. Accessed 10 July 2026.</> },
  { n: 5, content: <><strong>O*NET / US Department of Labor.</strong> Interest Profiler (mynextmove.org), free; technical manual at onetcenter.org/reports/IP_Manual.html.</> },
  { n: 6, content: <><strong>PAR / self-directed-search.com.</strong> Self-Directed Search, $18.95, online. Accessed 10 July 2026.</> },
  { n: 7, content: <><strong>Gallup.</strong> CliftonStrengths store pricing (Top 5 $24.99; full 34 upgrade $49.99) and technical report. Accessed 10 July 2026.</> },
  { n: 8, content: <><strong>assessment.com (MAPP).</strong> Pricing ($89.95–149.95) and published validity study. Accessed 10 July 2026. <strong>Truity; CareerExplorer (Sokanu).</strong> Test pages and pricing; no public technical manual found for either. Accessed 10 July 2026.</> },
  { n: 9, content: <><strong>International Coaching Federation.</strong> Credentialing requirements (ACC/PCC). <strong>NCDA.</strong> Certified Career Counselor requirements. <strong>Noloc.</strong> Register Loopbaanprofessional requirements (600+ hours, portfolio, 4-year re-certification).</> },
  { n: 10, content: <><strong>Trustpilot.</strong> Strawberry.me review page (4.8/5, ~480 reviews, incl. Trustpilot's review-solicitation notice); BetterUp reviews. Accessed 10 July 2026. <strong>G2.</strong> BetterUp reviews and pricing page.</> },
  { n: 11, content: <><strong>COTAN.</strong> Dutch committee on test affairs; 899+ independent test reviews (cotandocumentatie.nl).</> },
  { n: 12, content: <><strong>EFPA.</strong> Test review model. <strong>AERA/APA/NCME.</strong> Standards for Educational and Psychological Testing (technical-manual requirement).</> },
  { n: 13, content: <><strong>ACM (Autoriteit Consument &amp; Markt).</strong> Guidance: subscriptions taken out online must be cancellable online. <strong>Wet Van Dam</strong> (NL, notice-period cap). <strong>US:</strong> ROSCA simple-cancellation requirement.</> },
  { n: 14, content: <><strong>Jones, R. J., Woods, S. A., &amp; Guillaume, Y. R. F.</strong> Workplace coaching meta-analysis, <em>JOOP</em>, 2016. (Working alliance vs credentials as outcome predictor.)</> },
  { n: 15, content: <><strong>Boswell, W. R., Boudreau, J. W., &amp; Tichy, J.</strong> The honeymoon-hangover effect, <em>Journal of Applied Psychology</em>, 90(5). 2005.</> },
  { n: 16, content: <><strong>Bolles, R. N.</strong> <em>What Color Is Your Parachute?</em> <strong>Burnett, B., &amp; Evans, D.</strong> <em>Designing Your Life.</em> (List prices via Penguin Random House, accessed 10 July 2026.)</> },
];

export const methodology =
  "Every company fact in this guide comes from that company's own website or an attributed third-party source, checked on 10 July 2026. Two prices could not be verified from the company's own pages and are labeled with their third-party origin (Strawberry.me's subscription rate; BetterUp's individual pricing, which is not published). Reviewer complaints are reported as reviewer accounts, not as findings about the companies. Cairnly is a product in this market; it appears in the comparison table with disclosure, and the evaluation filters in chapters 02 through 04 apply to us as much as to anyone. Prices and review scores change; treat the figures as a snapshot, not a promise.";
