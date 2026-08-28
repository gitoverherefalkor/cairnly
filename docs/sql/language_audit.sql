-- Language-contract audit — run after every pipeline change (and any time a
-- report looks off). Expected result: ZERO rows from each query.
-- See docs/LANGUAGE_CONTRACT_PLAN.md.
--
-- Contract: report_sections.content/.title are canonical ENGLISH for every
-- generated prose section; translations live in content_i18n, written only by
-- the translate-section edge function.
--
-- Exempt section types (never English-canonical, never translated):
--   chat_highlights    — the user's own chat content, natively their language
--   chapter_1_feedback — JSON-encoded feedback structure (any chapter_%_feedback)
--   init_summary       — internal extraction artifact, exempt from translation
--                        (but still English canonical, so it IS checked below)
--
-- Grandfathered: rows created before the contract went live on 2026-08-21.
-- (Report 08ec34ec-89a1-4ae8-a7c6-75e4f6183588 predates it with Dutch
-- canonical content; it displays correctly via the English-fallback path.)

-- 1. Generated sections whose language stamp violates the contract.
SELECT id, report_id, section_type, language, created_at
FROM report_sections
WHERE created_at >= '2026-08-21'
  AND section_type NOT IN ('chat_highlights')
  AND section_type NOT LIKE 'chapter\_%\_feedback'
  AND language IS DISTINCT FROM 'en';

-- 2. Broken translation entries: an nl entry exists but carries no content.
SELECT id, report_id, section_type
FROM report_sections
WHERE content_i18n ? 'nl'
  AND coalesce(content_i18n->'nl'->>'content', '') = '';

-- 3. Dutch-looking canonical content on post-contract generated rows
--    (heuristic: unambiguous Dutch function words in the body). A hit means a
--    generator prompt regressed — translate-section will also have refused it
--    and alerted, but this query is the belt to that suspender.
SELECT id, report_id, section_type, created_at
FROM report_sections
WHERE created_at >= '2026-08-21'
  AND section_type NOT IN ('chat_highlights')
  AND section_type NOT LIKE 'chapter\_%\_feedback'
  AND content ~* '\m(jouw|jij|jezelf|waarom|zoals|zodat|hierdoor|loopbaan|vaardigheden)\M'
  AND content ~* '\m(de|het|een|van|voor|niet)\M';

-- 4. Non-English users' recent reports missing translations (informational —
--    these display as English fallback; expected only when translate-section
--    failed and alerted, or briefly during generation).
SELECT rs.report_id, p.preferred_language, count(*) AS untranslated_sections
FROM report_sections rs
JOIN reports r  ON r.id = rs.report_id
JOIN profiles p ON p.id = r.user_id
WHERE rs.created_at >= '2026-08-21'
  AND p.preferred_language IS DISTINCT FROM 'en'
  AND rs.section_type NOT IN ('chat_highlights', 'init_summary')
  AND rs.section_type NOT LIKE 'chapter\_%\_feedback'
  AND NOT (rs.content_i18n ? p.preferred_language)
GROUP BY rs.report_id, p.preferred_language;
