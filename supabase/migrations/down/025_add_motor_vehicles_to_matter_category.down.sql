BEGIN;

-- Drop function dependency first
DROP FUNCTION IF EXISTS public.commit_intake(UUID, UUID, TEXT, TEXT, public.matter_category, public.matter_status, public.matter_priority, JSONB, TEXT);

ALTER TABLE public.matters ALTER COLUMN category TYPE TEXT;
UPDATE public.matters SET category = 'other' WHERE category = 'motor_vehicles';

-- Drop category and recreate old type
DROP TYPE IF EXISTS public.matter_category CASCADE;
CREATE TYPE public.matter_category AS ENUM (
  'cheque_bounce',
  'consumer_dispute',
  'builder_possession',
  'family_dispute',
  'other'
);

ALTER TABLE public.matters ALTER COLUMN category TYPE public.matter_category USING category::public.matter_category;

COMMIT;
