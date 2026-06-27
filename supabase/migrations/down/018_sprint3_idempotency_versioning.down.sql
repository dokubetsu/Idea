BEGIN;

ALTER TABLE public.events DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE public.matters DROP COLUMN IF EXISTS version;

COMMIT;
