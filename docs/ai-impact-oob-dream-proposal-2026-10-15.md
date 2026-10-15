# AI-impact pill on Outside-the-Box and Dream Job cards (2026-10-15)

Follow-up to `docs/ai-impact-pill-proposal-2026-10-15.md`. Investigation and offline rehearsal only:
nothing live was changed. Rehearsal script: `scripts/jev-ai-impact-oob-rehearse.mjs`.

## 1. In short

- **Outside-the-box (OTB):** the AI word is written by the LLM in WF3 `Outside Of Box Analysis`. Its
  prompt says "use ai_impact_rating from enriched data", but these careers have none, so it guesses.
  It guesses "Moderate" almost every time (38 of 42 cards).
- **Dream jobs:** the word sits inside a bullet in WF4 `Dream Job Feasibility`, in at least four
  different spellings. The chat hides the AI pill on dream cards on purpose, but the **dashboard
  accordion and the PDF do show it**. So today a dream card has a pill in one place and none in the
  other.
- **Proposal:** label the cards **after** the LLM writes them and **before** they are saved. One
  small call to the `ai-impact` function in a new "items" mode, then swap the word in the text. It
  can't be done before writing, because the LLM invents the OTB titles in the same call that writes
  the cards.
- **Rehearsal (14 Stuart reports, 42 OTB + 26 dream cards, $0.005):** with the title pin every
  repeated title gets the same label every time (7 of 7 OTB titles, 2 of 2 dream titles). Without
  the pin, Jev alone still wobbles on titles that sit right on a level boundary, even when the input
  is identical.

## 2. Where the label is made and read today

| | OTB (`outside_box`) | Dream (`dream_jobs`) |
| --- | --- | --- |
| Written by | WF3 `Set Outside Box Prompt` → `Outside Of Box Analysis`, section "AI Impact on this role" | WF4 `Dream Job Feasibility`, bullet 2 under "Industry Outlook & Regional Trends" |
| What the prompt says | Five levels plus "use ai_impact_rating from enriched data" (there is none) | Same five-level block; the bullet format is loose |
| Parsed by n8n | `Parse OOB`: splits the cards, turns headings into `<h5>`, keeps `move` and `company` comments. AI word stays prose only. | `Parse Dream`: same idea, `move` only |
| Saved as | `report_sections.content` (no AI field in `metadata`) | same |
| Shapes seen | "Rating: Moderate.", "**Moderate** -" | "AI Impact: High.", "AI Impact: **Moderate**:", "AI Impact Rating Scale: **High**", "AI Impact (Rating: High):" |
| Read by | `extractAIImpact()` in `CareerScoreCard.tsx`: chat cards, dashboard accordion (`bodyMetaFor`), quadrant chart, share card, PDF | Dashboard accordion and PDF: yes. Chat: **no**, `ChatMessage.tsx` hides it ("dream cards are Feasibility-only") |

## 3. Proposal

### 3.1 The change

1. **`ai-impact` function, new "items" mode** (same rules file, same title pin):
   `POST {items: [{key, title, overview?, company_size_type?, path_type?}], dry_run?}` →
   `[{key, level, rule, pinned}]`. No `report_id`, nothing written to `enriched_jobs`.
2. **Where the pin lives.** These cards aren't in `enriched_jobs`, so the pin needs a home. Proposal: a
   small table `ai_impact_pins (title_norm, ownership, level, confidence, model, source, created_at)`,
   one row per title + ownership, first one wins. On a lookup the items mode checks this table
   **and** `enriched_jobs.ai_impact_level`. That way a title that was a Top-15 career for someone
   else ("Conservation Technology Lead") shows the same pill when it shows up as an OTB card. This
   needs a migration file.
3. **WF3:** `Parse OOB` → new HTTP node `AI impact OOB (Jev)` → new Code node `Apply AI label` →
   `Insert OOB`. Items = title, the card's own "Overview" paragraph (about the job, not the person),
   company type from the `<!--company-->` comment, and path type from the first word of "Path Type
   & Reality". The Code node replaces the word in the "AI Impact on this role" line (or adds
   "Rating: X." when there isn't one) and puts `ai_impact` in `metadata`.
4. **WF4:** the same two nodes between `Parse Dream` and the insert. Items = title only (the dream
   "Overview" talks about the person, not the job). The Code node replaces the word in the
   "AI Impact" bullet.
5. **Prompt touch (optional, same edit):** in both prompts, replace "use ai_impact_rating from enriched
   data" with "the platform fills in the rating; describe what AI takes over and what stays human".
   That keeps the sentence from arguing with a word it didn't choose (see risk 1).

The frontend doesn't need to change: the swapped word sits where `extractAIImpact()` already looks.

### 3.2 Timing, cost, failure

