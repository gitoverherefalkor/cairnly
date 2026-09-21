## The short version

I did not change anything. This is a read-only plan. Below is what I verified myself against the live workflow JSON pulled today, plus the three adversarial reviews folded in. Where reviewers disagreed with the plan, I re-ran the check myself and say who was right.

---

## 1. Was the hard English lock the only way?

**No. And the proof was already running in production two days before the lock was written.**

Here is the mechanism in plain terms. The old prompt did not tell the model "write in English." It told the model *"here is a variable called preferred_language; look at it and decide."* Deciding is a judgement call, and judgement calls get influenced by everything else in the context. For a candidate called "Sjoerd Prins" with Dutch employers, the Dutch evidence outweighed one little token buried four thousand words earlier, and the model decided Dutch. It followed instructions perfectly. It just decided wrong, twice, reliably, because the cue was the same both times.

The 2026-07-06 WF1 fix did not shout louder. It **deleted the decision**. It resolved the language *before* the prompt was even built, so the model sees a flat sentence naming exactly one language, at character 75, before any candidate data enters the picture:

```
Write EVERY word of your output ... in {{ ($('Process Survey Data1').first().json.preferred_language === 'nl') ? 'DUTCH (informal je/jij/jouw, never "u")' : 'ENGLISH' }}.
```

That prompt has since produced 470 clean English report sections. Critically, **the Dutch subheader translation table is still sitting inside it**, unchanged, in every English customer's prompt today. So the popular theory ("Dutch words in the prompt caused the bleed") is falsified: that material was byte-identical in the prompt that failed and in the prompt that has never failed. It was never the trigger.

The 2026-07-08 lock on WF3/WF4/WF8 was a different, worse move: it hard-coded English at the top while **leaving the original broken conditional in place at the bottom**. I verified that the contradicting Dutch instruction is still live in all four prompts (`T3 Careers Prompt` at char 19,584 of 20,571; `Set Runner Up Prompt` at 9,864; `Dream Job Feasibility` at 9,574; `Set Outside Box Prompt` at 13,536). Your English today rests on one instruction out-shouting a directly contradicting instruction 19,000 characters later. That is a standing bet, not a fix. WF1's design is strictly safer and it keeps Dutch reachable.

---

## 2. What actually breaks for a Dutch user today

A Dutch user has never existed in production (all 35 profiles and all 470 sections are `en`), so none of this has fired yet. But it is all reachable today:

| Stage | What happens |
|---|---|
| Personality profile (WF1) | Correct Dutch. WF1 is conditional. |
| Career chapters, runner-ups, dream job (WF4) | **English**, because the hard lock wins. |
| Outside-the-box (WF3) | **English**, same reason. |
| The `language` column | Stamped `nl` anyway, on English content. WF4's own `Parse Dream` has a code comment admitting this. |
| Outside-the-box formatting | WF3's `Parse OOB` picks the Dutch subheader list because the column says `nl`, finds none of them in English text, and stores the section with **zero `<h5>` tags**. That blanks subsection icons, the /jobs role descriptions and the dashboard teaser. |
| Chat delivery | `deliver-section/index.ts:149` reads `profiles.preferred_language`, so **Dutch intro + English career body + Dutch outro inside one chat bubble**. This is the exact mixed report you were trying to prevent, and it needs no prompt change to happen. |
| Executive summary (WF7) | Writes a confident Dutch summary of English chapters, and picks its language from `sections.find(s => s.language)`, which is whatever row PostgREST happens to return first. |
| Chat coach (WF5) | Dutch instruction sits at line 400 of a 412-line system message, competing with 10 messages of English career prose in memory plus English quick-reply text written into the transcript as the user's own turns. |
| Resume PDF/DOCX (WF9) | WF9 writes Dutch bullets correctly, but the section headings are hard-coded English literals in the React templates. Dutch content under "Professional Summary" and "Experience", in a document the user sends to employers. |

---

## 3. The recommended fix

**Principle:** resolve language at expression time, never at inference time. The model must never see a conditional about language and never see the other language's name in a directive. That is WF1's pattern, and it is the only language design you have with a production track record.

