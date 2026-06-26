-- ================================================================
-- LEAD PLATFORM -- Migration 022: Secure confirm_consultation RPC (H3)
-- ================================================================
-- SECURITY FIX: Replace caller-supplied p_lawyer_id with auth.uid()
--
-- Previously, confirm_consultation(p_consultation_id, p_lawyer_id) accepted
-- the lawyer identity as a parameter. Any authenticated user who guessed a
-- valid consultation_id + lawyer_id pair could call this RPC directly (e.g.,
-- via the Supabase client or REST API) and confirm a consultation as that lawyer.
--
-- The fix: drop p_lawyer_id entirely and derive the acting lawyer from
-- auth.uid() inside the function body. SECURITY DEFINER ensures the function
-- runs as the postgres role, but auth.uid() still reflects the JWT of the
-- calling session, so the ownership check is cryptographically bound to the
-- authenticated user -- not to whatever value the caller passes in.

CREATE OR REPLACE FUNCTION confirm_consultation(
  p_consultation_id UUID
  -- p_lawyer_id removed: derived from auth.uid() below (H3 security fix)
)
RETURNS TABLE (
  matter_id          UUID,
  already_confirmed  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_lawyer_id  UUID;
  v_matter_id  UUID;
  v_status     consultation_status;
  v_user_id    UUID;
  v_consultation_lawyer_id UUID;
BEGIN
  -- Derive lawyer identity from the calling session JWT -- cannot be spoofed.
  v_lawyer_id := auth.uid();

  IF v_lawyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is a lawyer or admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_lawyer_id
      AND role IN ('lawyer', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only lawyers or admins can confirm consultations'
      USING ERRCODE = 'P0005';
  END IF;

  -- 1. Acquire row lock immediately.
  SELECT c.matter_id, c.status, c.user_id, c.lawyer_id
    INTO v_matter_id, v_status, v_user_id, v_consultation_lawyer_id
    FROM consultations c
    WHERE c.id = p_consultation_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation % not found', p_consultation_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Lawyer ownership check.
  IF v_consultation_lawyer_id IS NOT NULL AND v_consultation_lawyer_id != v_lawyer_id THEN
    -- Allow admins to confirm on behalf of an assigned lawyer
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_lawyer_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Lawyer % is not authorized to confirm this consultation', v_lawyer_id
        USING ERRCODE = 'P0004';
    END IF;
    -- Admin confirms: keep the existing assigned lawyer (do not reassign to admin)
    v_lawyer_id := v_consultation_lawyer_id;
  END IF;

  -- 3. Idempotency: already confirmed -> return existing matter, do nothing.
  IF v_matter_id IS NOT NULL THEN
    RETURN QUERY SELECT v_matter_id, TRUE;
    RETURN;
  END IF;

  -- 4. Status guard: only 'pending' consultations can be confirmed.
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot confirm consultation with status %: must be pending', v_status
      USING ERRCODE = 'P0003';
  END IF;

  -- 5. Create matter atomically within the same transaction.
  INSERT INTO matters (user_id, lawyer_id, title, category, status)
    VALUES (v_user_id, v_lawyer_id, 'Consultation Case', 'other', 'active')
    RETURNING id INTO v_matter_id;

  -- 6. Link matter back and advance status.
  UPDATE consultations
    SET matter_id  = v_matter_id,
        status     = 'confirmed',
        lawyer_id  = v_lawyer_id,
        updated_at = now()
    WHERE id = p_consultation_id;

  RETURN QUERY SELECT v_matter_id, FALSE;
END;
$$;
