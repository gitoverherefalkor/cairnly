# Custom Résumé Feature — Implementation Spec

**Status:** Draft for review
**Branch:** `claude/resume-optimization-feature-rBdKh`
**Related n8n workflow (new):** `WF_custom_resume`

---

## 1. Overview

A new feature on the Dashboard that lets a user pick 1–3 careers from their assessment results and generate tailored résumés (optionally with cover letters) for each. Every résumé is generated in two forms — **ATS-safe** (machine-ready) and **designed** (human-ready) — and the user can pick a designed template.

Pre-requisite: the user must have a résumé uploaded. If not, they're gated to upload one before continuing. No "draft from scratch" fallback (edge case, not worth the complexity).

---

## 2. User flow

1. User is on `/dashboard` viewing their assessment results.
2. Clicks **"Generate tailored résumé"** (new CTA, slotted near the career results).
3. **Step 1 — Career selection.** Modal/page lists their careers grouped: Top 3, Runner-ups, Outside-the-box, Dream jobs. Checkboxes, max 3, ranked by score by default. User confirms selection.
4. **Step 2 — Résumé check.** App shows: "We'll use this résumé as the base" with file name + upload date. If no résumé on file → upload gate. Optional: show extracted contact info and let user fill any gaps (phone, LinkedIn, full address) inline before continuing. *(See §4 — this is the gap-handling step.)*
5. **Step 3 — Template picker.** User picks one of 5 templates (2 ATS-safe + 3 designed). Preview thumbnails shown.
6. **Step 4 — Cover letter toggle.** Checkbox: "Also generate a cover letter for each career." Default on.
7. **Generate.** Loading state ("Tailoring your résumé for *Product Manager*… 1 of 3"). Calls edge function → `WF_custom_resume`.
8. **Results page.** For each selected career: ATS score (0–100), live preview of the resume rendered in chosen template, download buttons (ATS-safe PDF, Designed PDF, Cover letter PDF). User can switch template without regenerating content. User can re-generate any one career individually.

---

## 3. Data sources

| Source | Used for | Where it lives |
|---|---|---|
| Uploaded résumé (PDF/DOCX) | Contact info, work history, education, skills | Supabase Storage bucket `resumes`, path `{user_id}/{timestamp}_{name}` |
| Personality profile | Voice/tone for résumé summary | `report_sections` rows where `section_type` in (`approach`, `strengths`, `values`) |
| Career enrichment | Keywords, required skills, tools, AI-impact context | `enriched_jobs` table (per career_title) |
| Career narrative ("why suited") | Résumé summary + cover letter argumentation | `report_sections` rows for the selected career types |
| Initial summary | Optional flavor context | `report_sections` where `section_type` = `init_summary` |
| Auth email | Contact (email) | `auth.users` / `profiles.email` |

**Not used:** raw survey answers. The personality and career section outputs already condense what matters.

---

## 4. The contact-info / detail gap (important)

The existing `profiles.resume_parsed_data` is **shaped for survey pre-fill**, not résumé generation. Confirmed by inspecting live rows: it has name, broad region (not full address), degree level (not institution names), career history as title+company+dates only, plus skills/achievements arrays. **It is missing**:

- ❌ Phone
- ❌ Full street address / city
- ❌ LinkedIn URL
- ❌ Portfolio URL
- ❌ Education institution names
- ❌ Detailed role descriptions (bullets, scope, impact metrics)
- ❌ Languages

**Solution:** `WF_custom_resume` does its **own deeper parse** of the original PDF stored in the `resumes` bucket. Results go into a new column / table (see §6) — not into the existing `resume_parsed_data` field (which keeps doing its survey-pre-fill job, untouched).

- Cached per uploaded résumé so re-generation doesn't re-parse.
- If extraction misses contact fields, **the UI shows a small form in Step 2** ("We couldn't find your phone number — add it here") so the user fills gaps once.

**Implication:** We do **not** modify the existing Resume Extract workflow (`myWIhgaahAXD2ULz`). New extraction lives inside `WF_custom_resume`.

---

## 5. `WF_custom_resume` — node-by-node

**Trigger:** Webhook. Called by new edge function `generate-custom-resume`.

**Payload from edge function:**
```json
{
  "user_id": "uuid",
  "report_id": "uuid",
  "resume_file_url": "signed-url-to-pdf",
  "selected_careers": [
    { "section_id": "uuid", "section_type": "top_career_1", "career_title": "Product Manager" },
    { "section_id": "uuid", "section_type": "runner_ups",   "career_title": "AI Workflow Automation Engineer" }
  ],
  "include_cover_letter": true,
  "user_overrides": {
    "phone": "+44 ...",
    "linkedin": "linkedin.com/in/...",
    "address": "London, UK"
  }
}
```

**Nodes:**

1. **Validate** — check `selected_careers.length` between 1 and 3, user owns the report, file URL is fresh.

