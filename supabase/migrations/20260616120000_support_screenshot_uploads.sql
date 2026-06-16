-- Add screenshot support to the Feedback & Support form.
--
-- A private bucket holds the uploaded image; the support_requests row keeps the
-- object path so the screenshot can be retrieved later. The
-- submit-support-request edge function runs with the service role and is the
-- only reader/writer, so no public storage RLS policies are needed (and we keep
-- the bucket private to avoid exposing user-submitted screenshots publicly).

alter table public.support_requests
  add column if not exists screenshot_path text;

insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
