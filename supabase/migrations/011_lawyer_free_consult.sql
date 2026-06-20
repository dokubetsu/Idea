-- ================================================================
-- LEAD PLATFORM — Migration 011: Lawyer Consultation Opt-In
-- ================================================================

ALTER TABLE lawyer_profiles
  ADD COLUMN IF NOT EXISTS offers_free_consultation BOOLEAN NOT NULL DEFAULT false;

-- Package opt-in: which paid tiers this lawyer offers
-- Stored as an array of consultation_package values
ALTER TABLE lawyer_profiles
  ADD COLUMN IF NOT EXISTS offered_packages consultation_package[] NOT NULL DEFAULT '{}';
-- Empty array = lawyer accepts no paid packages.
-- Card state: if offers_free_consultation=false AND offered_packages='{}'
--             → show "Not currently accepting consultations" (no booking button)