2. **Resume deep parse** — pulls the PDF, runs an LLM (or document AI) extraction with a **résumé-shaped output schema**:
   ```
   contact { name, email, phone, location, linkedin, portfolio }
   summary_raw
   experience [{ title, company, location, start, end, current, bullets[] }]
   education [{ institution, degree, field, start, end, location }]
   skills { technical[], soft[], tools[], languages[] }
   certifications [{ name, issuer, year }]
   ```
   Cache by `resume_uploaded_at` + file hash so re-generation skips this step.

3. **Merge user overrides** — overlay any fields the user filled in Step 2 on top of extracted contact info.

4. **Fetch context (parallel from Supabase)** —
   - `report_sections` rows for selected careers (narrative content)
   - `report_sections` for `approach`, `strengths`, `values` (voice cues)
   - `enriched_jobs` rows matching each selected `career_title` (keywords)
   - `report_sections.init_summary` (optional flavor)

5. **Per-career loop** (runs in parallel for the up-to-3 careers):

   **5a. Keyword mining** — from `enriched_jobs.technical_skills`, `soft_skills`, `typical_tasks`, `certifications_requirements`, `alternate_titles`, build a ranked must-include keyword list.

   **5b. LLM call #1 — Résumé content gen.** Inputs: parsed résumé + selected career narrative + keywords + voice cues. Outputs structured JSON:
   ```
   {
     summary: string,
     experience: [{ title, company, location, start, end, bullets: string[] }],
     skills_grouped: { technical[], tools[], soft[] },
     education: [...],
     highlights: string[]
   }
   ```
   Re-frames bullets toward the target career. Does **not** invent facts.

   **5c. LLM call #2 — ATS pass.** Takes 5b output + keyword list. Returns the polished JSON + `ats_score` (0-100) + `keyword_coverage` (which keywords made it in, which are still missing). Strips passive voice, removes buzzwords, tightens bullets.

   **5d. (Optional) LLM call #3 — Cover letter.** Only if `include_cover_letter=true`. Inputs: résumé JSON + career narrative + voice cues. Returns `{ greeting, opening, body_paragraphs[], closing }`.

   **5e. Insert into Supabase** — write row to new `custom_resumes` table (see §6).

6. **Aggregate response** — array of `{ career_section_id, custom_resume_id, ats_score, keyword_coverage }`.

7. **Error branch** → existing Error Handler workflow (`FbsruPbuZI2Fgtc8`).

**Why two (or three) LLM calls instead of one:** asking a single prompt to do content rewriting + ATS optimization + voice matching produces mush. Decomposed calls are more reliable and let us surface the ATS score as a visible feature.

**Estimated runtime:** ~20–35s per career, runs in parallel → total 25–40s for 3 careers.

---

## 6. Supabase schema additions

### New table: `custom_resumes`

```sql
create table public.custom_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  career_section_id uuid not null references public.report_sections(id) on delete cascade,
  career_title text not null,
  template_id text not null default 'ats-classic',
  resume_json jsonb not null,        -- structured résumé (source of truth, see §5b/5c)
  cover_letter_json jsonb,           -- nullable
  ats_score numeric,
  keyword_coverage jsonb,            -- { hit: [...], missing: [...] }
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- RLS: user can read/write only their own rows
alter table public.custom_resumes enable row level security;
create policy "custom_resumes_owner" on public.custom_resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index custom_resumes_user_idx on public.custom_resumes(user_id);
create index custom_resumes_report_idx on public.custom_resumes(report_id);
```

### New column: `profiles.resume_full_data`

```sql
alter table public.profiles add column resume_full_data jsonb;
alter table public.profiles add column resume_full_data_extracted_at timestamp with time zone;
```

This stores the deeper résumé parse (from §5 step 2) so re-generation doesn't re-parse the PDF. Separate from `resume_parsed_data` which keeps doing survey pre-fill.

---

## 7. Edge function

**New:** `supabase/functions/generate-custom-resume/index.ts`

- Mirrors the pattern of `forward-resume-to-n8n`.
- Validates auth.
- Creates a signed URL (5-min expiry) for the user's stored résumé.
- Calls `N8N_CUSTOM_RESUME_WEBHOOK_URL` (new env var).
- Returns the n8n response to the frontend (or a job ID if we want async, see §10 open decisions).

**Also new:** `supabase/functions/render-resume-pdf/index.ts`

- Takes `{ custom_resume_id, template_id, output_type: 'ats' | 'designed' | 'cover_letter' }`.
- Loads the resume_json from `custom_resumes`.
- Renders HTML using the chosen template.
- Converts to PDF via an HTML→PDF service (decision: do we self-host a renderer like Puppeteer in an edge function, or use a third-party API like PDFShift / DocRaptor?).
- Streams the PDF back.

---

## 8. Frontend structure

### New files

