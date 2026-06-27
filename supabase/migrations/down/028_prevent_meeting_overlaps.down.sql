BEGIN;

ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS uq_meeting_no_overlaps;

COMMIT;
