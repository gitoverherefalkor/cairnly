# Handoff: the job search in the public demo (phase 4)

**Written 2026-09-03 after a brainstorm with Sjoerd. Self-contained: execute
from here. Read `docs/handoff/demo-replay-plan.md` first for the demo's
locked decisions, its fixture mechanism and the traps; this document only
adds to it.**

## What Sjoerd decided (do not relitigate)

1. **Jobs only.** The job search is the one toolkit tool the demo showcases.
   Résumé tailor and cover letters stay switched off (the existing
   `DemoToolDialog` explains them). Revisit after the jobs demo has earned it.
2. **Both personas.** One real search run for Emma (Service Designer, London)
   and one for Marcel (his top career, Netherlands). Frozen results, not a live
   search.
3. **Opens on results.** The demo lands on the results list for the persona's
   top career; the saved-jobs kanban is one tab away with two or three cards.
4. **English listings are fine**, also for Dutch visitors of Emma's demo. The
   listings come back in the language of the search and are not translated.
5. **Separate page**: `/demo/jobs`, linked from the demo dashboard. Same
   `?p=` partner audience handling, same honest label, same trust bar.
6. **Nudge.** On the demo dashboard the Jobs tile shows as unlocked (the only
   unlocked tool), with a one-line explainer banner above the toolkit and the
   same teal pulse the voice Settings button uses, so visitors open it.
7. **Honest label covers the fiction.** The toolkit ladder then shows one
   referral earned. The invite dialog should say the toolkit state is a demo
   state.
8. **Real components, frozen real output.** Same rule as phases 1 to 3: the
   Jobs screens render the real `JobsResults` / `JobsSavedKanban` from a
   fixture. No screenshots, no mock listings, no live calls.

## Open question for whoever builds this: persona selection

Today `chooseFixture(i18n.language)` in `src/demo/loadFixture.ts` picks the
persona by site language (nl → Marcel, else Emma). Sjoerd is building homepage
entry points where a visitor picks the persona they relate to, in either
language, so persona and language must decouple: a `?persona=emma|marcel`
parameter on `/demo`, `/demo/dashboard` and `/demo/jobs` that overrides the
language pick, with the existing `fallback.otherLanguage` note when the
session's language differs from the visitor's.

**Another session may already have built this.** Before touching it, check
`git log -- src/demo/loadFixture.ts src/pages/Demo.tsx` and grep for
`persona` in `src/pages/Demo*.tsx`. If it exists, `/demo/jobs` must honour the
same parameter and every link between the three demo pages must carry it
along (the dashboard link in `DemoFooter`, "Back to the conversation" on the
dashboard, the new jobs links). If it does not exist yet, build it first: it
is a small change and every homepage link depends on it.

## How the Jobs page works today (what the demo reuses)

Mapped 2026-09-03; verify line numbers, they drift.

- **Route and page:** `/jobs` → `src/pages/Jobs.tsx` (about 700 lines). It is
  the ONLY stateful component; everything under `src/components/jobs/v2/` is
  presentational and takes 100% of its data as props: `JobsSearch`,
  `JobsResults`, `JobsSavedKanban`, `JobsLocked`, atoms in `jobsV2Shared.tsx`.
  `grep supabase src/components/jobs` returns nothing.
- **Views:** `'search' | 'results' | 'saved'`, chosen from `?mode=` and a
  sessionStorage snapshot (`cairnly_jobs_search_v1`). The demo does not need
  the search form at all; it can still show it read-only if wanted.
- **Search:** `useJobSearch().searchJobs()` → edge function `search-jobs`
  (10/min/IP, 24h `job_search_cache`) → n8n WF8 `Bx0uNW4gnnXIGO8j`
  (Apify LinkedIn scrape → Gemini title translation → Claude scoring).
  Payload: `career_title, country_codes, work_arrangement, job_commitment,
  location, alternate_titles, career_overview, user_languages,
  avoid_preferences, report_id`. Response: `{ jobs: JobListing[],
  total_count, cached }`. Shapes in `src/hooks/useJobSearch.ts` (`JobListing`
  lines 6-25, `JobSearchResult` lines 27-35).
- **Results are NOT stored in a table.** They live in component state and the
  sessionStorage snapshot. So the demo fixture must carry the
  `JobSearchResult[]` itself; there is nothing to export from the database
  for results. The 24h `job_search_cache` row is the only server copy, and it
  expires.
- **Saved jobs:** table `saved_jobs` (`status` in saved / applied /
  interviewing / archived, plus `note`, `from_career`, `match_score`,
  `applied_at`). Hook `useSavedJobs` (react-query on `user_id`). Kanban
  columns are defined in `JobsSavedKanban.tsx`. Cover-letter linkage via
  `cover_letters.job_external_id`, résumé counts via `custom_resumes`; both
  arrive as props (`coverLetterByJobKey`, `resumesByCareerKey`).
