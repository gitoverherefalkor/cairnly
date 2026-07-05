-- The frontend (useCustomResumes) has subscribed to postgres_changes on
-- custom_resumes since the feature shipped, but the table was never added to
-- the supabase_realtime publication (only reports is), so those events never
-- fired. Generation masked this: its 4s polling runs while rows are
-- 'processing'. The Strengthen feature surfaces it because strength_review
-- updates land on already-completed rows, where polling is off.

alter publication supabase_realtime add table custom_resumes;
