# Plan: English canonical, translate at the boundary

**Status:** proposal, nothing executed. **Written:** 2026-08-20.
**Replaces:** `n8n_wfs_cairnly/NL_language_lock_redesign_PROPOSED.md` (never built; see §7 for why it is now moot).

---

## 1. Context

A live Dutch report is half English. Report `08ec34ec-89a1-4ae8-a7c6-75e4f6183588`,
`preferred_language = 'nl'`, 17 sections:

| Body | Sections |
|---|---|
| Dutch | `approach`, `development`, `strengths`, `values`, `top_career_1/2/3`, `runner_ups` ×3, `init_summary` |
| English | `dream_jobs` ×3, `outside_box` ×3 |

**All 17 rows are stamped `language = 'nl'`.** Verified against the database.

Every fix so far has attacked the same layer: make the generator prompt choose the right language.
That layer cannot be made reliable, because "choose a language" is a judgement the model makes
against 20KB+ of English career data, and it loses. It lost in WF1 in July, it lost again in WF4's
dream-job node, and the reason two nodes in WF4 now succeed while two fail is that somebody fixed
two of four pasted copies.

**The fix is to delete the decision, not to win it.** Generate everything in English, always.
Translate once, after parsing, before persistence. Store both.

This also settles the multi-language question: per-language generation costs O(N × prompts) —
another arm through ~56KB of prompt across WF3 and WF4 per language, another byte-diff gate,
another set of structural tokens to pin. Translation at the boundary costs O(1). Adding German is
adding a string to an enum.

---

## 2. The architecture

```
survey → WF1..WF4 (ENGLISH ONLY, no language logic anywhere)
       → parse nodes extract structure + metadata (ENGLISH ONLY, unchanged)
       → persist: content = English canonical, metadata = structured columns
       → translate-section (once per section, per target language)
       → persist: content_i18n[lang] = translated prose
       → display: metadata from columns, prose from content_i18n[lang] ?? content
```

Four rules:

1. **No generator prompt mentions a language.** Not a lock, not a ternary, not a table. If a prompt names a language, that is a bug.
2. **English is the canonical artifact.** `report_sections.content` is always English. It is the thing parsers, features and future work read.
3. **Translation never invents structure.** The translator preserves the tag skeleton exactly: same tags, same count, same order. Only human-readable text changes.
4. **Missing translation falls back to English.** Never blank, never half. A failed translation degrades to a readable English section.

Rule 4 is what makes this safe to ship under a deadline: the worst failure is today's behaviour.

---

## 3. Schema

One migration.

```sql
-- English canonical body already lives in report_sections.content.
-- Translations live beside it, keyed by language.
ALTER TABLE report_sections
  ADD COLUMN content_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

-- report_sections.language currently records INTENT and is demonstrably wrong
-- (17 rows stamped 'nl', 6 of them English). Redefine it as a fact about
-- `content`, which is now always English.
COMMENT ON COLUMN report_sections.language IS
  'Language of the canonical `content` column. Always ''en''. Translations live in content_i18n.';

-- Structured metadata so the display layer never parses prose. Most of this is
-- already extracted inside the n8n parse nodes; it is just not persisted.
ALTER TABLE report_sections
  ADD COLUMN ai_impact text,          -- was regexed out of the body by extractAIImpact
  ADD COLUMN feasibility text,        -- 'Minimal' | 'Moderate' | 'High' | 'Severe' | 'Critical'
  ADD COLUMN subsections jsonb NOT NULL DEFAULT '[]'::jsonb;
  -- subsections: [{ "key": "why_fits", "heading_en": "Why this role fits you", "order": 0 }, ...]
```

`content_i18n` shape:

```json
{ "nl": { "title": "…", "content": "<h5>…</h5>…", "translated_at": "2026-08-20T21:00:00Z", "model": "…" } }
```

Note `report_sections.language` is `NOT NULL DEFAULT 'en'`, so no backfill is needed for the
column itself. Existing rows that hold Dutch content are handled in §8.

---

## 4. The translator

**New:** `supabase/functions/translate-section/index.ts`

