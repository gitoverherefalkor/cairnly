-- Section 2 · Q7 (2g) "What kind of work environment do you prefer?" had two
-- "Highly Flexible" options; the 4th was a mislabeled duplicate that should be
-- the structured extreme. Fix the 4th option (label + description) and reorder
-- the four choices into a clean Flexible -> Structured ramp.
--
-- Single-select question; the stored value is the canonical English choice, so
-- WF1's "2g" options list must be updated to match (done separately by hand).

update public.questions
set config = jsonb_set(config, '{choices}',
      '["**Highly Flexible** (Minimal structure and maximum autonomy)","**Somewhat Flexible** (I prefer fluidity but appreciate some process)","**Somewhat Structured** (I prefer a process but not rigid rules)","**Highly Structured** (Clear structure and defined expectations)"]'::jsonb),
    translations = jsonb_set(
      translations,
      '{nl,choices}',
      ((translations->'nl'->'choices') - '**Highly Flexible** (I find structure stifling)')
        || jsonb_build_object(
             '**Highly Structured** (Clear structure and defined expectations)',
             '**Heel gestructureerd** (Duidelijke structuur en heldere verwachtingen)')
    )
where id = '22222222-2222-2222-2222-222222222227';
