BEGIN;

DROP TABLE IF EXISTS public.matter_updates CASCADE;
DROP TABLE IF EXISTS public.matter_assignments CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.matters CASCADE;
DROP TABLE IF EXISTS public.lawyer_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.matter_priority CASCADE;
DROP TYPE IF EXISTS public.matter_status CASCADE;
DROP TYPE IF EXISTS public.matter_category CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

COMMIT;
