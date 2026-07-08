-- Drop "Lastly," from the 7e question label (EN + NL). 7e is no longer the last
-- question of section 7 now that 7f (entrepreneurship) follows it.
-- Display-only label change; n8n keys off the question code/uuid, not the label.

UPDATE public.questions
SET label = 'Which areas or competencies do you enjoy and would you like to develop (further) as part of a next/new job?',
    translations = jsonb_set(translations, '{nl,label}', to_jsonb(
      'Welke gebieden of competenties vind je leuk en wil je (verder) ontwikkelen als onderdeel van een volgende/nieuwe baan?'::text))
WHERE id = '77777777-7777-7777-7777-777777777775';
