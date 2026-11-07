---
name: cairnly-live-test
description: Run an end-to-end live test of cairnly.io with an AI tester (Sonnet) playing a real user and an AI fixer watching n8n and Supabase. Use when Sjoerd asks for a live test, walkthrough, smoke test or "AI user test" of Cairnly.
---

# Cairnly live test

An AI tester walks through the live site as a real user: free-code signup, CV upload,
survey, report, chat with pushback, job search, tailored CV, cover letter, and back into
the post-report coach. A fixer watches n8n and Supabase and clears blockers so the tester
can continue. The output is one report for Sjoerd.

There is **no staging**: this runs on production (Supabase `pcoyafgsirrznhmdaiji`, n8n
`falkoratlas.app.n8n.cloud`, site `https://cairnly.io`).

Files in this folder:
- `persona.md`: who the tester is, the pushback script, account naming.
- `noor-cv.html`: the persona's CV, rendered to PDF in setup.
- `pw.mjs`: browser driver for cloud mode (one persistent Chromium, one command per step).

## Scope and fixer mandate (agreed with Sjoerd, 2026-11-07)

Sjoerd wants the run to go without him approving each step. So, before starting, post
**one** message listing exactly what the run will do (the items below), and start once he
confirms. That single confirmation covers the run. Never go beyond this list:

- Production SQL **scoped to the test account only**: mint the free code, set
  `comp_tool_unlocks`, repair or re-trigger that account's rows.
- Read-only everywhere else: n8n workflows and executions, Supabase logs, tables, edge functions.
- Re-running n8n executions for the test account.
- **Fixer mandate "A+"**: by default only repair test-account data and log code or workflow
  bugs. A code, edge-function or n8n change only when it **blocks the test** or is an
  **obvious fix** (typo, wrong id, missing grant). Then: export the workflow to
  `n8n_wfs_cairnly/` (or note the edge function version) first, make the smallest change,
  commit to `main` with a clear message, and list it in the report with how to roll back.
- Never touch other users' data, never drop or truncate, never edit `auth.users` directly.

Anything outside this list: log it as a proposed fix in the report, do not do it.

## Pick the browser mode

