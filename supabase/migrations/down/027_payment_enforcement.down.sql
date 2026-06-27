BEGIN;

ALTER TABLE public.matters DROP COLUMN IF EXISTS total_paid;
DROP FUNCTION IF EXISTS public.get_matter_payment_status(UUID);

COMMIT;
