-- Enable the "non-negotiable" checkbox rider on the salary (3f) and schedule (3d)
-- questions by giving each a config.non_negotiable_rider label (+ NL translation).
-- The frontend shows the checkbox only when this key is present; the flag itself is
-- stored in a submission sidecar (responses.__non_negotiables), not in the answer,
-- so 3f/3d answers stay plain strings and existing readers are untouched.

UPDATE public.questions
SET config = jsonb_set(config, '{non_negotiable_rider}', to_jsonb(
      'This is non-negotiable for me. Rule out careers that clearly don''t meet it.'::text)),
    translations = jsonb_set(translations, '{nl,non_negotiable_rider}', to_jsonb(
      'Dit is voor mij niet onderhandelbaar. Sluit banen uit die hier duidelijk niet aan voldoen.'::text))
WHERE id IN (
  '33333333-3333-3333-3333-333333333336',  -- 3f desired compensation range
  '33333333-3333-3333-3333-333333333334'   -- 3d schedule
);
