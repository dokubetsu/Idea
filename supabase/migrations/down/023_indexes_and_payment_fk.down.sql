-- Note: Concurrent index drops are not wrapped in a transaction block
DROP INDEX IF EXISTS public.idx_payments_milestone_id;
DROP INDEX IF EXISTS public.idx_payments_user_id;
DROP INDEX IF EXISTS public.idx_audit_logs_actor_id;
DROP INDEX IF EXISTS public.idx_audit_logs_target;
DROP INDEX IF EXISTS public.idx_lawyer_availability_lawyer_id;
DROP INDEX IF EXISTS public.idx_time_slots_lawyer_id;
DROP INDEX IF EXISTS public.idx_time_slots_consultation_id;
DROP INDEX IF EXISTS public.idx_time_slots_available;
DROP INDEX IF EXISTS public.idx_matter_milestones_payment_record_id;

-- DDL can run in its own block
BEGIN;
ALTER TABLE public.matter_milestones DROP COLUMN IF EXISTS payment_record_id;
ALTER TABLE public.matter_milestones RENAME COLUMN payment_gateway_ref TO payment_id;
COMMIT;
