# SEO Growth Playbook

A portable, sector-agnostic runbook for taking a product from "invisible on Google"
to "ranking on the searches that matter." It captures the strategy used to build out
Cairnly's SEO in July 2026, written so it can be lifted into a **completely different
project, sector, and product**.

## How to reuse this in another project

Copy two files into the new repo:
- this file (`SEO_GROWTH_PLAYBOOK.md`) → repo root
- `.claude/commands/seo.md` → the new repo's `.claude/commands/`

Then, in that repo, run `/seo` (or just say "follow the SEO playbook"). Claude will
read this file and adapt it to that project's stack, sector, and product.

**What transfers 1:1 vs. what you re-derive:**

| Layer | Transfers unchanged? | Why |
|---|---|---|
| **Part 1 — Technical foundation** | ✅ Yes, 1:1 | It's stack-dependent, not sector-dependent. A React SPA is a React SPA whether it sells career tests or tractor parts. |
| **Part 2 — Content engine** | ⚠️ Method transfers; specifics don't | The *workflow* (research → draft → review → publish → measure) is identical. The *keywords, competitors, research angle, and voice* must be re-derived for the new sector — never copy them. |
| **Part 3 — Principles** | ✅ Yes | Truth-as-defense, disclose-your-interest, the indexing rules — universal. |

**The one-line strategy:** *Make every page individually rankable and shareable
(Part 1), then earn rankings over time with original, rigorously-sourced content that
targets the gaps competitors leave (Part 2). Everything else is patience and
measurement.*

---

## Part 1 — Technical foundation (≈1 day of code, do this first)

### The problem this solves

Most modern web apps are **client-rendered single-page apps (SPAs)** — React, Vue, etc.
They ship one `index.html` shell and render everything with JavaScript. That creates two
SEO-killing defaults:

1. **Every route serves the same `<head>`** — same title, same description. Google can't
   tell your pages apart, so it can't rank them for their own topics.
2. **Non-JavaScript crawlers see nothing.** Google runs JS (slowly); LinkedIn, Slack,
   WhatsApp, Facebook, and some search bots **do not**. Share a link and they all show
   the same generic homepage card.

If the project uses a server-rendered framework (Next.js, Astro, Remix, SvelteKit,
Nuxt), most of this is handled natively — use the framework's `<head>`/metadata API and
skip to the checklist items that still apply (sitemap, robots, structured data, canonical
domain, share card). If it's a plain SPA (Vite/CRA + React Router), do all of it.

### The checklist (with the reasoning and the traps)

**1. Per-page `<head>` management.**
One reusable `<Seo>` component that sets, per route: `<title>`, meta description,
`<link rel="canonical">`, Open Graph tags, Twitter card tags, and JSON-LD. On React 18
use `react-helmet-async`; on React 19 you can render `<title>`/`<meta>` directly (native
hoisting); other frameworks have their own head API.

**2. Single source of truth — avoid the duplicate-tag trap.** ⚠️ *This one bit us.*
Do **not** hardcode varying tags (description, OG, canonical) in `index.html` **and** also
render them dynamically. The dynamic library can only replace tags *it* created, so the
static ones linger and you end up with two conflicting copies of each — crawlers pick the
wrong one. Keep `index.html` to genuinely invariant tags only (charset, viewport, icons,
a fallback `<title>`). Render one default `<Seo>` at the app root and override per page.

**3. Non-JS crawlers: bake tags into static HTML at build time.**
If you can't SSR, generate one HTML file per public route at build (a "poor man's
prerender"): copy the built `index.html` into `dist/<route>/index.html` with that route's
tags injected into the `<head>`. Vercel/Netlify serve the filesystem match before the SPA
rewrite, so a scraper hitting `/blog/post` gets correct static tags while the app still
boots normally. Mark the injected tags with a `data-*` attribute and strip them in your JS
entrypoint before the app mounts, so the runtime head manager stays the sole owner (else
you re-introduce trap #2). *(See `scripts/inject-meta.mjs` + `scripts/seo-routes.mjs` in
this repo for a working implementation.)*

