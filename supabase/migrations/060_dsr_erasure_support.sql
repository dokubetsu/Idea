-- Migration 060: DSR erasure support columns
-- Tracks when a user exercised right-to-erasure so ops/legal can audit.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dsr_erased_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.dsr_erased_at IS
  'Set when the user completed DSR erasure; account should remain inactive.';

INSERT INTO schema_migrations (version)
VALUES ('060_dsr_erasure_support')
ON CONFLICT (version) DO NOTHING;

COMMIT;
