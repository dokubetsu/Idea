BEGIN;

DROP TABLE IF EXISTS public.time_slots CASCADE;
DROP TABLE IF EXISTS public.lawyer_availability CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.audit_action CASCADE;

COMMIT;
