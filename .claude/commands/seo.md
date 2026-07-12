---
description: Run the SEO growth playbook (SEO_GROWTH_PLAYBOOK.md) — audit + build the technical foundation and/or draft researched content, adapted to this repo's stack and sector.
argument-hint: optionally "audit" | "technical" | "content <topic>" (default audits and recommends)
---

You are running the SEO growth playbook for **this** project. It may be a different
stack, sector, and product than the one the playbook was written from — adapt, don't
copy specifics.

## Your job

1. **Read `SEO_GROWTH_PLAYBOOK.md` first** — it is the authoritative runbook (portable,
   sector-agnostic). If it isn't in this repo, tell the user to copy it here from the
   project they got it from, then stop.

2. **Detect the context before acting:**
   - Framework/stack (plain SPA vs. Next/Astro/Remix/etc.) — decides how much of Part 1
     applies. Check `package.json`, the build config, and how `<head>`/routing work.
   - The product and its audience, in one sentence — you need this to reason about
     keywords and the credible research angle. If it isn't obvious from the repo
     (README, landing copy, CLAUDE.md), **ask the user**.
   - The live domain + which host is canonical (ask if unknown; never guess — a wrong
     canonical splits rankings).

3. **Pick the mode from `$ARGUMENTS`:**
   - empty / `audit` → audit the current SEO state against Part 1's checklist and report
     gaps with a prioritized recommendation. Don't write code yet.
   - `technical` → implement Part 1 for this stack (per-page head, single-source-of-truth,
     static shells or SSR, sitemap, robots, canonical, structured data, share card).
   - `content <topic>` → run Part 2's production workflow for one article: research (fan
     out, verify sources adversarially), draft in the house voice, then produce a
     **readable review copy** (artifact/preview, not a diff) and stop for approval.

4. **Respect the gates.** Technical changes go on a branch; **content is never merged
   without the human reading the review copy first.** Verify Part 1 work with a headless
   browser (real per-route tags, no duplicates, app actually boots) before committing.

5. **Hand back the human checklist** (Search Console, DNS, LinkedIn) — those steps the
   owner must do; you can't. List the specific URLs/records they need.

Keep the non-technical owner in mind: explain what each change does and why, offer a
preview, and never sit on branch work silently.
