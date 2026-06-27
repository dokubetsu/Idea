BEGIN;

ALTER TABLE public.matter_milestones DROP COLUMN IF EXISTS payment_id;
ALTER TABLE public.matter_milestones DROP COLUMN IF EXISTS invoice_url;

COMMIT;
