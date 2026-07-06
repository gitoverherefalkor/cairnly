-- Region question: add cost-of-living anchors to the description so US users can
-- tell which "cost region" tier they belong to. Feedback from a live US user:
-- "Dividing the US into cost regions is confusing. I'm in a major metro (usually
-- high cost) but it's also praised for affordability."
--
-- Copy-only change. The dropdown `choices` (the exact strings forwarded to the
-- n8n salary pipeline) are deliberately UNTOUCHED; only `config.description`
-- changes. Applies to all three surveys that share this region question:
--   Pro     11111111-1111-1111-1111-111111111114  (live, "seeking change")
--   Starter a1a1a1a1-0001-4000-a000-000000000003
--   Encore  b2b2b2b2-0001-4000-a000-000000000003
-- Each keeps its own existing "if you're moving" lead sentence.

-- Pro (live)
UPDATE public.questions
SET config = jsonb_set(
  config, '{description}',
  to_jsonb('If you prepare to move somewhere else soon, then select that region. The US options refer to local cost of living, not city size: **high-cost** is pricey metros like New York, San Francisco, Boston, Seattle, LA and DC; **average-cost** is places like Chicago, Dallas, Houston, Atlanta and Minneapolis; **lower-cost** is smaller inland cities like Oklahoma City, Memphis and Cleveland, plus rural areas. Not sure? Pick average-cost.'::text)
)
WHERE id = '11111111-1111-1111-1111-111111111114';

-- Starter
UPDATE public.questions
SET config = jsonb_set(
  config, '{description}',
  to_jsonb('If you are about to move, pick the region you are moving to. The US options refer to local cost of living, not city size: **high-cost** is pricey metros like New York, San Francisco, Boston, Seattle, LA and DC; **average-cost** is places like Chicago, Dallas, Houston, Atlanta and Minneapolis; **lower-cost** is smaller inland cities like Oklahoma City, Memphis and Cleveland, plus rural areas. Not sure? Pick average-cost.'::text)
)
WHERE id = 'a1a1a1a1-0001-4000-a000-000000000003';

-- Encore
UPDATE public.questions
SET config = jsonb_set(
  config, '{description}',
  to_jsonb('If you are moving somewhere for this next stage, pick that region. The US options refer to local cost of living, not city size: **high-cost** is pricey metros like New York, San Francisco, Boston, Seattle, LA and DC; **average-cost** is places like Chicago, Dallas, Houston, Atlanta and Minneapolis; **lower-cost** is smaller inland cities like Oklahoma City, Memphis and Cleveland, plus rural areas. Not sure? Pick average-cost.'::text)
)
WHERE id = 'b2b2b2b2-0001-4000-a000-000000000003';

-- Dutch translation of the Pro region description (only survey with an nl translation).
-- Anchors match the Dutch option labels: Dure / Gemiddelde / Goedkopere regio's.
UPDATE public.questions
SET translations = jsonb_set(
  translations, '{nl,description}',
  to_jsonb('Als je van plan bent binnenkort te verhuizen, kies dan die regio. De VS-opties gaan over lokale kosten van levensonderhoud, niet over de grootte van de stad: **dure regio''s** zijn prijzige metropolen zoals New York, San Francisco, Boston, Seattle, LA en DC; **gemiddelde regio''s** zijn plekken als Chicago, Dallas, Houston, Atlanta en Minneapolis; **goedkopere regio''s** zijn kleinere binnenlandse steden zoals Oklahoma City, Memphis en Cleveland, plus landelijke gebieden. Niet zeker? Kies gemiddelde regio''s.'::text)
)
WHERE id = '11111111-1111-1111-1111-111111111114';
