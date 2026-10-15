-- 3h "aspects to avoid": at most 5 picks.
--
-- WF3 turns every pick into a dealbreaker penalty, so ticking (nearly) all
-- nine boxes punishes every career and empties the runner-ups. Capping at 5
-- makes people choose what they really want to stay away from. QuestionRenderer
-- shows the counter ("Select up to 5") and blocks a 6th pick; "Other" counts
-- as a pick. The old helper text said "Select all that apply", which is no
-- longer true, so it is replaced (EN + NL). Descriptions are UI-only.

UPDATE public.questions
SET max_selections = 5,
    config = jsonb_set(config, '{description}',
      to_jsonb('Pick the ones you most want to stay away from. This helps us leave unsuitable roles out of your recommendations.'::text)),
    translations = jsonb_set(translations, '{nl,description}',
      to_jsonb('Kies wat je het liefst vermijdt. Zo laten we ongeschikte rollen weg uit je aanbevelingen.'::text))
WHERE id = '33333333-3333-3333-3333-333333333338';
