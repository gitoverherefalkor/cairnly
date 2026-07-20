-- Fix the Section 7 career-goal questions' selection-count contradiction.
--
-- Section 7 Q1 (short-term goals) and Q2 (long-term goals) displayed conflicting
-- instructions: their description reads "Choose up to 2" (NL: "Kies maximaal 2"),
-- but max_selections was 3, so the survey's auto-generated hint said
-- "Select between 1 and 3".
--
-- Every other multi-select across all three surveys has its "up to N" copy match
-- max_selections -- including the sibling Q3 in this same section ("up to 2" / 2).
-- These two were the only outliers, so the authored copy (2) is the intent and
-- max_selections = 3 was stale. Both EN and NL copy already say 2, so no
-- translation change is needed.
--
-- Reversible: set max_selections back to 3 to undo.

update questions set max_selections = 2
where id in (
  '77777777-7777-7777-7777-777777777771', -- S7 Q1: short-term career goals
  '77777777-7777-7777-7777-777777777772'  -- S7 Q2: long-term career goals
);
