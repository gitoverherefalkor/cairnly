# WF6 feedback-capture gap — fix + Scott backfill

**Why:** Scott's coach session (report `7f3b4815-9128-428d-91e1-ca437ec8d1fe`)
had real discussions on **top_career_1** and **top_career_2**, he advanced past
both, but WF6 never wrote feedback for them — `report_sections.feedback` is NULL,
untouched since report generation. His input lives only in `chat_messages`.

**Root cause:** Scott advanced by *typing* "Yes" / "Yes let's go", not clicking
the Continue pill. Two compounding gaps:
1. **Frontend** — those phrases weren't matched as an `advance` intent, so the
   background WF6 fire (which only runs on `intent==='advance'`) was skipped.
   ✅ FIXED in `src/components/chat/ChatContainer.tsx` (commit on branch
   `claude/modest-wozniak-dvsfdt`). Bare "yes"/"ok" deliberately left to the agent.
2. **WF5 prompt** — when those turns reached the agent as free text, its
   `FREE-TEXT ADVANCE` rule ("just point to the Continue button") swallowed the
   completion signal and it never called WF6. ⬇️ NEEDS THE PROMPT EDIT BELOW.

(Couldn't be applied from the web session: its network policy blocks outbound to
`falkoratlas.app.n8n.cloud`. Apply these from the n8n editor.)

---

## 1. WF5 (Cairnly Coach) system-prompt edit

Backup first: export the live WF5 to `n8n_wfs_cairnly/` before editing.

### Replace the `# FREE-TEXT ADVANCE` section with:

```
# FREE-TEXT ADVANCE
This applies ONLY to a CLEAN pass-through — the user has NOT discussed the
current section. If, with no prior discussion this section, the user types
"next", "continue", "let's move on" or similar, briefly acknowledge and point
them to the button:

"Sounds good. Click 'Continue to next section' below when you're ready to move on."

CRITICAL: If the user is signalling completion AFTER a real discussion of this
section — even a short "yes", "yes let's go", "sounds good", or a "yes" that
answers your own "ready to move on?" question — that is NOT a clean advance. You
MUST call WF6 - feedback processing with the discussion summary FIRST, then point
them to the Continue button. Never skip WF6 just because the confirmation was short.

Do NOT try to deliver section content yourself. You don't have those tools, and
the platform owns delivery. If they want to discuss something first, engage with that.
```

### In `# WF6 - feedback processing TOOL — when to call`, replace the "Completion signals" list with:

```
Completion signals (CALL WF6) — these apply whenever a discussion happened this
section, INCLUDING short confirmations that answer your own "ready to move on?":
- "looks good, let's continue"
- "yes", "yes let's go", "yep", "sounds good" — when they follow your
  "ready to move on?" or otherwise close out the discussion
- "I'm ready for the next one"
- "no more questions" / "let's move on"
- Explicit agreement after their concerns are resolved

If you asked "Ready to move on?" and the user agrees in ANY form, that is a
completion signal: call WF6 before anything else.
```

This resolves the tension between "FREE-TEXT ADVANCE → point to button" and
"completion signal → call WF6". Leave WF5 unpublished until you've eyeballed it.

---

## 2. Backfill Scott's two missed sections (re-run WF6)

His raw feedback is safe in `chat_messages`, so nothing is permanently lost — but
to get it into the report, WF6 must run for these two sections (it regenerates the
section `content` via Gemini; a plain SQL write would record the text but leave the
narrative — e.g. the Creative Dock "success" framing he corrected — wrong).

In the n8n editor, open **WF6 - Feedback processing NL/EN**, pin this input on the
"When Executed by Another Workflow" trigger, and Execute — once per section.

**top_career_1:**
```json
{
  "section_type": "top_career_1",
  "feedback": "User found the Innovation Project Manager match expected and confirmatory rather than novel, and wants later matches to build on his transferable cross-sector skills and personality. He has no degree, so experience is his main hiring signal, especially entering a new field. -> Reassured him the top-3 -> runner-ups -> outside-the-box sequence surfaces progressively more unexpected directions, and confirmed his breadth (Shell Woodcreek, ExxonMobil QR system, Creative Dock) travels across sectors when framed around results. User accepted and proceeded.",
  "explore": "",
  "report_id": "7f3b4815-9128-428d-91e1-ca437ec8d1fe",
  "first_name": "Scott"
}
```

**top_career_2:**
```json
{
  "section_type": "top_career_2",
  "feedback": "Chief of Staff resonates, but the user flagged work-life balance and boundaries as a genuine concern (a lower-ranked but still important priority). He prefers 'Director of Special Projects' as a closer fit: same high-complexity, cross-functional work, but a defined portfolio and better boundary control rather than owning the principal's entire operational life. -> Agreed; recorded Director of Special Projects as the preferred alternate framing and WLB/boundaries as a constraint to carry into the final report and any future role targeting.",
  "explore": "Compared Chief of Staff vs Director of Special Projects: CoS gives more proximity to leadership and a faster path to COO/GM but real always-on hours; Director of Special Projects keeps the high-complexity cross-functional work while giving a defined, self-managed portfolio and better boundary control, which fits his need for space to reset.",
  "report_id": "7f3b4815-9128-428d-91e1-ca437ec8d1fe",
  "first_name": "Scott"
}
```

**top_career_3** is still in active discussion (Innovation Consultant — boutique
over solo, plus the Creative Dock projects-were-failures caveat). Once he finishes
it, capture that too — it's the section where the Creative Dock honesty most needs
to land so the narrative stops implying those projects succeeded.
