BEGIN;

DROP TABLE IF EXISTS public.consultations CASCADE;
DROP TYPE IF EXISTS public.consultation_status CASCADE;
DROP TYPE IF EXISTS public.consultation_package CASCADE;

COMMIT;