1. **Cloud (default)**. Check: `curl -sS -o /dev/null -w "%{http_code}" https://cairnly.io/`
   must give 200. A proxy 403 or `000` means the project's cloud environment does not
   allow the site. Then tell Sjoerd to add a cloud environment with full network access
   ([Project settings](#project-settings/environment), Cloud environment, Add cloud
   environment), or to choose Mac mode. Hosts needed: `cairnly.io`, `www.cairnly.io` (cairnly.io redirects there), `*.supabase.co`,
   Google Fonts.
2. **Mac (computer use)**, only when Sjoerd picks it. The tester uses the
   `mcp__remote-devices__computer_*` tools on his Mac, which takes over his screen. App
   access for the browser is requested once at the start. Put the CV PDF in a connected
   folder (`device_commit_files`) so the file picker can reach it. Untested whether a
   subagent receives these tools: if not, the orchestrator drives the browser itself and
   keeps the persona.

## Roles

| Role | Who | Job |
|---|---|---|
| Orchestrator | the session running this skill | Preflight, setup, starts tester and fixer, keeps the log, writes the report |
| Tester | `Agent`, `model: "sonnet"` | Is the persona. Drives the browser one step at a time, logs every step, stops with `BLOCKED:` when stuck |
| Fixer | `Agent`, default model | Diagnoses a blocker from n8n executions, Supabase logs and the test account's rows, fixes within the mandate, reports back |

Haiku is too weak for a long, consistent chat with pushback. Use Sonnet for the tester.

## Run folder and log

Run id = `YYYYMMDD` (add `-2`, `-3` for reruns that day). Everything goes to
`/mnt/project-files/live-tests/<run>/`:
- `log.md`: one line per step (time, phase, action, result), plus every fixer action.
- `screenshots/`, `downloads/` (from `pw.mjs`), `noor-cv.pdf`.
- `account.md`: email, user id, report id, code.

## Phase 0: setup (orchestrator)

1. Note the start time in UTC (the health check filters on it).
2. Render the CV:
   ```bash
   node -e "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.argv[1]);await p.pdf({path:process.argv[2],format:'A4'});await b.close()})()" "$PWD/.claude/skills/cairnly-live-test/noor-cv.html" /mnt/project-files/live-tests/<run>/noor-cv.pdf
   ```
3. Mint the free code (Supabase MCP `execute_sql`):
   `select public.mint_individual_code('AI live test <run>') as code;`
   Signup link: `https://cairnly.io/auth?flow=signup&code=<CODE>&lang=en`
4. Generate a throwaway password for the test account and keep it in the run folder.
5. Cloud mode: `node .claude/skills/cairnly-live-test/pw.mjs start /mnt/project-files/live-tests/<run>`

## Phases (tester), with pass criteria

Hand the tester `persona.md`, the account details, the driver usage (header of `pw.mjs`)
and the phases below. Run them in chunks (F1-F3, F5, F6-F8, F9) and continue the same
tester with `SendMessage` so it keeps the persona and memory of the chat.

- **F1 Signup**: open the signup link, fill name, email, password, submit. Pass: no Stripe
  screen, lands in the app. Then the orchestrator sets the tool unlocks:
  `update public.profiles set comp_tool_unlocks = 3 where id = (select id from auth.users where email = '<email>');`
- **F2 CV upload**: upload `noor-cv.pdf` on the pre-survey upload step
  (`pw.mjs upload 'input[type=file]' <path>`). Pass: survey fields are pre-filled from the CV.
- **F3 Survey**: answer every question as the persona. Pass: submit succeeds, the
  processing page shows, WF1 starts (orchestrator checks n8n).
- **F4 Report wait (orchestrator)**: WF1 → WF2 → WF3 → WF4 run in n8n. Do not hold the
  turn: schedule a wake-up (`send_later`) and check every ~10 minutes with the health
  check below. Pass: report status leaves pending, sections present (personality, top 3,
  runner-ups, outside-the-box, dream job), AI-impact labels visible on the dashboard.
- **F5 Chat with pushback (WF5 + WF6)**: go through the chat section by section. Use at
  least four pushbacks from `persona.md`. Finish with the wrap-up. Pass per pushback: the
  coach engages with the substance, neither caves blindly nor ignores it. Pass overall:
  feedback shows up in the report (WF6), `user_engagement_tracking.chat_completed_at` set,
  executive summary (WF7) generated.
- **F6 Job search (WF8)**: Jobs page, location Utrecht / remote, one or two careers. Save
  two jobs. Each career search is a paid Apify scrape: max 3 searches. Pass: results with
  match scores, saving works.
- **F7 Tailored CV (WF9)**: create a tailored CV for one saved job, download it. Pass:
  generated, fits the job, download works (`pw.mjs downloads`).
- **F8 Cover letter (WFX)**: from the saved job card, create a cover letter, download.
  Pass: specific to the job and company, download works.
- **F9 Back to the coach (WF5C, `/coach`)**: open the coach from the dashboard (or the
  banner at the end of the first chat). Ask the follow-up from `persona.md`, push back once.
  Also reopen `/chat` and check the welcome-back screen. Pass: the coach knows the report
  and the first chat's highlights, does not change the report, the message counter goes
  up (`coach_usage`).

Tester rules:
- Look before every action (`pw.mjs look`) and read the screen like a user would. Note
  confusing copy, slow steps and dead ends as UX findings, not just hard failures.
- Never use the database or APIs to skip a step, unless the orchestrator says so.
- Stuck for more than 2 tries on the same step, an error message, or a spinner over
  5 minutes (outside F4): stop and return `BLOCKED: <phase> <what you see> <screenshot path>`.
- Return at the end of each chunk with: steps done, pass/fail per criterion, UX notes.

## Health check (orchestrator, after each chunk and every wake-up in F4)

1. n8n: `search_workflow_executions` with `status: ["error","crashed"]`,
   `startedAfter: <start time>`. Workflow ids are in `CLAUDE.md`.
2. Supabase: `select * from public.error_logs where created_at > '<start>' order by created_at desc;`
   (also `api_error_logs`), and `query_logs` for edge functions (`forward-to-n8n`,
   `chat-proxy`, `search-jobs`, `generate-custom-resume`, `generate-cover-letter`).
3. Test account state: `reports.status`, count of `report_sections`,
   `user_engagement_tracking`, `saved_jobs`, `custom_resumes`, `cover_letters`,
   `coach_usage` for the report.

An error that belongs to the test account, or a `BLOCKED:` from the tester → start the fixer.

## Fixer brief (give it this, plus the error and the account ids)

Diagnose the root cause from the n8n execution (`get_workflow_execution`), Supabase logs
and the account's rows. Fix within the mandate above. Order of preference: re-run the
step for the test account → repair the account's data → frontend or edge fix → n8n edit.
Before any n8n edit export the current workflow JSON to `n8n_wfs_cairnly/`. Report:
cause, what you changed, how to roll back, and whether the tester can continue. If it
cannot be fixed within the mandate, say so: the tester skips that phase where possible
and the run continues.

Max two fix attempts per blocker, then log it and move on.

## Report

A Claude Doc "Cairnly live test <run>" with:
1. Summary: phases passed / failed, the top 3 problems.
2. Per phase: pass/fail per criterion, with screenshots for failures.
3. Chat quality: each pushback, the coach's answer in short, verdict.
4. UX findings from the persona's view.
5. Fixer actions: what, why, commit or workflow version, how to roll back.
6. Proposed fixes not done (outside the mandate).
7. Cost notes: number of job searches, n8n runs.

Post the link in the thread.

## Lessons from run 20261107

- The cloud container can restart mid-run (MCP tools drop, `uptime` resets). The pw.mjs
  browser dies with it: run `pw.mjs start <runDir>` again; the profile on the mount keeps the
  login. The download hook is lost after a restart in practice: check the downloads folder directly.
- Supabase MCP asks Sjoerd for approval on a DELETE (he sees an empty notification) and times
  out after 60s. Avoid DELETEs in an unattended run; log the row for cleanup instead.
- `/chat` after a finished chat redirects to `/dashboard`. That is expected: the
  WelcomeBackCard is only for resuming an unfinished first chat. The "return to chat" feature is `/coach`.
- F6-F8 showed no paywall for this account and `comp_tool_unlocks` stayed 3, so the unlocks
  were not consumed (check whether tools are free by design).
- The job search form defaults to country United States: change it to Netherlands every search.

## Cleanup

- `pw.mjs stop`.
- Leave the test account for Sjoerd's review. Delete only when he asks (via the app's
  delete-account flow or the `delete-user-data` function, never by hand in `auth.users`).
- Update this skill with anything the run taught you (new selectors, flaky steps).