Input `{ section_id, target_language }`. Reads the canonical row, translates, writes
`content_i18n[target_language]`. Idempotent: re-running overwrites that one key and touches
nothing else.

Reuse the existing `resolveLang` normalisation from `verify-access-code/index.ts` (`pickLang`),
lifted into `supabase/functions/_shared/language.ts` so there is one implementation:

```ts
export type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es';
export const SUPPORTED: Lang[] = ['en', 'nl'];   // add codes here, nothing else changes
export const resolveLang = (v: unknown): Lang => {
  const c = String(v ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED as string[]).includes(c) ? (c as Lang) : 'en';
};
```

### The prompt

Sjoerd's read is right: a capable model with clear tone instruction and real Cairnly context
translates this well. The prompt is where the quality budget goes, and it is spent **once**
instead of N times across two workflows.

It needs four blocks:

**(a) Role and register.** Career-guidance copy for professionals 18-55, mostly college-educated
office workers, read once and acted on. Not marketing, not academic.

**(b) Voice rules, per language.** For Dutch, the rules already written down in `CLAUDE.md` and the
`cairnly-marketing` skill: casual `je`, never `u`; warm and direct; no hype; no exclamation marks;
**never em-dashes** (use commas, periods, colons, parentheses); never the contrast construction
"het is niet X, het is Y". Match the register already in `public/locales/nl/*.json`. Add a block
per language as they are onboarded.

**(c) Glossary.** Seed from `scripts/i18n-glossary.json`, which already exists and already has a
`rules.<lang>` structure. Pin the terms that must not drift: role titles, "assessment", "coach",
section names. This is the single highest-leverage quality lever and it is one file.

**(d) The structural contract, stated as hard constraints.** This is what makes it safe:

- Reproduce every HTML tag exactly: same tags, same nesting, same count, same order. Never add or remove one.
- Reproduce verbatim, never translate: `---CAREER_SPLIT---`, every `<!--…-->` comment token (`<!--move:Ready now-->`, `<!--company:…-->`), every URL, every number, every currency figure.
- Inside fenced JSON blocks: translate **only** the `headline` and `explanation` values. Every key, and every value of `fit_scores` and `move`, stays byte-identical English.
- Return only the translated document. No preamble, no explanation, no code fence around the whole thing.

### Validation before write

Cheap, deterministic, non-negotiable. Reject and retry once, then fall back to English:

```ts
const tagSeq = (s: string) => (s.match(/<\/?[a-z][a-z0-9]*/gi) ?? []).join(',');
assert(tagSeq(translated) === tagSeq(canonical));           // skeleton preserved
assert(count(translated, '---CAREER_SPLIT---') === count(canonical, '---CAREER_SPLIT---'));
assert(sameSet(matchAll(translated, /<!--.*?-->/g), matchAll(canonical, /<!--.*?-->/g)));
assert(jsonKeys(translated) === jsonKeys(canonical));        // fenced JSON keys unchanged
assert(looksLike(translated) === target_language);           // stopword sniff, both directions
```

The last one closes the loop that has never existed: nothing in this pipeline has ever compared
produced language against intended language. A failed assert writes nothing and logs to the Global
Error Handler (`FbsruPbuZI2Fgtc8`), which already sends email alerts.

### Where it is called

After the parse/insert nodes in WF4 and WF3, one call per section. **Not a copy-pasted node per
insert** — copy-pasting the same block into four places is exactly how the current split-brain
happened, where two of four pasted locks got fixed and two did not. Options, in order of
preference:

1. One n8n **sub-workflow** (`WF-T Translate Sections`) invoked once at the end of WF4 with the report id, which fans out over the report's sections itself. One node in WF4, one implementation.
2. Failing that, call `translate-section` from `analysis-completed`, so it is triggered by report completion rather than wired into each generator.

Either way: **one place**.

---

## 5. Frontend

The display layer stops parsing prose.

- **New helper** `src/lib/sectionText.ts`:
  ```ts
  export const sectionText = (s: ReportSection, lang: string) =>
    s.content_i18n?.[lang]?.content ?? s.content;
  export const sectionTitle = (s: ReportSection, lang: string) =>
    s.content_i18n?.[lang]?.title ?? s.title;
  ```
  Every render path goes through these two. That single fallback is rule 4.

