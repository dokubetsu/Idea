BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 009: Case Health Status
-- ================================================================

CREATE TYPE matter_health_status AS ENUM (
  'waiting_on_client',
  'waiting_on_lawyer',
  'waiting_on_court',
  'in_progress'
);

ALTER TABLE matters
  ADD COLUMN IF NOT EXISTS matter_health matter_health_status NOT NULL DEFAULT 'in_progress';

COMMENT ON COLUMN matters.matter_health IS
  'Signals who has the ball: waiting_on_client = action needed from client,
   waiting_on_lawyer = lawyer is working, waiting_on_court = next step is a hearing,
   in_progress = actively being worked on. Set by lawyer via PATCH /matters/{id}.';

COMMIT;
