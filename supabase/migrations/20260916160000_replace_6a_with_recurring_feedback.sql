-- Replace 6a "How do you handle feedback or constructive criticism?" (a binary
-- self-report) with an open question about the feedback the candidate keeps
-- hearing from others, and whether they agree with it.
--
-- Why: the personality report is fed almost only self-descriptions, and the
-- narrative prompt generates insight by CONTRASTING sources. This answer is the
-- one place the survey captures how others see the candidate, and the
-- "do you agree" rider hands the model a ready-made self-vs-perceived tension.
-- The old binary answer carried no signal that the new answer does not carry
-- better, so it is replaced in place (same uuid, same slot 6.1) rather than
-- added, keeping the survey at 61 questions.
--
-- IMPORTANT SEQUENCING: apply this TOGETHER WITH the WF1 edit that rewrites the
-- "6a" entry in Process Survey Data1 (type long_text, options: []) and the
-- init-summary line. If only this migration lands, WF1 keeps listing the two
-- old options as `notChosen` for every candidate and the narrative reads a
-- choice nobody made. Pro survey only; starter/encore have their own rows.

UPDATE public.questions
SET type = 'long_text',
    label = 'What feedback have you heard more than once in your career, from managers, colleagues or clients?',
    required = true,
    allow_multiple = false,
    allow_other = false,
    config = jsonb_build_object(
      'max_length', 600,
      'description', 'Include the critical ones. Two or three sentences is plenty. Where you disagree with the feedback, say so: that disagreement is useful to us.'
    ),
    translations = jsonb_build_object(
      'nl', jsonb_build_object(
        'label', 'Welke feedback heb je in je loopbaan meer dan eens gekregen, van leidinggevenden, collega''s of klanten?',
        'description', 'Noem ook de kritische punten. Twee of drie zinnen zijn genoeg. Ben je het ergens niet mee eens? Zeg dat dan: juist dat verschil is nuttig voor ons.'
      )
    )
WHERE id = '66666666-6666-6666-6666-666666666661'
  AND type = 'multiple_choice';  -- idempotent: no-op once applied

-- Rollback (restores the row exactly as it was on 2026-09-16):
-- UPDATE public.questions
-- SET type = 'multiple_choice',
--     label = 'How do you handle feedback or constructive criticism?',
--     config = '{"choices": ["I actively seek it and use it to improve", "I find it challenging and may struggle to apply it"]}'::jsonb,
--     translations = '{"nl": {"label": "Hoe ga je om met feedback of opbouwende kritiek?", "choices": {"I actively seek it and use it to improve": "Ik zoek het actief op en gebruik het om beter te worden", "I find it challenging and may struggle to apply it": "Ik vind het lastig en kan moeite hebben om het toe te passen"}}}'::jsonb
-- WHERE id = '66666666-6666-6666-6666-666666666661';
