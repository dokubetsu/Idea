BEGIN;

-- Clean up any invalid pre-existing bar council IDs by setting them to NULL
UPDATE public.lawyer_profiles
SET bar_council_id = NULL
WHERE bar_council_id IS NOT NULL
  AND bar_council_id !~ '^[A-Z]{2,3}/\d+/\d{4}$';

ALTER TABLE public.lawyer_profiles
  ADD CONSTRAINT chk_bar_council_id_format
  CHECK (bar_council_id IS NULL OR bar_council_id ~ '^[A-Z]{2,3}/\d+/\d{4}$');

COMMIT;
