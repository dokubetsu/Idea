BEGIN;

-- ── 1. Revoke blanket table privileges on sensitive tables ──────────
REVOKE ALL PRIVILEGES ON TABLE public.schema_migrations FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.pending_notifications FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM authenticated;


-- ── 2. Add UNIQUE constraint to invoices.invoice_number ────────────
-- Clean up any duplicates beforehand (append suffix to any duplicates)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY invoice_number ORDER BY created_at) as rn
  FROM public.invoices
)
UPDATE public.invoices
SET invoice_number = invoice_number || '_' || substr(md5(random()::text), 1, 6)
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Drop unique constraint if exists first to be safe, then add
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS unique_invoice_number;
ALTER TABLE public.invoices ADD CONSTRAINT unique_invoice_number UNIQUE (invoice_number);


-- ── 3. Lawyer Suspension RPC Refinements & Reactivation ─────────────
CREATE OR REPLACE FUNCTION suspend_lawyer_rpc(p_lawyer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  -- Authorization: caller must be admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.user_role AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Check that target is actually a lawyer
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_lawyer_id AND role = 'lawyer'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Target user is not a lawyer or does not exist' USING ERRCODE = '45000';
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Update lawyer_profiles table
  UPDATE public.lawyer_profiles
  SET is_available = FALSE,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Clear the elevated role from JWT claims
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "suspended"}'::jsonb
  WHERE id = p_lawyer_id;
END;
$$;

-- Atomic lawyer reactivation RPC
CREATE OR REPLACE FUNCTION reactivate_lawyer_rpc(p_lawyer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  -- Authorization: caller must be admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.user_role AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Check that target exists and is a lawyer (or suspended lawyer)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_lawyer_id AND (role = 'lawyer'::public.user_role OR (raw_app_meta_data->>'role' = 'suspended'))
  ) THEN
    RAISE EXCEPTION 'Target user is not a lawyer or does not exist' USING ERRCODE = '45000';
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET is_active = TRUE,
      role = 'lawyer'::public.user_role,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Update lawyer_profiles table
  UPDATE public.lawyer_profiles
  SET is_available = TRUE,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Restore the role in JWT claims
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "lawyer"}'::jsonb
  WHERE id = p_lawyer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reactivate_lawyer_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reactivate_lawyer_rpc(UUID) TO authenticated, service_role;


-- ── 4. Fix Lawyer Requests FK Cascades ──────────────────────────────
ALTER TABLE public.lawyer_requests ALTER COLUMN lawyer_id DROP NOT NULL;


-- ── 5. Prevent Meeting & Consultation Overlaps ──────────────────────
-- Redefine check_meeting_overlap to also check against consultations
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
      -- Serialize concurrent inserts for the same lawyer
      PERFORM pg_advisory_xact_lock(hashtext('meeting_overlap' || v_lawyer_id::text));

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
        RAISE EXCEPTION 'Lawyer is already booked for a meeting at this time' USING ERRCODE = '23514';
      END IF;

      -- Check if an overlapping consultation exists (assuming 30 minutes duration)
      SELECT EXISTS (
        SELECT 1
        FROM public.consultations c
        WHERE c.lawyer_id = v_lawyer_id
          AND c.status IN ('pending', 'confirmed')
          AND c.scheduled_at IS NOT NULL
          AND NEW.scheduled_at < (c.scheduled_at + interval '30 minutes')
          AND (NEW.scheduled_at + (NEW.duration_minutes * interval '1 minute')) > c.scheduled_at
      ) INTO v_overlap_exists;

      IF v_overlap_exists THEN
        RAISE EXCEPTION 'Lawyer has a conflicting consultation at this time' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Consultation overlap check
