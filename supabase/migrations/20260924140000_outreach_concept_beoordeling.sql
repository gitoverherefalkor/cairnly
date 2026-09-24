-- The second reader's verdict on a concept (supabase/functions/_shared/outreachCritic.ts).
--
-- { verdict: 'goed' | 'krom' | 'template' | 'onbekend', reasons: [...], zin, rounds, model }
-- 'template' means the mail holds no model-written text at all. Auto-approve
-- only passes 'goed' and 'template'; /ops shows the verdict and the reasons on
-- the card, and compares it with what Sjoerd did to build trust before he
-- turns auto-approve on.

alter table public.outreach_concepts
  add column if not exists beoordeling jsonb;

comment on column public.outreach_concepts.beoordeling is
  'Critic verdict: {verdict: goed|krom|template|onbekend, reasons, zin, rounds, model}. Auto-approve requires goed or template.';
