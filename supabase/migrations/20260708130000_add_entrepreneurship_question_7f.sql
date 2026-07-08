-- New question 7f: entrepreneurial appetite (Pro survey only).
-- Placed as the final question of section 7 "Career Goals and Development".
--
-- IMPORTANT SEQUENCING: do NOT ship this to the live survey until WF1 knows the
-- 7f code (its code->uuid dict entry) and WF2 reads it. Otherwise live users
-- answer a question the pipeline ignores. Apply this together with the WF1/WF2
-- edits after they are exported and approved. See
-- docs/superpowers/specs/2026-07-08-entrepreneurship-question-design.md
--
-- Stable-code note: codes are UUID-mapped in WF1 and independent of order_num,
-- so adding this row renumbers nothing (4a..7e keep their UUIDs).

INSERT INTO public.questions
  (id, section_id, type, label, required, allow_multiple, allow_other, order_num, config, translations)
VALUES (
  '77777777-7777-7777-7777-777777777776',
  '70000000-0000-0000-0000-000000000001',
  'multiple_choice',
  'How interested are you in starting your own business?',
  true,   -- required (single-select; "Not for me" is a painless opt-out)
  false,  -- single-select
  true,   -- allow_other -> open "Other" field (required once ticked, min 4 chars)
  6,      -- last question of section 7 (current max order_num is 5)
  jsonb_build_object(
    'choices', jsonb_build_array(
      'Not for me',
      'Curious about it, but not actively planning',
      'Interested and seriously considering it',
      'I already run, or have run, my own business'
    ),
    'description', 'There are no wrong answers; this just helps us judge whether self-employed paths belong in your recommendations. Choose one, or add your own.'
  ),
  jsonb_build_object(
    'nl', jsonb_build_object(
      'label', 'Hoe geïnteresseerd ben je in het starten van een eigen bedrijf?',
      'choices', jsonb_build_object(
        'Not for me', 'Niets voor mij',
        'Curious about it, but not actively planning', 'Nieuwsgierig, maar ik ben er niet actief mee bezig',
        'Interested and seriously considering it', 'Geïnteresseerd en ik overweeg het serieus',
        'I already run, or have run, my own business', 'Ik heb al een eigen bedrijf (gehad)'
      ),
      'description', 'Er zijn geen foute antwoorden; dit helpt ons bepalen of zelfstandige loopbaanpaden bij je passen. Kies er één, of vul je eigen antwoord in.'
    )
  )
)
ON CONFLICT (id) DO NOTHING;

-- Rollback:
-- DELETE FROM public.questions WHERE id = '77777777-7777-7777-7777-777777777776';
