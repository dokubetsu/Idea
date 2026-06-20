-- ================================================================
-- LEAD PLATFORM — Migration 014: Hearing Reminders
-- ================================================================

ALTER TABLE hearings ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
