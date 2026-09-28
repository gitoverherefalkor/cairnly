-- Outreach: a Cc on a concept.
--
-- Replies sometimes name a colleague to include ("stuur de code naar
-- aveenstra@stambv.com", Stam B.V., 2026-09-25). The cockpit now shows To and
-- Cc as editable fields; outreach-send puts Cc in the MIME headers.
-- Comma-separated addresses, null when there is none.

alter table public.outreach_concepts add column if not exists cc text;

comment on column public.outreach_concepts.cc is
  'Comma-separated Cc addresses, set in /ops. Null = no Cc.';
