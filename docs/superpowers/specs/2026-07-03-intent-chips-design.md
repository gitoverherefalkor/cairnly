# Intent Chips — personalized landing page framing

**Date:** 2026-07-03
**Status:** Approved design, pending spec review
**Scope:** Homepage (`/`, `src/pages/Index.tsx` and `src/components/landing/`), locale files, one new Supabase table.

## 1. What we're building

A "What brings you here?" chip row in the hero for organic visitors. Clicking a chip swaps the page's *framing copy* (hero + two spots deeper down) to that intent's version, in the visitor's language (EN/NL). Every pick is logged anonymously to Supabase, including a "Something else" free-text option, so over time we learn which entry-reason is most common. The most popular intent can later be promoted to default (a one-line change).

No layout, image, proof-section, pricing, methodology, comparison, FAQ, or final-CTA changes. Ad slugs are **out of scope** for now, but the variant copy and the tracking table's `source` column are structured so slugs can be added later by wiring routes to existing variants.

## 2. Intent taxonomy

| Chip (EN) | Intent key | Copy variant |
|---|---|---|
| I chose my path at 16 | `default` | Current live copy, unchanged |
| Good at my job, not sure it's me | `good-at-it` | New |
| Worried about AI and my role | `ai-worried` | New |
| Life changed, work didn't | `life-changed` | New |
| Understanding myself and what I want | `understand-myself` | New |
| Something else… | `other` | No copy swap; opens free-text input |

## 3. UX behavior

- Chip row renders inside `Hero`, below the CTA/reassurance block. Styled with existing landing pill/gold patterns (`lp-*` classes, gold accent `#D4A024`). Font weights ≤ 700.
- The `default` chip renders **pre-selected** so the row reads as "you're seen", not as a gate.
- Clicking a chip: framing copy cross-fades (~250ms) to that variant. Clicking the default chip restores original copy.
- Choice persists in `localStorage` (`cairnly_intent`) so a returning visitor keeps their framing. On load, a stored intent is applied immediately (no flash of default where avoidable).
- "Something else…" expands an inline one-line text input + submit button. On submit: row is logged, input collapses to a short thanks message. Page copy stays default. Free text capped at 280 chars client-side.
- Every chip click is logged (see §6). A random `visitor_id` UUID in localStorage (`cairnly_visitor_id`) allows de-duping in analysis without identifying anyone.

## 4. What flexes per variant (and what never does)

**Flexes (per intent, per language):**
1. `hero.titleA` / `hero.titleHighlight` / `hero.titleB` — H1 keeps the three-part gold-highlight structure.
2. `hero.body` + `hero.bodyEmphasis`
3. `hero.ctaPrimary` (label only; same `useGetStarted` action)
4. `whyBuilt.p1` (the "decision made at 16" paragraph; must still flow into the unchanged `whyBuilt.p2`)
5. `whoFor.rightItems` order only: the mapped bullet moves to the front. No new bullet copy.
   Mapping: `good-at-it` → item 0, `ai-worried` → item 2, `life-changed` → item 2, `understand-myself` → item 3. `default` unchanged.

**Never flexes:** hero eyebrow, reassurance line, secondary CTA, all imagery, Pillars, HowItWorks, Methodology, CoachCards, ComparisonTable, CostMath, Pricing, ForkDivider, `whyBuilt.p2`, FAQ, FinalCTA, footer.

## 5. Architecture

- **`IntentContext`** (`src/contexts/IntentContext.tsx`): `{ intent, setIntent }`, persisted to localStorage, provided in `Index.tsx` around the landing sections only. Default value `'default'` so components outside the provider are unaffected.
- **`IntentChips.tsx`** (`src/components/landing/IntentChips.tsx`): chip row + "something else" input. Reads labels from i18n. Calls `setIntent` and fires the Supabase insert (fire-and-forget; a failed insert never blocks the UI).
- **Variant key resolution** (`src/components/landing/useIntentCopy.ts`): tiny hook wrapping `useTranslation('landing')`:
  `vt(key)` returns `t(key)` when intent is `default`, else `t('variants.<intentCamel>.' + key, { defaultValue: t(key) })`. Missing variant keys silently fall back to default copy, so partial variants can never break the page.
