-- ================================================================
-- LEAD PLATFORM — Migration 015: Milestone Billing
-- ================================================================

ALTER TABLE matter_milestones
ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id TEXT;