- **Read metadata from the new columns, not from regexes.** `extractAIImpact`, `extractFeasibility`, `extractOverview` and the `subsectionIcons` heading map in `src/components/dashboard/v2/dashboardV2Shared.tsx`, `CareerScoreCard.tsx` and `src/pages/Jobs.tsx` currently regex English headings out of the body. They read `ai_impact`, `feasibility` and `subsections` instead. This is what allows the translator to translate headings freely, and it removes the class of bug where a Dutch heading makes the Career Map silently vanish (`CareerQuadrant` bails on a null `aiImpact`).

- **`deliver-section`** (`supabase/functions/deliver-section/index.ts:166-212`) currently sniffs the content language and logs mismatches, because content and intent could disagree. They can no longer disagree. It resolves the user's language, calls `sectionText`, and picks the matching boilerplate. The mismatch branch and its logging come out.

- **WF7 exec summary** stops voting on section languages. The report language is a single known value.

---

## 6. Rollout

Additive, so it is safe under deadline pressure. Nothing below breaks English.

1. Migration (§3). Additive columns, no data change. English is unaffected the moment it lands.
2. `_shared/language.ts` + `translate-section` + validation. Not called yet.
3. Backfill `ai_impact` / `feasibility` / `subsections` for existing rows with a one-off script that runs the same regexes the frontend uses today, against the English canonical.
4. Frontend switches to `sectionText` / metadata columns. Still English everywhere. **Ship and verify here** — this is a safe stopping point, and everything up to it is invisible to users.
5. Wire the translate call (§4). Dutch starts appearing.
6. Strip language logic from the generator prompts (§7). Do this **last**: until step 5 is proven, the existing Dutch arms are the only Dutch you have.

---

## 7. What this clears out

The strongest argument for this design is how much accumulated machinery it makes dead. All of the
following exists today to solve a problem that stops existing.

**Deleted from the n8n prompts:**

- The `!!! ABSOLUTE LANGUAGE LOCK … !!! END LANGUAGE LOCK !!!` block (441 chars, sha1 `1c72a12ab2e3`) in all four prompts: WF4 `T3 Careers Prompt`, `Set Runner Up Prompt`, `Dream Job Feasibility`, and WF3 `Set Outside Box Prompt`.
- The trailing `# OUTPUT LANGUAGE` conditional in those same four prompts — the contradicting Dutch instruction sitting 19,000 characters after the lock, which today's English output survives only by out-shouting.
- The Dutch subheader translation tables embedded in the prompts, including the one still shipped to every English customer in WF1.
- WF1's resolved ternary (`Write EVERY word of your output … in {{ … === 'nl' ? 'DUTCH …' : 'ENGLISH' }}`). WF1 generates English too.
- Whatever per-node language handling was added to `T3 Careers Prompt` and `Set Runner Up Prompt` after 2026-08-17 to make them emit Dutch. That is the fix that produced today's split-brain; it goes with the rest.

**Never has to be built:**

- The entire `Language Blocks` / resolved-expression redesign in `NL_language_lock_redesign_PROPOSED.md`: the new Code node per workflow, the programmatic EN-arm slicing, the byte-diff gate, the WF3-vs-WF4 tail-anchoring divergence, and the per-workflow approval cycle for each. That document stays as history; its mechanism analysis is correct and worth reading, and its conclusion is superseded.
- Pinning structural tokens English inside a Dutch arm (`## How AI will impact this role`, `Future-proof skills`, the five feasibility labels, `<!--move:X-->`, `<!--company:X-->`, `---CAREER_SPLIT---`, JSON keys). Moot: nothing parses translated text.
- Per-language prompt maintenance. This is the cost that scales with N and it never starts.

**Removed from the codebase:**

