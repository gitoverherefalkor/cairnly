# Cairnly Localization Playbook

**Purpose.** This is the authoritative, AI-executable runbook for the multilingual system. With this file plus the repo, an agent can add a new language end-to-end from a single instruction like *"maak nu de Duitse variant"*. It also explains, for humans, what is shared across languages and what is not.

Companion files:
- `LOCALIZATION_PLAN.md` — the original phased rollout history (Phases 0-5).
- `scripts/i18n-glossary.json` — brand terms + per-language style rules (the most leveraged asset).
- `cairnly-homepage-copy.md` (EN) / `cairnly-homepage-copy-nl.md` (NL) — canonical landing copy.

---

## 1. Mental model: what's shared vs per-language

**The single most important thing to understand.**

There is **one** set of React components. Every language renders through the exact same components. Only the *words* differ, and the words live in separate JSON files (`public/locales/<lang>/*.json`) plus a few hand-written text files.

| You change… | Applies to other languages? | What you do |
|---|---|---|
| **Layout / design / CSS / spacing / colors** | ✅ Automatically | Nothing. It's one component. |
| **Flow / routing / behavior / logic** (e.g. "send users to X after Y") | ✅ Automatically | Nothing. |
| **A component's icon, image, animation** | ✅ Automatically | Nothing (unless the image contains baked-in text). |
| **Wording of existing text** (reword an English sentence) | ❌ No — other langs keep the old translation | Tell the agent "and update the translations" so it re-syncs that key. |
| **Add a new text slot** (new heading, bullet, button, section) | ❌ No — the new key only exists in English | Add the English key, then `npm run i18n:sync <lang>` auto-translates the missing key into every language. |
| **A brand-new component with text** | ❌ No | Add EN keys, run sync per language, **and `git add` the new component file**. |

**So the answer to "do I need to say 'also do it for the other language'?"**
- For how it **looks or behaves**: no, it's automatic.
- For **what it says**: the words themselves need translating. The easiest path is: change/add the English, then run `npm run i18n:sync nl de` which auto-fills anything missing. For *reworded* existing English, say so explicitly ("update the translations too") because the sync only fills *missing* keys, it doesn't detect that an English string changed meaning.

---

## 2. How the system works (architecture map)

| File / area | Responsibility |
|---|---|
| `src/i18n.ts` | i18next init. `supportedLngs` whitelist, namespace list, `.nl`/`.de` domain detection, localStorage key `cairnly_language`, `react: { useSuspense: false }`, HttpBackend loads `/locales/{{lng}}/{{ns}}.json`. |
| `public/locales/<lang>/*.json` | All UI strings. 7 namespaces: `common, auth, landing, survey, chat, report, dashboard`. **English is the source of truth.** |
| `src/components/LanguageSwitcher.tsx` | The `languages` array (code/label/flag/`disabled`). One array → rendered in both `LandingNav` and `Navbar`. Auto-hides on `/chat`. |
| `src/components/landing/LandingNav.tsx` | Landing-page nav. Mounts `<LanguageSwitcher>` (desktop + mobile). |
| `src/components/Navbar.tsx` | App nav. Also mounts `<LanguageSwitcher>`. |
| `src/hooks/useLanguage.ts` | Syncs `profiles.preferred_language` ⇄ i18next on login. |
| `src/lib/format.ts` | `formatDate` / `formatCurrency` / `formatNumber` via `Intl`. Maps `nl→nl-NL`, `de→de-DE`, else `en-US`. Never hardcode locale strings. |
| `src/lib/pricing.ts` | Price source of truth by currency. `nl`/`de` → EUR, else USD. |
| `src/lib/i18nArray.ts` | **`tArray(t, key)`** — safe reader for `returnObjects: true` arrays. Mandatory for any translation array (see Pitfall P2). |
| `scripts/i18n-sync.ts` | `npm run i18n:sync <lang> [--dry-run]`. Reads `en/*.json`, finds missing keys in target, translates via Claude using the glossary, writes target files. Preserves arrays. Needs `ANTHROPIC_API_KEY` in `.env`. |
| `scripts/i18n-glossary.json` | Do-not-translate brand terms + per-language rules (je-form, no em-dashes, currency format, etc.). |
| `supabase/functions/deliver-section/boilerplate.ts` | Chat section intros/outros, **per language**, hand-written. `getBoilerplate(lang)` / `getDreamJobsWrapUp(lang)`. |
| AI edge functions | `forward-to-n8n`, `forward-resume-to-n8n`, `chat-proxy`, `deliver-section`, `wrap-up-extract`, `generate-share-quotes`, `generate-cover-letter`, `generate-custom-resume` all read `profiles.preferred_language` and pass it downstream. `wrap-up-extract` + `generate-share-quotes` append a "write output in <lang>" instruction via a `LANG_NAMES` map. |
| `src/components/resume/utils/aiResumeParser.ts` | Client-side resume-parse prompt. Has Dutch CV conventions; extend per language as needed. |

