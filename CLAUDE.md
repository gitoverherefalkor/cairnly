# Atlas Assessments Project

## Project overview
Atlas Assessments is a career guidance platform for professionals aged 18-55 (primarily college-educated, office jobs). Users complete a custom survey, and an AI system (via n8n workflows) analyzes their responses to provide personality assessments and detailed career recommendations based on their goals, personality, and skills. Users can discuss results through an AI chat and incorporate feedback into a final report.

Current development focus: building out the platform features and establishing n8n workflow connections.

## Developer profile
- **Background**: Project manager with AI workflow expertise
- **Coding level**: Non-technical "vibe coder" learning terminology
- **Needs**: Clear explanations, visual confirmation of changes, guidance on technical decisions
- **Working style**: Collaborative, needs AI to take the reigns but explain what's happening

## Communication guidelines
- Use business casual tone, avoid excessive formality
- Keep explanations simple but not condescending
- Explain technical concepts when introducing new patterns or tools
- Challenge assumptions if something seems off
- For LARGE changes or new features: provide a recap of what you understand and what you'll do, wait for confirmation, then execute
- For small changes: just do it and push so changes can be tested visually
- No need for disclaimers or "I'm just an AI" statements
- Be honest when you don't know something
- When walking the user through a manual, repeatable process (setting up an API key, configuring a tool, a multi-step terminal workflow, etc.), proactively offer to capture it as a step-by-step Notion tutorial they can reference later. Create it as a standalone top-level Notion page (not nested under an unrelated page) unless they say where to put it.

## Development commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm test`: Run tests
- `git status`: Check git status
- `git add .`: Stage all changes
- `git commit -m "message"`: Commit changes
- `git push`: Push to GitHub

## Installed software
- VS Code (for visualization)
- Docker
- Homebrew
- Postman
- Terminal (zsh)
- Git/GitHub
- Node.js and npm

## File boundaries
**Safe to edit:**
- `/src/` - All source code files
- `/public/` - Public assets
- `/supabase/` - Supabase functions and migrations
- `/mocks/` - Mock data files
- Documentation files

**Never touch:**
- `/node_modules/`
- `/dist/`
- `/.git/`
- Package lock files (unless explicitly updating dependencies)

## Tech stack
- React with TypeScript
- Supabase (database and auth)
- Vite (build tool)
- Tailwind CSS
- n8n (external workflow automation)

## Coding standards
- Write clean, readable code
- Add comments for complex logic
- Use TypeScript types properly
- Follow existing code patterns in the project
- Test changes visually in the browser

## Git workflow
- Commit frequently with clear messages
- Push changes after major features or fixes
- Always check `git status` before committing
- Use descriptive commit messages (not "update" or "fix")

## Before starting large changes
1. Explain what you understand from the request
2. Outline your approach
3. Wait for confirmation
4. Execute and push changes
5. Summarize what was changed

## Supabase CLI / MCP policy

You may run Supabase CLI commands and the Supabase MCP **without per-command approval** for *non-risky* actions — defined as anything that doesn't kill edge functions, drop tables, or touch user data. Specifically:

**Allowed without asking:**
- Reading state (`list_projects`, `list_tables`, `list_migrations`, `get_logs`, `get_advisors`, `list_edge_functions`, `get_project_url`, etc.)
- Applying migrations that already exist as version-controlled SQL files in `supabase/migrations/` (they're auditable, reversible, and were drafted in collaboration with the user)
- Regenerating TypeScript types (`generate_typescript_types`) — read-only output, just refreshes `src/integrations/supabase/types.ts`
- Deploying *new* edge functions you just wrote in this branch
- Running local-dev commands (`supabase start`, `supabase db reset` on a local stack)

**Requires explicit approval first:**
- Re-deploying or deleting *existing* edge functions (could break live traffic)
- `execute_sql` with mutations against production (INSERT/UPDATE/DELETE on user-data tables) — read-only SELECTs are fine
- `apply_migration` for SQL that wasn't written into a migration file first (i.e. ad-hoc schema changes that aren't version-controlled)
- Pausing, restoring, or deleting projects / branches
- Anything touching `auth.users` directly

Rule of thumb: if the action is reversible by re-running `supabase db push` from the repo, it's safe. If reversing it requires a backup restore or manual reconstruction, ask first.

## n8n integration notes
- n8n handles the AI assessment workflows
- Platform needs to send survey data to n8n
- Platform needs to receive assessment results from n8n
- Consider webhook endpoints and API connections

