# The Language Contract: English canonical, translate at the boundary

**Status: LIVE since 2026-08-28.** This is the as-built record (it replaces the
proposal version that lived on PR #81). Original diagnosis and rationale: §1.
What actually shipped, including deviations from the proposal: §2–§7.
How to operate and extend it: §8–§10.

---

## 1. Why this exists

A live Dutch report came out half English (report `08ec34ec…`, 17 sections:
11 Dutch, 6 English, all stamped `language='nl'`). Every previous fix attacked
the same layer: make the generator prompt choose the right language. That layer
cannot be made reliable, because "choose a language" is a judgement the model
makes against 20KB+ of English career data, and it loses. It lost in WF1 in
July 2026, and again in WF4's dream-job node in August.

**The fix deletes the decision instead of winning it.** Every generator writes
English, always. One translator translates the finished document, guarded by a
deterministic validation gate. Display falls back to English when a translation
is missing. Adding a language is content work (voice rules, glossary, UI
locale files), not architecture work across 30 fronts.

## 2. The contract

1. **No generator prompt decides a language.** Each of WF1/WF3/WF4/WF6/WF7
   carries one static line: write ALL prose in English, always. (A static
   directive cannot mispick; only decisions can.)
2. **`report_sections.content` / `.title` are canonical English** for every
   generated prose section. Parsers, regexes, job search, title matching — all
   machine consumers read canonical and are therefore immune to translation.
3. **Translations live in `report_sections.content_i18n`** (jsonb, keyed by
   language: `{"nl": {"title", "content", "comparison", "translated_at",
   "model"}}`), written ONLY by the `translate-section` edge function.
   n8n must never write this column (n8n Supabase nodes store jsonb as string
   primitives — the documented house trap).
4. **Missing translation falls back to English.** Never blank, never mixed:
   chat delivery and the PDF are all-or-nothing per unit (a bubble/document is
   entirely translated or entirely English).
5. **Stale translations cannot exist.** A DB trigger wipes `content_i18n`
   whenever `content` or `title` changes, no matter who wrote (verified live).
6. **Exempt section types:** `chat_highlights` (user's own chat, natively
   their language), `chapter_%_feedback` (JSON payloads), `init_summary`
   (internal, English canonical but never translated).

## 3. The translator (`supabase/functions/translate-section`)

Input `{report_id | section_id, target_language?, force?}`; target defaults to
the report owner's `preferred_language`. Auth: n8n shared secret. Model:
claude-sonnet-5 (never send `temperature`). Concurrency 4, idempotent (skips
existing translations unless `force`).

Prompt = role/register + per-language voice rules + glossary
(`_shared/glossary.ts`, mirrored from `scripts/i18n-glossary.json` with a
vitest drift test) + **pinned heading translations**
(`_shared/headingPins.ts`) + the structural contract.

**The gate** (`_shared/translationGate.ts`, pure, 29 vitest tests): tag
skeleton equality, comment-token multiset, digit-run multiset (separator
localisation allowed, digit changes not), markdown structure counts
(headings/bullets/✓/⚠/bold/fences/CAREER_SPLIT), and a two-level language
sniff — whole-document AND per-paragraph, so partial translations fail too.
One retry with the failure list fed back, then give up: nothing is written,
Sjoerd gets an alert email, the user sees English.

**The input alarm:** before translating, the canonical content itself is
sniffed. Non-English canonical is REFUSED and alerted — the permanent
regression detector for generator prompts (proven live: it correctly refused
all 10 Dutch-canonical legacy rows while translating the 6 English ones).

**Optimistic write guard:** the UPDATE is conditioned on the content that was
translated, so a section rewritten mid-translation is left alone.

## 4. Where translation is triggered (three call sites)

| Trigger | When | Mechanism |
|---|---|---|
| `analysis-completed` | before flipping the report to `pending_review` | awaits `translate-section` (150s deadline) so a non-EN user's **first look is never the English fallback**; on failure it proceeds (fallback beats blocking) |
| WF6 node `Translate Updated Section` | after the three `Update Section in DB*` nodes | the trigger wiped the stale translation; this re-translates before the sub-workflow returns to the chat agent (closes the chat race). `onError: continue` |
| WF7 node `Translate Exec Summary` | after `Insert Exec Summary` | exec summary is generated at chat wrap-up, outside the pipeline window. `onError: continue` |

## 5. Display layer

Every render path goes through `sectionText()` / `sectionTitle()`
(`supabase/functions/_shared/sectionText.ts`, re-exported as
`src/lib/sectionText.ts`): translation if present, else canonical English.
Every parser reads canonical directly. Specifics:

- **Dashboard V4 / share cards / charts:** translated prose + titles;
  `extractAIImpact` etc. parse canonical. `CareerMatch.canonicalTitle` carries
  the English machine key for job-search/CV flows.
- **Chat:** `findSectionByTitle` matches canonical AND translated titles;
  pills parse canonical via the matched row; NL boilerplate phrases added to
  progress detection; NL wrap-up quick-reply now detected (`sessie afronden`).
- **deliver-section:** all-or-nothing per section; boilerplate follows
  `preferred_language`; the old majority-vote language sniffing is gone.
- **PDF:** renders in `preferred_language` only when EVERY translatable
  section has that translation (chrome and prose always agree); language is
  part of the render cache key.
- **Enum pills** (AI-impact, Move, Feasibility levels, blurbs, legends):
  localized via `src/lib/enumLabels.ts` — DB tokens stay English, display maps
  them.
- **Heading pins:** `headingPins.ts` fixes every known heading/title to one
  translation (the exact strings the icon dictionary already held from the old
  NL prompts). Drift tests: `src/lib/headingPins.test.ts`.

## 6. Deviations from the original proposal (deliberate)

- **No `ai_impact`/`feasibility`/`subsections` columns.** Parsing canonical
  English at render time is exactly as reliable as columns and needed no n8n
  insert-node changes, no backfill, no dual-source logic.
- **Staleness trigger added** (the proposal had none): without it, a WF6
  rewrite would have silently served the OLD translation — worse than English.
- **Input-language alarm added** (the proposal only sniffed output).
- **`metadata.comparison` (headline/explanation) is translated too**, stored
  under `content_i18n[lang].comparison` (user-facing prose the proposal missed).
- **Readiness gate placement decided:** translation runs inside
  `analysis-completed` *before* the ready signal, closing the first-look race.
- **The generators keep ONE static language line.** Rule "no prompt mentions a
  language" was scoped to *decisions*; a static "write English, names never
  change your language" anchors the model against foreign-language cue
  pressure at zero decision risk. (`generate-share-quotes`' language
  instruction also stays: it already IS a translate-at-the-boundary call.)

## 7. n8n changes (applied 2026-08-28, all five verified node-for-node)

Rollback: n8n version history, or `n8n_wfs_cairnly/*_LIVE_BACKUP_pre_langcontract_apply_20260828.json`.
Applier: `scripts/apply-language-contract-n8n.mjs` (self-contained: fetch →
transform → assert only intended nodes change → PUT → re-fetch → verify;
idempotent, `--dry-run` supported).

- **WF1** `prompt_perso_prof1`: resolved ternary block and the Dutch header
  table removed. `extract_report_sections_code1`: stamps `'en'`.
- **WF3** `Set Outside Box Prompt`: LANGUAGE LOCK + conditional tail removed.
  `Parse OOB`: stamps `'en'` (its Dutch subheader array remains as harmless
  dead matching).
- **WF4** the three generator prompts: LOCK + conditional tails removed;
  `Split Top3` / `Parse runner up` / `Parse Dream`: stamp `'en'`.
- **WF6** five `Build * Prompt` tails → static English (feedback may be Dutch;
  understand it, write English); new `Translate Updated Section` node.
- **WF7** language vote in `Combine Sections` and `Prepare for Insert` pinned
  to `'en'`; prompt conditional removed; new `Translate Exec Summary` node.

Out of scope, unchanged: WF5 chat (live conversation has no boundary to
translate at; deliver-section now feeds it coherent per-language context),
WF8/WF9/WFX (job search and documents keep their own language params),
intake-chat, Starter/Encore flavors (WF1S/WF1P etc. — apply the same edits
when those go live).

## 8. Operations

- **Audit:** `docs/sql/language_audit.sql` — zero rows expected from every
  query; run after any pipeline change. Rows created before 2026-08-21 are
  grandfathered (incl. report `08ec34ec…`, which displays correctly via
  fallback).
- **Alerts:** translation failures and non-English canonical email
  sjoerd@falkoratlas.com with section ids and reasons. The affected sections
  show English (readable), never garbage. Re-run: POST `translate-section`
  with the `report_id`.
- **Live probe:** `scripts/deliver-section-probe.mjs` exercises the chat
  delivery path as the test user.
- **The one test that proves everything:** one fresh NL survey end to end
  (test user, `preferred_language='nl'`) — expect: English canonical in DB,
  `content_i18n.nl` on every non-exempt section before the ready email, fully
  Dutch dashboard/chat/PDF.

## 9. Adding a language (e.g. German)

1. `_shared/language.ts`: add `'de'` to `SUPPORTED`.
2. `_shared/glossary.ts` + `scripts/i18n-glossary.json`: rules already exist
   for `de`; add preferred terms (drift test keeps them in sync).
3. `_shared/headingPins.ts`: add the `de` map (translate the ~35 pinned
   headings once); add the same strings to `subsectionIcons.ts` (drift test
   enforces this).
4. `src/lib/enumLabels.ts`: add the `de` block.
5. UI locale files under `public/locales/de/` + survey translation
   (LOCALIZATION_PLAYBOOK.md / the add-language skill).
6. `translationGate.ts`: German stopwords already present.

The report pipeline itself needs **zero** changes — that is the point.

## 10. History

- Proposal (2026-08-20, PR #81) — superseded by this as-built version.
- `n8n_wfs_cairnly/NL_language_lock_redesign_PROPOSED.md` — never built; its
  mechanism analysis remains a good read, its conclusion is superseded.
- Code: `11ae158` (stage 1: DB + translator + gate), `5dff89d` (stage 2:
  display layer), plus the n8n apply of 2026-08-28.
