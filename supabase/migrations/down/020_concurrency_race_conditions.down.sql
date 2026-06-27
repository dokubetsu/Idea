BEGIN;

DROP FUNCTION IF EXISTS public.acquire_matter_lock(UUID);
DROP FUNCTION IF EXISTS public.release_matter_lock(UUID);

COMMIT;
