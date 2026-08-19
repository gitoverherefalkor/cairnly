# Handoff: localize the candidate path (dashboard → survey → report)

**Status:** not started. Inventory complete, nothing wired yet.
**Written:** 2026-08-18. **Owner after handoff:** a fresh session.
**Companion file:** `localization-candidate-path-strings.json` (all 404 rows, with proposed keys and Dutch).

---

## Why this exists

Dutch is live and the Dutch survey *questions* render correctly, because question text comes
from the database (`questions.translations`) and `useSurvey` reads `i18n.language`.

But the entire frame around those questions was never localized. Twelve files on the
post-signup path contain **zero `useTranslation`**. A Dutch candidate arriving through a
partner link therefore sees Dutch questions inside an English shell: "Welcome, Sjoerd.
Let's start.", "NEXT STEP · 25 MINUTES", "Start Assessment".

This is not a regression and nothing was broken by an earlier fix. `git log -S "useTranslation"`
on these files returns **zero commits, ever**. The hook was never added.

This blocks the partner track: Dutch outplacement agencies hand this link to their candidates
in week 38 (14–18 September 2026).

## What is already done (do not redo)

Commit `7d75839` localized the **signup page only** and added the `?lang=` querystring detector.
That work is finished and verified in both languages. It deliberately touched nothing else.

Commit `d040a94` fixed `profiles.preferred_language`, which was `'en'` for all 36 production
profiles. That value is not cosmetic: WF9 writes the résumé body in it, and `save-chat-response`
and `wrap-up-extract` read it. New signups now carry the right language.

## Scope

Twelve files, **356 unique strings / 404 occurrences**. Median length 22 characters — mostly
buttons and headings, not prose. A further **89 strings are deliberately excluded** and listed
per group in the JSON under `excluded_do_not_translate`; most are submitted answer values.

| Slice | Files | Strings |
|---|---|---:|
| 1. Dashboard entry + code screens | `DashboardEntryState`, `AccessCodeModal`, `AccessCodeVerifier`, `DashboardAppNav`, `pages/Dashboard` | 140 |
| 2. Survey shell | `AssessmentWelcome`, `SurveyForm`, `SectionIntroduction`, `pages/Assessment` | 82 |
| 3. Question renderer | `QuestionRenderer` | 155 |
| 4. Report processing | `pages/ReportProcessing` | 27 |

Commit each slice separately, building and testing between them, so main never holds a
half-translated screen.

**`src/components/assessment/AssessmentLayout.tsx` is clean.** It renders only `{children}`.
Do not add `useTranslation` to it. If a later scan reports it as missing i18n, that is a false
positive.

## Traps

These were found by a 16-agent read-only audit. Each one silently breaks something.

**1. The `dashboard` namespace is entirely dead.** Nothing in `src/` calls
`useTranslation('dashboard')`. Both `en/dashboard.json` and `nl/dashboard.json` exist and are
registered in `src/i18n.ts`, but no component consumes them. Every key already in there is
unverified. Treat text matches as candidates, not as proven copy.

**2. Key collision in `dashboard.json`.** It has a **top-level string** `"welcome": "Welcome,
{{name}}!"`. Adding a nested `welcome.*` object collides with it and one of the two silently
loses. Put the entry-state keys under `entry.*` instead.

**3. Hook placement in `pages/Dashboard.tsx`.** There are early returns at lines ~499 (loading)
and ~517 (completed report). `useTranslation` must be declared at the top with the other hooks,
near `const { toast } = useToast()`. Declaring it lower changes the hook count between branches
and breaks React. The file already carries a comment about this for `pdfLoading`.

**4. Database-driven copy in `QuestionRenderer.tsx` must NOT be wrapped in `t()`.** These already
arrive in the user's language: `question.label`, `question.config.description`,
`question.config.non_negotiable_rider`, `question.choiceLabels`, `question.langLabels`. Exact
line numbers are in the JSON notes. Wrapping them double-translates or breaks the lookup.

**5. Same for `SectionIntroduction.tsx`.** `sectionTitle`, `description` and `justCompletedTitle`
are props sourced from `survey_sections` rows and already Dutch. Only the surrounding frame is
in scope. Watch line ~92: the ternary `justCompletedTitle ? 'Up next' : \`Section ${n}\`` has a
template literal in the second branch, so a quote-based grep will not find it.

