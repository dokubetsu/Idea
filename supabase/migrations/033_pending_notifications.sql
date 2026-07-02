CREATE TABLE IF NOT EXISTS pending_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL,
  actor_id            UUID,
  matter_id           UUID,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscriber_name     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  attempts            INT NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with admin role to manage outbox
DROP POLICY IF EXISTS "pending_notifications:admin_all" ON pending_notifications;
CREATE POLICY "pending_notifications:admin_all"
  ON pending_notifications FOR ALL TO authenticated
  USING (auth_role() = 'admin');
