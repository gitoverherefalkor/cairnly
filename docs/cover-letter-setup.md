# Cover Letter feature — setup guide

This doc walks through everything still needed to make the per-posting cover
letter flow work end-to-end after the code changes shipped in this branch.

There are **three setup steps**. None of them are optional — they're all
required for the modal to actually produce a PDF. Each step says:
- **What** it does
- **Why** it's needed
- **Who** is responsible (Claude vs Sjoerd) and **why**
- **How** to do it (with concrete commands / clicks)

---

## Step 1 — Apply the Supabase migration

### What

There's a new SQL file at:

`supabase/migrations/20260525120000_add_cover_letters.sql`

It creates a new database table called `cover_letters` plus the Row Level
Security (RLS) policies that lock each row to its owner. Without this table,
the new edge function has nowhere to store generated letters.

### Why

The Cover Letter feature stores one row per (user, job posting) in this
table. The edge function inserts a row in `processing` status, n8n updates it
to `completed` (or `failed`) when generation finishes, and the modal
subscribes to that row via Supabase Realtime to flip from "Generating…" to
the rendered PDF preview.

If the table doesn't exist, you'll see errors like
`relation "cover_letters" does not exist` the moment a user clicks "Cover
letter" on a job card.

### Who & why

**Either Claude (preferred) or Sjoerd can do this.**

- Claude can apply the migration directly through the Supabase MCP, which is
  the simplest path now that the MCP tools are available in this session.
- Sjoerd can also do it manually via the Supabase dashboard or CLI if he
  prefers to see and click through it himself.

The reason Claude *can* do this safely (unlike n8n) is that the migration is
**version-controlled SQL in the repo** — it's auditable, reversible, and
already approved by virtue of being in the codebase. n8n workflows aren't in
the repo and aren't version-controlled, which is why they're treated
differently (see Step 2).

### How — option A (Claude does it, recommended)

Tell Claude "go ahead, apply the migration via MCP" and Claude will:
1. Call `mcp__plugin_supabase_supabase__list_projects` to find your project.
2. Call `mcp__plugin_supabase_supabase__apply_migration` with the SQL from
   the migration file.
3. Verify the table exists with `list_tables`.

### How — option B (Sjoerd does it manually)

Two sub-options:

