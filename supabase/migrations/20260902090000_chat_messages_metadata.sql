-- Provenance metadata on chat messages. First use: record which quick-reply
-- pill produced a typed user turn ({"quick_reply": "differently"}) so the
-- transcript can show a small "via <pill>" label — in the product and in
-- harvested demo transcripts. Nullable and additive; nothing reads or writes
-- it before the frontend change that ships alongside this migration.
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata jsonb;