- **Touched components:** `Hero` (use `vt` for title/body/CTA + render `IntentChips`), `WhyWeBuiltThis` (use `vt` for `p1`), `WhoFor` (reorder `rightItems` by mapping). Components stay copy-free.
- **i18n:** new blocks in `public/locales/{en,nl}/landing.json`: `intentChips.*` and `variants.{goodAtIt,aiWorried,lifeChanged,understandMyself}.*`. No component-level strings.

## 6. Tracking (Supabase)

New migration in `supabase/migrations/` (applied individually via MCP, **not** `db push`, per migration-history policy):

```sql
create table public.intent_picks (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null check (intent_key in
    ('default','good-at-it','ai-worried','life-changed','understand-myself','other')),
  free_text text check (char_length(free_text) <= 500),
  locale text not null check (char_length(locale) <= 5),
  visitor_id uuid not null,
  source text not null default 'chip' check (source in ('chip','slug')),
  created_at timestamptz not null default now()
);

alter table public.intent_picks enable row level security;

create policy "anyone can log an intent pick"
  on public.intent_picks for insert
  to anon, authenticated
  with check (true);
-- No select/update/delete policies: the client can only write.
```

- Anonymous by design: no user id, no IP, no user agent.
- `source` distinguishes organic chip clicks from future ad-slug visits, so the "promote to default" decision uses clean chip data only (slug traffic measures ad spend, not preference).
- After applying: regenerate TypeScript types (`src/integrations/supabase/types.ts`).
- Reading the data: via Supabase dashboard/SQL for now; no in-app reporting.

## 7. Copy — EN

> Writing rule: no em-dashes anywhere in this copy (public-facing). CTA labels use `·` like the existing NL CTA.

### Chips UI

- Prompt: `What brings you here?`
- Chips: `I chose my path at 16` · `Good at my job, not sure it's me` · `Worried about AI and my role` · `Life changed, work didn't` · `Understanding myself and what I want` · `Something else…`
- Free-text placeholder: `Tell us in a few words what brings you here`
- Submit: `Send` — Thanks: `Thanks, that genuinely helps us make Cairnly better.`

### Variant: good-at-it

- H1: titleA `Being` · highlight `good at it` · titleB `was never the same as it being you.`
- body: `Competent and quietly unsure is not a contradiction, it's more common than you think. Cairnly is one assessment that looks at who you've become, not the role you grew into, and asks:`
- bodyEmphasis: `if you could choose again, knowing what you know now, would you choose this?`
- ctaPrimary: `Ask the real question · €39`
- whyBuilt.p1: `Some careers are grown into rather than chosen. You were good at something, so you got more of it. More responsibility, more of the same kind of work, a title that fits your skills but maybe not the person behind them. Competence is a quiet current: by the time you look up, you're the person everyone relies on, for work you're no longer sure you'd pick. That question deserves better than a gut feeling.`

### Variant: ai-worried

- H1: titleA `Half the takes on AI and your job are` · highlight `panic.` · titleB `The other half are denial.`
- body: `You don't need another opinion piece, you need a straight answer about your situation. Cairnly scores every career it suggests on how AI is set to reshape it, so the real question becomes:`
- bodyEmphasis: `which direction still has room for you in ten years, and do you actually want it?`
- ctaPrimary: `See where your role is heading · €39`
- whyBuilt.p1: `They're built on assumptions that stopped being safe. You picked a field, got good at it, and planned on it carrying you for decades. Then the ground started moving. Some roles will grow, some will shrink, most will change shape, and the honest answer for yours is buried under equal parts hype and doom. Sorting that out deserves better than a headline.`