- **When:** OTB runs inside WF3 in parallel with the scoring branch; `Wait for Ranking + OOB` only
  moves on when both are done, so the extra ~0.3 s almost never adds to the total time. Dream runs
  inside WF4, before the dream cards are saved.
- **Cost and time:** at most 6 Jev calls per report (3 OTB + up to 3 dreams), measured at $0.0002 per
  report, median 234 ms per call, run in parallel. Most calls disappear once the pin has the title.
- **If Jev fails:** the HTTP node continues on error and the Code node leaves the LLM's word alone, so
  the card looks exactly like today. The report is never blocked.
- **Old reports:** untouched.

### 3.3 Founders and the passion pick

The OTB passion pick is usually a founder (e.g. "Founder, Campervan Conversion Company"), so it
counts as own work: the leaders-and-owners ceiling doesn't apply and Jev's honest score is used. OTB
cards never go through `Ranking`, so the top-3 ban doesn't matter here. In the rehearsal the founder
cards came out Moderate, except one run where Jev said the work is hands-on enough for Minimal
(physical score 0.83, just over the 0.8 line). That's exactly the kind of flip the pin settles. One
catch: the pin compares exact titles, and the LLM varies them ("Campervan" vs "Camper Van", "Kit
Company", "Modular ..."), so those count as different titles. Collapsing spaces and punctuation in the
title key would catch "Campervan"/"Camper Van"; "Kit" and "Modular" stay separate titles, which is
fine.

## 4. Rehearsal numbers

Stuart, 14 reports from 13 to 15 October. "Today" = the word the frontend shows. "Jev" = the card's
title + overview (OTB) or title only (dream), with the production rules. "Pin" = first label per
title, reused afterwards.

**Outside-the-box (42 cards, 7 titles that repeat):**

| | Today | Jev | Jev + pin |
| --- | --- | --- | --- |
| Minimal / Moderate / High | 2 / 38 / 2 | 3 / 26 / 13 | 2 / 27 / 13 |
| Same title, same label everywhere | 6 of 7 | 6 of 7 | 7 of 7 |

Today's labels look stable, but only because the LLM says "Moderate" to almost everything. With Jev,
12 of 42 words change. The clearest case is Forward Deployed Engineer (AI Startup): Moderate today in
5 of 6 runs, High with Jev in all of them (an engineer who builds AI integrations: much of the
coding and configuration moves to AI). Conservation Technology Lead stays Moderate. Lead Game
Designer goes High when the card describes live-service content work.

**Dream jobs (26 cards, 2 titles):**

| | Today | Jev (title only) | Jev + pin |
| --- | --- | --- | --- |
| Moderate / High / unreadable | 15 / 5 / 6 | 25 / 1 / 0 | 26 / 0 / 0 |
| Same title, same label everywhere | 1 of 2 | 1 of 2 | 2 of 2 |

Wildlife Photographer flips between High and Moderate today (5 High, 5 Moderate). The LLM's "High"
reasoning is about market demand ("generated imagery is eroding stock sales"), which is exactly what
the chosen scale leaves out (it measures the work, not the number of jobs). Jev says Moderate every
time. Camper Van Designer got the exact same input 13 times and Jev said High once (score 1.50, right
on the line), which is why the pin is needed, not just nice to have. 6 of today's 26 dream cards have
a word the parser can't read, so they show no pill on the dashboard.

## 5. Risks

1. **Text that argues with the pill:** when the word changes, the sentence next to it was written for
   the old word. For example, the Wildlife Photographer text about shrinking stock sales would now
   sit under "Moderate". The optional prompt touch (3.1 point 5) prevents this for new reports.
2. **Frozen labels:** same as the Top 3. If the questions change, clear the pin table.
3. **New table + function redeploy + two workflow edits:** more moving parts than the Top-3 change.
   The function change is the risky one, because a push that touches `supabase/functions/`
   redeploys every function.
4. **The Code nodes edit card text.** If the LLM writes the AI section in a new shape, the swap
   finds no word and falls back to adding "Rating: X." at the start of the section. That's safe
   because the frontend reads either.

## 6. What Sjoerd must decide

1. **Dream jobs: should they have an AI pill at all?** Today the chat hides it but the dashboard
   and PDF show it. Either make it stable everywhere (this proposal) or hide it everywhere (a
   frontend-only change, no n8n or Jev work for dreams).
2. **Go for OTB** (items mode + pin table + WF3 edit)? Needs his yes for WF3, the function redeploy
   and the migration.
3. **The prompt touch** (the LLM describes but doesn't rate): yes or no.
4. **Forward Deployed Engineer and similar AI-builder roles move to High.** That's in line with his
   earlier call ("AI jobs get done by AI too"), but worth a quick look.
