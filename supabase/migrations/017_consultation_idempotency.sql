BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 017: Consultation Idempotency
-- ================================================================

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

COMMIT;