- `Parse OOB`'s Dutch subheader array and the proposed union-both-arrays fix. It only ever sees English.
- Frontend parser widening: `extractFeasibility` accepting `Haalbaarheidsscore`, Dutch keys in `subsectionIcons`, `extractOverview` accepting `Overzicht`, the `extractAIImpact` regex widening. All of it, plus the risk that the widening changed English behaviour.
- `deliver-section`'s content-language sniffing and mismatch logging (`index.ts:200-212`).
- WF7 `Combine Sections`' first-row-lottery language pick, and the proposed majority-vote replacement.
- WF6's title-equality fragility, where a translated title flips `wasReplaced`, wipes `metadata.move` and falsely stamps `origin: chat_replacement`. Titles are compared in English.
- The Dutch-stopword sniffers proposed for four separate parser nodes, replaced by one assert in one function.

**Stops being a lie:**

- `report_sections.language`. Today it says `nl` on six English bodies and every consumer trusts it. It becomes a fact about a column that is always English, with translations in a separate, explicitly-keyed place.

**What this does not solve.** The chat coach (WF5) still needs per-language handling: it reads Dutch
user input and streams Dutch replies, so there is no boundary to translate at. Same for the
`QuickReplies` pills, which today write English sentences into the transcript as the user's own
turns and feed the coach exactly the mixed context that caused the original bug. Both are out of
scope here and unchanged by this plan.

---

## 8. Verification

**Proving English is untouched** (steps 1-4 of the rollout):
- `npm run build`, `npx vitest run`.
- Every existing English report renders identically. `content_i18n` is empty, so `sectionText` falls through to `content` on every path.
- Backfilled `ai_impact` / `feasibility` / `subsections` match what the frontend regexes produce today, row for row. Diff the script's output against the live regex output before switching the frontend over.

**Proving the translator holds:**
- Unit-test `translate-section` against fixtures: one of each section type from a real English report. Assert the full validation set in §4, not just "it is Dutch".
- Adversarial fixture: a section containing a fenced JSON block, a `<!--move:-->` token, a `€` figure and a URL. Assert every one survives byte-identical.

**The reproduction tests that matter**, both directions, because only one has ever been run:
- **Dutch cue pressure on an English user:** Dutch name, Dutch employers, `language = 'en'`. This exact profile broke WF1 twice in July. Under this design it cannot fail, because no prompt mentions language, and that is precisely the claim worth testing. Run it twice.
- **English cue pressure on a Dutch user:** English name, English employers, `language = 'nl'`.

**End to end:** three to five full `nl` reports, read by a Dutch speaker. Check the machine contract
too: tag skeleton identical to canonical, three careers parsed, `<!--move:-->` still an English
token, fenced JSON keys English with Dutch `headline`/`explanation`.

**Acceptance test, permanent:**
```sql
SELECT id, section_type FROM report_sections
WHERE language <> 'en'
   OR (content_i18n ? 'nl' AND content_i18n->'nl'->>'content' IS NULL);
```
Zero rows. Keep it as `docs/sql/language_audit.sql` and run it after every pipeline change.

**Never** test by executing WF4 against a real report: its insert nodes use `autoMapInputData` and
it POSTs to `analysis-completed`, so a run duplicates rows for a paying customer. Use a throwaway
report id with `Insert Top 3`, `Insert Runner Ups`, `Insert dream` and the `analysis-completed`
node disabled.

**Existing Dutch rows.** Report `08ec34ec…` has six English bodies stamped `nl` and eleven Dutch
bodies stamped `nl`. It predates the contract and cannot be repaired in place — the Dutch bodies
are not canonical English. Delete and re-run it rather than migrating it. WF6 never writes the
`language` column, so if it receives chat feedback before being re-run it will regenerate exactly
one section into a report that is already inconsistent.

---

## 9. Two decisions

1. **Where the translate call lives** — sub-workflow invoked from WF4, or `analysis-completed` calling `translate-section`. Sub-workflow keeps it inside the pipeline and visible in n8n's execution log; `analysis-completed` keeps n8n untouched. Recommend the sub-workflow, but either satisfies "one place".
2. **Does a failed translation block or fall back?** Rule 4 says fall back to English and alert. That means a Dutch candidate can, in the worst case, see an English section — which is exactly today's behaviour, so it is not a regression. Blocking would mean showing them nothing. Recommend fall back.
