-- ================================================================
-- LEAD PLATFORM -- Migration 028: Prevent Lawyer Double-Booking
-- ================================================================

CREATE OR REPLACE FUNCTION check_meeting_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_lawyer_id UUID;
  v_overlap_exists BOOLEAN;
BEGIN
  -- Only check if status is 'scheduled'
  IF NEW.status = 'scheduled' THEN
    -- Get the lawyer_id for the matter of the new/updated meeting
    SELECT lawyer_id INTO v_lawyer_id
    FROM public.matters
    WHERE id = NEW.matter_id;

    IF v_lawyer_id IS NOT NULL THEN
      -- Check if another scheduled meeting exists for the same lawyer that overlaps
      SELECT EXISTS (
        SELECT 1
        FROM public.meetings m
        JOIN public.matters mat ON m.matter_id = mat.id
        WHERE mat.lawyer_id = v_lawyer_id
          AND m.status = 'scheduled'
          AND m.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          -- Overlap check: (Start1 < End2) AND (Start2 < End1)
          AND NEW.scheduled_at < (m.scheduled_at + (m.duration_minutes * interval '1 minute'))
          AND (NEW.scheduled_at + (NEW.duration_minutes * interval '1 minute')) > m.scheduled_at
      ) INTO v_overlap_exists;

      IF v_overlap_exists THEN
        RAISE EXCEPTION 'Lawyer is already booked at this time' USING ERRCODE = '23514'; -- CHECK_VIOLATION
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger
DO $$ BEGIN
  CREATE TRIGGER trg_check_meeting_overlap
    BEFORE INSERT OR UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION check_meeting_overlap();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Register this migration
INSERT INTO schema_migrations (version) VALUES ('028_prevent_meeting_overlaps') ON CONFLICT (version) DO NOTHING;
