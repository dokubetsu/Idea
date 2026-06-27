-- ================================================================
-- LEAD PLATFORM -- Migration 023: FK Indexes & Payment FK (H11 + H12)
-- ================================================================

-- ── H11: Missing FK indexes for tables added in migration 021 ────
-- PostgreSQL does NOT automatically create indexes on FK columns.
-- Without these, every JOIN or RLS policy that filters by these columns
-- triggers a sequential scan. Combined, these 6 columns cover all the
-- most common query patterns for the new tables.

-- payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_milestone_id
  ON public.payments(milestone_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id
  ON public.payments(user_id);

-- audit_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_actor_id
  ON public.audit_logs(actor_id);

-- Composite index on (target_type, target_id) covers all "show me logs for X" queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs(target_type, target_id);

-- lawyer_availability
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lawyer_availability_lawyer_id
  ON public.lawyer_availability(lawyer_id);

-- time_slots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_slots_lawyer_id
  ON public.time_slots(lawyer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_slots_consultation_id
  ON public.time_slots(consultation_id);

-- Partial index on available slots only (the most common lookup pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_slots_available
  ON public.time_slots(lawyer_id, start_at)
  WHERE status = 'available';


-- ── H12: Fix dual payment reference system ───────────────────────
--
-- Migration 015 added matter_milestones.payment_id as a TEXT column that
-- stored a Razorpay payment gateway reference string (e.g., "pay_AbCdXyZ123").
-- Migration 021 added a proper payments table.
-- These two references are completely independent and can diverge silently.
--
-- Fix:
--   1. Rename the existing TEXT column to payment_gateway_ref (clarifies its purpose
--      as an external payment gateway reference ID, not a FK to our payments table).
--   2. Add payment_record_id UUID FK -> payments(id) as the proper structured link.
--
-- The two columns serve DIFFERENT purposes:
--   payment_gateway_ref  TEXT  -- opaque string from Razorpay/Stripe ("pay_AbCdXyZ")
--   payment_record_id    UUID  -- FK to our internal payments table

-- Step 1: Rename old TEXT column (safe — no data type change)
ALTER TABLE matter_milestones
  RENAME COLUMN payment_id TO payment_gateway_ref;

-- Step 2: Add the structured FK column
ALTER TABLE matter_milestones
  ADD COLUMN IF NOT EXISTS payment_record_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Step 3: Index the new FK column
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matter_milestones_payment_record_id
  ON public.matter_milestones(payment_record_id);
