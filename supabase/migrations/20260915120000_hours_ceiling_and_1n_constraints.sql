-- Two changes that let a candidate express capacity limits ("belastbaarheid"),
-- prompted by a Spoor 2 re-integration partner: in those trajectories the
-- binding constraint is what someone can sustain, not what they'd enjoy.
--
-- 1. Question 3d (schedule) gains an optional weekly hours ceiling. The value is
--    folded into the ANSWER STRING ("Part-time work (max 24 hours/week)") rather
--    than a sidecar, so the whole n8n chain reads it without a schema change:
--    WF1's Process Survey Data1 copies `chosen` through verbatim and matches the
--    option list with includes(), and the existing [NON-NEGOTIABLE] marker is
--    appended after ours. The "(max N hours/week)" suffix is written in English
--    in every locale (config.choices is the canonical answer value); only the
--    field's label and placeholder are translated.
--
-- 2. Question 1n (Additional Context) leads with the working conditions someone
--    needs rather than burying them behind finances and caregiving, and drops
--    the "skip if nothing comes to mind" sign-off that invited people to skip it.
--    Deliberately phrased as forward-looking working conditions, never as health
--    or diagnosis: it collects the actionable signal (WF3 already reads 1n as
--    "Personal Constraints") without moving into special-category data.

-- 1. Hours ceiling on 3d ---------------------------------------------------
UPDATE public.questions
SET config = jsonb_set(config, '{hours_field}', jsonb_build_object(
      'label', 'Maximum hours per week (optional)',
      'placeholder', 'e.g. 24')),
    translations = jsonb_set(translations, '{nl,hours_field}', jsonb_build_object(
      'label', 'Maximaal aantal uur per week (optioneel)',
      'placeholder', 'bijv. 24'))
WHERE id = '33333333-3333-3333-3333-333333333334';  -- 3d schedule

-- 2. Reframed Additional Context (1n) -------------------------------------
UPDATE public.questions
SET config = jsonb_set(
      jsonb_set(config, '{description}', to_jsonb(
        'Anything we should take into account in your recommendations? (Optional)\nFor example: working conditions you need in order to sustain a role (a calm environment, control over your own pace, little deadline pressure, limited screen time, no physically demanding work, a short commute), your household''s financial situation, or caregiving commitments at home.\nThe more concrete you are, the better we can rule out roles that would not fit.'::text)),
      '{placeholder}', to_jsonb(
        'e.g. a maximum of 24 hours a week, a calm environment, a short commute, caregiving two days a week'::text)),
    translations = jsonb_set(translations, '{nl,description}', to_jsonb(
      'Is er iets dat we moeten meewegen in je aanbevelingen? (Optioneel)\nBijvoorbeeld: werkomstandigheden die je nodig hebt om een functie vol te houden (een rustige omgeving, grip op je eigen tempo, weinig deadlinedruk, beperkt beeldschermwerk, geen zwaar fysiek werk, korte reistijd), de financiële situatie van je huishouden, of zorgtaken thuis.\nHoe concreter je bent, hoe beter we rollen kunnen uitsluiten die niet passen.'::text))
WHERE id = '11111111-1111-1111-1111-111111111121';  -- 1n Additional Context
