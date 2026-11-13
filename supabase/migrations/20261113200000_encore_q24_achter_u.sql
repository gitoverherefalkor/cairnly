-- Encore v2 Q2.4 Dutch label: "achter zich" -> "achter u" (round 6 persona finding).
-- Both are allowed with "u", but "achter u" reads more natural. Display text only;
-- stored answer values are the English choices and do not change. No new objects, no grants.
UPDATE public.questions
SET translations = jsonb_set(translations, '{nl,label}', '"Wat laat u graag achter u?"'::jsonb)
WHERE id = 'c3c3c3c3-0002-4000-a000-000000000004';
