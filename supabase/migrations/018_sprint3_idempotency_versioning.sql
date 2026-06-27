BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 018: Sprint 3 Idempotency & Versioning
-- ================================================================

-- 1. Add schema_version to intake_sessions
ALTER TABLE public.intake_sessions ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 2;

-- 2. Add idempotency_key to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 3. Add payment_idempotency_key to matter_milestones
ALTER TABLE public.matter_milestones ADD COLUMN IF NOT EXISTS payment_idempotency_key TEXT UNIQUE;

COMMIT;
