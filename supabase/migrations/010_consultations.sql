BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 010: Consultations
-- ================================================================

CREATE TYPE consultation_package AS ENUM ('free', 'starter', 'full');
-- Package-to-session-count mapping (configured in app, not in DB):
--   free    = 1 session
--   starter = 3 sessions
--   full    = 5 sessions

CREATE TYPE consultation_status AS ENUM (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'declined'
);

CREATE TYPE consultation_payment_status AS ENUM (
  'unpaid',
  'paid',
  'waived'
);

CREATE TABLE consultations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lawyer_id           UUID REFERENCES profiles(id),
  -- lawyer_id is nullable ONLY when package='free' and the platform assigns a lawyer.
  -- The assignment logic is defined in the router (first available opted-in lawyer),
  -- not left open-ended. Platform-assigns path is a v1 simplification;
  -- if no lawyer is available, booking returns a "no availability" error,
  -- not a silent null.

  package             consultation_package NOT NULL DEFAULT 'free',
  sessions_total      INT NOT NULL DEFAULT 1,
  sessions_used       INT NOT NULL DEFAULT 0
                        CHECK (sessions_used >= 0 AND sessions_used <= sessions_total),
  status              consultation_status NOT NULL DEFAULT 'pending',
  payment_status      consultation_payment_status NOT NULL DEFAULT 'unpaid',
  matter_id           UUID REFERENCES matters(id),
  notes               TEXT,
  scheduled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── updated_at trigger ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_consultations_updated_at
    BEFORE UPDATE ON consultations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Row Level Security ───────────────────────────────────────────
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- User reads their own bookings
CREATE POLICY "consultations:user_read_own"
  ON consultations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Lawyer reads consultations assigned to them
CREATE POLICY "consultations:lawyer_read_assigned"
  ON consultations FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid());

-- Admin reads all (uses auth_role() helper from 002_rls.sql — not hand-rolled EXISTS)
CREATE POLICY "consultations:admin_all"
  ON consultations FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- User creates their own bookings
CREATE POLICY "consultations:user_insert"
  ON consultations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Lawyer updates consultations assigned to them (confirm / decline / complete)
CREATE POLICY "consultations:lawyer_update_assigned"
  ON consultations FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid());

-- User can cancel their OWN PENDING booking before lawyer responds
-- Scoped to status = 'pending' to prevent cancelling confirmed/completed consultations
CREATE POLICY "consultations:user_cancel_own"
  ON consultations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');
  -- WITH CHECK ensures the user can only SET status to 'cancelled',
  -- not change any other field through this policy path

-- ================================================================
-- confirm_consultation RPC
-- ================================================================

CREATE OR REPLACE FUNCTION confirm_consultation(
  p_consultation_id UUID,
  p_lawyer_id       UUID   -- verified by router BEFORE this call
)
RETURNS TABLE (
  matter_id          UUID,
  already_confirmed  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_matter_id  UUID;
  v_status     consultation_status;
  v_user_id    UUID;
  v_consultation_lawyer_id UUID;
BEGIN
  -- 1. Acquire row lock immediately.
  --    FOR UPDATE prevents two concurrent PATCH /confirm calls from both reading
  --    matter_id IS NULL and both proceeding to INSERT — the exact race condition
  --    in the original draft. One call blocks until the other commits.
  --    Also verifies the consultation exists in the same query.
  SELECT c.matter_id, c.status, c.user_id, c.lawyer_id
    INTO v_matter_id, v_status, v_user_id, v_consultation_lawyer_id
    FROM consultations c
    WHERE c.id = p_consultation_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation % not found', p_consultation_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Add lawyer ownership check
  IF v_consultation_lawyer_id IS NOT NULL AND v_consultation_lawyer_id != p_lawyer_id THEN
    RAISE EXCEPTION 'Lawyer % is not authorized to confirm this consultation', p_lawyer_id
      USING ERRCODE = 'P0004';
  END IF;

  -- 2. Idempotency: already confirmed → return existing matter, do nothing.
  IF v_matter_id IS NOT NULL THEN
    RETURN QUERY SELECT v_matter_id, TRUE;
    RETURN;
  END IF;

  -- 3. Status guard: only 'pending' consultations can be confirmed.
  --    A 'declined' or 'cancelled' consultation must not silently create a matter
  --    on a stale retry or a replayed request.
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot confirm consultation with status %: must be pending', v_status
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Create matter atomically within the same transaction.
  INSERT INTO matters (user_id, lawyer_id, title, category, status)
    VALUES (v_user_id, p_lawyer_id, 'Consultation Case', 'other', 'active')
    RETURNING id INTO v_matter_id;

  -- 5. Link matter back and advance status.
  UPDATE consultations
    SET matter_id  = v_matter_id,
        status     = 'confirmed',
        lawyer_id  = p_lawyer_id,
        updated_at = now()
    WHERE id = p_consultation_id;

  RETURN QUERY SELECT v_matter_id, FALSE;
END;
$$;

COMMIT;
