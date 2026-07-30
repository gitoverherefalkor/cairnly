-- Reframe the "What subject or specialization did you study?" question (1g,
-- uuid …117) description. Pro survey only.
--
-- Why: the old copy read "(Optional: Fill this out if you want it considered
-- for career suggestions)", which framed the field as a nice-to-have AND
-- oversold what it did. Measured fill rate is already 26/26 on real completed
-- submissions (the only blanks are empty-payload test rows), so the field is
-- not being overlooked and does not need `required = true` — which would only
-- trap the "No formal education" / "High school diploma" respondents into
-- typing "n/a". What needed fixing was the framing, not the gate.
--
-- The new copy states the actual use (how realistic the dream roles are), which
-- lands once the matching WF4 "Credential Reality" prompt change is in. Apply
-- this migration together with that change, not before. The copy deliberately
-- says "dream roles" and not "career suggestions": the Top 3 ranking was left
-- degree-blind on purpose, so promising more would overstate it.
--
-- Description copy only: `required` stays false, the stored answer shape (bare
-- string) is unchanged, and every n8n question mapping still reads [1g].
--
-- The frontend renders a literal \n (backslash-n) as <br> via
-- formatTextWithEmphasis in QuestionRenderer.tsx, so line breaks are stored as \n.

UPDATE public.questions
SET config = jsonb_set(config, '{description}', to_jsonb(
  'List your degree(s) or specialization. We use it to judge how realistic your dream roles are.\nSkip if it does not apply.'::text))
WHERE id = '11111111-1111-1111-1111-111111111117';

UPDATE public.questions
SET translations = jsonb_set(translations, '{nl,description}', to_jsonb(
  'Noem je opleiding(en) of specialisatie. We gebruiken dit om te bepalen hoe realistisch je droombanen zijn.\nSla over als het niet van toepassing is.'::text))
WHERE id = '11111111-1111-1111-1111-111111111117';
