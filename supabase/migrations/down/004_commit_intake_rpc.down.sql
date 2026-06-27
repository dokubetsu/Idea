BEGIN;

DROP FUNCTION IF EXISTS public.commit_intake(UUID, UUID, TEXT, TEXT, public.matter_category, public.matter_status, public.matter_priority, JSONB, TEXT);

COMMIT;