**6. `ReportProcessing.tsx` has a structural problem.** `STEPS` is a module-level const, so
`useTranslation` cannot be called there. Either move the array inside the component or keep it
at module level with a stable `id` plus a `labelKey`. Either way, fix `key={step.label}` at
line ~211: once labels are translated, the React key changes on a language switch and every row
remounts, re-firing the fade-in animation. Key on a stable id instead.

**7. Stale keys that must not be reused.** `en/survey.json` and `nl/survey.json` carry an unwired
`welcome.{title,accessCodeLabel,verify,needCode}` block from April 2026, written for a screen
whose copy has since changed. `welcome.accessCodeLabel` is an exact text match for the current
label, which makes reuse tempting and wrong. Delete the block in the same commit as slice 2.

**8. `SurveyForm.tsx` needs a manual pass.** The first extractor found 23 strings there; the
auditor found 19 more. That is a 45% miss rate on one file. Do not trust its inventory rows
without re-reading the file yourself. Seven of its keys DO have exact matches with existing
Dutch in `survey.json` (`loading.progress`, `errors.noQuestions`, `submitted.title`,
`submitted.continueToDashboard`, `failed.title`, `failed.retrying`, `failed.retry`) — reuse
those verbatim rather than re-translating.

## Decisions that must not be undone

Four deliberate choices are documented in commit messages. A naive fix reverts them.

1. **`navigator` is deliberately absent** from the i18n detection order (commit `2d477c4`).
   A Dutch-locale browser was forcing Dutch on expats who want English. Never reintroduce
   browser-language sniffing.
2. **`querystring` is first** in the detection order on purpose (commit `7d75839`), so a partner
   link's `?lang=` beats a stored choice.
3. **Survey content is display-only translated.** Submitted answer *values* stay English so the
   n8n payload is byte-identical (commits `89b2814`, `f283cf0`). Localizing a value breaks WF1
   and the `profiles.region` write.
4. **The language switcher hides on `/chat`** to avoid a half-translated transcript, and the
   per-language `disabled` kill switch in `LanguageSwitcher` is retained on purpose.

## Dutch copy rules

- **Never use em-dashes.** Commas, periods, colons, parentheses or sentence breaks instead.
- Casual `je`-form, never `u`. Warm and direct, no hype, no exclamation marks.
- Never the contrast structure "het is niet X, het is Y" or any variant.
- Match the voice already in `public/locales/nl/*.json`.

The Dutch in the JSON was drafted by the extraction agents and audited for these rules, but it
has **not** been reviewed by a human. Read it before shipping; it is a strong first draft, not
final copy.

## How to verify

1. `npm run build` and `npx vitest run` after each slice.
2. Start the dev server and load the flow in both languages:
   - `http://localhost:8080/auth?flow=signup&code=<code>&lang=nl`
   - the same with `&lang=en`
3. In the browser console, confirm no raw keys leak: `document.body.innerText` should contain
   no `entry.` / `survey.` / `{{` fragments.
4. Switch language with the switcher mid-flow and confirm nothing remounts or blanks.

## Known gaps left open on purpose

- The **cookie consent banner** is still English on every page. It is legal copy and needs the
  owner's Dutch wording before translation.
- The sibling auth pages (**forgot password, reset password, email confirmation**) still have
  hardcoded English eyebrows and titles. Same pattern as the signup page was, outside the
  candidate's main path.
- `LOCALIZATION_PLAN.md:33` wrongly claims `Dashboard.tsx` is partly translated. It contains no
  `useTranslation` at all. Correct that line while you are in there; the wrong claim is probably
  why this surface was never noticed.
- `LOCALIZATION_PLAYBOOK.md` line ~38 says "7 namespaces"; `src/i18n.ts` registers 12.
- **Starter and Encore surveys have zero Dutch translations** in the database (0 of 40 and 0 of
  41 questions). Only the Knowledge Worker survey (`…0001`, 61 of 61) is translated. Localizing
  the frame will not make those two products Dutch.
