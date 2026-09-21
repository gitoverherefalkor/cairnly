# Cairnly Starter: Marketing & Distribution Handoff

**Date:** 2026-07-06
**Product:** Cairnly Starter, live at cairnly.io/starter (English only for now)
**Audience:** Gen Z / young adults (roughly 18-27) trying to land their first or second serious job. Little or no professional experience. Caught in the "limbo" of a tight entry-level market plus AI absorbing classic junior tasks.
**Status at handoff:** Frontend, survey, and payment flow are live. The starter AI pipeline (WF1S-WF4S in n8n) is built but INACTIVE pending review. Do not drive traffic until the launch checklist in `docs/superpowers/specs/2026-07-05-starter-flavor-design.md` is complete.

---

## 1. What is fundamentally different about this group

These four differences drive every recommendation below. If a campaign idea does not lean on at least one of them, it is probably a pro-audience idea wearing a hoodie.

### 1.1 The buyer and the user are often different people
Pro customers buy for themselves. Starters have no income, high price sensitivity, and decision fatigue. But they are surrounded by people who desperately want to help and do not know how: parents, grandparents, mentors. Career clarity is one of the few gifts a parent of a stuck graduate will happily pay for.

**The unfair advantage:** Cairnly's existing pro audience (35-55, office professionals) literally are these kids' parents. We already own the buyer's attention. Starter distribution starts inside the pro funnel, not next to it.

### 1.2 They travel in cohorts at predictable moments
Pros hit career doubt individually and unpredictably. Starters hit the wall together:

- **June/July:** graduation wave
- **September:** the "everyone else has a job" panic
- **January:** the "new year, still nothing" dip

They sit in reachable groups: study programs, student associations, bootcamps, traineeship waitlists. One good experience in a cohort spreads to thirty peers for free. Plan campaigns against this calendar, not spread evenly across the year.

### 1.3 They have evidence but no vocabulary for it
A pro's problem is direction. A starter's problem is direction PLUS articulation. They have run shifts, organized events, built things, taught themselves tools, and then they write "flexible team player" on a CV because nobody taught them that a supermarket job contains five interview stories.

This is where the honest "leg up" lives: not inventing experience, but articulating real experience they do not recognize as such. It is also the emotional core of the messaging: "you have more evidence about yourself than you think."

### 1.4 Institutions are paid to care about them
Youth-to-work is a funded policy area: university and hogeschool career services, gemeenten, traineeship providers, EU youth programs. Nobody has a budget for helping a 45-year-old marketer pivot. Lots of people have budgets and placement KPIs for graduates.

---

## 2. Distribution channels, ranked by effort-to-impact

### Priority 1: Parents as buyers (the gift wedge)
- **Positioning:** "Stop lecturing. Give clarity." A graduation gift that is not money or another lecture.
- **Mechanics:** the access-code system already supports buy-for-someone-else; a code is just a code. Needed: a light "gift Starter" moment in the pro product (post-report, when goodwill peaks) and a mention on the pro landing page.
- **Channels:** the existing pro channels (LinkedIn, Meta, newsletter). Same targeting, new message. Zero new channel cost.
- **Timing:** heavy push in May-June (graduation gifts), secondary in December (holiday + January dip anticipation).

### Priority 2: Cohort virality through the report itself
- The share-card system exists. Build a starter variant: "My direction: UX research. And I finally know why." Posted by one anxious grad, it is the most credible ad the rest of the cohort will ever see.
- Pair with the existing referral-code system, tuned for peers (small discount both ways).
- Peer proof beats authority for this group. Testimonials should be from other starters, never from "career experts."

### Priority 3: One institutional pilot (manual, no build)
- Pick ONE hogeschool career service or traineeship provider. Hand them ~25 free codes for a graduating class. Ask for two things back: outcome data and a quotable testimonial.
- If it works, bulk codes at institutional pricing become a clean B2B2C line on existing infrastructure.
- **Hard guardrail:** the institution pays, but the report belongs to the student. No upstream sharing of individual results, ever. The moment career services can read a student's anxieties, the honesty contract is broken and the peer channel dies with it.

### Priority 4: The "limbo" narrative as organic content
- The positioning is already written (see the /starter landing page). "Entry-level requires experience" and "AI ate the junior work" are compulsively shareable topics for this group.
- Short, honest, non-doom content (TikTok/IG/LinkedIn) that says the quiet part out loud. Credibility comes from the product not promising miracles.
- **Content rules:** no fabricated statistics, no doom-bait, no "one weird trick to get hired." The brand is "the platform that does not bullshit you." Every piece of content either passes that test or does not ship.

---

## 3. Product assets that give an actual leg up (future build, shapes the pitch now)

The honest differentiator: turn the report into application ammunition. All of it reuses machinery that already exists for the pro flavor.

| Asset | Builds on | What it does for the starter |
|---|---|---|
| Starter resume | WF9 (custom resume) | Legitimately reframes side jobs, projects, and studies into a credible no-experience CV |
| Cover letter paragraphs | WFX (cover letter) | Cites their real evidence per application |
| Interview prep in the coach | WF5 (chat) | Drills the question they bomb ("why hire you with no experience?") and builds STAR stories from the shifts and projects they think do not count |
| Entry-level job search | WF8 (find roles) | Junior/traineeship filters instead of senior roles |
| Parent one-pager (optional, user-controlled) | Report data | Turns the kitchen-table fight into a structured conversation; closes the loop with the buyer, who tells other parents |

**Pricing implication:** the bundle reframes EUR 39 from "a personality test" to "assessment + direction + application kit + interview coach." That framing survives both the broke-graduate objection and the gifting parent's scrutiny.

**Legitimacy note:** self-awareness is THE junior hiring signal. We manufacture it legitimately: no fabricated experience, no "Cairnly certified" overclaiming, directions always include the hard truths (realistic timelines, salary reality, AI exposure per field).

---

## 4. Honesty guardrails (non-negotiable, they ARE the brand)

1. No fabricated experience anywhere in generated resumes or letters. Reframing real evidence only.
2. No job guarantees, no placement-rate claims we cannot back.
3. No invented statistics in marketing content.
4. Reports and answers belong to the user, never to the paying institution or parent (sharing is the user's choice).
5. Recommendations include the uncomfortable parts: entry timelines, starting salaries, AI exposure. The report that says "this will take 18 months and the first year pays badly" is the report that gets recommended to friends.

---

## 5. Suggested sequence

1. **Now (pre-launch):** finish the launch checklist (activate WF1S-WF4S, set the webhook secret, smoke-test end to end). Decide pricing: keep EUR 39 or introduce a starter price point.
2. **Launch week:** gift cross-sell inside the pro product + pro landing page mention. Announce Starter to the existing newsletter (parents angle, not "we launched a feature" angle).
3. **Month 1:** starter share-card + peer referral tuning. Start the limbo content stream.
4. **Month 2:** one institutional pilot, manually managed.
5. **After pipeline is proven:** spec and build the application-ammunition pack (starter variants of WF9/WFX/WF8 + interview-prep coach mode), then make it the centerpiece of the pitch.

---

*Prepared from the strategy discussion of 2026-07-06. Technical state of the Starter flavor: see `docs/superpowers/specs/2026-07-05-starter-flavor-design.md` (spec + launch checklist) and the project memory. Landing copy source: `public/locales/en/starter.json`.*
