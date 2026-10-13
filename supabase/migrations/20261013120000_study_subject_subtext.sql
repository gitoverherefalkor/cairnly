-- Question 1g (field of study): soften the helper text.
--
-- "We use it to judge how realistic your dream roles are" read as a verdict on
-- people changing careers, and undersold the use: WF3 weighs it as background
-- in every fit score, WF4 only gates on it for licensed dream fields. Copy
-- only; the stored answer and every workflow are unchanged.
--
-- replace() swaps just the middle sentence, so the existing line-break marker
-- before "Skip if it does not apply." stays exactly as stored.

UPDATE public.questions
SET config = jsonb_set(
      config,
      '{description}',
      to_jsonb(replace(
        config->>'description',
        'We use it to judge how realistic your dream roles are.',
        'Your field of study helps us spot skills you can carry into other roles.'
      ))
    ),
    translations = jsonb_set(
      translations,
      '{nl,description}',
      to_jsonb(replace(
        translations->'nl'->>'description',
        'We gebruiken dit om te bepalen hoe realistisch je droombanen zijn.',
        'Zo zien we welke kennis en vaardigheden je kunt meenemen naar ander werk.'
      ))
    )
WHERE id = '11111111-1111-1111-1111-111111111117';
