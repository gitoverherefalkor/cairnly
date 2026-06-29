# WF3 outside-the-box — feed alternate titles into the no-doubles rule (PROPOSED)

**Status:** proposed, NOT applied (n8n unreachable from web sessions). Apply in the
n8n editor and test one run.

## Why
The OOB step generates free-text titles; the only guard against overlap is the
"Already Presented" list (input 3 = `shortlist_careers` = title/company/RID only).
Alternate titles are never shown to it. So Prins's re-run produced "Program Director
(Social Enterprise/Impact NGO)" — which is an **alternate title of the already-presented
"Senior Program Manager, Social Impact"** (alts: Director of Programs, Program Director,
Impact Programs Manager). It slipped past the no-doubles rule because the model never
saw the alts. `enriched_jobs.alternate_titles` is already pulled by "Pull enriched"
(`select=*`); it just isn't threaded into the prompt.

## Fix part 1 — data: expose every enriched career's title + alternate titles
Add a **Code node** named `Build covered titles`, wired into the chain anywhere after
"Pull enriched" and before "Set Outside Box Prompt". jsCode (Run Once for All Items):

```js
// "Already considered" namespace for the OOB prompt: each suitable-15 career's
// main title + its alternate titles, so OOB can't echo a presented role's alt
// (e.g. "Program Director" is an alt of "Senior Program Manager, Social Impact").
const enriched = $('Pull enriched').all().map(i => i.json);
const covered = enriched
  .filter(c => c && c.career_title)
  .map(c => {
    let alts = c.alternate_titles;
    if (typeof alts === 'string') { try { alts = JSON.parse(alts); } catch { alts = []; } }
    if (!Array.isArray(alts)) alts = [];
    return { title: c.career_title, alternate_titles: alts };
  });
return [{ json: { covered_titles: JSON.stringify(covered, null, 2) } }];
```

(`career_title` and `alternate_titles` are real `enriched_jobs` columns, so this is
robust. Verify "Pull enriched" is resolvable by name from the new node — it should be.)

## Fix part 2 — prompt: in "Set Outside Box Prompt"

### Add a new input, right after input 3 (`# INPUTS` block):
```
- **3b. Titles already considered, WITH their alternate titles. Your 3 picks must NOT match or closely echo ANY of these, including the alternates.**
{{ $('Build covered titles').first().json.covered_titles }}
```

### Replace SELECTION PRINCIPLE 6 (Hard Divergence) with:
```
6. **Hard Divergence from Presented Roles:** None of the 3 options may match, or be a
   near-synonym of, any title in the "Already Presented" list OR its alternate titles
   (input 3b), and none may share BOTH the primary sector AND the primary function of a
   presented role. Alternate titles count as already-covered. Example: if "Senior Program
   Manager, Social Impact" is presented with alternates "Director of Programs / Program
   Director / Impact Programs Manager", then "Program Director at an impact NGO" is NOT
   outside the box — reject it and pick a genuinely different lane.
```

## Test
After applying, re-run a clustered profile (e.g. Prins, report
`bf86828c-74f1-4f65-a334-36e048487a14`) via the Ops "Re-run a report" button and check
that no OOB pick echoes a presented title or its alternates.
