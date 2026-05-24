# WF_custom_resume — n8n Workflow Setup

The new "Tailor your résumé" feature on the dashboard kicks off this workflow.
It takes the user's selected careers + their uploaded résumé and produces
tailored `resume_json` (and optional `cover_letter_json`) per career, with an
ATS score and keyword coverage report.

This document is a node-by-node spec you can build in n8n. The frontend and
edge function are already in place; once this workflow is live and the
webhook URL is wired into Supabase, the feature works end-to-end.

---

## Required credentials in n8n

Bind these before activating the workflow:

| Credential | Used by | Notes |
|---|---|---|
| **OpenAI** (or Anthropic) | All LLM nodes | We use GPT-4o or Claude Sonnet across 3 calls per career. |
| **Supabase** | Supabase nodes (read/write) | Service role — needed to update `custom_resumes` and `profiles`. |
| **HTTP Header (shared secret)** | Webhook auth | Header name: `x-shared-secret`. Value: matches Supabase `N8N_SHARED_SECRET`. |

---

## Required environment variables / secrets

| Where | Variable | Value |
|---|---|---|
| Supabase Edge Function secrets | `N8N_CUSTOM_RESUME_WEBHOOK_URL` | The webhook URL n8n gives you when you create the Webhook trigger node (see step 1 below). |
| Supabase Edge Function secrets | `N8N_SHARED_SECRET` | Any strong random string. Must match the value sent by n8n on outbound calls and checked on inbound. (Already used by other workflows — re-use it.) |

After setting these, redeploy the `generate-custom-resume` edge function or
restart the Supabase Functions runtime so the new env vars take effect.

---

## Webhook payload

The edge function POSTs this body to the webhook with header
`x-shared-secret: <N8N_SHARED_SECRET>`:

```json
{
  "user_id": "uuid",
  "report_id": "uuid",
  "resume_file_url": "https://...supabase.co/.../resumes/<user>/<file>.pdf?token=...",
  "selected_careers": [
    {
      "section_id": "uuid",
      "section_type": "top_career_1",
      "career_title": "Product Manager",
      "custom_resume_id": "uuid"
    }
  ],
  "include_cover_letter": true,
  "user_overrides": { "phone": "...", "linkedin": "..." },
  "template_id": "ats-classic"
}
```

The signed `resume_file_url` is valid for 10 minutes — n8n needs to fetch it
within that window.

---

## Node-by-node

### 1. Webhook (trigger)
- **Type**: `n8n-nodes-base.webhook`
- **HTTP Method**: POST
- **Authentication**: Header Auth → header `x-shared-secret`, expected value
  is your `N8N_SHARED_SECRET`. (Or use a Code node to check the header
  manually and fail-closed if it mismatches.)
- **Response Mode**: "Immediately" with `{"received": true}` — we want the
  edge function to return fast; all updates flow back via Supabase Realtime.

Copy the production webhook URL into `N8N_CUSTOM_RESUME_WEBHOOK_URL`.

### 2. HTTP Request — fetch the résumé PDF
- **URL**: `={{ $json.body.resume_file_url }}`
- **Response Format**: File / Binary
- Property: `data`

### 3. Extract from File — PDF to text
- **Operation**: Extract Text from PDF
- **Binary Property**: `data`

### 4. Code — preserve original payload
A small Code node that fans out the original webhook payload alongside the
extracted text so subsequent nodes have both.

```js
return [{
  json: {
    ...$('Webhook').first().json.body,
    resume_text: $input.first().json.text || '',
  },
}];
```

### 5. OpenAI — Deep résumé parse
- **Model**: `gpt-4o` (or equivalent)
- **Response Format**: JSON object
- **System prompt**:

```
You extract a structured résumé from raw text. Output ONLY a JSON object
matching this schema exactly:

{
  "contact": { "name": "", "title": "", "email": "", "phone": "",
               "location": "", "linkedin": "", "portfolio": "" },
  "summary_raw": "",
  "experience": [
    { "title": "", "company": "", "location": "", "start": "", "end": "",
      "current": false, "bullets": ["", "", ...] }
  ],
  "education": [
    { "institution": "", "degree": "", "field": "", "location": "",
      "start": "", "end": "" }
  ],
  "skills": { "technical": [], "soft": [], "tools": [], "languages": [] },
  "certifications": [ { "name": "", "issuer": "", "year": "" } ]
}

Rules:
- Never invent facts. If a field isn't in the text, return an empty string
  or empty array.
- Dates as the candidate wrote them ("Jan 2022", "2020", etc.). Don't
  normalise.
- For each experience row, lift every bullet point as-is into "bullets".
- "current": true only if the text clearly says "Present", "Current", or no
  end date is given for the latest role.
```

- **User message**:

```
{{ $json.resume_text }}
```

