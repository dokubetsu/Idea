-- ================================================================
-- LEAD PLATFORM — Migration 013: Meeting Scheduler
-- ================================================================


CREATE TYPE meeting_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled'
);

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  meeting_link TEXT, -- Could be a Zoom/Google Meet link
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS Policies
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Users can read meetings for their matters
CREATE POLICY "meetings:user_read"
  ON meetings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = meetings.matter_id
      AND m.user_id = auth.uid()
    )
  );

-- Lawyers can read meetings for assigned matters
CREATE POLICY "meetings:lawyer_read"
  ON meetings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = meetings.matter_id
      AND m.lawyer_id = auth.uid()
    )
  );

-- Admin can read all
CREATE POLICY "meetings:admin_all"
  ON meetings FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- Users and Lawyers can insert/update if they are associated with the matter
-- Note: we enforce specific validations (like session limits) in the backend API router.
CREATE POLICY "meetings:user_lawyer_insert"
  ON meetings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = meetings.matter_id
      AND (m.user_id = auth.uid() OR m.lawyer_id = auth.uid())
    )
  );

CREATE POLICY "meetings:user_lawyer_update"
  ON meetings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = meetings.matter_id
      AND (m.user_id = auth.uid() OR m.lawyer_id = auth.uid())
    )
  );
