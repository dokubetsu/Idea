BEGIN;

ALTER TABLE public.lawyer_profiles DROP COLUMN IF EXISTS offers_free_consultation;

COMMIT;
