BEGIN;

ALTER TABLE public.hearings DROP COLUMN IF EXISTS reminder_sent;

COMMIT;
