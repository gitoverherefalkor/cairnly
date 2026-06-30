# WF4 fixes (PROPOSED) — (1) sort top-3 by score, (2) split "Alignment", (3) runner-up distinction note

**Status:** proposed, NOT applied. Apply all three in the n8n editor in one WF4 pass.
⚠️ Verify the live `Split Top3` / `T3 Careers Prompt` / `Set Runner Up Prompt` nodes match
these before editing — the other session has been changing WF3/WF4, so the live nodes may
differ from the export.

---

## Change 1 — sort the top-3 by score (node `Split Top3`)

### Why
The top-3 slots are assigned **by position**, not by score, and the score is
**LLM-generated** (`Split Top3` parses `"Compatibility score: N/100"` out of each career's
narrative). So career #3 in the model's output is stamped `top_career_3` even if its score
is higher than #2. Real example (sjn.geurts, re-run): 93 / 87 / 91 — #3 outscored #2.

### Fix
At the end of `Split Top3`, replace the hard-coded 3-element return array:

```js
const career1 = parseCareer(meta1.cleanedText);
const career2 = parseCareer(meta2.cleanedText);
const career3 = parseCareer(meta3.cleanedText);

return [
  { json: { title: career1.title, alternate_titles: career1.alternate_titles, company_size_type: career1.company_size_type, content: career1.content, score: career1.score, metadata: meta1.metadata, report_id: reportId, section_type: "top_career_1", order_number: 1, language: __lang } },
  { json: { title: career2.title, alternate_titles: career2.alternate_titles, company_size_type: career2.company_size_type, content: career2.content, score: career2.score, metadata: meta2.metadata, report_id: reportId, section_type: "top_career_2", order_number: 2, language: __lang } },
  { json: { title: career3.title, alternate_titles: career3.alternate_titles, company_size_type: career3.company_size_type, content: career3.content, score: career3.score, metadata: meta3.metadata, report_id: reportId, section_type: "top_career_3", order_number: 3, language: __lang } }
];
```

with:

```js
const career1 = parseCareer(meta1.cleanedText);
const career2 = parseCareer(meta2.cleanedText);
const career3 = parseCareer(meta3.cleanedText);

// Sort by compatibility score DESCENDING so the slot number always tracks the displayed
// score. The score is written by the LLM per career and isn't guaranteed to descend with
// output order. Null/unparsed scores sort last; ties keep model order (stable sort).
const ranked = [
  { c: career1, metadata: meta1.metadata },
  { c: career2, metadata: meta2.metadata },
  { c: career3, metadata: meta3.metadata },
].sort((a, b) => (Number(b.c.score) || 0) - (Number(a.c.score) || 0));

return ranked.map((entry, i) => ({
  json: {
    title: entry.c.title,
    alternate_titles: entry.c.alternate_titles,
    company_size_type: entry.c.company_size_type,
    content: entry.c.content,
    score: entry.c.score,
    metadata: entry.metadata,
    report_id: reportId,
    section_type: `top_career_${i + 1}`,
    order_number: i + 1,
    language: __lang,
  },
}));
```

Safe: the "second/third match" label is added at delivery time from `section_type`, not
baked into the narrative.

---

## Change 2 — split "Alignment with your ambitions" into two paragraphs (node `T3 Careers Prompt`)

### Why
The subsection renders as one dense blob mixing short- and long-term. Split it into two
short paragraphs (short-term, then long-term) so it's scannable.

### Fix
In `T3 Careers Prompt`, find the `## Alignment with your ambitions` block and replace it
with:

```
## Alignment with your ambitions
[Write TWO short paragraphs separated by a blank line. NEVER merge them into one block.

Paragraph 1 (SHORT-TERM, 25-40 words): name their stated short-term goal and judge honestly how well this role serves it now.

Paragraph 2 (LONG-TERM, 25-40 words): name their stated long-term ambition, judge whether this role is a stepping-stone toward it, the destination itself, or a detour, and ALWAYS name the honest catch relative to that long-term ambition (finish line, or a bridge to it?).

Connect to their STATED goals, not their happiness pattern. Use the trajectory_fit reasoning from the enriched data if present.

Hard rules:
- Anchor on their stated short-term and long-term ambitions — NOT the sentiment/happiness scores.
- Do NOT reuse the "extends your X/10 [role]" pattern phrasing here. That belongs ONLY in "Why this role fits you."
- Factor their age and career stage [1c] into the honest read: a multi-year reskill or from-scratch pivot changes the calculus at an established stage (time, opportunity cost). Realistic and respectful — trade-offs and timing, not capability.
- Keep the two paragraphs separated by a blank line so they render as two paragraphs, never one block.]

Example:
"This serves your short-term goal of part-time income while you build your own business: the role gives you flexible income now.

Your long-term ambition is a business running on its own with you focused on strategy. Board work builds the network and deal-flow that make that real, so treat it as a 2-3 year platform, not the finish line."
```

---

## Change 3 — runner-up: name the distinction when it resembles a Top 3 role (node `Set Runner Up Prompt`)

### Why
Runner-ups are designed to sit adjacent to the top 3, so one can look like a near-duplicate
on the surface (e.g. runner-up "Part-Time AI Transformation Lead" next to top-1 "Fractional
AI Transformation Advisor"). That's fine, but the user shouldn't read it as the same role —
have the model name the key real distinction when there is one. Goes in "Why this role fits
you", NOT the Overview (the Overview must stay a pure role description per its own rule). The
prompt already receives `allCareers` (incl. the top 3), so it can compare.

### Fix
In `Set Runner Up Prompt`, in the `## Why this role fits you` block, bump the cap to 60-90
words and add a third (conditional) bullet:

```
## Why this role fits you

[60-90 words MAX, 1-2 short paragraphs. Assume the reader now knows what the role is from the Overview — do not re-describe the job here.]
- What's appealing about this role and why it suits their profile
- Why it's not Top 3 (be specific about the gap)
- IF this role looks, on the surface, a lot like one of their Top 3 matches (similar title, function, or domain — compare against the careers in allCareers), add ONE short clause naming the key REAL distinction so it doesn't read as a duplicate: e.g. employment model (at a company vs your own venture), role type or seniority (Lead vs Advisor, operator vs strategist), company size, or scope. Only when you can name a concrete difference from the data at hand; if the distinction would be vague or invented, skip it.
```

---

## Test (after applying all three)
Re-run an affected report via the Ops "Re-run a report" button (e.g. sjn.geurts@gmail.com)
and confirm:
1. top_career_1 ≥ top_career_2 ≥ top_career_3 by score,
2. "Alignment with your ambitions" renders as two paragraphs (short-term, then long-term),
3. where a runner-up resembles a top-3 role, "Why this role fits you" names the key
   distinction (and stays silent when there's no concrete one).
