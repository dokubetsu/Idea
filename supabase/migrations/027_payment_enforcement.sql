-- ================================================================
-- LEAD PLATFORM -- Migration 027: Payment Enforcement (C5)
-- ================================================================
-- Block confirmation of paid (starter/full) consultations when
-- payment_status = 'unpaid'. Replaces the single-param secure
-- confirm_consultation function with an updated version that
-- enforces payment before confirming.

CREATE OR REPLACE FUNCTION confirm_consultation(
  p_consultation_id UUID
  -- p_lawyer_id removed: derived from auth.uid() (migration 022 fix)
)
RETURNS TABLE (
  matter_id          UUID,
  already_confirmed  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_lawyer_id              UUID;
  v_matter_id              UUID;
  v_status                 consultation_status;
  v_payment_status         consultation_payment_status;
  v_package                consultation_package;
  v_user_id                UUID;
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
  SELECT c.matter_id, c.status, c.payment_status, c.package, c.user_id, c.lawyer_id
    INTO v_matter_id, v_status, v_payment_status, v_package, v_user_id, v_consultation_lawyer_id
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

  -- 3. C5: Payment enforcement for paid packages.
  --    Free consultations are always waived; paid ones must have payment cleared first.
  IF v_package != 'free' AND v_payment_status = 'unpaid' THEN
    RAISE EXCEPTION 'Cannot confirm consultation: payment_status is unpaid for package %', v_package
      USING ERRCODE = 'P0006';
  END IF;

  -- 4. Idempotency: already confirmed -> return existing matter, do nothing.
  IF v_matter_id IS NOT NULL THEN
    RETURN QUERY SELECT v_matter_id, TRUE;
    RETURN;
  END IF;

  -- 5. Status guard: only 'pending' consultations can be confirmed.
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot confirm consultation with status %: must be pending', v_status
      USING ERRCODE = 'P0003';
  END IF;

  -- 6. Create matter atomically within the same transaction.
  INSERT INTO matters (user_id, lawyer_id, title, category, status)
    VALUES (v_user_id, v_lawyer_id, 'Consultation Case', 'other', 'active')
    RETURNING id INTO v_matter_id;

  -- 7. Link matter back and advance status.
  UPDATE consultations
    SET matter_id  = v_matter_id,
        status     = 'confirmed',
        lawyer_id  = v_lawyer_id,
        updated_at = now()
    WHERE id = p_consultation_id;

  RETURN QUERY SELECT v_matter_id, FALSE;
END;
$$;
