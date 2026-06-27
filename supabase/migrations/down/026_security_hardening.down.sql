BEGIN;

DROP FUNCTION IF EXISTS public.confirm_consultation_v2(UUID);
DROP FUNCTION IF EXISTS public.contact_lawyer_v2(UUID, UUID, TEXT);

COMMIT;