- **Gating:** `useReferralStatus()` → `features.find(f => f.key === 'jobs')`;
  locked → `JobsLocked`. Résumé and cover-letter buttons on result cards use
  `LockedActionButton` → `handleInvite`.
- **Nav:** every Jobs screen wraps `LakeBackground` + `DashboardAppNav`
  (profile, sign out). The demo brings its own nav, as `DemoDashboard` does.
- **No i18n** in the jobs tree: all copy is hardcoded English. A Dutch demo
  visitor sees English chrome on this page. Acceptable for now (decision 4);
  note it in the intro card.

### Calls the demo must never make

| Call | Where | Why |
|---|---|---|
| `search-jobs` | `useJobSearch.ts` | Apify + Gemini + Claude per career |
| `generate-cover-letter` | `useGenerateCoverLetter.ts` | LLM, writes a `cover_letters` row; drags in Realtime + polling from `useCoverLetter` |
| `generate-custom-resume`, `resume-strengthen` | résumé hooks via `ResumeViewerModal` | LLM |
| `ensure-referral-code` | `useReferralStatus.ts` | mints a DB row |
| `saved_jobs` insert / delete / update | `useSavedJobs.ts` | writes |
| apply links | `JobsResults.tsx`, `JobsSavedKanban.tsx` | free, but they leave to LinkedIn: keep them, `rel="nofollow noopener"`, and count them as a CTA click |

## The build

### 1. Run the two searches once, for real

Use the existing scripts pattern (service role, demo-guarded, `.env.local`).
New script `scripts/demo-run-job-search.mjs <email> --career=<section_type>`:

- signs in as the persona (like `demo-chat-step.mjs`), calls
  `functions/v1/search-jobs` with the same payload `useJobSearch` builds
  (career title + alternate titles + overview from `report_sections`,
  country from the profile: GB for Emma, NL for Marcel; `work_arrangement`
  hybrid, `job_commitment` full-time, languages and avoid-preferences from
  `reports.payload` exactly as `Jobs.tsx` derives them);
- writes the response into the persona's fixture under a new key
  `jobs: { careerTitle, sectionType, jobs, totalCount, cached, status: 'done' }[]`
  (the `JobSearchResult` shape), one entry per career searched;
- the demo shows ONE career per persona (decision 2). Searching all three
  top careers costs three runs; do not, unless Sjoerd asks.

Cost: one WF8 run per persona (Apify scrape + two LLM calls). Rate limit is
10/min/IP; irrelevant for two calls. Results are cached 24h server-side, so a
re-run within a day is free and identical.

Then pick two or three listings per persona to mark as saved: insert them into
`saved_jobs` for the demo user through the real `save-heart` flow
(`useSavedJobs.saveJob` shape: `status: 'saved'`, `from_career`,
`match_score`) or directly with the service role, and give one of them
`status: 'applied'` so the kanban shows two columns in use. Export them into
the fixture as `savedJobs: SavedJob[]` (extend `demo-export-fixture.mjs`:
`saved_jobs` rows for the user, like `savedResponses`).

Do NOT run WF8 for a persona whose fixture already has `jobs`; the
walkthroughs are frozen and a second run would produce different listings
than the ones the annotations may refer to.

### 2. Fixture and types

- `src/demo/types.ts`: add `jobs?: DemoJobSearchResult[]` and
  `savedJobs?: DemoSavedJob[]` to `DemoFixture` (shapes copied from
  `useJobSearch.ts` and `useSavedJobs.ts`; keep them structurally identical
  so the components accept them without adapters).
- `demo-export-fixture.mjs`: keep whatever `jobs` the fixture already holds
  when re-exporting (results are not in the database; a re-export after a new
  chat walkthrough must not drop them). Read the existing file first and
  carry `jobs` over.
- Tests (`src/demo/loadFixture.test.ts`): both fixtures carry `jobs` with
  at least one result set of status `done` and at least five listings, and
  `savedJobs` with two or more rows whose `external_job_id` exists in `jobs`.

### 3. `/demo/jobs` page

`src/pages/DemoJobs.tsx`, modelled on `DemoDashboard.tsx`:

- same fixture choice (language, and the persona parameter if it exists),
  same `?p=` audience, `trackSampleView`, `DemoTrustBanner`, the demo nav
  with "Back to the dashboard" and the honest label, `DemoFooter` at the end
  with `showDashboardLink`.
- state: `view: 'results' | 'saved'` (starts on `results`), a local
  `savedJobs` array seeded from the fixture (save-heart and kanban drag
  update local state only, nothing persists; that is the mechanic being
  shown, and a reload resets it), `tool: DemoTool | null` for the dialog.
