-- ================================================================
--  LEAD PLATFORM — Missing Infrastructure Tables v1 (Migration 021)
-- ================================================================

-- ── 1. Schema Migrations Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version      VARCHAR(255) PRIMARY KEY,
  inserted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed existing migrations
INSERT INTO schema_migrations (version) VALUES
  ('001_schema'),
  ('002_rls'),
  ('003_migrate_from_crm'),
  ('004_commit_intake_rpc'),
  ('005_soft_deletes'),
  ('006_hearings_milestones_threading'),
  ('007_notifications'),
  ('008_notification_preferences'),
  ('009_case_health'),
  ('010_consultations'),
  ('011_lawyer_free_consult'),
  ('012_storage_bucket'),
  ('013_meetings'),
  ('014_hearing_reminders'),
  ('015_billing'),
  ('016_session_atomicity'),
  ('017_consultation_idempotency'),
  ('018_sprint3_idempotency_versioning'),
  ('019_performance_indexes'),
  ('020_concurrency_race_conditions'),
  ('021_missing_infrastructure')
ON CONFLICT (version) DO NOTHING;

-- ── 2. Payments Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id             UUID           REFERENCES matter_milestones(id) ON DELETE SET NULL,
  user_id                  UUID           REFERENCES profiles(id) ON DELETE SET NULL,
  amount_inr               NUMERIC(10,2)  NOT NULL,
  status                   TEXT           NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_id               TEXT           UNIQUE,
  payment_idempotency_key  TEXT           UNIQUE,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Enable RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Payments Policies
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ── 3. Audit Logs Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT         NOT NULL,
  target_type TEXT,
  target_id   UUID,
  changes     JSONB        NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Enable RLS for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit Logs Policies
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- Typically inserted by system/service-role (server-side API operations)

-- ── 4. Lawyer Availability Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_availability (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id              UUID         NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  day_of_week            INTEGER      NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0: Sunday, 6: Saturday
  start_time             TIME         NOT NULL,
  end_time               TIME         NOT NULL,
  slot_duration_minutes  INTEGER      NOT NULL DEFAULT 30,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_times CHECK (start_time < end_time),
  UNIQUE (lawyer_id, day_of_week, start_time)
);

-- Enable RLS for lawyer availability
ALTER TABLE lawyer_availability ENABLE ROW LEVEL SECURITY;

-- Lawyer Availability Policies
CREATE POLICY "Anyone can view lawyer availability"
  ON lawyer_availability FOR SELECT
  USING (true);

CREATE POLICY "Lawyers can manage their own availability"
  ON lawyer_availability FOR ALL
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);

-- ── 5. Time Slots Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_slots (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id        UUID         NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  consultation_id  UUID         REFERENCES consultations(id) ON DELETE SET NULL,
  start_at         TIMESTAMPTZ  NOT NULL,
  end_at           TIMESTAMPTZ  NOT NULL,
  status           TEXT         NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slot_times CHECK (start_at < end_at)
);

-- Enable RLS for time slots
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

-- Time Slots Policies
CREATE POLICY "Anyone can view time slots"
  ON time_slots FOR SELECT
  USING (true);

CREATE POLICY "Lawyers can manage their own slots"
  ON time_slots FOR ALL
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);