### 6. Code — merge user overrides into contact
```js
const parsed = JSON.parse($input.first().json.message.content);
const overrides = $('Webhook').first().json.body.user_overrides || {};
parsed.contact = { ...parsed.contact, ...Object.fromEntries(
  Object.entries(overrides).filter(([_, v]) => v && v.trim())
)};
return [{ json: { resume_full_data: parsed } }];
```

### 7. Supabase — persist resume_full_data
- **Operation**: Update Row
- **Table**: `profiles`
- **Match**: `id = {{ $('Webhook').first().json.body.user_id }}`
- **Columns**:
  - `resume_full_data`: `={{ JSON.stringify($json.resume_full_data) }}`
  - `resume_full_data_extracted_at`: `={{ new Date().toISOString() }}`

### 8. Code — fan out per career
This turns the single resume_full_data input into N items (one per career).

```js
const resume = $('merge user overrides into contact').first().json.resume_full_data;
const body = $('Webhook').first().json.body;
const careers = body.selected_careers || [];
return careers.map((c) => ({
  json: {
    ...body,
    career: c,
    resume_full_data: resume,
  },
}));
```

### 9. Split In Batches (size 1) — process each career
The downstream nodes execute per career.

### 10. Supabase — fetch career narrative
- **Operation**: Get Row
- **Table**: `report_sections`
- **Match**: `id = {{ $json.career.section_id }}`
- Returns the row containing the "Why this role fits you" narrative for the
  selected career.

### 11. Supabase — fetch enriched_jobs
- **Operation**: Get Many
- **Table**: `enriched_jobs`
- **Filter**: `career_title = {{ $json.career.career_title }}`
- (Fall back gracefully if no match — many narrative careers won't have an
  enriched_jobs row.)

### 12. Supabase — fetch personality sections
- **Operation**: Get Many
- **Table**: `report_sections`
- **Filter**: `report_id = {{ $json.report_id }} AND section_type IN ('approach','strengths','values','init_summary')`

### 13. Code — build keyword list
```js
const enriched = $('fetch enriched_jobs').first()?.json || {};
const keywords = new Set();

(enriched.technical_skills || []).forEach(k => keywords.add(k));
(enriched.soft_skills || []).forEach(k => keywords.add(k));
(enriched.typical_tasks || []).forEach(k => keywords.add(k));
(enriched.certifications_requirements || '').split(/[,;\n]/).forEach(k => {
  const trimmed = k.trim();
  if (trimmed) keywords.add(trimmed);
});

return [{ json: { ...$json, keywords: Array.from(keywords).slice(0, 25) } }];
```

### 14. OpenAI — Résumé content generation
- **Model**: `gpt-4o`
- **Response Format**: JSON object
- **System prompt**:

```
You re-frame a candidate's existing résumé toward a specific target career.

NEVER invent facts. NEVER add experience the candidate doesn't have. Your job
is to choose which existing bullets to lift, re-order them, and rewrite the
summary so the résumé tells the strongest possible story for THIS target.

Output ONLY a JSON object matching this schema:

{
  "contact": { ... },          // copy from input unchanged
  "summary": "",               // 3-4 sentences, written in the voice cues provided
  "experience": [
    { "title": "", "company": "", "location": "", "start": "", "end": "",
      "current": false, "bullets": ["", ...] }
  ],
  "skills_grouped": {
    "technical": [], "tools": [], "soft": [], "languages": []
  },
  "education": [...],          // copy unchanged
  "certifications": [...],
  "highlights": ["", "", ""]   // 2-3 standout one-liners pulled from experience
}

Rules:
- Keep every role the candidate held. Don't drop history.
- Within each role, re-order bullets to lead with what matters for the
  target career. You can rewrite phrasing (active voice, quantify if the
  number is already in the source) but never fabricate metrics.
- Skills: distribute into technical / tools / soft / languages buckets,
  prioritising overlap with the keyword list.
- Summary: lead with the candidate's strongest claim to the target role,
  written in the voice cues. Avoid clichés ("results-driven", "passionate").
```

- **User message**:

```
TARGET CAREER: {{ $json.career.career_title }}

WHY-SUITED NARRATIVE (from their assessment, optional):
{{ $('fetch career narrative').first()?.json?.content || 'Not available.' }}

PERSONALITY VOICE CUES:
{{ $('fetch personality sections').first()?.json?.content || '' }}

MUST-INCLUDE KEYWORDS (try to land these):
{{ JSON.stringify($json.keywords) }}

CANDIDATE'S CURRENT RÉSUMÉ (JSON):
{{ JSON.stringify($json.resume_full_data) }}
```

### 15. OpenAI — ATS optimisation pass
- **Model**: `gpt-4o-mini` (cheaper is fine for this pass)
- **Response Format**: JSON object
- **System prompt**:

