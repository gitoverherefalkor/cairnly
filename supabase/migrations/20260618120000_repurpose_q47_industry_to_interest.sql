-- Repurpose Q4.7 (n8n short-code 4g, id …4447): retire "industries you would
-- prefer to avoid" and replace it with a short open-text prompt that surfaces the
-- candidate's natural strengths through an outside-in lens (what people rely on
-- them for). This captures revealed/authentic signal the survey did not previously
-- have, and replaces a blunt industry-level exclusion filter.
--
-- The matching industry-avoidance logic is being removed from WF1/WF2/WF3/WF4 in
-- the same change set. Same question_id is reused (never insert a new row — it
-- would break the n8n UUID mapping).
--
-- Existing stored answers for this id (old industry selections) are left as-is:
-- they are historical inputs to already-generated reports. Only new respondents
-- see the new question.

update public.questions
set type           = 'long_text',
    label          = 'When people come to you for help or advice, what''s it usually about?',
    allow_multiple = false,
    allow_other    = false,
    config = jsonb_build_object(
      'description', 'A sentence or two is plenty. Think about what friends or colleagues naturally turn to you for, the kind of help or advice people seek from you.',
      'max_length', 600
    ),
    translations = jsonb_build_object(
      'nl', jsonb_build_object(
        'label', 'Waarvoor komen mensen bij jou voor hulp of advies?',
        'description', 'Een zin of twee is genoeg. Denk aan waar vrienden of collega''s van nature voor bij je aankloppen, het soort hulp of advies dat mensen bij jou zoeken.'
      )
    )
where id = '44444444-4444-4444-4444-444444444447';
