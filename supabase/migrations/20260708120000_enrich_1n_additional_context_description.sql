-- Enrich the "Additional Context" open question (1n, uuid …121) description to
-- invite feasibility context (household finances, family/caregiving, health/
-- accessibility) without adding any fields. Pro survey only.
--
-- Description copy only: the stored answer shape (bare string) and every n8n
-- question mapping are unchanged. Business appetite is intentionally NOT invited
-- here because the new entrepreneurship question (7f) owns that signal.
--
-- The frontend renders a literal \n (backslash-n) as <br> via
-- formatTextWithEmphasis in QuestionRenderer.tsx, so line breaks are stored as \n.

UPDATE public.questions
SET config = jsonb_set(config, '{description}', to_jsonb(
  'Anything else that should shape your recommendations? (Optional)\nE.g. your (household''s) financial situation, any family or caregiving commitments, and any health or accessibility considerations. Any other highly noteworthy disclaimers or remarks.\nSkip if nothing comes to mind.'::text))
WHERE id = '11111111-1111-1111-1111-111111111121';

UPDATE public.questions
SET translations = jsonb_set(translations, '{nl,description}', to_jsonb(
  'Is er nog iets dat je aanbevelingen zou moeten beïnvloeden? (Optioneel)\nBijv. je financiële situatie (of die van je huishouden), eventuele gezins- of zorgverplichtingen, en eventuele gezondheids- of toegankelijkheidsoverwegingen. Of andere zeer noemenswaardige kanttekeningen of opmerkingen.\nSla over als er niets te binnen schiet.'::text))
WHERE id = '11111111-1111-1111-1111-111111111121';
