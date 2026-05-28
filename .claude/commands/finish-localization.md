---
description: Continue Dutch localization. Reads LOCALIZATION_PLAN.md, finds the next unchecked phase, executes through to the next stop-gate, then updates status.
---

You are continuing the Dutch localization rollout for Cairnly. The single source of truth is `LOCALIZATION_PLAN.md` in the project root.

## Your job this session

1. **Read `LOCALIZATION_PLAN.md` first.** Do not assume you know what's in it — it gets updated every session.

2. **Find your starting point** in the `## Status` section:
   - The first unchecked `[ ]` item under "Pending ❌" is your phase.
   - If there are no unchecked items, the rollout is complete — report that and stop.

3. **Confirm with the user before starting.** Send a single message:
   - Which phase you're about to execute
   - The estimated session count from the plan
   - The first ⛔ gate you expect to hit
   - Ask: "Proceed?"

   Wait for confirmation. Do not start work until they say yes.

4. **Execute the phase Steps in order.** Read the phase's **Inputs** files first. Follow the **Steps** exactly. Use exact file paths from the plan.

5. **STOP at every ⛔ gate.** Never proceed past a gate without explicit user approval in this session. When you hit a gate:
   - State clearly which gate you've hit (quote the gate description from the plan)
   - Show the user what they need to review (diff, file contents, list of items)
   - Ask a specific question
   - Wait for response

6. **n8n autonomy rule (Phase 4 critical):**
   - **ADDING new nodes to a workflow** → do it freely via the n8n MCP / API. No approval needed.
   - **EDITING parameters of an existing node** → STOP. Show before/after diff. Get explicit per-node approval. The plan marks every such edit with ⛔.
   - Before ANY workflow change, export current JSON to `n8n_aa/<workflow>_BEFORE_localization_<YYYYMMDD>.json`.
   - Workflows stay inactive after edits. User activates manually in n8n UI.

7. **Run the phase ✅ Verification checklist** before marking the phase complete. If any item fails, do not check the phase off — report the failure and stop.

8. **Update `LOCALIZATION_PLAN.md` Status section** before ending the session:
   - Move completed phase from `Pending ❌` to `Done ✅` (with `[x]`)
   - If you hit a gate mid-phase and stopped, do NOT check the phase off — leave it pending with a brief inline note like `- [ ] Phase 2 — Pipeline plumbing (in progress: Steps 1–3 done, stopped at gate before Step 4)`

9. **Final report** in chat at end of session:
   - What phase/steps you completed
   - What gate (if any) is blocking next progress
   - Exact next action needed from the user
   - Estimated time/effort for the next `/finish-localization` run

## Constraints

- **Never modify `LOCALIZATION_PLAN.md` outside the Status section** without explicit user approval. The plan is the contract; status updates are bookkeeping.
- **Never edit n8n workflows without following the autonomy rule above.** When in doubt, ask.
- **Never flip the Dutch language toggle live** (i.e., never edit `supportedLngs` or `disabled: false` on the nl entry) without a gate confirmation, even if the plan says to. That's the launch moment — always confirm.
- **Never deploy edge functions in bulk** without listing them and getting batch approval. Per-CLAUDE.md rule: new function deploys OK, re-deploys of existing functions need approval.
- **Follow project CLAUDE.md** — including: no em-dashes in any user-facing Dutch text (in glossary), commit + push for visual review on small changes, large changes get a recap-then-execute flow.
- **Use Supabase MCP for migrations** (allowed without per-command approval per CLAUDE.md, since migrations are version-controlled).

## If the plan is unclear or stale

If you encounter something the plan doesn't cover (new code added since the plan was written, an edge function not listed, a workflow that doesn't match its documented structure):
1. STOP. Do not improvise.
2. Report what you found that the plan doesn't address.
3. Ask the user whether to (a) extend the plan first, then continue, or (b) skip and document as a follow-up.

Begin by reading `LOCALIZATION_PLAN.md`.