### Variant: life-changed

- H1: titleA `What you` · highlight `need` · titleB `from work changed. The job never got the memo.`
- body: `Kids, burnout, a move, a loss, a restart: the ground shifts and the old fit stops fitting. Cairnly is one assessment that takes where you actually are now, not where you were at 25, and asks:`
- bodyEmphasis: `what would work look like if it fit the life you have today?`
- ctaPrimary: `Find what fits now · €39`
- whyBuilt.p1: `They're chosen once and then assumed to keep fitting forever. But lives don't hold still. Kids arrive, health interrupts, priorities shift, and what a job needs to give you at 40 is rarely what you asked of it at 25. Most people carry a career shaped around a life they no longer live, and the tools to re-ask the question honestly were never built for them.`

### Variant: understand-myself

- H1: titleA `You can't pick the right direction until you` · highlight `know` · titleB `who's choosing.`
- body: `Cairnly starts with a serious assessment of who you've become: your strengths, your history, what actually drives you. The career answers are built on that foundation, which is why the first question isn't about jobs at all:`
- bodyEmphasis: `who are you now, and what do you actually want from the next chapter?`
- ctaPrimary: `Start with you · €39`
- whyBuilt.p1: `They're chosen before the chooser is fully formed. You picked a direction before you knew your own strengths, your patterns, what gives you energy and what quietly drains it. Twenty years of living generates a lot of self-knowledge, but almost nobody sits down to turn it into an honest picture of who they've become. Without that picture, every career question is a guess.`

## 8. Copy — NL

### Chips UI

- Prompt: `Wat brengt je hier?`
- Chips: `Ik koos m'n richting op m'n zestiende` · `Goed in m'n werk, maar past het nog?` · `Bezorgd over AI en mijn rol` · `M'n leven veranderde, m'n werk niet` · `Mezelf en wat ik wil beter begrijpen` · `Iets anders…`
- Free-text placeholder: `Vertel in een paar woorden wat je hier brengt`
- Submit: `Versturen` — Thanks: `Dank je, dit helpt ons echt om Cairnly beter te maken.`

### Variant: good-at-it

- H1: titleA `Ergens` · highlight `goed in zijn` · titleB `is niet hetzelfde als ergens op je plek zijn.`
- body: `Competent zijn en stilletjes twijfelen is geen tegenstrijdigheid, het komt vaker voor dan je denkt. Cairnly is één enkel assessment dat kijkt naar wie je bent geworden, niet naar de rol waar je in bent gegroeid, en vraagt:`
- bodyEmphasis: `als je opnieuw kon kiezen, met alles wat je nu weet, zou je hier dan weer voor kiezen?`
- ctaPrimary: `Stel de echte vraag · €39`
- whyBuilt.p1: `Sommige carrières kies je niet, je groeit erin. Je was ergens goed in, dus kreeg je er meer van. Meer verantwoordelijkheid, meer van hetzelfde soort werk, een functietitel die past bij je vaardigheden maar misschien niet bij de persoon erachter. Competentie is een stille stroming: tegen de tijd dat je omhoog kijkt, ben je degene op wie iedereen rekent, voor werk waarvan je niet meer zeker weet of je het zelf nog zou kiezen. Die vraag verdient meer dan een onderbuikgevoel.`

### Variant: ai-worried

- H1: titleA `De helft van de verhalen over AI en jouw baan is` · highlight `paniek.` · titleB `De andere helft is ontkenning.`
- body: `Je hebt geen zoveelste opiniestuk nodig, maar een eerlijk antwoord voor jouw situatie. Cairnly beoordeelt elk voorgesteld carrièrepad op hoe AI het gaat veranderen, zodat de echte vraag wordt:`
- bodyEmphasis: `welke richting heeft over tien jaar nog ruimte voor jou, en wil je die eigenlijk wel?`
- ctaPrimary: `Zie waar je vak naartoe gaat · €39`
- whyBuilt.p1: `Ze zijn gebouwd op aannames die niet meer vanzelfsprekend zijn. Je koos een vakgebied, werd er goed in, en rekende erop dat het je decennia zou dragen. Toen begon de grond te schuiven. Sommige rollen groeien, sommige krimpen, de meeste veranderen van vorm, en het eerlijke antwoord voor jouw rol ligt begraven onder evenveel hype als doemdenken. Dat uitzoeken verdient meer dan een krantenkop.`

