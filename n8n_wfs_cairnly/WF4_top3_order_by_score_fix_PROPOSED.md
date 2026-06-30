# WF4 — sort the top-3 by score so rank tracks the score (PROPOSED)

**Status:** proposed, NOT applied. Apply in the n8n editor.
⚠️ Verify the live `Split Top3` node matches this before editing — the other session
has been changing WF3/WF4, so the live node may differ from the repo export.

## Why
In WF4 the top-3 slots are assigned **by position**, not by score, and the score is
**LLM-generated** (`Split Top3` parses `"Compatibility score: N/100"` out of each
career's narrative). So career #3 in the model's output is always stamped
`top_career_3` even if the model gave it a higher score than #2. Real example
(sjn.geurts@gmail.com, today's re-run): top_career_1=93, top_career_2=87,
**top_career_3=91** — #3 outscores #2. Users read rank as "best match first", so this
looks broken.

## Fix — WF4 node `Split Top3`
At the very end of the node, replace the hard-coded 3-element return array with a
score-sorted version. Find this (the parse + return):

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

Replace with:

```js
const career1 = parseCareer(meta1.cleanedText);
const career2 = parseCareer(meta2.cleanedText);
const career3 = parseCareer(meta3.cleanedText);

// Sort the three by compatibility score DESCENDING so the slot number always tracks
// the displayed score. The score is written by the LLM per career and is not
// guaranteed to descend with output order, so without this top_career_3 can outscore
// top_career_2. Null/unparsed scores sort last. Ties keep model order (stable sort).
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

Safe because the slot label the user sees ("your second top career match") is added at
delivery time from `section_type`, not baked into the narrative — so promoting a career
from slot 3 to slot 2 just relabels it; the text travels with it.

## Note (deeper, optional)
The displayed score is the **LLM's** number, not WF3's compatibility score that drove
selection. This fix makes the *display* self-consistent (slot matches the shown score).
If you'd rather rank strictly by WF3's real compatibility score, that's a separate
change (thread WF3's score through instead of parsing the LLM's). For now, sorting by
the shown score removes the visible inversion.

## Test
Re-run an affected report via the Ops "Re-run a report" button (e.g.
sjn.geurts@gmail.com) and confirm top_career_1 ≥ top_career_2 ≥ top_career_3 by score.
