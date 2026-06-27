BEGIN;

DROP FUNCTION IF EXISTS public.verify_lawyer_rpc(UUID);
DROP FUNCTION IF EXISTS public.suspend_lawyer_rpc(UUID);

COMMIT;