**4. `sitemap.xml` generated from one route registry.**
Keep a single list of public routes (+ any DB/markdown-driven pages) and generate the
sitemap from it at build time. Reference it in `robots.txt`. One registry feeds both the
sitemap and the static shells from #3, so a new page appears in both automatically.

**5. `robots.txt`: allow public, disallow internal.**
Allow marketing/content routes; `Disallow:` app/auth/admin/dev routes (`/dashboard`,
`/auth`, `/admin`, etc.). Add a `Sitemap:` line. Also set `<meta name="robots"
content="noindex">` on those internal routes (belt and suspenders — robots.txt stops
crawling, noindex stops indexing if a URL leaks via a link).

**6. Canonical domain discipline.**
Pick **one** host — apex (`site.com`) or `www` — as primary, redirect the other to it,
and store it as **one constant** in code that every canonical/OG/sitemap URL derives from.
Two hosts serving the same content with no redirect splits your ranking. Whichever the
host (Vercel/DNS) says is live, match it; flipping later is a one-line change.

**7. Structured data (JSON-LD).**
`Organization` + `WebSite` on the homepage (brand recognition, sitelinks). `Article` +
`BreadcrumbList` on content pages (rich results, and LLMs cite structured data). `Product`,
`FAQPage`, `HowTo`, etc. where they genuinely fit the content — don't fake schema for
content that isn't there.

**8. A real share card + trim image weight.**
Produce a proper **1200×630** Open Graph image in the brand's fonts/palette (not the raw
logo). Slim oversized favicons/app icons — page speed (Core Web Vitals) is a ranking
factor. A headless-browser render of a small HTML card is an easy way to generate the OG
image on-brand.

**9. Keyword-target the title, description, and H1.**
Brand poetry ("Career path clarity") doesn't match what people type. Work the actual
high-intent phrase into the title/description/H1 ("career change," "career assessment").
This is where Part 1 meets Part 2.

### How to verify Part 1 (don't trust, check)
Build for production, serve it, and drive a **headless browser** to each route asserting:
one (and only one) of each tag, correct per-route values, `noindex` present on internal
routes, and the static shells contain the right tags **without JS** (fetch the raw HTML).
We caught the duplicate-tag bug and a missing-env blank-page this way — a passing build
does not prove the head is correct.

---

## Part 2 — The content engine (what actually ranks, over months)

The technical layer makes pages *rankable*. Content is what makes them *rank*. This is the
higher-leverage, slower-burning half. The workflow below is identical across sectors; the
inputs are not.

### 1. Research keywords AND gaps — before writing a word.
Find what your audience actually searches (phrases, not your brand name). Then find the
**openings**:
- **Query gaps** — searches with weak, stale, or no dedicated page. (For Cairnly,
  "career coach vs career assessment" had *no* dedicated page anywhere — an open lane.)
- **Evidence gaps** — claims every competitor makes but *none* backs with data. That
  vacuum is your wedge.
Skim the top-ranking pages for the target query: note what they all say (so you can
compress it) and what none of them prove (so you can own it).

### 2. Differentiate with original, cited research.
The durable moat is content competitors *can't* cheaply copy. For Cairnly that was the
"research report" format: stat-dense, every claim traced to a named primary source. Pick
the equivalent credible angle for the new product — original data, a rigorous teardown, a
genuinely useful tool, first-hand testing. Listicles rank for a while; researched pages
earn links and age well.

### 3. Sourcing discipline (this is what makes bold content defensible).
- Trace every factual claim to a **named primary source** (institution + year).
- Flag anything you could only verify **second-hand**.
- **Label geography** of each stat (don't present US data as universal — huge tell, and
  wrong for a non-US audience).
- Include **caveats that cut against your own product.** Citing the evidence *against*
  yourself is what makes the rest credible — and legally safe.
- Name recycled/unsourced "facts" and debunk them rather than repeating them.

### 4. The production workflow (repeat per article).
1. **Research** — fan out searches, fetch primary sources, verify claims adversarially
   (default to "unproven" until a real source is found).
2. **Draft** in the house voice, matching an existing well-formed piece's structure.
3. **Review copy** — hand the human a *readable* rendered page (an artifact/preview),
   never a code diff. They approve content, not TypeScript.
