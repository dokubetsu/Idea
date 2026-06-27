BEGIN;

ALTER TABLE public.consultations DROP COLUMN IF EXISTS idempotency_token;

COMMIT;
