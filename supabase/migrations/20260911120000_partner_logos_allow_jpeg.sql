-- partner-logos bucket: accept JPEG uploads.
--
-- ops-partners started accepting image/jpeg on 2026-09-11 (commit b9bddc4),
-- but the bucket's own allowlist still said PNG + SVG only, so Storage answered
-- every JPG upload with 415 invalid_mime_type and the Ops form showed a bare
-- "Something went wrong". Two allowlists, one forgotten. The function remains
-- the place that decides what a logo may be; this just stops the bucket from
-- disagreeing with it. Size cap (256 KB) unchanged.

update storage.buckets
set allowed_mime_types = array['image/png', 'image/svg+xml', 'image/jpeg']
where id = 'partner-logos';
