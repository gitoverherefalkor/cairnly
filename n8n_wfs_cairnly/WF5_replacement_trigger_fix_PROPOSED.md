# WF5 (Cairnly Coach) — make career replacement OPT-IN only (PROPOSED)

**Status:** proposed, NOT applied. Needs Sjoerd's explicit go-ahead before editing WF5 in
the n8n editor (existing production workflow `h7ie9zN080IM2g7N`). Export current state to
`n8n_wfs_cairnly/` before touching it.

## The bug (observed 2026-07-03, report 4ea66020 / sjn.geurts)

User was on the outside-the-box section and typed:

> "nah. ive tried life science space before and found it frustrating in terms of privacy,
> liability and sales cycles. next section please"

That is **feedback + a move-on signal** — NOT a request to swap a career. The coach instead:
1. Fabricated a brand-new career ("Interactive Exhibition & Brand Experience Designer"),
2. Passed it to WF6 as a new-career `explore` payload,
3. Told the user "we've swapped that recommendation out … you'll see that reflected in your
   dashboard."

WF6 then rewrote outside-the-box **card #3's body** to the fabricated role. Two things broke:
- The replacement is **coach-invented**, not a scored/matched career from the WF2→WF3
  pipeline, but it renders on the dashboard identically to the ones that are.
- WF6 rewrote the **body but not the title column**, so the live card was self-contradictory
  (title "Experience Design Director (Digital Health…)", body "…we've replaced the digital
  health direction … Interactive Exhibition …"). *(The card body has since been restored to
  the original by hand; this doc fixes the trigger so it can't recur.)*

## Root cause
The prompt allows replacement careers ("suggest replacement careers when asked",
`explore` = "new career replacement", "Generate 800+ words … when the user explicitly
requests a complete NEW career to replace an existing one"), but there is **no hard guard**
stopping the coach from treating ordinary negative feedback / a "next section" as a
replacement request. So it self-triggered a swap the user never asked for.

## Proposed prompt change (in `Cairnly Coach Agent` → `options.systemMessage`)

### 1. Add a new hard-rule block (place it right above `# WF6 - feedback processing TOOL — when to call`)

```
# REPLACEMENTS ARE OPT-IN ONLY (read before ever generating a new career)
Only generate a replacement career, or put a new career into WF6's `explore` field, when the
user has EXPLICITLY asked to swap or replace a specific pick this section. Explicit =
"replace this one", "swap X for something else", "give me a different runner-up", "can you
change this pick". 

Disliking a role, sharing a bad past experience with a sector, or saying "next section" is
NOT a replacement request. It is feedback. For feedback WITHOUT an explicit swap request:
- Acknowledge it genuinely and briefly.
- Call WF6 with a `feedback` summary ONLY (concern → resolution). Leave `explore` EMPTY.
- Point the user to the Continue button.
- Do NOT invent a new role, do NOT say a card was swapped, and do NOT tell the user their
  dashboard now shows a different career.

When unsure whether they want a swap, ASK, do not assume:
"Want me to swap this pick for a different direction, or just note that and move on?"

Even when a swap IS explicitly requested: per CAREER SUGGESTION REQUESTS below, you brainstorm
directions in prose and frame them as ideas from the chat, not scored matches. Only route a
full replacement to WF6 `explore` when the user has clearly said "yes, replace it".
```

### 2. Tighten the `explore` parameter description (in `## WF6 parameters`)
Change:
```
- explore (max 300 words for deep dives; no limit for new careers):
  YOUR generated content if a deep dive or new career replacement was
  provided. Leave empty otherwise.
```
to:
```
- explore (max 300 words for deep dives; no limit for new careers):
  YOUR generated content ONLY for (a) a deep dive the user asked for, or (b) a new career the
  user EXPLICITLY asked to swap in (see REPLACEMENTS ARE OPT-IN ONLY). Leave empty for plain
  feedback / disagreement / "next section" — those get a `feedback` summary and nothing in
  `explore`.
```

### 3. Reinforce in `# RESPONSE LENGTH`
Change "Generate 800+ words ONLY when the user explicitly requests a complete NEW career to
replace an existing one." →
"Generate 800+ words ONLY when the user has EXPLICITLY asked to replace a specific career this
section (see REPLACEMENTS ARE OPT-IN ONLY). Never generate a replacement off the back of
feedback or a move-on signal alone."

## Replacement UX: explicit trigger + MANDATORY caveat

A replacement career is fundamentally different from the other cards: it is written by the
chat model from the current report + conversation, and it never went through the scored
matching pipeline (WF2 enrichment → WF3 scoring/AI-impact/path-type). The user must be told
this, clearly, every time. Two pieces:

### A. Make the trigger an explicit action, ideally a button (recommended)
Relying on the model to detect "explicit ask" from free text is what failed here. Cleaner:
add a per-card action in the outside-the-box / career cards, e.g. **"Suggest a different
direction"**. Clicking it is the unambiguous opt-in — no intent-guessing. Free-text explicit
asks ("swap this pick") still work, but the button is the primary, safe path. The button
click can carry a one-line confirm that states the caveat up front (see B) so the user opts
in with eyes open.

### B. The caveat must appear in TWO places, every time
1. **In the coach's chat reply** when it offers or delivers a replacement. Required wording,
   in substance:
   > "Heads-up: this suggestion is generated from your report and our conversation, not the
   > scored matching that produced your other cards. Treat it as a strong lead to explore,
   > not a ranked match."
2. **On the card itself, permanently** (so it survives after the chat scrolls away and shows
   on the dashboard). Best done as a small badge, not just body text that can be missed:
   - WF6 sets a metadata flag on the replacement card, e.g. `metadata.origin =
     "chat_replacement"` (and leaves `score` null, which these already are).
   - The frontend renders a compact caveat pill on any card with that flag, e.g.
     **"Chat-generated · not scored"** with the fuller sentence on hover/expand.
   - This is a small, self-contained frontend change (CareerScoreCard / card header) that
     Claude can build once the WF6 flag is agreed. Until then, WF6 can prepend a one-line
     italic caveat to the card body as a stop-gap.

### C. Prompt wording to add (under REPLACEMENTS ARE OPT-IN ONLY)
```
When you DO deliver an explicitly-requested replacement, you MUST state the caveat in your
reply: the suggestion comes from their report and this conversation, not the scored matching
pipeline that produced their other cards, so it is a lead to explore, not a ranked match.
Never present a replacement as if it were a scored match. Pass metadata.origin =
"chat_replacement" through to WF6 so the card is labelled as chat-generated on the dashboard.
```

## Secondary finding for WF6 (note, not part of this WF5 change)
When WF6 *does* apply an approved replacement, it rewrote `content` but not the `title`
column, leaving a title/body mismatch. If we keep the replacement feature, WF6 should update
the section `title` (and any header inside `content`) together, or the card ends up
self-contradictory. Flag for a separate WF6 pass.

## Test (after applying WF5)
Re-run a chat to the outside-the-box (or any career) section and type a dislike + "next
section please" with NO explicit swap ask. Expected: coach acknowledges, notes the feedback,
points to Continue, and the report cards are UNCHANGED. Then explicitly ask "swap this pick
for something else" and confirm the replacement path still works end-to-end.