```
src/components/custom-resume/
├── CustomResumeEntry.tsx           ← CTA card on dashboard
├── CareerPickerStep.tsx            ← Step 1 (max 3 checkboxes)
├── ResumeCheckStep.tsx             ← Step 2 (file confirm + gap-fill form)
├── TemplatePickerStep.tsx          ← Step 3 (5 thumbnails)
├── GenerationStep.tsx              ← Step 4 (loading + progress)
├── ResultsView.tsx                 ← Per-career tabs with preview + downloads
├── ResumePreview.tsx               ← Renders resume_json in chosen template
├── CoverLetterPreview.tsx
├── templates/
│   ├── ats-classic.tsx             ← built by us
│   ├── ats-modern.tsx              ← built by us
│   ├── designed-minimalist.tsx     ← from Claude Design brief
│   ├── designed-executive.tsx      ← from Claude Design brief
│   └── designed-creative.tsx       ← from Claude Design brief
└── hooks/
    ├── useCustomResume.ts          ← orchestrates the flow
    └── useResumePreviewRender.ts
```

### Modified files

- `src/components/dashboard/v2/DashboardV4.tsx` — add `CustomResumeEntry` CTA card.
- `src/App.tsx` — optional new route `/custom-resume/:reportId` if we want the flow on its own page rather than a modal. (Recommendation: modal/sheet for the wizard, dedicated page for the results.)
- `src/integrations/supabase/types.ts` — regenerate after migration.

### UI patterns
- Use existing shadcn components: `Dialog` / `Sheet` for the wizard, `Card`, `Button`, `Checkbox`, `Tabs`, `Progress`.
- Atlas color palette: use `atlas-blue` for primary actions, `atlas-teal` for success states, `atlas-orange` for alerts (e.g., missing keywords in ATS feedback).
- The ATS score gets a prominent visual treatment — circular progress or a labeled badge ("87/100 — Strong match").

---

## 9. Templates

- **2 ATS-safe** (built in-repo): `ats-classic` (serif, traditional), `ats-modern` (sans, clean). Single column, no icons, no columns, standard fonts. Plain HTML structures so PDF text layer is parser-friendly.
- **3 designed** (from Claude Design brief, see the brief shared with you): `designed-minimalist`, `designed-executive`, `designed-creative`. Delivered as Figma frames or HTML/CSS, then implemented as React components.

Templates render from the `resume_json` source of truth — template switching is instant and doesn't trigger regeneration.

---

## 10. Open decisions

1. **Sync vs. async webhook.** With three careers in parallel + LLM calls, total time is ~30–40s. Borderline for a sync HTTP request. **Recommendation:** async — return immediately, frontend polls `custom_resumes` table (or subscribes via Supabase Realtime) for completion. Mirrors how the main report generation works.
2. **PDF rendering choice.** Self-hosted Puppeteer in an edge function (more setup) vs. third-party API (faster to ship, adds a vendor). **Recommendation:** start with a third-party PDF API (e.g., PDFShift) for speed; revisit if cost/privacy becomes an issue.
3. **Re-parse strategy.** If a user uploads a new résumé later, do we invalidate cached `resume_full_data` automatically? **Recommendation:** yes, key it by `profiles.resume_uploaded_at`; if that changes, re-parse on next generation.
4. **Initial summary as input.** Include in LLM context or skip? **Recommendation:** include — it's a short, well-curated framing of the user. Worth the tokens.
5. **Editing the result.** Can users edit `resume_json` directly in the UI before downloading? **Recommendation:** v1 = no (regenerate or live with it). v2 = inline editor. Don't block v1 on this.
6. **Storage of PDFs.** Generate-on-demand vs. cache PDFs in a new Storage bucket. **Recommendation:** generate-on-demand from `resume_json` — keeps storage costs down and means template/edit changes are reflected immediately.

---

## 11. Out of scope (v1)

- Multi-language résumés (English only for v1)
- LinkedIn export ingestion (the gating uses the same upload widget)
- AI-suggested edits / chat-with-your-résumé
- Saving multiple template variants per career
- Versioning history of past generations (just the latest per career)
- Recruiter sharing / public résumé links

---

## 12. Implementation order (proposed)

1. **DB migration** — `custom_resumes` table + `profiles.resume_full_data` column.
2. **Export current n8n state** to `n8n_aa/` (Resume Extract + WF1 + WF2 + WF3 + WF4 + WF5 + Error Handler) per CLAUDE.md policy.
3. **Build `WF_custom_resume`** in n8n. Test end-to-end with a real user_id via Postman.
4. **Edge function** `generate-custom-resume` (proxy + signed URL).
5. **Edge function** `render-resume-pdf` (PDF rendering).
6. **ATS templates** (2) in React.
7. **Wizard UI** (steps 1–4) as a Sheet/Dialog from dashboard.
8. **Results view** with preview, ATS score, downloads.
9. **Polish** — empty states, error states, loading micro-interactions.
10. **Designed templates** (3) — slotted in once Claude Design delivers them.

---

## 13. Approvals needed before building

- [ ] Spec reviewed and approved
- [ ] Decision on async vs. sync (open decision #1)
- [ ] Decision on PDF rendering vendor (open decision #2)
- [ ] Confirm we're OK exporting all production n8n workflows to `n8n_aa/` as part of step 2
- [ ] Claude Design brief sent (already drafted)
