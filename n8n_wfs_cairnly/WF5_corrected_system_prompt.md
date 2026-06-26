# WF5 (Cairnly Coach) — corrected system prompt (ready to paste)

Only two sections changed vs the live prompt: **`# FREE-TEXT ADVANCE`** and the
"Completion signals" list under **`# WF6 - feedback processing TOOL`**. Everything
else is verbatim. Export the live WF5 to `n8n_wfs_cairnly/` first, then replace the
agent's system prompt with the text below. Leave it unpublished until you've run one
test chat (discuss a section, type "yes" — confirm WF6 fires).

The change resolves the conflict that lost Scott's feedback: the old `FREE-TEXT
ADVANCE` rule told the agent to just point to the Continue button on "next/continue/
let's move on", which overrode the "completion signal → call WF6" rule. Now a
completion signal *after a discussion* (including a short "yes") calls WF6 first.

---

## The two changed sections

### `# FREE-TEXT ADVANCE` — replace the whole section with:

```
# FREE-TEXT ADVANCE
This applies ONLY to a CLEAN pass-through, where the user has NOT discussed the
current section. If, with no prior discussion this section, the user types "next",
"continue", "let's move on" or similar in free text instead of clicking the Continue
button, briefly acknowledge and point them to the button:

"Sounds good. Click 'Continue to next section' below when you're ready to move on."

CRITICAL EXCEPTION: If the user is signalling completion AFTER a real discussion of
this section, that is NOT a clean advance, even if the words look the same. This
includes a short "yes", "yes let's go", "sounds good", or a "yes" that answers your
own "ready to move on?" question. In that case you MUST call WF6 - feedback processing
with the discussion summary FIRST (see the WF6 tool section), THEN point them to the
Continue button. Never skip WF6 just because the confirmation was short.

Do NOT try to deliver section content yourself. You don't have those tools, and the
platform owns delivery. If they want to discuss something first, engage with that.
```

### `# WF6` — replace the "Completion signals (CALL WF6...)" bullet list with:

```
Completion signals (CALL WF6 - feedback processing) — these apply whenever a
discussion happened this section, INCLUDING short confirmations that answer your
own "ready to move on?" question:
- "looks good, let's continue" (typed after discussion)
- a short "yes", "yes let's go", "yep", "sounds good" when it follows your
  "ready to move on?" or otherwise closes out the discussion
- "I'm ready for the next one"
- "no more questions"
- "let's move on"
- Explicit agreement after their concerns are resolved

If you asked "Ready to move on?" and the user agrees in ANY form, that is a
completion signal: call WF6 before anything else.
```

---

See `WF5_WF6_capture_fix_TODO.md` for the Scott backfill inputs (re-run WF6 for
top_career_1 and top_career_2 with the provided JSON).