**The trick that buys the English guarantee:** do not delete the lock and do not soften it. Replace it with an expression whose non-`nl` branch reproduces **today's bytes exactly**. English customers keep getting a character-for-character identical prompt. Dutch users get a fully resolved, single-language Dutch prompt.

### The pattern

One new Code node per workflow, named `Language Blocks`, that does no I/O and only concatenates constants:

```js
const raw  = ($('Get Report Language').first().json || {}).language;
const isNL = raw === 'nl';                    // anything else, including missing, is English

return $input.all().map(i => ({
  json: { ...i.json,
    __lock:    isNL ? NL_LOCK    : EN_LOCK,     // EN_LOCK sliced from the export, not retyped
    __tail_t3: isNL ? NL_TAIL_T3 : EN_TAIL_T3,
  },
  pairedItem: i.pairedItem
}));
```

Then two surgical substitutions per prompt, and nothing else:

* the leading lock block becomes `{{ $('Language Blocks').first().json.__lock }}`
* the trailing `# OUTPUT LANGUAGE` block becomes `{{ $('Language Blocks').first().json.__tail_* }}`

The ~19,000 characters of prompt body in between are never opened. That body holds the 07-10 predictability rules and the 07-12 AI-tell bans, and leaving it closed removes any chance of collateral damage.

### Corrections the reviewers forced, which I re-verified myself

