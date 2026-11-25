-- Encore v2 Q1.5 ("Whose decision is it to stop working?"): optional free-text note
-- under the choices (Sjoerd, 2026-11-25). The note is stored as a sidecar
-- (responses.__notes[question_id]), not in the answer, and WF1P passes it on as "1.5b".
-- Display config only; no new objects, no grants.
UPDATE public.questions
SET config = jsonb_set(config, '{note_field}', jsonb_build_object(
      'label', 'Anything to add? (optional)',
      'placeholder', 'For example how the decision came about and how you feel about it.')),
    translations = jsonb_set(translations, '{nl,note_field}', jsonb_build_object(
      'label', 'Toelichting (optioneel)',
      'placeholder', 'Bijvoorbeeld hoe het besluit tot stand kwam en hoe u erin staat.'))
WHERE id = 'c3c3c3c3-0001-4000-a000-000000000005';