**B1. Via Supabase CLI** (if you have it installed and linked):

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
supabase db push
```

This pushes any un-applied migration files to your remote project.

**B2. Via Supabase dashboard** (no CLI needed):

1. Open https://supabase.com/dashboard → your project → SQL Editor.
2. Open a new query.
3. Copy the full contents of
   `supabase/migrations/20260525120000_add_cover_letters.sql` into the editor.
4. Click "Run".

### About the failure you hit

You said step 1 failed but didn't say which option you tried or what the
error was. **Tell Claude what you tried (CLI? dashboard?) and paste the
error message**, and Claude will diagnose it. Common causes:

- `permission denied` — wrong role (use service role or apply via dashboard).
- `relation "custom_resumes" does not exist` — the migration depends on an
  earlier one being applied first; check `supabase migration list`.
- `policy already exists` — re-running a partially-applied migration. The
  `DO $$ ... IF NOT EXISTS` blocks should prevent this, but if it slipped
  through, Claude can write a fixup.

---

## Step 2 — Build the n8n cover-letter workflow

### What

A brand new n8n workflow that:
1. Receives a POST from the new `generate-cover-letter` edge function with
   `{ user_id, report_id, cover_letter_id, job, source_resume }`.
2. Calls an LLM with a prompt tuned for cover letters (mentions the specific
   organization, role, and JD wording — that's the whole point of decoupling
   from the résumé flow).
3. Writes the result back to Supabase: `cover_letters.letter_json =
   {greeting, opening, body_paragraphs[], closing}` and
   `status = 'completed'` (or `'failed'` with an `error_message` if the LLM
   call dies).

### Why

The edge function is a thin kickoff: validate auth, snapshot the job, insert
the row, fire the webhook, return. **It does not call the LLM itself** — that
job belongs to n8n, same as every other AI generation in this app (résumés,
profiles, chat, etc.). The architecture is intentional: keep cost, retries,
and prompt iteration in n8n where you can tweak them visually without
redeploying code.

Without this workflow, every "Generate cover letter" click will insert a
`cover_letters` row stuck in `processing` forever, because nothing is on the
other end of the webhook to fulfill it.

### Who & why

**Sjoerd builds this — Claude can only assist with explicit per-workflow
approval.**

This is the rule from your `CLAUDE.md`:

> n8n workflows and question mappings are critical production pipelines.
> Never edit them speculatively. You may modify a workflow when ALL of these
> are true:
> 1. The user has given explicit approval for that specific workflow (a
>    per-workflow yes, not a blanket one)
> 2. You have presented a clear plan: which nodes change, what the change is,
>    why it's needed, and what could break
> 3. The user has confirmed the plan before you call the n8n API

A *new* workflow is less risky than editing an existing one, but the same
principle applies: Claude should propose a plan and get your sign-off before
calling the n8n API to create it.

**Answer to "did you not create the workflow yet?"** — Correct. Claude has
not touched n8n at all in this branch. The edge function fires a webhook at
an env var (`N8N_COVER_LETTER_WEBHOOK_URL`) that doesn't exist yet. That's
why the migration + frontend ship safely, but the actual letter generation
won't happen until the n8n side is built.

### How — what the workflow needs to look like

If you want Claude to scaffold the workflow for you, say "draft the n8n
cover-letter workflow and ask me before creating it." Claude will then:
1. Propose every node (Webhook → Set → AI call → Set → Supabase update → Respond).
2. Show the prompt that goes into the LLM.
3. Show the Supabase update shape.
4. Wait for your explicit "yes, create it" before calling the n8n API.

Or you can build it yourself in the n8n editor. Either way, here's the spec:

#### Trigger: Webhook node
- Method: POST
- Path: something like `/webhook/cover-letter-generate`
- Authentication: header `x-shared-secret` matching `N8N_SHARED_SECRET`
  (same pattern as the existing custom-resume webhook)
- Respond: "Immediately" with `200 OK` (don't keep the edge function waiting
  for the full LLM round-trip)

#### Input payload
```json
{
  "user_id": "uuid",
  "report_id": "uuid",
  "cover_letter_id": "uuid",
  "job": {
    "id": "string",
    "title": "Senior Product Manager",
    "company": "Acme Corp",
    "location": "Amsterdam",
    "description": "Full JD text…",
    "apply_url": "https://…",
    "source": "linkedin"
  },
  "source_resume": {
    "id": "uuid",
    "career_title": "Product Manager",
    "resume_json": { /* full ResumeJson */ }
  }
}
```

#### LLM prompt (starting point — refine on real outputs)
> You are writing a cover letter for `{{ source_resume.resume_json.contact.name }}`
> applying to the role of **{{ job.title }}** at **{{ job.company }}**.
>
> Use the candidate's résumé below as the source of voice, experience, and
> achievements. The letter must clearly reference *this specific posting* —
> mention the company by name, reflect the role's actual responsibilities
> (from the job description), and surface the 1-2 strongest evidence points
> from the résumé that map to what this employer is looking for.
>
> Job description:
> {{ job.description }}
>
> Candidate résumé:
> {{ source_resume.resume_json | json }}
>
> Return strict JSON in this shape:
> ```
> {
>   "greeting": "Dear Hiring Team,",
>   "opening": "...",
>   "body_paragraphs": ["...", "..."],
>   "closing": "..."
> }
> ```
> No prose outside the JSON.

#### Final step: update Supabase
Use the Supabase node (or HTTP node hitting PostgREST with the service role
key — same pattern as `WF1`). On success:
```sql
UPDATE cover_letters
SET letter_json = $1,
    status = 'completed',
    updated_at = now()
WHERE id = $2;
```

On failure (LLM error, parse error, etc.):
```sql
UPDATE cover_letters
SET status = 'failed',
    error_message = $1,
    updated_at = now()