**The golden rule:** English is canonical. One change → propagate to all languages via the sync script (AI-assisted), never by hand-editing every file.

---

## 3. What's already wired for ANY new language

These already handle arbitrary language codes — no work needed when adding a language:
- ✅ `src/lib/format.ts` — `de→de-DE` already mapped (add a line for other locales).
- ✅ `src/lib/pricing.ts` — `de→eur` already mapped.
- ✅ `src/i18n.ts` domain detection — `.de` → `de` already handled.
- ✅ Edge function `LANG_NAMES` maps — already include `de: 'German (Deutsch)'`.
- ✅ `scripts/i18n-glossary.json` — has a `de` rules block.
- ✅ `scripts/i18n-sync.ts` — language-agnostic; reads glossary `rules.<lang>`.
- ✅ `LanguageSwitcher` — one array drives both navs.

German specifically is ~70% pre-wired. Other languages need their own `format.ts` locale line, glossary `rules.<lang>` block, and edge-function `LANG_NAMES` entry (all trivial).

---

## 4. A-Z runbook: add a new language

Example: German (`de`). Substitute the code for other languages.

### Step 0 — Prereqs
- `ANTHROPIC_API_KEY` present in `.env` (the sync script needs it; it loads dotenv with `override: true` so an empty shell var won't shadow it).
- Confirm `scripts/i18n-glossary.json` has a `rules.<lang>` block. For `de` it exists. For a new code, add one (je/Sie-form, number format, date format, "no em-dashes", etc.). Optionally add a `preferred["en-><lang>"]` term map.

### Step 1 — UI strings (all 7 namespaces, incl. landing)
```bash
npm run i18n:sync de            # translates every missing key en → de
```
This creates `public/locales/de/*.json` with arrays preserved. **Human-review the output**, especially `landing.json` (marketing voice) and `common.json` (CTAs). Spot-check ~10 strings.

> If you have a human translation of the landing copy (like `cairnly-homepage-copy-nl.md` for NL), prefer pasting that into `de/landing.json` over the machine output, then keep the file as `cairnly-homepage-copy-de.md`.

### Step 2 — Register the language in the UI
- `src/i18n.ts`: add `'de'` to `supportedLngs`.
- `src/components/LanguageSwitcher.tsx`: add `{ code: 'de', label: 'Deutsch', flag: '🇩🇪', disabled: true }`. Keep `disabled: true` until review + verification passes, then flip to `false` (that's the go-live moment — treat it as a gate).

### Step 3 — Chat boilerplate (`supabase/functions/deliver-section/boilerplate.ts`)
- Add `'de'` to the `Language` union type.
- Add a `const DE: Record<SectionType, Boilerplate>` block (10 sections, intro/outro). Translate from `EN`, respecting glossary rules. Keep `intro: null` placements identical to EN/NL.
- Add `de: DE` to `BOILERPLATE`.
- Add a `de` entry to `DREAM_JOBS_WRAP_UP_BY_LANG`.
- Update `getBoilerplate` and `getDreamJobsWrapUp` to return the `de` block when `language === 'de'`.
- Redeploy: `supabase functions deploy deliver-section --project-ref pcoyafgsirrznhmdaiji`.

### Step 4 — Formatting & pricing (usually already done)
- `src/lib/format.ts`: confirm a `lang.startsWith("de")` → `de-DE` line exists (it does). Add one if introducing a brand-new code.
- `src/lib/pricing.ts`: confirm currency mapping covers the language.

### Step 5 — AI edge functions
- Confirm `LANG_NAMES` in `wrap-up-extract` and `generate-share-quotes` includes the language (de is present). Add it if missing.
- If any **new** AI-output edge function was added since this playbook, give it the same `preferred_language` lookup + output-language instruction.
- Make that output-language instruction a **forceful, expression-resolved lock at the top of the prompt**, not a buried "if nl … else …" conditional — LLMs code-switch to the wrong language on strong name/employer cues otherwise. This applies to the **n8n workflow prompts (WF1–WFX)** too, which this playbook doesn't otherwise cover. See Pitfall **P9**.
- (Optional, polish) `aiResumeParser.ts`: add the language's CV date conventions (German: `dd.mm.yyyy`, "Heute" = Present, "Berufserfahrung"/"Ausbildung" headers).

### Step 6 — Build, commit, push
```bash
npm run build                   # must succeed
git status --porcelain | grep '^??'   # CHECK for untracked files under src/ — see Pitfall P1
git add <every new/changed file, including any new component>
git commit -m "Add German (de) localization"
git push
```

### Step 7 — VERIFY (mandatory — see Section 6)
Do not consider it done until the Vercel deploy is **Ready** AND the live page renders in the new language with a clean console.

### Step 8 — Go live
Once verified, flip `disabled: false` for the language in `LanguageSwitcher.tsx`, commit, push, re-verify.

---

## 5. Pitfalls & learnings (the war stories)

These are real failures we hit. Each cost real debugging time. Don't repeat them.

### P1 — Untracked component files silently break the production build
`Methodology.tsx` imported `./WorkflowDiagramV2`, but `WorkflowDiagramV2.tsx` was never `git add`-ed. macOS (case-insensitive, file on disk) built fine; `npm run build` passed locally. Vercel (Linux) failed: `Could not resolve "./WorkflowDiagramV2"`. **The production build was broken for ~21 hours while every local build passed.**
- **Always** run `git status --porcelain | grep '^??'` and `git add` new components before pushing.
- A green local `vite build` does **not** prove the repo is complete — it only proves your *disk* is complete.

### P2 — `t(key, {returnObjects:true}).map()` crashes the whole page on first render
i18n runs with `react: { useSuspense: false }` and loads namespaces async. On the first render, before the namespace JSON arrives, `t('faq.items', {returnObjects:true})` returns the **key string**, not the array. `.map()` on a string → `TypeError: X.map is not a function` → the error boundary takes down the entire route (white screen, both languages).
- **Always** read translation arrays via `tArray(t, 'some.key')` from `src/lib/i18nArray.ts`. It returns `[]` during the pre-load window and the real array once loaded (react-i18next re-renders on load).
- Never write `t(..., { returnObjects: true }) as X[]` followed by `.map`.

### P3 — The sync script used to turn arrays into objects
`flatten`/`unflatten` round-tripping arrays produced `{"0":..,"1":..}` instead of `[..]`. Combined with `tArray`, that renders an **empty** section (no crash, just missing content). Fixed: `unflatten` now `arrayify`s objects whose keys are exactly `0..n-1`. If you hand-edit a locale JSON, keep arrays as arrays.

### P4 — Em-dashes in public copy
Project rule (global CLAUDE.md): never use em-dashes (—) in public/external copy, in **any** language. Use commas, periods, colons, parentheses, or a middle dot (·). The glossary encodes this. Audit before go-live:
```bash
grep -nE "—" public/locales/<lang>/*.json supabase/functions/deliver-section/boilerplate.ts
```

### P5 — Hardcoded locale formatting
Never hardcode `'en-US'`, `€39.00`, or `1,500`. Use `formatDate`/`formatCurrency`/`formatNumber` from `src/lib/format.ts`. Dutch/German want `€39,00` and `1.500`.

### P6 — "It built and pushed" ≠ "it's live"
Multiple commits landed on `main`, each local build passed, each push succeeded — but production never updated because every deploy errored (see P1). **Treat a push as a request, not a result.** Always confirm with `vercel ls`.

### P7 — `ANTHROPIC_API_KEY` shadowing
A shell may export `ANTHROPIC_API_KEY=` (empty), which shadows the `.env` value. The sync script loads dotenv with `{ override: true }` to win over the empty shell var. If sync says "API key missing" despite `.env` having it, this is why.

### P8 — The switcher must actually be mounted where users look
Dutch went "live" but no flag appeared, because the switcher was only in `Navbar.tsx` and the homepage uses `LandingNav.tsx`. When adding language UI, confirm the switcher renders on the surfaces users actually start from (landing + app).

### P9 — LLM prompts code-switch to the wrong language on strong name/context cues
A buried conditional ("if `preferred_language` is 'nl' … else English") is **not** enough to force the output language. On 2026-07-06, WF1's personality prompt (`prompt_perso_prof1`) correctly rendered `preferred_language = en`, yet the model wrote the entire personality narrative in **Dutch** for a candidate named "Sjoerd Prins" with Dutch employers — reliably (two separate runs; verified the prompt saw `en`). English-named users on the *same* prompt stayed English. The Dutch header-translations and instructions living inline in the prompt gave the model something to latch onto, and a strongly Dutch-cued candidate tipped it over. Careers (WF3/WF4) were fine because they enforce language robustly; the personality narrative was the weak link.
- **Fix pattern:** put an **absolute, expression-resolved output-language lock at the very TOP** of every LLM prompt, before any other content:
  `Write EVERY word — every heading and every sentence — in {{ preferred_language === 'nl' ? 'DUTCH' : 'ENGLISH' }}. The candidate's name, nationality, or employers must NEVER change your output language.`
  A resolved token ("ENGLISH"/"DUTCH") up front beats a conditional the model must evaluate against buried inline examples.
- **This covers the n8n workflow prompts (WF1–WFX) too**, which this playbook otherwise doesn't touch. When adding a language, audit **every** LLM prompt (n8n + AI edge functions) for this top-of-prompt lock; ideally inject *only* the target language's examples so there's nothing cross-language to bleed from.
- **Test for it:** generate a report for a user whose NAME/employers strongly imply language X but whose `preferred_language` is Y. If any section comes out in X, the lock is missing or too weak.

---

## 6. Verification protocol (mandatory)

Run **all** of these before calling a language done. This protocol exists because of P1/P6.

1. **Build**: `npm run build` exits 0.
2. **No untracked source**: `git status --porcelain | grep '^??'` shows nothing under `src/` that's imported.
3. **Deploy is green**: after push, `vercel ls` shows the newest Production deploy as `● Ready`, not `● Error`. Wait for it.
4. **Live render check**: load the site (or `npm run dev` + Preview MCP), switch to the new language, and:
   - The page renders fully (not the error boundary / white screen).
   - Browser console has **zero** errors (`preview_console_logs level=error`). Watch specifically for `*.map is not a function` (P2) and missing-key warnings.
   - Walk the surfaces: landing (hero, pillars, how-it-works, methodology, comparison table, pricing, who-for, FAQ), signup, dashboard, profile, chat boilerplate.
   - Dates show the locale format; prices use the locale's decimal separator.
5. **Em-dash sweep** (P4): grep returns nothing.
6. **Switcher present** (P8): the flag/globe appears in the landing nav and app nav; switching persists across reloads (localStorage `cairnly_language`).

---

## 7. Known surfaces NOT yet localized (set expectations)

As of this writing, these are English-only regardless of selected language. Adding a language does **not** automatically cover them; they're tracked in `LOCALIZATION_PLAN.md` Phases 3-4:
- **Emails** (confirmation, reminder, payment, journal) — still English (Phase 3).
- **Survey question content** in the DB (`questions`, `survey_sections`) — JSONB `translations` column exists but isn't populated/read yet (Phase 3).
- **n8n-generated report + chat content** — the pipeline passes `preferred_language` (Phase 2 done), but the workflows don't yet inject the output-language instruction (Phase 4, needs per-node approval). So AI report/chat text returns in English until Phase 4.
- **`Profile.tsx` body** (~40 strings) — descoped, hardcoded English.
- **`WorkflowDiagramV2.tsx`** SVG labels — short technical strings, hardcoded.

When you add a language, mention these so expectations are set: "UI shell + landing are <lang>; AI-generated content and emails follow once Phases 3-4 ship."

---

## 8. One-line summary for the agent

> To add a language `<x>`: ensure glossary `rules.<x>` exists → `npm run i18n:sync <x>` → review → add `<x>` to `supportedLngs` (i18n.ts) and to the `languages` array (LanguageSwitcher.tsx, start `disabled:true`) → add the `<x>` boilerplate block in `deliver-section/boilerplate.ts` and redeploy that function → confirm `format.ts`/`pricing.ts`/`LANG_NAMES` cover `<x>` → `npm run build` → **`git add` new files** → push → **confirm `vercel ls` is Ready** → load the page, switch to `<x>`, console clean → flip `disabled:false` → push → re-verify. Pitfalls: tArray for all translation arrays (P2), commit new components (P1), no em-dashes (P4), Intl formatting (P5), a push is not a deploy (P6).
