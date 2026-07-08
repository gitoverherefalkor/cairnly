-- Differentiate the non-negotiable rider copy for salary vs schedule.
-- Salary (3f): only the FLOOR matters -- paying above the range is fine -- so phrase
-- it as "below the bottom of this range". Schedule (3d) isn't a range, keep it generic.

UPDATE public.questions
SET config = jsonb_set(config, '{non_negotiable_rider}', to_jsonb(
      'This is non-negotiable for me. Rule out careers that clearly pay below the bottom of this range.'::text)),
    translations = jsonb_set(translations, '{nl,non_negotiable_rider}', to_jsonb(
      'Dit is voor mij niet onderhandelbaar. Sluit banen uit die duidelijk minder betalen dan de onderkant van dit bereik.'::text))
WHERE id = '33333333-3333-3333-3333-333333333336';

UPDATE public.questions
SET config = jsonb_set(config, '{non_negotiable_rider}', to_jsonb(
      'This is non-negotiable for me. Rule out careers that clearly don''t fit this schedule.'::text)),
    translations = jsonb_set(translations, '{nl,non_negotiable_rider}', to_jsonb(
      'Dit is voor mij niet onderhandelbaar. Sluit banen uit die duidelijk niet bij dit rooster passen.'::text))
WHERE id = '33333333-3333-3333-3333-333333333334';
