BEGIN;

DROP TABLE IF EXISTS public.hearings CASCADE;
DROP TABLE IF EXISTS public.matter_milestones CASCADE;
ALTER TABLE public.matters DROP COLUMN IF EXISTS thread_id;

COMMIT;