| Claim in the draft plan | Verdict | What I measured |
|---|---|---|
| The lock is 417 chars | **Wrong** | It is **441** chars (442 with n8n's leading `=`), sha1 `1c72a12ab2e3`, identical in all four prompts. Slicing at 417 would leave a 24-character fragment of the lock dangling above the new expression in every English prompt. Never specify these edits by offset. Anchor on the literal strings `!!! ABSOLUTE LANGUAGE LOCK` through `!!! END LANGUAGE LOCK !!!`. |
| "Use backticked template literals, the text has no backticks" | **Wrong for two of four** | The T3 and Runner-Up tails each contain **6 backticks** (the ` ```json ` bullet). Backticks there are a syntax error or silently truncate the English tail. Slice all arms programmatically out of the export instead. |
| WF3: insert the Code node after `Pull Profile Sections` | **Blocker, confirmed** | `Pull Profile Sections` has exactly one consumer, `Combine Profile sections`, and that node does `$input.all()` over **4** personality rows. A node returning one item silently drops 3 of 4 sections **for English users**. Correct insertion point in WF3 is between `Extract Interests and history` and `Set Outside Box Prompt` (a single edge, verified), pass-through, preserving `json.text` and `pairedItem`. |
| WF3: replace the tail "to end of string" | **Blocker, confirmed** | In WF4 the tail does run to the end. In WF3 the block is 13,536 to **14,511**, and is followed by 966 chars of `# INPUTS` containing every data injection the prompt has. Applying the WF4 recipe to WF3 deletes all of them. |
| "`Get Report Language` is fragile, no `alwaysOutputData`" | **Wrong** | It has `alwaysOutputData: true`. Zero rows yields an empty item and `language === undefined`. Also `report_sections.language` is `TEXT NOT NULL DEFAULT 'en'`, so there are no NULL or legacy rows anywhere. |
| Phase 4: strip the Dutch tables out of the English prompts | **Delete this idea entirely** | The tail is not all Dutch-gated. The paragraph pinning `---CAREER_SPLIT---`, the `# ` title line, `**Alternative titles:**`, `**Compatibility score: NN/100**` and the ` ```json ` block is **unconditional**, and `Use Markdown "## " for each subheader` is the only occurrence of the word "Markdown" in the entire 20KB prompt. Deleting it risks `Split Top3` throwing `Expected 3 careers but found N`, which means `analysis-completed` never fires and an English report silently never completes. |
| Verify by executing WF4 against a real report | **Wrong method** | WF4's insert nodes use `autoMapInputData` and it POSTs to `analysis-completed`. That would duplicate rows for a paying customer. Prove English statically instead (section 5). |
| The AI-impact heading is pinned English, so the Dashboard Career Map is safe in Dutch | **Wrong** | I traced it: `Keep this heading in English exactly as written, in every language` sits under `## Future-proof skills`, not under `## How AI will impact this role`. The AI heading is **not** pinned, and the NL branch says "the subheader TEXT itself in Dutch". `extractAIImpact` then returns null, and `CareerQuadrant` does `if (!aiImpact) continue;` and bails under 2 points, so the whole Career Map disappears. Fix this in the NL arm, not the frontend. |

### Honest residual risk

1. **Copy fidelity, not semantics.** The only way English changes is a mistyped English arm. That is mechanical and fully detectable before production, which is why section 5 is non-negotiable.
2. **One genuinely new node on the English path.** `Language Blocks` does no I/O, only concatenates constants, and defaults to English on anything that is not exactly `'nl'`.
3. **One degenerate case I cannot make byte-identical.** If `Get Report Language` returns zero rows, today n8n renders `preferred_language = ` from its own expression engine; my Code node would render `preferred_language = undefined`. That only occurs on a report that has no sections at all, which is already broken. I am naming it rather than hiding it.
4. **Dutch itself is unproven.** English has 470 rows behind it. Dutch has zero, and it is not symmetric: a Dutch WF1 run receives 20 to 25KB of hard-coded **English** survey schema, WF4 receives English enriched career data from WF2, and WF3's `Step 2 analysis` scorer has no language instruction at all yet feeds prose into WF4. A resolved lock is proven to hold against 1.2KB of inline Dutch. It is not proven to hold against 25KB of English going the other way.

---

## 4. Ordered change list

### A. n8n changes (each needs your explicit per-workflow approval; export to `n8n_wfs_cairnly/` first)

| # | What | Where | EN impact | NL impact | Risk |
|---|---|---|---|---|---|
| 1 | Add pass-through `Language Blocks` Code node; EN arms sliced from the export, never retyped | WF4, after `Get Report Language` | None, provable | Single place Dutch is decided | Low |
| 2 | Swap lock + tail for expressions; body untouched | WF4 `T3 Careers Prompt`, `Set Runner Up Prompt`, `Dream Job Feasibility` | None, provable | Dutch becomes reachable at all | Medium |
| 3 | Same, pass-through node between `Extract Interests and history` and `Set Outside Box Prompt`; tail anchored to stop before `# INPUTS` | WF3 `Set Outside Box Prompt` | None, provable | Unlocks Dutch on the only prose WF3 writes | Medium |
| 4 | **BYTE-DIFF GATE** (see section 5) | WF3 + WF4 | This is what makes "no-op" a fact | Nothing directly | Low |
| 5 | In the NL arms, pin English: `## How AI will impact this role`, `Future-proof skills`, the 5 feasibility labels (`Low` … `High`), `<!--move:X-->` (Ready now/Reframe/Upskill/Retrain), `<!--company:X-->` bands, the `More details…` footer, and the whole parsing-contract paragraph. In `comparison`, keys and `fit_scores`/`move` stay English but `headline` and `explanation` **must be Dutch** (they render at `DashboardV4.tsx:2527` and get pushed into chat at `CareerComparisonCard.tsx:64`) | WF3 + WF4 NL arms | None, provable | Without this the Move pill, Feasibility pill and Career Map all silently vanish in Dutch | Low |
| 6 | `Parse OOB`: union both subheader arrays **and** add the generic `## X` to `<h5>` rule that `Split Top3` and `Parse runner up` already have | WF3 | None expected, verify by replay | Stops the Dutch outside-the-box section storing zero `<h5>` | Low |
| 7 | Replace English literals written by code nodes: `<strong>Alternate titles:</strong>`, `'Career Option'`, `Career N`, `'Dream Job'`, `'Outside Box Career'` | WF3/WF4 parsers | None, provable (EN arm = today's literal) | Cheapest visible-quality win; no prompt fix can reach these | Low |
| 8 | WF6: re-key `Process Outside Box` / `Process Dream` off row `id`, drop title-equality, and add "reproduce the title verbatim" to the NL arm. Today a translated title flips `wasReplaced`, wipes `metadata.move` and falsely stamps `origin: chat_replacement` | WF6 | See note below | Prevents a metadata shredder the moment Dutch works | Medium |
| 9 | WF7 `Combine Sections`: majority vote instead of first-row lottery. **Only after** the cutover gate below, since a majority vote on a half-migrated report is worse than today | WF7 | None expected | Stops the exec summary picking language at random | Low |
| 10 | WF5 coach: same resolved-ternary conversion, and a rule that the section text may be in another language and must not be mirrored | WF5 | Prompt edit, must be byte-gated | Removes the last unresolved conditional | Medium |
| 11 | Add a cheap Dutch-stopword sniffer in the four parsers that flags when produced language disagrees with intended language | WF3/WF4 | None, provable | Nothing anywhere in the chain compares these today | Low |
| 12 | WF8 `Build Scoring Prompt` | **Defer** | **Changes EN** | See open decisions | Medium |

**Note on WF6 (reviewer disagreement, adjudicated):** the draft called this a free no-op. It is not. I read the block: the clauses `keep the same <h5>/<h3>/<h4>/<strong> subheaders and HTML tags` and `Do NOT change the required JSON output structure` sit **inside** the `IS 'nl'` sentence. The English branch is one short sentence. So either you byte-freeze all 805 characters for English (safe, but the conditional stays), or you lift the structure clauses out, which **is** an English prompt change across five nodes that regenerate live sections for paying customers. My call: byte-freeze for launch, revisit later.

### B. Frontend and edge changes (branch-deployable, zero live-prompt risk)

| # | What | Where | EN impact | NL impact | Risk |
|---|---|---|---|---|---|
| 13 | `extractFeasibility` accepts `Haalbaarheidsscore`; `subsectionIcons` gets Dutch keys; `extractOverview` and `extractSubsectionContent` accept `Overzicht` | `CareerScoreCard.tsx`, `subsectionIcons.ts`, `Jobs.tsx`, `dashboardV2Shared.tsx` | None expected (pure alternation) | Dutch reports stop looking broken on screen | Low |
| 14 | `extractAIImpact` regex widening | `CareerScoreCard.tsx` | **Changes EN behaviour** | Belt and braces only; the real fix is item 5 | Medium, needs replay |
| 15 | `deliver-section`: prefer the section's own `report_sections.language` over `profiles.preferred_language`, and log the boilerplate fallthrough | `deliver-section/index.ts:149`, `boilerplate.ts` | None expected | Kills the guaranteed Dutch-wrapper-around-English-body bug | Low |
| 16 | Localize the résumé templates' section headings and skills labels off the `preferred_language` that `generate-custom-resume/index.ts:258` already reads | `AtsClassic/AtsModern/ModernResume/ClassicResume`, `resumeToDocx.ts` | None | The only Dutch artifact a user hands to a third party | Low |
| 17 | `save-chat-response`, `wrap-up-save`, `tts` get the language suffix pattern that `wrap-up-extract` already uses. If you localize wrap-up-save's `##### Saved Responses` you must accept both literal sets in `V4SavedResponses.summaryOnly()` in the same change | edge functions | None, provable (suffix only built when `!== 'en'`) | Removes English chrome around Dutch content | Low |
| 18 | Salary string: WF2 emits `€60,000 - €120,000` verbatim into `SalaryPill`. Reformat in the **display layer** keyed off section language, not in WF2 | `dashboardV2Shared.tsx` | None | One number convention per report | Low |
| 19 | QuickReplies localization | `QuickReplies.tsx` + `ChatContainer` + `ChatMessages` + `wrap-up-extract` | **Must be additive** | Biggest remaining code-switch feeder into WF5 | **High** |

**On item 19, reviewer correction accepted:** re-keying off the `intent` field must *supplement*, never replace, the phrase matchers. Historical chat transcripts are plain text with no intent metadata, so a straight re-key silently breaks wrap-up rehydration for every existing English customer. Ship it as one atomic change or not at all.

---

## 5. Rehearsal and verification recipe

**Proving English is unchanged (do this statically, before anything is written):**

1. Export live WF3 and WF4 to `n8n_wfs_cairnly/`. That is both the rollback artifact and the diff baseline.
2. Build the edit with a script: load the export JSON, slice each EN arm out of the original string programmatically, splice the expressions in, and `assert(EN_ARM === original.slice(start, end))` for all four prompts. No hand-typing in the n8n expression editor, ever. The prompts contain typographic apostrophes, `€`, `->` and triple backticks, and a browser textarea is the single largest risk in this whole plan.
3. Render the new value locally with `language = 'en'` and diff against the original. **Require zero bytes of difference.** Also render with `undefined` and `'EN'` and confirm both fall to the English arm.
4. Diff the full node array before and after and confirm exactly the intended fields changed, plus the one new node, and nothing else.
5. PUT via the public API using the documented body shape `{name, nodes, connections, settings}`.
6. If you still want a live rehearsal: run it against a **throwaway** report id with `Insert Top 3`, `Insert Runner Ups`, `Insert dream` and the `analysis-completed` HTTP node **disabled**. Never against a customer's report.

**Proving Dutch is correct:**

7. Create 3 to 5 test reports with `preferred_language = 'nl'` and run the full chain WF1 to WF7. Have a Dutch speaker read them. Do not just check that they are Dutch, check the machine contract: every prescribed Dutch `<h5>` present, the `<!--move:-->` value still one of the four English tokens, the feasibility label still English, `## How AI will impact this role` still English, `---CAREER_SPLIT---` intact, three careers parsed, the fenced JSON present with `headline`/`explanation` in Dutch.

**The P9 reproduction test, which is the important one:**

8. Run a candidate with a **Dutch name and Dutch employers** whose `preferred_language` is `'en'`. That exact profile is what broke WF1 twice in July. If the English output stays English under maximum Dutch cue pressure, the resolved-token design is doing its job. Run it twice, since the original failure was reproducible across two runs.
9. Then run the mirror: an **English-named candidate with English employers** whose language is `'nl'`. That tests the reverse bleed, which nobody has ever tested and which is the direction with 25KB of English input working against you.

**Cutover gate, easy to forget:** no report may exist with `language = 'nl'` when this lands. WF6 never writes the `language` column, so a pre-fix Dutch report that receives chat feedback afterwards gets exactly one section regenerated into Dutch inside an English report. If any pilot report predates the fix, delete and re-run it rather than letting WF6 patch it.

---

## 6. Open decisions for you

1. **Quick-reply pills before or after the partner rollout?** Today every Dutch chat session writes English sentences into the transcript as the user's own turns, which feeds the coach the exact mixed context that caused the original bug. Fixing it touches four matchers and is the highest-risk item here. Ship Dutch reports inside an English chat shell first, or do it properly up front?
2. **Job-search reasons.** Making WF8's `match_reason` Dutch needs a four-node plumbing change (`search-jobs` never sends `preferred_language`; the string appears zero times in WF8) and is the only prompt edit that touches the English path. It buys about 14 words per job, sitting behind a hard-coded English `Why:` label. My call: leave it English for launch. Your call whether the partner cares.
3. **The "Overview" section stays English.** `init_summary` has no language logic on purpose, and `PersonalityRadar`'s legacy fallback regexes English labels out of it. Translating it would kill the radar on older reports. Accept English structural labels there, relabel in the frontend, or translate and repair the radar?
4. **Native Dutch prompts, now or later?** This design produces Dutch from an English prompt spec. Separate per-language prompt nodes would produce better Dutch, at the cost of maintaining two copies of ~56KB of prompt across WF3 and WF4, in a codebase whose dominant failure mode is prompt drift. I recommend later. If the partner expects native-quality Dutch copy on day one, that changes the timeline.
5. **English tokens visible inside Dutch reports.** `Ready now / Reframe / Upskill / Retrain` and `Minimal / Moderate / High / Severe / Critical` stay English because the parsers match them exactly. Acceptable? If not, the fix is a display-layer translation map keyed off the canonical English value, never a change to what the model emits.
6. **How many Dutch rehearsal reports before real partner traffic?** I would want at least 3 to 5 full end-to-end reports read by a Dutch speaker, including both cue-pressure tests above.
7. **Two pre-existing fragilities, fix now or log?** `Split Top3` throws `Expected 3 careers but found N` with no fallback, and `Complete merge` needs all three branches, so that failure means the report silently never completes. Not caused by the language work, but a first Dutch run is exactly when a delimiter drift is most likely to bite.