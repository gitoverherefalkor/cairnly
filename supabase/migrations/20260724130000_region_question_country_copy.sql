-- Reframe the "region" question as a friendly country question.
--
-- The frontend now renders a country picker (CountryRegionSelect) that maps the
-- chosen country/area to the same cost-of-living band string the n8n salary
-- pipeline already expects, so the stored answer and n8n are UNCHANGED — only
-- the wording changes here. The 10 band choices are deliberately left in place:
-- the picker detects the question by the "Northern and Western Europe" sentinel
-- in its choices, and they remain the graceful fallback dropdown.
--
-- ⚠️ Apply this AT MERGE TIME, together with the frontend picker going live.
-- Applying it earlier would show the "country" wording above the old 10-band
-- dropdown on production until the frontend deploys.
--
-- Region questions: starter (a1a1…), encore (b2b2…), pro (1111…).
-- Only the pro survey carries NL translations, so NL copy is set there only.

-- English label + description (all three surveys)
UPDATE public.questions
SET label = 'Which country are you based in?',
    config = jsonb_set(
      config,
      '{description}',
      to_jsonb(
        'Pick where you''re based, or where you''d like to find a role. It sets which job market''s salary estimates you''ll see.'::text
      )
    )
WHERE id IN (
  'a1a1a1a1-0001-4000-a000-000000000003',
  'b2b2b2b2-0001-4000-a000-000000000003',
  '11111111-1111-1111-1111-111111111114'
);

-- Dutch label + description (pro survey only — the one with NL translations)
UPDATE public.questions
SET translations = jsonb_set(
      jsonb_set(translations, '{nl,label}', to_jsonb('In welk land woon je?'::text)),
      '{nl,description}',
      to_jsonb(
        'Kies waar je woont, of waar je een baan zoekt. Dit bepaalt op welke arbeidsmarkt we je salarisindicaties baseren.'::text
      )
    )
WHERE id = '11111111-1111-1111-1111-111111111114';
