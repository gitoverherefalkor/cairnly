---
description: Add a new language to Cairnly end-to-end, following LOCALIZATION_PLAYBOOK.md. Pass the language (e.g. "de" or "German").
argument-hint: <language code or name, e.g. "de" or "German">
---

You are adding a new language to the Cairnly multilingual system. The target language is: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user which language to add (code + flag) before doing anything.

## Your job

1. **Read `LOCALIZATION_PLAYBOOK.md` first** — it is the authoritative runbook. Do not assume you remember it; it gets updated. Also skim `scripts/i18n-glossary.json`.

2. **Resolve the language**: normalize the input to a BCP-47 code (e.g. "German"/"Duits" → `de`, "French"/"Frans" → `fr`), and note the native label + flag emoji for the switcher (e.g. `de` → "Deutsch" 🇩🇪).

3. **Confirm a short plan** in one message before executing: which code/label/flag, whether the glossary already has a `rules.<lang>` block (if not, you'll add one), and which surfaces will be covered vs not (UI shell + landing yes; emails / n8n AI output follow Phases 3-4). Wait for a "go".

4. **Execute the A-Z runbook** from the playbook, in order:
   - Ensure `scripts/i18n-glossary.json` has a `rules.<lang>` block (add one respecting the language's formality/number/date conventions + the no-em-dash rule). Optionally add a `preferred["en-><lang>"]` term map.
   - `npm run i18n:sync <lang>` to translate all 7 namespaces. Then **present a sample (~10 strings, especially landing) for the user to review.** ⛔ Gate here.
   - Register in `src/i18n.ts` (`supportedLngs`) and `src/components/LanguageSwitcher.tsx` (add the entry, start `disabled: true`).
   - Add the `<lang>` block to `supabase/functions/deliver-section/boilerplate.ts` (Language type, the per-section block, the BOILERPLATE map, DREAM_JOBS_WRAP_UP_BY_LANG, and the getters). ⛔ Show the user the translated boilerplate for review before deploying.
   - Confirm `src/lib/format.ts`, `src/lib/pricing.ts`, and edge-function `LANG_NAMES` maps cover the language; add lines if missing.
   - (Optional polish) extend `aiResumeParser.ts` with the language's CV date/section conventions.

5. **Build + commit discipline (critical — see playbook P1):**
   - `npm run build` must pass.
   - Run `git status --porcelain | grep '^??'` and **`git add` every new file**, especially any new component. A green local build does NOT prove the repo is complete.
   - Commit with a descriptive message, push.

6. **Deploy the edge function** if boilerplate changed: `supabase functions deploy deliver-section --project-ref pcoyafgsirrznhmdaiji`. (Per CLAUDE.md, re-deploying an existing function needs approval — ⛔ ask first, listing what you're deploying.)

7. **VERIFY — mandatory, do not skip (playbook Section 6 + P6):**
   - After push, run `vercel ls` and confirm the newest Production deploy is `● Ready`, not `● Error`. Wait for it.
   - Load the site (`npm run dev` + Preview MCP, or the live URL), switch to the new language, and confirm: page renders (no error boundary), console has **zero** errors (watch for `*.map is not a function`), dates/currency use the locale format, switcher appears in landing + app nav.
   - Walk the surfaces: landing (hero → pillars → how-it-works → methodology → comparison → pricing → who-for → FAQ), signup, dashboard, profile, chat boilerplate.

8. **Go-live gate**: only after verification passes, flip the language's `disabled: false` in `LanguageSwitcher.tsx`, commit, push, and re-verify the deploy is Ready. Treat the flip as an explicit ⛔ gate — confirm with the user.

## Hard rules (from the playbook)
- **Every translation array must be read via `tArray(t, key)`** (src/lib/i18nArray.ts). Never `t(..., {returnObjects:true}).map`. (Pitfall P2.)
- **No em-dashes (—)** in any public copy, any language. Audit with `grep -nE "—" public/locales/<lang>/*.json`. (P4.)
- **Never hardcode** `'en-US'` or `€39.00` — use `src/lib/format.ts`. (P5.)
- **A push is not a deploy.** Always confirm with `vercel ls`. (P6.)
- Don't translate n8n LLM prompts; the output-language instruction is appended via injector nodes (Phase 4, separate work).

## Report at the end
Summarize: what's now in the new language, what's still English (emails, n8n AI output, survey questions, Profile body — per playbook Section 7), the deploy status, and whether the language is live (`disabled:false`) or staged for review.

Begin by reading `LOCALIZATION_PLAYBOOK.md`.