## n8n API access
- **Instance**: https://falkoratlas.app.n8n.cloud
- **API Key**: stored in `.env` as `N8N_API_KEY`
- **Auth header**: `X-N8N-API-KEY`
- **Usage**: `curl -s -H "X-N8N-API-KEY: $(grep N8N_API_KEY .env | cut -d'"' -f2)" https://falkoratlas.app.n8n.cloud/api/v1/workflows`
- **Capabilities**: List/get/update workflows, check executions, activate/deactivate
- **Modification policy**: n8n workflows and question mappings are critical production pipelines. The rules differ for editing existing workflows vs. drafting new ones:

  **Editing an existing workflow (WF1–WF9, WFX, Error Handler, Resume Extract, or anything else already in production):** Never edit speculatively. You **may** modify when ALL of these are true:
  1. The user has given explicit approval for that specific workflow (a per-workflow yes, not a blanket one)
  2. You have presented a clear plan: which nodes change, what the change is, why it's needed, and what could break
  3. The user has confirmed the plan before you call the n8n API

  Prefer frontend / edge function fixes when both are viable. When you do edit, always export the current state to `n8n_wfs_cairnly/` first so we can roll back.

  **Creating a new workflow from scratch:** Allowed without per-workflow approval *when the feature being built genuinely requires it* (i.e. there's frontend / edge function code in the same change that fires a webhook with no receiver yet). You may:
  - Call the n8n API to create the workflow with the nodes the feature needs
  - Leave the new workflow **inactive / not published** so the user reviews it in the n8n editor before turning it on
  - Save a copy to `n8n_wfs_cairnly/` for version control

  Still required: present a brief plan (nodes + prompt + Supabase update shape) in chat before calling the API, so the user can spot anything obviously wrong before it lands. Do not activate the workflow yourself — that's a user action.
- **Workflow exports**: JSON backups are in `n8n_wfs_cairnly/` folder

### Workflow IDs (current architecture)
| Workflow | ID | Purpose |
|----------|-----|---------|
| WF0.1 (Resume Extract) | myWIhgaahAXD2ULz | PDF resume parsing (n8n name "WF0 - Resume data extraction") |
| WF1 (Profile Insert) | 0Z8WxV5tVFMJqIZt | Survey → personality profile. **This is the live webhook receiver** for `forward-to-n8n` (workflow name "WF1 - Profile Insert EN/NL", active). The older `nupGvBByAGh4A9tL` / `WF1.2_Profile Insert` is inactive — don't use it. |
| WF2 (Enrich 15) | vVv0tsnFlBnarMdq | Career research + AI impact ("WF2 - Source to Enrich 15") |
| WF3 (Scoring + OOB) | zhgJuiDp60PS5ZKJ | Career scoring + outside-the-box ("WF3 - scoring careers NL/EN"). ⚠️ The old `LJA5JPHvnqhA36Oh` / `WF3.2_scoring_careers` is **inactive** — don't use it (it was the duplicate-and-replace source during the May 2026 NL localization). |
| WF4 (Content Gen) | seWmQPFQqIe60TkU | Top 3 + runner-up + dream job narratives ("WF4 - Career selection NL/EN"). ⚠️ The old `pXlzC6vuG7TO28oQ` / `WF4 Career selection` is **inactive** — don't use it. |
| WF5 (Chat) | h7ie9zN080IM2g7N | Interactive career coach chat (n8n name "WF5 - Cairnly Coach"). Old `XPhZc4Fyn2umaUyJ` / WF5.2 is inactive. |
| WF6 (Feedback) | CyyjL7D51NbVZNtL | Incorporates chat feedback into the report ("WF6 - Feedback processing NL/EN"). Old `XuOb0iIv1Hwc2t62` is inactive. |
| WF7 (Exec Summary) | ohNbCw7pVqvjCZHT | Executive summary generation ("WF7 - ExecSummary NL/EN"). Old `yg7naUkC6oqr2WpU` is inactive. |
| WF8 (Finding Roles) | Bx0uNW4gnnXIGO8j | "Find Open Roles" job search ("WF8 - Finding selected roles") |
| WF9 (Custom Resume) | IFhL4Lno0hyMJ1Jc | Tailored resume generation ("WF9 - Custom Resume") |
| WFX (Cover Letter) | M9w7xWeiPNmU7ZFb | Per-application cover letter generation ("WFX - Cover Letter") |
| Error Handler | FbsruPbuZI2Fgtc8 | Global error logging + email alerts |

> All 12 of the above are **active in production** and their current exports live in `n8n_wfs_cairnly/` (one JSON per workflow, the source of truth for local reference). The IDs were verified against the live n8n API on 2026-06-05.

> ⚠️ **Edge secret `N8N_WEBHOOK_URL` must point to the LIVE WF1 webhook:**
> `https://falkoratlas.app.n8n.cloud/webhook/28477bc7-d895-4b0e-bc45-a030312f6fcc`
> (this is WF1 `0Z8WxV5tVFMJqIZt`, the active "Survey complete Webhook2" node).
> On 2026-06-05 it was found still pointing at the **old inactive WF1.2** webhook
> path `dfe2a07c-…` (workflow `nupGvBByAGh4A9tL`), a leftover from the WF1.2 → WF1
> migration. That returned 404 on every real submission. If submissions start
> failing with `forward-to-n8n` 502s and n8n shows no executions, check this secret first.