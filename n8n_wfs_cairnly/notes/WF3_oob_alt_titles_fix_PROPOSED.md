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

## Fix part 3 — sync the AI-impact subsection wording with WF4 (top-3 / runner-ups)

### Why
The OOB card and the top-3 / runner-up cards write their AI-impact subsection
**differently**, so identical-looking sections read inconsistently:

| Source | Subheader | Rating lead-in |
|--------|-----------|----------------|
| OOB (WF3) | `AI Impact on this role` | `Moderate: …` (bare rating + colon) |
| Top-3 / runner-ups (WF4) | `How AI will impact this role` | `AI Impact Rating: Moderate` |

(Verified live 2026-07-01: OOB `outside_box` sections render `<h5>AI Impact on this
role</h5>` then `Moderate: …`; WF4 `top_career_*` sections render `<h5>How AI will impact
this role</h5>` then `AI Impact Rating: <Level>`.)

Two problems this caused:
1. **Text labels out of sync** — same concept, two different headers, on cards that sit
   side by side in the same report.
2. **A phantom inline pill on OOB only** — the frontend used to surface a small AI-impact
   badge at the top of any paragraph that LED with a bare rating. `Moderate:` (OOB) matched
   that pattern; `AI Impact Rating: Moderate` (WF4) did not. So OOB cards showed an extra
   inline pill the top-3 cards never did. (The frontend inline badge has since been removed
   — the header CareerScoreCard pill is now the single source of truth for every card — so
   this is no longer a rendering bug. The wording sync below is still worth doing so the two
   card families read identically.)

### Fix — in the OOB narrative prompt (the node that writes the outside-the-box card body)
Change the AI-impact subsection so it matches WF4 exactly:

- **Subheader:** `How AI will impact this role`  (was `AI Impact on this role`)
- **Lead-in line:** `AI Impact Rating: [Level]`  (was a bare `[Level]:`)

where `[Level]` stays on the existing OOB scale (Minimal / Low / Moderate / High / …).
So the OOB card should emit, e.g.:

```
<h5>How AI will impact this role</h5>

AI Impact Rating: Moderate

AI accelerates narrative generation, puzzle logic testing, and concept visualization, but …
```

> ⚠️ WF4's own rating lead-in is itself inconsistent in older data (`Rating: Moderate.`,
> `Augmented (Moderate Impact):`, and free-form prose all appear). The canonical form we're
> standardizing on is **`AI Impact Rating: [Level]`** — the most common current WF4 output.
> If you're also touching WF4 in the same pass, nudge its prompt to emit that exact lead-in
> for full consistency; if not, at minimum bring OOB in line with it here.

## Test
After applying, re-run a clustered profile (e.g. Prins, report
`bf86828c-74f1-4f65-a334-36e048487a14`) via the Ops "Re-run a report" button and check:
1. no OOB pick echoes a presented title or its alternates (parts 1–2), and
2. the OOB AI-impact subsection now reads `How AI will impact this role` +
   `AI Impact Rating: [Level]`, matching the top-3 / runner-up cards (part 3).