### Variant: life-changed

- H1: titleA `Wat jij` · highlight `nodig hebt` · titleB `van werk is veranderd. Je baan heeft de memo nooit gekregen.`
- body: `Kinderen, een burn-out, een verhuizing, een verlies, een nieuwe start: de grond verschuift en de oude match past niet meer. Cairnly is één enkel assessment dat uitgaat van waar je nu écht staat, niet van wie je op je 25e was, en vraagt:`
- bodyEmphasis: `hoe zou werk eruitzien als het paste bij het leven dat je nu hebt?`
- ctaPrimary: `Vind wat nu past · €39`
- whyBuilt.p1: `Ze worden één keer gekozen, en daarna wordt aangenomen dat ze voor altijd blijven passen. Maar een leven staat niet stil. Er komen kinderen, gezondheid grijpt in, prioriteiten verschuiven, en wat een baan je op je veertigste moet geven is zelden wat je er op je 25e van vroeg. De meeste mensen dragen een carrière die is gevormd rond een leven dat ze niet meer leiden, en de tools om die vraag opnieuw eerlijk te stellen bestonden niet voor ze.`

### Variant: understand-myself

- H1: titleA `Je kunt niet de juiste richting kiezen zonder te` · highlight `weten` · titleB `wie er kiest.`
- body: `Cairnly begint met een serieus assessment van wie je bent geworden: je sterke punten, je geschiedenis, wat je werkelijk drijft. De carrière-antwoorden bouwen op dat fundament, en daarom gaat de eerste vraag helemaal niet over banen:`
- bodyEmphasis: `wie ben je nu, en wat wil je eigenlijk van het volgende hoofdstuk?`
- ctaPrimary: `Begin bij jezelf · €39`
- whyBuilt.p1: `Ze worden gekozen voordat de kiezer zichzelf goed kent. Je koos een richting voordat je je eigen sterke punten kende, je patronen, wat je energie geeft en wat er stilletjes aan vreet. Twintig jaar leven levert enorm veel zelfkennis op, maar bijna niemand gaat zitten om daar een eerlijk beeld van te maken van wie je bent geworden. Zonder dat beeld is elke carrièrevraag een gok.`

## 9. Error handling

- Supabase insert failures are swallowed (console.warn only); personalization always works even if logging fails.
- Unknown/corrupt `cairnly_intent` in localStorage → treated as `default`.
- Missing variant i18n key → i18next `defaultValue` fallback to default copy. A partial translation can never blank a section.

## 10. Verification

Dev server + browser preview, both languages (EN default, NL via language switcher or `cairnly_language`):
1. Chip click swaps H1 (with correct gold highlight), body, emphasis, CTA label, `whyBuilt.p1`, and WhoFor bullet order. Nothing else on the page changes.
2. Default chip restores original copy; refresh keeps the chosen intent.
3. "Something else" submits, collapses to thanks, and a row lands in `intent_picks` (verified via SQL).
4. Each chip click inserts a row with correct `intent_key`, `locale`, `visitor_id`, `source='chip'`.
5. No console errors; mobile viewport (375px) chip row wraps cleanly.

## 11. Out of scope

Ad slugs and per-slug canonical/meta (future, reuses `variants.*` + `source='slug'`), rotating H1 (dropped), arrival modal (rejected), in-app analytics dashboard for picks, promoting a variant to default (future one-liner once data exists).
