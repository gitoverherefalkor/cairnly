-- Encore v2: hide 5.2 ("What does your partner hope for...") when 5.1 is
-- "I don't have a partner". The survey reads config.show_if (src/lib/surveySkip.ts).
-- Config-only change on one question row; no table or grant changes.
update public.questions
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'show_if', jsonb_build_object(
    'question_id', 'c3c3c3c3-0005-4000-a000-000000000001',
    'not_in', jsonb_build_array('I don''t have a partner')
  )
)
where id = 'c3c3c3c3-0005-4000-a000-000000000002';
