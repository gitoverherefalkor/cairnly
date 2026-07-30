# WF4 — Dream Job Feasibility: Credential Reality dimension

**Workflow:** WF4 - Career selection NL/EN (`seWmQPFQqIe60TkU`)
**Node:** `Dream Job Feasibility`
**Backup:** `WF4 - Career selection NL_EN_LIVE_BACKUP_pre_credential_20260730.json`
**Updated export:** `WF4 - Career selection NL_EN.json`

Prompt-only change, one node. No rewiring, no new nodes, no upstream changes.
Output contract is untouched: the five rating labels, `---DREAM_JOB_SPLIT---` and
the `<!--move:-->` comment all stay exactly as they were, so `parseDreamJob` and
the frontend need no changes.

## Why

Field of study `[1g]` was collected but never reached either feasibility gate.
WF3's Feasibility Penalty cites only `1h, 1j, 1l`; this node referenced neither
`[1f]` nor `[1g]`. So a dream job could be rated "Retrain" for someone who already
holds the exact credential that field gates on.

Two guardrails, both deliberate:

1. **Gating credentials only.** A licensed field (law, medicine, psychotherapy,
   accountancy, teaching, chartered engineering) is a real barrier and does not
   decay. A general business or tech degree is not a barrier and must not move the
   rating. This keeps the change from turning into "your degree decides your report."
2. **No degree-age speculation.** No graduation date is collected anywhere — not in
   the survey (Q6 is level, Q7 is subject, neither dated) and not in WF0's resume
   extraction. Any "your degree is outdated" reasoning would be the model guessing,
   so the prompt forbids it outright.

Deliberately **not** changed: WF3's Feasibility Penalty. Adding the degree there
would push the Top 3 toward the obvious, and for most people the degree is already
encoded in their career history, which the ranking already weights.

## How to apply

Paste as three separate insertions rather than replacing the whole prompt, so any
edits made in the editor since the last export are preserved.

### 1. New analysis dimension

Directly **after** the `4. **Path Type Reality:** ...` paragraph and **before**
`**TONE:**`, insert a blank line then:

```
5. **Credential Reality (gating credentials only):** Check the candidate's education level [1f] and field of study [1g] in Input 5 against what the dream field actually gates on.
   - A GATING credential is one a person cannot legally or practically be hired without: law, medicine, psychotherapy, accountancy, teaching, chartered or professional engineering, and similar licensed fields. Relevance does not fade with time; the licence is the barrier.
   - A NON-GATING degree (most business, communications, marketing and general technical degrees) is background color only. It must NOT move the Feasibility Rating or the Move tag.
   - If they ALREADY hold the gating credential for the dream field, say so plainly and let it raise the Feasibility Rating and the Move tag. A gated field they are already credentialed for is rarely "Retrain".
   - If the dream field gates on a credential they do NOT hold, name that credential as the concrete barrier, in both the Feasibility Rating reason and the Steps section.
   - NEVER speculate about how old a degree is. No graduation date is collected anywhere, so you cannot know it. Do not call a degree "outdated", "recent", or "no longer relevant". Judge ONLY whether the credential gates the field.
```

### 2. Steps bullet

Under `**Steps for Pursuing This Role**`, replace bullet 2.

Find:
```
- [Bullet 2: Critical certification or education required in the European market]
```
Replace with:
```
- [Bullet 2: Critical certification or education required in the European market. If Input 5 shows they already hold it, say that instead of listing it as a to-do]
```

### 3. Extraction guard + new input

At the end of the `# EXTRACTION GUARD (critical)` paragraph, before `# INPUTS`, add:

```
Input 5 is the candidate fact sheet. Use it ONLY for education level [1f], field of study [1g] and certifications. NEVER treat a title appearing in it as a dream job.
```

At the end of the `# INPUTS` list, after input 4, add:

```
5. Candidate fact sheet (education level [1f], field of study [1g], certifications - credentials ONLY, never a source of dream jobs)
{{ $('When Executed by Another Workflow').first().json.init_summary_content }}
```

The `init_summary_content` expression is the same pattern `T3 Careers Prompt` and
`Set Runner Up Prompt` already use, so it is known to resolve on this trigger.

## Verifying

Re-run a report for someone with a licensed-field degree and check that the dream
job section names the credential. Then re-run one with a general business degree and
confirm the rating did **not** move because of it.

## Rolling back

Re-import `WF4 - Career selection NL_EN_LIVE_BACKUP_pre_credential_20260730.json`,
or remove the three insertions above.