- `JobsResults` with `results = fixture.jobs`, `careerOptions` built the way
  `Jobs.tsx` builds them (only the searched career needs to be present),
  `resumeUnlocked = false`, `coverUnlocked = false`, `onInvite → setTool`
  (`resume` / `coverLetter` as appropriate), `onSave → local`, `onViewSaved →
  setView('saved')`, `onNewSearch → setTool('jobs')` with a dialog line that
  says a new search runs live for real users. The `CoverLetterModal` inside
  `JobsResults` must never open: make sure the cover-letter action routes to
  the dialog before it reaches the modal (check the prop it keys on; if the
  modal opens unconditionally on a click, add a prop to suppress it, additive
  like `DashboardV4.nav`).
- `JobsSavedKanban` with the local `savedJobs`, `onStatusChange → local`,
  résumé / cover-letter actions → dialog, `onBack → setView('results')`.
- Apply links stay real (`rel="nofollow noopener"`, `trackCtaClick('demo_job_apply')`).
- Intro card under the page (as on the dashboard demo): what this is, that
  the listings were found for her/him on the date of the run, that they age,
  and that a real search runs live. Strings under `jobsDemo.*` in both demo
  locale files; the jobs components themselves stay English (decision 4).
- Route in `src/App.tsx`, SEO entry in `scripts/seo-routes.mjs` (Dutch static
  shell like the other demo routes), `DEMO_JOBS_ROUTE` in `src/demo/constants.ts`.

### 4. The demo dashboard: unlocked tile, nudge, links

In `src/pages/DemoDashboard.tsx`:

- `features`: `jobs` unlocked, the other two locked. `ladder`: step 1
  unlocked, `referralCount = 1`. The toolkit shows "Unlocked!" on the Jobs
  step.
- `handleNavigate`: routes starting with `/jobs` go to `/demo/jobs` (carry
  `?p=` and the persona parameter) instead of the dialog; `/custom-resume`
  keeps the dialog. The per-career "Find roles" buttons on the match cards
  (`handleFindRoles` in `DashboardV4`) call `onNavigate('/jobs?mode=search&career=…')`
  when unlocked, so they now lead to the demo jobs page too.
- Explainer banner above the toolkit: one line, `dashboardDemo.jobsNudge`
  in both languages ("Emma unlocked the job search. Open it to see what it
  found for her." / Marcel equivalent, first name interpolated), with a
  button to `/demo/jobs`. Pulse: `DashboardV4` needs an additive prop to
  pulse one toolkit step (e.g. `pulseStepKey?: 'jobs'`) reusing the
  `animate-mic-hint-pulse` ring, cleared on first click, same pattern as
  `MessageVoiceButton.hintSettings`.
- `DemoToolDialog`: the `invite` text should say the toolkit state shown is
  the demo's (one referral earned for the job search), so the honest label
  holds on the ladder too. Add `jobsSearch` as a tool name for "run a new
  search" from the jobs page.

### 5. Verify, then ship

- `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- In the browser (dev server from `.claude/launch.json`, route
  `/demo/jobs`): no request to `functions/v1/*` and no `saved_jobs` request
  leaves the page (check the network log); results render with match scores
  and histogram; save-heart toggles locally; kanban drag moves a card; the
  résumé and cover-letter buttons open the dialog; both personas render
  (switch language, or the persona parameter); the dashboard's Jobs tile is
  unlocked, pulses, and lands on `/demo/jobs`.
- Commit fixture additions, page, strings and docs together. Update the
  status block at the top of `docs/handoff/demo-replay-plan.md` (phase 4) and
  the memory note.

## Traps specific to this phase

1. **Results are ephemeral server-side.** Nothing to re-export later; the
   fixture is the only copy. Never let a re-export of the chat fixture drop
   the `jobs` key (step 2).
2. **`JobsResults` mounts `CoverLetterModal` itself.** Opening it starts a
   Realtime subscription and 3-second polling on `cover_letters`. Route the
   action to the dialog before the modal can open.
3. **`useReferralStatus` mints a code.** Do not mount any hook from the
   signed-in Jobs page; the demo page builds `features`/`ladder` from the
   catalogue constants (`REFERRAL_FEATURES`, `UNLOCK_LADDER`) like
   `DemoDashboard` does.
4. **The kanban's drag library** (`@dnd-kit`) works without a session, but
   its `onStatusChange` must not call `updateStatus` from `useSavedJobs`
   (react-query, `user_id` keyed, and a write). Local state only.
5. **Apify listings carry `apply_url` to LinkedIn** and sometimes personal
   recruiter names in `description`. Read the frozen listings before
   committing them to a public repo; drop any listing that names a person.
6. **Marcel's fixture is Dutch, the jobs chrome is English.** The intro card
   must say the search page is English for now (decision 4), otherwise a
   Dutch visitor reads it as a bug.
7. **Font-weight cap 700, no em-dashes in copy** (house rules), and the
   `nl` locale file must carry every new key the tests check.
