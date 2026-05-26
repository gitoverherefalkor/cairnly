-- Add share_quotes column to report_sections so the share-card modal can
-- show AI-summarized one-liners instead of literal raw sentences from the
-- body. Populated by the generate-share-quotes edge function on first
-- modal open for a given role section; null until then. Only top_career_1/2/3
-- and outside_box sections will ever have values written here.
--
-- Shape: a JSON array of short strings, e.g.
--   ["You get founder-level autonomy without the capital burn.",
--    "Strategic engagement of the CoS role without the politics.",
--    "Advisory model solves both problems at once."]

ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS share_quotes jsonb;

COMMENT ON COLUMN public.report_sections.share_quotes IS
  'AI-summarized shareable quotes for the share-card modal. Generated on-demand by the generate-share-quotes edge function. JSON array of short strings (1-3 items). Null until generated.';