4. **Publish** on approval (branch → PR → merge). Content is never auto-merged.
5. **Request indexing** in Search Console for the new URL (hours vs. days to discovery).
6. **Seed** on LinkedIn (see Part 3 on why).

### 5. De-AI the prose (do this every time).
Machine-drafted text has tells that make people stop reading. On every draft:
- Cut em-dash overload; use commas/periods.
- Kill repeated constructions (the "It's not X. It's Y." cadence, stacked triads).
- Remove tic words (an over-used "honest," "delve," "crucial," "landscape").
- Vary sentence length. Keep the one or two vivid phrases; delete the rest of the polish.

### 6. Internal linking.
Link new articles to related ones. It spreads ranking authority and keeps readers on site.
A cluster of cross-linked pages on one theme outranks the same pages standing alone.

### 7. The measurement loop (the payoff).
Set up **Google Search Console** + **Bing Webmaster Tools**, submit the sitemap, then
**wait 2–3 weeks** for data. Then read which queries you actually surface for and write the
*next* articles targeting those — real demand beats guessing. This closes the loop: the
data tells you what to write next.

---

## Part 3 — Cross-cutting principles

- **Truth is the defense.** Especially for competitor/comparison content: if every claim
  is a verifiable fact or the other party's own published data, it's defensible no matter
  who it annoys. "Backed and defensible" is the license to publish bold.
- **Disclose your own commercial interest and hold yourself to the same standard** you
  apply to competitors (e.g. disclose your price *and* planned changes, cite evidence
  against your own product). Self-application is armor.
- **Social shares don't directly boost Google rankings** (LinkedIn links are "nofollow").
  Their value is a **backlink lottery ticket** — the chance someone with a real website
  cites your research. Low engagement on a post doesn't waste anything; it's one ticket
  that didn't hit. Keep buying tickets (one finding per post, over weeks).
- **Small edits don't hurt indexing.** Google re-crawls changed pages as a matter of
  course; fixing a typo or updating a price is safe and mildly positive (looks
  maintained). Only re-*request* indexing for new pages or major rewrites. The one real
  caution: don't rip the keyword-carrying title/H1 out of a page that's already ranking.
- **New domains rank slowly.** Weeks to index, months to climb, compounding with each
  quality page. This is a curve, not a launch.

---

## The human's recurring checklist (things only the owner can do)

These require account/DNS/social access an agent doesn't have. Per new article, and at
setup:

- [ ] **Search Console**: verify the domain (DNS TXT record), submit `sitemap.xml`, and
      **Request Indexing** on each new URL.
- [ ] **Bing Webmaster Tools**: one-click import from Search Console.
- [ ] **Domain/DNS**: set one canonical host as primary, redirect the other; redirect
      any legacy/old-brand domains rather than deleting them.
- [ ] **LinkedIn**: seed each article — post from a *personal* profile (algorithms favor
      people over company pages), lead with a *finding* not a link.
- [ ] **Approve/merge** content PRs after reading the review copy.

---

## Pitfalls we hit (so the next project doesn't)

- **Duplicate meta tags** from static + dynamic tags coexisting (Part 1, #2).
- **Blank pages** when a build lost its `.env` — the SPA died on missing env vars; static
  SEO shells still rendered, masking it. Verify the *app boots*, not just that tags exist.
- **Broken image/asset paths** after a folder reorg — the SEO scripts kept emitting old
  URLs. Keep asset paths in the single route registry so one edit fixes all shells.
- **US-centric data** presented as universal — label geography from the first draft.
- **Merging one commit too early** in a squash — verify the branch tip is what you think
  before merging.

---

*Worked example: this playbook was executed on Cairnly (career-guidance SaaS). Part 1
lives in `src/components/Seo.tsx`, `src/lib/seo.ts`, `scripts/seo-routes.mjs`,
`scripts/inject-meta.mjs`, `scripts/generate-sitemap.mjs`. Part 2's output is the
`Cairnly Research` reports under `src/content/journal/`. Use them as reference
implementations; re-derive all keywords, competitors, and voice for the new sector.*
