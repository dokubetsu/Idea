BEGIN;

ALTER TABLE public.matters DROP COLUMN IF EXISTS health_score;
ALTER TABLE public.matters DROP COLUMN IF EXISTS health_details;

COMMIT;