WHERE id = $2;
```

#### Connect it to the edge function
Once the workflow is live:
1. Copy its **Production webhook URL** from the Webhook node.
2. Set it as a Supabase Function secret named `N8N_COVER_LETTER_WEBHOOK_URL`:
   - Dashboard → Project Settings → Edge Functions → Secrets → Add new.
3. Make sure `N8N_SHARED_SECRET` is already set there (it should be —
   the custom-resume function already uses it).
4. Redeploy the edge function (or it'll pick up the new env on next cold
   start, but redeploying is faster):
   ```bash
   supabase functions deploy generate-cover-letter
   ```

---

## Step 3 — Regenerate Supabase TypeScript types

### What

The file `src/integrations/supabase/types.ts` is **auto-generated** from
your live database schema. It contains TypeScript definitions for every
table, column, and view, so the codebase gets type-checked against the
real DB.

Right now it does *not* know about the new `cover_letters` table because it
was last regenerated before the migration was written. Regenerating it adds
`cover_letters` to the type registry.

### Why

Without regenerating, the code that queries `cover_letters` has to use a
workaround. In `src/components/cover-letter/hooks/useCoverLetter.ts` you'll
see this line:

```ts
.from('cover_letters' as unknown as never)
```

That `as unknown as never` cast is me telling TypeScript "trust me, this
table exists" because the auto-generated types don't list it. It works, but
it's fragile — typos in column names won't get caught, and the
`CoverLetterRow` interface I hand-wrote in
`src/components/cover-letter/types.ts` can drift from the real schema.

Regenerating fixes both: the cast goes away, and `CoverLetterRow` can be
replaced with `Tables<'cover_letters'>` which is always in sync with the DB.

### Who & why

**Either Claude or Sjoerd can do this.** Same reasoning as Step 1 — types
are read-only generated artifacts in the repo, low-risk to touch.

### How — option A (Claude does it via MCP, recommended)

Tell Claude "regenerate the Supabase types." Claude will:
1. Call `mcp__plugin_supabase_supabase__generate_typescript_types` to get
   the fresh types.
2. Overwrite `src/integrations/supabase/types.ts`.
3. Update `useCoverLetter.ts` to drop the cast and use the generated type.
4. Update `cover-letter/types.ts` to re-export from generated types instead
   of hand-defining `CoverLetterRow`.
5. Run `npm run build` to confirm no type errors.

### How — option B (Sjoerd does it manually via CLI)

```bash
cd "/Users/sjoerdgeurts/Documents/Code Projects/Cairnly"
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Then ping Claude to do the small cleanup (drop the cast, drop the hand-typed
interface). That cleanup is a 2-minute job once the file is fresh.

---

## Order of operations

Run them in this order (later steps depend on earlier ones):

1. **Step 1** — apply the migration. **Without this, nothing else works.**
2. **Step 3** — regenerate types. *Can* run any time after Step 1, but doing
   it before Step 2 keeps the codebase clean as you iterate.
3. **Step 2** — build the n8n workflow + set the webhook env var. **Last,
   because it depends on the table existing and you'll want to test it
   end-to-end with real frontend → edge fn → n8n → Supabase round-trips.**

---

## Quick reference: who owns what

| Item | Owner | Why |
|---|---|---|
| Migration SQL file | Claude wrote it, Sjoerd or Claude applies it | Version-controlled, reversible, in the repo |
| Edge function code | Claude | Code in the repo, version-controlled |
| Frontend (modal, hooks, JobCard wiring) | Claude | Code in the repo |
| n8n workflow | Sjoerd (or Claude with explicit per-workflow approval) | Production pipeline outside the repo; project rule per `CLAUDE.md` |
| Edge function secrets (`N8N_COVER_LETTER_WEBHOOK_URL`, `N8N_SHARED_SECRET`) | Sjoerd | Secrets management — Claude shouldn't see or set production secrets |
| Type regeneration | Either | Generated artifact, low-risk |
| End-to-end testing in the live app | Sjoerd | Requires real auth, real report, real n8n |