CREATE OR REPLACE FUNCTION check_consultation_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_overlap_exists BOOLEAN;
BEGIN
  -- Only check if status is pending/confirmed and scheduled_at is set
  IF NEW.status IN ('pending', 'confirmed') AND NEW.scheduled_at IS NOT NULL AND NEW.lawyer_id IS NOT NULL THEN
    -- Serialize concurrent inserts/updates for the same lawyer
    PERFORM pg_advisory_xact_lock(hashtext('consultation_overlap' || NEW.lawyer_id::text));

    -- Check overlapping consultations (assuming 30-min duration)
    SELECT EXISTS (
      SELECT 1
      FROM public.consultations c
      WHERE c.lawyer_id = NEW.lawyer_id
        AND c.status IN ('pending', 'confirmed')
        AND c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND c.scheduled_at IS NOT NULL
        AND NEW.scheduled_at < (c.scheduled_at + interval '30 minutes')
        AND (NEW.scheduled_at + interval '30 minutes') > c.scheduled_at
    ) INTO v_overlap_exists;

    IF v_overlap_exists THEN
      RAISE EXCEPTION 'Lawyer is already booked for another consultation at this time' USING ERRCODE = '23514';
    END IF;

    -- Check overlapping meetings
    SELECT EXISTS (
      SELECT 1
      FROM public.meetings m
      JOIN public.matters mat ON m.matter_id = mat.id
      WHERE mat.lawyer_id = NEW.lawyer_id
        AND m.status = 'scheduled'
        AND NEW.scheduled_at < (m.scheduled_at + (m.duration_minutes * interval '1 minute'))
        AND (NEW.scheduled_at + interval '30 minutes') > m.scheduled_at
    ) INTO v_overlap_exists;

    IF v_overlap_exists THEN
      RAISE EXCEPTION 'Lawyer has a conflicting meeting scheduled at this time' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_check_consultation_overlap
    BEFORE INSERT OR UPDATE ON public.consultations
    FOR EACH ROW
    EXECUTE FUNCTION check_consultation_overlap();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 6. Prevent Overlapping Availability Ranges ──────────────────────
CREATE OR REPLACE FUNCTION check_availability_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_overlap_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.lawyer_availability
    WHERE lawyer_id = NEW.lawyer_id
      AND day_of_week = NEW.day_of_week
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      -- Overlap check for TIME ranges: (Start1 < End2) AND (Start2 < End1)
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) INTO v_overlap_exists;

  IF v_overlap_exists THEN
    RAISE EXCEPTION 'Lawyer availability range overlaps with an existing range on this day' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_check_availability_overlap
    BEFORE INSERT OR UPDATE ON public.lawyer_availability
    FOR EACH ROW
    EXECUTE FUNCTION check_availability_overlap();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 7. Optimize auth_role() ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp, auth AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Try from JWT claim (parsed in memory, fast)
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS NOT NULL THEN
    RETURN v_role::user_role;
  END IF;
  
  -- Fallback to database select
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user')::user_role;
END;
$$;


-- ── 8. Indexes ──────────────────────────────────────────────────────
-- Partial Indexes for soft-deletes
CREATE INDEX IF NOT EXISTS idx_matters_lawyer_id_active ON public.matters(lawyer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matters_user_id_active ON public.matters(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_matter_id_active ON public.matter_milestones(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_matter_id_active ON public.documents(matter_id) WHERE deleted_at IS NULL;

-- FK Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON public.time_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_case_messages_sender_id ON public.case_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_events_actor_id ON public.events(actor_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lawyer_requests_user_id ON public.lawyer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_requests_lawyer_id ON public.lawyer_requests(lawyer_id);

-- GIN Indexes
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_intake_sessions_extracted_facts ON public.intake_sessions USING gin (extracted_facts);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_assessment_result ON public.intake_sessions USING gin (assessment_result);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON public.documents USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_tags ON public.practice_scenarios USING gin (tags);

-- Register this migration
INSERT INTO schema_migrations (version) VALUES ('053_hardening_updates') ON CONFLICT (version) DO NOTHING;

COMMIT;