```
You score a tailored résumé for ATS-readiness and tighten any weak phrasing.

Output ONLY:

{
  "resume_json": { ... },                 // the polished résumé
  "ats_score": 0-100,                     // overall ATS-readiness score
  "keyword_coverage": {
    "hit": [...],                         // keywords from the must-include
                                          // list that appear in the resume
    "missing": [...]                      // keywords that should ideally
                                          // appear but don't yet
  }
}

Scoring rubric (out of 100):
- 40 pts: keyword coverage (rough proportion of must-include keywords hit)
- 20 pts: action verbs at start of bullets, active voice
- 20 pts: quantified impact where the source supports it
- 10 pts: section headers present and standard
- 10 pts: contact info complete (email, phone, location at minimum)

Rules:
- Improve phrasing freely (strip passive voice, remove fluff) but NEVER
  introduce new facts or change dates / titles / companies.
- If a must-include keyword is core to the role but absent from the
  candidate's actual background, leave it in "missing" — don't fake it.
```

- **User message**:

```
KEYWORDS TO COVER:
{{ JSON.stringify($json.keywords) }}

CANDIDATE-TAILORED RÉSUMÉ:
{{ $('Résumé content generation').first().json.message.content }}
```

### 16. IF — include_cover_letter is true
Routes to the cover-letter LLM if requested, otherwise skips it.

### 17. OpenAI — Cover letter (optional)
- **Model**: `gpt-4o`
- **Response Format**: JSON object
- **System prompt**:

```
Write a tailored cover letter for the target role. Output ONLY:

{
  "greeting": "Dear Hiring Team,",   // or similar — no fake names
  "opening": "",                     // 1 paragraph — why this role, what
                                     // the candidate brings
  "body_paragraphs": ["", ""],       // 1-2 paragraphs — evidence from their
                                     // history, framed for THIS role
  "closing": ""                      // 1 short paragraph — next-step ask
}

Rules:
- 3-4 paragraphs total. Tight. Hiring managers skim.
- Pull specific examples from the résumé — names of companies, projects.
- Voice should match the personality cues provided.
- Never say "I am writing to apply for...". Lead with substance.
```

- **User message**:

```
TARGET CAREER: {{ $json.career.career_title }}

WHY-SUITED NARRATIVE:
{{ $('fetch career narrative').first()?.json?.content || '' }}

PERSONALITY VOICE CUES:
{{ $('fetch personality sections').first()?.json?.content || '' }}

TAILORED RÉSUMÉ:
{{ $('ATS optimisation pass').first().json.message.content }}
```

### 18. Code — assemble the update payload
```js
const ats = JSON.parse($('ATS optimisation pass').first().json.message.content);
const coverItem = $('Cover letter (optional)').first();
const cover = coverItem ? JSON.parse(coverItem.json.message.content) : null;

return [{
  json: {
    custom_resume_id: $json.career.custom_resume_id,
    resume_json: ats.resume_json,
    cover_letter_json: cover,
    ats_score: ats.ats_score,
    keyword_coverage: ats.keyword_coverage,
  },
}];
```

### 19. Supabase — update the custom_resumes row
- **Operation**: Update Row
- **Table**: `custom_resumes`
- **Match**: `id = {{ $json.custom_resume_id }}`
- **Columns**:
  - `resume_json`: `={{ JSON.stringify($json.resume_json) }}`
  - `cover_letter_json`: `={{ $json.cover_letter_json ? JSON.stringify($json.cover_letter_json) : null }}`
  - `ats_score`: `={{ $json.ats_score }}`
  - `keyword_coverage`: `={{ JSON.stringify($json.keyword_coverage) }}`
  - `status`: `'completed'`
  - `updated_at`: `={{ new Date().toISOString() }}`

### 20. Error workflow
Wire the workflow's "Error Workflow" setting to the existing **Error
Handler** workflow (ID `FbsruPbuZI2Fgtc8`). Inside the error workflow, also
update the affected `custom_resumes` row to `status='failed'` so the user's
UI surfaces the failure instead of spinning forever.

---

## End-to-end test

1. With the workflow active, log in as a test user with a completed report
   and an uploaded résumé.
2. Navigate to **Dashboard → Tailor your résumé** (requires 2 referrals to
   be unlocked — use a test account with referrals seeded if needed, or
   temporarily flip the feature flag).
3. Pick 1–3 careers and a template. Click Generate.
4. The wizard transitions to the results view with a tab per career, each
   showing "Tailoring your résumé…".
5. Within ~30–40 seconds, each card flips to a live PDF preview with an ATS
   score badge and download buttons.

If a card stays in "Tailoring…" for more than 2 minutes, check the n8n
execution log for that workflow run.

---

## Cost estimate (per generation)

For one user generating tailored résumés for 3 careers with cover letters:

- 1× deep résumé parse (gpt-4o): ~$0.02
- 3× résumé content gen (gpt-4o): ~$0.06
- 3× ATS pass (gpt-4o-mini): ~$0.01
- 3× cover letter (gpt-4o): ~$0.05
- **Total: ~$0.14 per user-generation**

Switching to Claude Sonnet 4.5 is comparable. Switching résumé content gen
to gpt-4o-mini cuts the total to ~$0.05 with quality tradeoff.
