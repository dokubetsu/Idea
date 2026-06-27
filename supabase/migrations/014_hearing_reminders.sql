BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 014: Hearing Reminders
-- ================================================================

ALTER TABLE hearings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
