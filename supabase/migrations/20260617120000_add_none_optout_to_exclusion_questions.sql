-- Add a mutually-exclusive "None of these" opt-out to the two exclusion
-- questions that lack one (tendencies that hinder; aspects of a new career to
-- avoid), and mark the existing opt-out on the "industries to avoid" question
-- as mutually exclusive. This lets users honestly answer "nothing" instead of
-- being forced to pick an item or hack it through the "Other" field.
--
-- The stored answer value is always the canonical English choice, so n8n
-- (WF1 "Process Survey Data1") receives "None of these" and treats it as
-- "selected nothing real" via its existing chosen/notChosen logic — no
-- workflow change needed. config.exclusive_choices drives the front-end
-- mutual-exclusion (selecting it clears the rest, and vice versa).

-- Section 2 · Q10 — "Which of the following tendencies have you experienced...?"
update public.questions
set config = jsonb_set(
      jsonb_set(config, '{choices}', (config->'choices') || '["None of these"]'::jsonb),
      '{exclusive_choices}', '["None of these"]'::jsonb),
    translations = jsonb_set(
      translations, '{nl,choices,None of these}', '"Geen van deze"'::jsonb)
where id = '22222222-2222-2222-2222-22222222222a';

-- Section 3 · Q8 — "What aspects of a new career would you like to avoid?"
update public.questions
set config = jsonb_set(
      jsonb_set(config, '{choices}', (config->'choices') || '["None of these"]'::jsonb),
      '{exclusive_choices}', '["None of these"]'::jsonb),
    translations = jsonb_set(
      translations, '{nl,choices,None of these}', '"Geen van deze"'::jsonb)
where id = '33333333-3333-3333-3333-333333333338';

-- Section 4 · Q7 — "Are there any industries you would prefer to avoid?"
-- The existing opt-out becomes mutually exclusive (no new choice needed).
update public.questions
set config = jsonb_set(config, '{exclusive_choices}',
      '["Industry doesn''t matter to me, it about the job"]'::jsonb)
where id = '44444444-4444-4444-4444-444444444447';
