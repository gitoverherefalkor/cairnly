-- Multi-select helper texts: stop repeating the selection rule.
--
-- Every multi-select already shows the automatic counter from
-- QuestionRenderer (e.g. "Select between 1 and 2 · 2 selected"), so helper
-- texts like "(Choose up to 2)" said it twice. Where the helper text only
-- repeated the rule it is removed; where it added something, only that part
-- stays. "Select all that apply" texts are untouched (the counter only says
-- "Select at least one" there). Descriptions are UI-only: no edge function
-- or n8n workflow reads them.
--
-- 4.2 archetypes: the question says "Which 2 archetypes" but min_selections
-- was NULL (so 1 was accepted and the counter read "between 1 and 2").
-- Now exactly 2 are required; the counter says "Select 2".

-- Helper text removed entirely (EN + NL where present)
UPDATE public.questions
SET config = config - 'description',
    translations = CASE WHEN translations ? 'nl'
                        THEN translations #- '{nl,description}'
                        ELSE translations END
WHERE id IN (
  '44444444-4444-4444-4444-444444444441', -- 4.1 interest areas
  '44444444-4444-4444-4444-444444444442', -- 4.2 archetypes
  '66666666-6666-6666-6666-666666666667', -- 6.7 EI challenges
  '77777777-7777-7777-7777-777777777771', -- 7.1 short-term goals
  '77777777-7777-7777-7777-777777777772', -- 7.2 long-term goals
  'a1a1a1a1-0002-4000-a000-000000000005', -- starter 2.5 learn best
  'a1a1a1a1-0004-4000-a000-000000000006'  -- starter 4.6 sound like you
);

-- 4.2 archetypes: exactly 2
UPDATE public.questions SET min_selections = 2
WHERE id = '44444444-4444-4444-4444-444444444442';

-- Helper text shortened, pro survey (EN + NL)
UPDATE public.questions
SET config = jsonb_set(config, '{description}', to_jsonb(v.en)),
    translations = jsonb_set(translations, '{nl,description}', to_jsonb(v.nl))
FROM (VALUES
  ('11111111-1111-1111-1111-111111111115'::uuid,
   'Pick what best describes your main objectives, or add your own under ''Other''.',
   'Kies wat het best bij je doelen past, of vul je eigen doel in bij ''anders''.'),
  ('44444444-4444-4444-4444-444444444446'::uuid,
   'Use ''Other'' if your topic is not listed.',
   'Kies ''anders'' als jouw onderwerp er niet tussen staat.'),
  ('77777777-7777-7777-7777-777777777773'::uuid,
   'Use ''Other'' if none of these apply.',
   'Kies ''anders'' als geen van deze bij je past.'),
  ('77777777-7777-7777-7777-777777777775'::uuid,
   'Pick the areas you are **personally motivated** to develop, whatever your current level.',
   'Kies de gebieden die je **zelf graag** verder ontwikkelt, ongeacht je huidige niveau.')
) AS v(id, en, nl)
WHERE questions.id = v.id;

-- Helper text shortened, starter + encore (English only, no NL rows)
UPDATE public.questions
SET config = jsonb_set(config, '{description}', to_jsonb(v.en))
FROM (VALUES
  ('a1a1a1a1-0005-4000-a000-000000000005'::uuid, 'Optional.'),
  ('b2b2b2b2-0005-4000-a000-000000000004'::uuid, 'Optional.'),
  ('b2b2b2b2-0004-4000-a000-000000000003'::uuid, 'This is between you and the report.')
) AS v(id, en)
WHERE questions.id = v.id;
