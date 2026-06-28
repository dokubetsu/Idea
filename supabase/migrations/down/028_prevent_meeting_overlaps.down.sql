BEGIN;

DROP TRIGGER IF EXISTS trg_check_meeting_overlap ON public.meetings;
DROP FUNCTION IF EXISTS check_meeting_overlap();

COMMIT;
