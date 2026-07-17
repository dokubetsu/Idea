-- Migration 059: Phase 1 business correctness
-- 1. Consultation payment columns + mark_consultation_paid RPC
-- 2. apply_payment_rpc (atomic milestone payment)
-- 3. create_invoice_rpc (atomic invoice + line links)
-- 4. matching_accept_rpc (atomic request accept + matter assign)
-- 5. return_matter_to_matching (suspension path)
-- 6. transition_matter_status: allow active → matching
-- 7. Fix reactivate_lawyer_rpc (auth.users for suspension metadata)

BEGIN;

-- pgcrypto for digest() used by create_invoice_rpc IRN generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Consultations payment columns + payments.consultation_id
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (amount_inr >= 0),
  ADD COLUMN IF NOT EXISTS payment_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_gateway_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_payment_idempotency_key
  ON public.consultations (payment_idempotency_key)
  WHERE payment_idempotency_key IS NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS consultation_id UUID
    REFERENCES public.consultations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_consultation_id
  ON public.payments (consultation_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. mark_consultation_paid
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_consultation_paid(
  p_consultation_id UUID,
  p_payment_id TEXT,
  p_idemp_key TEXT,
  p_amount_inr NUMERIC,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_row public.consultations%ROWTYPE;
  v_payment_id UUID;
  v_is_service BOOLEAN;
BEGIN
  v_is_service := coalesce(auth.role(), '') = 'service_role';

  IF NOT v_is_service AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to mark this consultation paid'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.consultations
  WHERE id = p_consultation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.user_id IS DISTINCT FROM p_user_id AND NOT v_is_service THEN
    RAISE EXCEPTION 'Consultation does not belong to user' USING ERRCODE = '42501';
  END IF;

  IF v_row.package = 'free'::public.consultation_package THEN
    RAISE EXCEPTION 'Free consultations do not require payment' USING ERRCODE = 'P0006';
  END IF;

  -- Idempotent: already paid with same payment / key
  IF v_row.payment_status = 'paid'::public.consultation_payment_status THEN
    IF p_idemp_key IS NOT NULL
       AND v_row.payment_idempotency_key IS NOT NULL
       AND v_row.payment_idempotency_key IS DISTINCT FROM p_idemp_key THEN
      RAISE EXCEPTION 'Idempotency key mismatch for already-paid consultation'
        USING ERRCODE = 'P0006';
    END IF;
    RETURN jsonb_build_object(
      'consultation_id', v_row.id,
      'payment_status', v_row.payment_status,
      'already_paid', TRUE,
      'payment_gateway_ref', v_row.payment_gateway_ref
    );
  END IF;

  IF v_row.status NOT IN (
    'pending'::public.consultation_status
  ) THEN
    RAISE EXCEPTION 'Cannot pay consultation in status %', v_row.status
      USING ERRCODE = 'P0003';
  END IF;

  -- Amount must match (allow 1 paise tolerance expressed in INR)
  IF p_amount_inr IS NULL
     OR abs(coalesce(v_row.amount_inr, 0) - p_amount_inr) > 0.02 THEN
    RAISE EXCEPTION 'Payment amount does not match consultation amount'
      USING ERRCODE = 'P0006';
  END IF;

  IF p_idemp_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.consultations
      WHERE payment_idempotency_key = p_idemp_key
        AND id IS DISTINCT FROM p_consultation_id
    ) THEN
      RAISE EXCEPTION 'Idempotency key already used for another consultation'
        USING ERRCODE = 'P0006';
    END IF;
  END IF;

  INSERT INTO public.payments (
    consultation_id,
    user_id,
    amount_inr,
    status,
    payment_id,
    payment_idempotency_key
  ) VALUES (
    p_consultation_id,
    v_row.user_id,
    p_amount_inr,
    'completed',
    p_payment_id,
    p_idemp_key
  )
  ON CONFLICT (payment_id) DO UPDATE
    SET status = EXCLUDED.status
  RETURNING id INTO v_payment_id;

  UPDATE public.consultations
  SET payment_status = 'paid'::public.consultation_payment_status,
      payment_gateway_ref = p_payment_id,
      payment_idempotency_key = p_idemp_key,
      updated_at = NOW()
  WHERE id = p_consultation_id;

  RETURN jsonb_build_object(
    'consultation_id', p_consultation_id,
    'payment_status', 'paid',
    'already_paid', FALSE,
    'payment_record_id', v_payment_id,
    'payment_gateway_ref', p_payment_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_consultation_paid(UUID, TEXT, TEXT, NUMERIC, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_consultation_paid(UUID, TEXT, TEXT, NUMERIC, UUID)
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 3. apply_payment_rpc — atomic milestone payment
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_payment_rpc(
  p_milestone_id UUID,
  p_payment_id TEXT,
  p_idemp_key TEXT,
  p_amount_inr NUMERIC,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_ms public.matter_milestones%ROWTYPE;
  v_payment_id UUID;
BEGIN
  -- Only service role (backend after signature verify)
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'apply_payment_rpc requires service_role'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ms
  FROM public.matter_milestones
  WHERE id = p_milestone_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_ms.is_paid THEN
    RETURN to_jsonb(v_ms) || jsonb_build_object('already_paid', TRUE);
  END IF;

  IF p_idemp_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.matter_milestones
      WHERE payment_idempotency_key = p_idemp_key
        AND id IS DISTINCT FROM p_milestone_id
    ) THEN
      RAISE EXCEPTION 'Idempotency key already used for another milestone'
        USING ERRCODE = 'P0006';
    END IF;
  END IF;

  UPDATE public.matter_milestones
  SET is_paid = TRUE,
      payment_gateway_ref = p_payment_id,
      payment_idempotency_key = p_idemp_key,
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_milestone_id
    AND is_paid = FALSE;

  IF NOT FOUND THEN
    SELECT * INTO v_ms FROM public.matter_milestones WHERE id = p_milestone_id;
    RETURN to_jsonb(v_ms) || jsonb_build_object('already_paid', TRUE);
  END IF;

  IF p_amount_inr IS NOT NULL AND p_amount_inr > 0 THEN
    INSERT INTO public.payments (
      milestone_id,
      user_id,
      amount_inr,
      status,
      payment_id,
      payment_idempotency_key
    ) VALUES (
      p_milestone_id,
      p_user_id,
      p_amount_inr,
      'completed',
      p_payment_id,
      p_idemp_key
    )
    ON CONFLICT (payment_id) DO UPDATE
      SET status = EXCLUDED.status
    RETURNING id INTO v_payment_id;

    UPDATE public.matter_milestones
    SET payment_record_id = v_payment_id
    WHERE id = p_milestone_id;
  END IF;

  SELECT * INTO v_ms FROM public.matter_milestones WHERE id = p_milestone_id;
  RETURN to_jsonb(v_ms) || jsonb_build_object(
    'already_paid', FALSE,
    'payment_record_id', v_payment_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_payment_rpc(UUID, TEXT, TEXT, NUMERIC, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_rpc(UUID, TEXT, TEXT, NUMERIC, UUID)
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 4. create_invoice_rpc — atomic invoice + line item locking
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_invoice_rpc(
  p_matter_id UUID,
  p_lawyer_id UUID,
  p_time_entry_ids UUID[],
  p_disbursement_ids UUID[],
  p_period_start DATE,
  p_period_end DATE,
  p_work_summary TEXT,
  p_due_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_year INT;
  v_invoice_number TEXT;
  v_subtotal NUMERIC(14, 2) := 0;
  v_te_sum NUMERIC(14, 2) := 0;
  v_disb_sum NUMERIC(14, 2) := 0;
  v_gst_percent NUMERIC(5, 2) := 18.00;
  v_gst_amount NUMERIC(14, 2);
  v_total NUMERIC(14, 2);
  v_invoice public.invoices%ROWTYPE;
  v_irn TEXT;
  v_qr TEXT;
  v_ids UUID[];
  v_locked_ids UUID[];
  v_matter_check UUID;
BEGIN
  -- Authz: service_role, or assigned lawyer / admin
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.matters m
      WHERE m.id = p_matter_id
        AND m.deleted_at IS NULL
        AND (
          m.lawyer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::public.user_role
              AND p.is_active = TRUE
          )
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to invoice this matter' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Lock matter row
  SELECT id INTO v_matter_check
  FROM public.matters
  WHERE id = p_matter_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_matter_check IS NULL THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  v_ids := coalesce(p_time_entry_ids, ARRAY[]::UUID[]);
  IF cardinality(v_ids) > 0 THEN
    -- Lock and validate unbilled time entries belong to matter
    SELECT array_agg(te.id ORDER BY te.id)
    INTO v_locked_ids
    FROM public.time_entries te
    WHERE te.id = ANY (v_ids)
      AND te.matter_id = p_matter_id
      AND te.status = 'unbilled'
    FOR UPDATE;

    IF v_locked_ids IS NULL
       OR cardinality(v_locked_ids) <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'One or more time entries are missing, already billed, or not on this matter'
        USING ERRCODE = 'P0006';
    END IF;

    SELECT COALESCE(SUM(te.amount_inr), 0) INTO v_te_sum
    FROM public.time_entries te
    WHERE te.id = ANY (v_ids);
  END IF;

  v_ids := coalesce(p_disbursement_ids, ARRAY[]::UUID[]);
  IF cardinality(v_ids) > 0 THEN
    SELECT array_agg(d.id ORDER BY d.id)
    INTO v_locked_ids
    FROM public.disbursements d
    WHERE d.id = ANY (v_ids)
      AND d.matter_id = p_matter_id
      AND d.invoice_id IS NULL
    FOR UPDATE;

    IF v_locked_ids IS NULL
       OR cardinality(v_locked_ids) <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'One or more disbursements are missing, already linked, or not on this matter'
        USING ERRCODE = 'P0006';
    END IF;

    SELECT COALESCE(SUM(d.amount_inr), 0) INTO v_disb_sum
    FROM public.disbursements d
    WHERE d.id = ANY (v_ids);
  END IF;

  v_subtotal := v_te_sum + v_disb_sum;

  v_year := EXTRACT(YEAR FROM NOW())::INT;
  v_invoice_number := public.generate_next_invoice_number(v_year);

  v_gst_amount := ROUND(v_subtotal * v_gst_percent / 100, 2);
  v_total := ROUND(v_subtotal + v_gst_amount, 2);
  v_irn := encode(digest('INV-' || v_invoice_number, 'sha256'), 'hex');
  v_qr := 'GST-EINVOICE-MOCK-SIGNATURE-DATA-FOR-' || v_invoice_number
          || '-IRN-' || left(v_irn, 16);

  INSERT INTO public.invoices (
    matter_id,
    invoice_number,
    period_start,
    period_end,
    subtotal_inr,
    gst_percent,
    gst_amount_inr,
    total_inr,
    work_summary,
    due_date,
    gstin,
    hsn_sac,
    place_of_supply,
    irn,
    qr_code_data
  ) VALUES (
    p_matter_id,
    v_invoice_number,
    p_period_start,
    p_period_end,
    v_subtotal,
    v_gst_percent,
    v_gst_amount,
    v_total,
    p_work_summary,
    p_due_date,
    '27LEADG1234A1Z0',
    '998211',
    'Delhi',
    v_irn,
    v_qr
  )
  RETURNING * INTO v_invoice;

  IF coalesce(p_time_entry_ids, ARRAY[]::UUID[]) <> ARRAY[]::UUID[] THEN
    UPDATE public.time_entries
    SET status = 'billed',
        invoice_id = v_invoice.id,
        updated_at = NOW()
    WHERE id = ANY (p_time_entry_ids)
      AND matter_id = p_matter_id
      AND status = 'unbilled';
  END IF;

  IF coalesce(p_disbursement_ids, ARRAY[]::UUID[]) <> ARRAY[]::UUID[] THEN
    UPDATE public.disbursements
    SET invoice_id = v_invoice.id
    WHERE id = ANY (p_disbursement_ids)
      AND matter_id = p_matter_id
      AND invoice_id IS NULL;
  END IF;

  RETURN to_jsonb(v_invoice);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE
) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 5. matching_accept_rpc
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.matching_accept_rpc(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_lawyer_id UUID := auth.uid();
  v_req public.lawyer_requests%ROWTYPE;
  v_matter public.matters%ROWTYPE;
  v_old_status public.matter_status;
BEGIN
  IF v_lawyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Must be verified lawyer (or admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_lawyer_id
      AND p.is_active = TRUE
      AND (
        p.role = 'admin'::public.user_role
        OR (
          p.role = 'lawyer'::public.user_role
          AND EXISTS (
            SELECT 1 FROM public.lawyer_profiles lp
            WHERE lp.id = v_lawyer_id AND lp.is_verified = TRUE
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Only verified lawyers can accept requests' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.lawyer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.lawyer_id IS DISTINCT FROM v_lawyer_id
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = v_lawyer_id AND role = 'admin'::public.user_role
     ) THEN
    RAISE EXCEPTION 'Request is not assigned to this lawyer' USING ERRCODE = '42501';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request has already been processed' USING ERRCODE = 'P0003';
  END IF;

  IF v_req.matter_id IS NULL THEN
    UPDATE public.lawyer_requests
    SET status = 'accepted'
    WHERE id = p_request_id AND status = 'pending';
    RETURN jsonb_build_object(
      'request_id', p_request_id,
      'status', 'accepted',
      'matter_id', NULL,
      'matter_assigned', FALSE
    );
  END IF;

  SELECT * INTO v_matter
  FROM public.matters
  WHERE id = v_req.matter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  v_old_status := v_matter.status;

  IF v_matter.status <> 'matching'::public.matter_status THEN
    RAISE EXCEPTION 'This matter is no longer in the matching state'
      USING ERRCODE = 'P0006';
  END IF;

  IF v_matter.lawyer_id IS NOT NULL THEN
    RAISE EXCEPTION 'This matter has already been assigned to another lawyer'
      USING ERRCODE = 'P0006';
  END IF;

  UPDATE public.matters
  SET lawyer_id = v_lawyer_id,
      status = 'active'::public.matter_status,
      assigned_at = NOW(),
      updated_at = NOW()
  WHERE id = v_matter.id
    AND status = 'matching'::public.matter_status
    AND lawyer_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This matter has already been assigned to another lawyer'
      USING ERRCODE = 'P0006';
  END IF;

  UPDATE public.lawyer_requests
  SET status = 'accepted'
  WHERE id = p_request_id AND status = 'pending';

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', 'accepted',
    'matter_id', v_matter.id,
    'matter_assigned', TRUE,
    'old_status', v_old_status::text,
    'new_status', 'active'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.matching_accept_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matching_accept_rpc(UUID) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 6. return_matter_to_matching (lawyer suspension)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.return_matter_to_matching(
  p_matter_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_status public.matter_status;
  v_lawyer_id UUID;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    -- Allow active admins
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'::public.user_role
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT status, lawyer_id INTO v_status, v_lawyer_id
  FROM public.matters
  WHERE id = p_matter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IN (
    'resolved'::public.matter_status,
    'archived'::public.matter_status
  ) THEN
    RETURN jsonb_build_object(
      'matter_id', p_matter_id,
      'changed', FALSE,
      'old_status', v_status::text,
      'new_status', v_status::text
    );
  END IF;

  UPDATE public.matters
  SET lawyer_id = NULL,
      status = 'matching'::public.matter_status,
      assigned_at = NULL,
      updated_at = NOW()
  WHERE id = p_matter_id;

  RETURN jsonb_build_object(
    'matter_id', p_matter_id,
    'changed', TRUE,
    'old_status', v_status::text,
    'new_status', 'matching',
    'previous_lawyer_id', v_lawyer_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_matter_to_matching(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_matter_to_matching(UUID, UUID)
  TO service_role;

-- Also allow single-arg form (actor optional)
CREATE OR REPLACE FUNCTION public.return_matter_to_matching(p_matter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  RETURN public.return_matter_to_matching(p_matter_id, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_matter_to_matching(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_matter_to_matching(UUID)
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 7. transition_matter_status: allow active → matching
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION transition_matter_status(
  p_matter_id UUID,
  p_new_status matter_status,
  p_actor_id UUID
) RETURNS TABLE (
  old_status TEXT,
  success BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_current matter_status;
BEGIN
  SELECT status INTO v_current
  FROM public.matters
  WHERE id = p_matter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current = 'draft'::matter_status AND p_new_status = 'intake'::matter_status THEN
    NULL;
  ELSIF v_current = 'intake'::matter_status AND p_new_status IN ('assessment'::matter_status, 'matching'::matter_status) THEN
    NULL;
  ELSIF v_current = 'assessment'::matter_status AND p_new_status IN ('matching'::matter_status, 'active'::matter_status) THEN
    NULL;
  ELSIF v_current = 'matching'::matter_status AND p_new_status = 'active'::matter_status THEN
    NULL;
  ELSIF v_current = 'active'::matter_status AND p_new_status = 'resolved'::matter_status THEN
    NULL;
  ELSIF v_current = 'active'::matter_status AND p_new_status = 'matching'::matter_status THEN
    -- Lawyer suspension / reassignment pool
    NULL;
  ELSIF v_current = 'resolved'::matter_status AND p_new_status = 'archived'::matter_status THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current, p_new_status USING ERRCODE = 'P0006';
  END IF;

  IF p_new_status = 'resolved'::matter_status THEN
    UPDATE public.matters
    SET status = p_new_status,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_matter_id;
  ELSIF p_new_status = 'archived'::matter_status THEN
    UPDATE public.matters
    SET status = p_new_status,
        archived_at = NOW(),
        updated_at = NOW()
    WHERE id = p_matter_id;
  ELSIF p_new_status = 'matching'::matter_status AND v_current = 'active'::matter_status THEN
    UPDATE public.matters
    SET status = p_new_status,
        lawyer_id = NULL,
        assigned_at = NULL,
        updated_at = NOW()
    WHERE id = p_matter_id;
  ELSE
    UPDATE public.matters
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_matter_id;
  END IF;

  old_status := v_current::text;
  success := TRUE;
  RETURN NEXT;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 8. Fix reactivate_lawyer_rpc
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reactivate_lawyer_rpc(p_lawyer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.user_role AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Target is a lawyer profile, or was suspended via JWT metadata on auth.users
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_lawyer_id
      AND (
        p.role = 'lawyer'::public.user_role
        OR coalesce(u.raw_app_meta_data->>'role', '') = 'suspended'
      )
  ) THEN
    RAISE EXCEPTION 'Target user is not a lawyer or does not exist' USING ERRCODE = '45000';
  END IF;

  UPDATE public.profiles
  SET is_active = TRUE,
      role = 'lawyer'::public.user_role,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  UPDATE public.lawyer_profiles
  SET is_available = TRUE,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "lawyer"}'::jsonb
  WHERE id = p_lawyer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reactivate_lawyer_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reactivate_lawyer_rpc(UUID) TO authenticated, service_role;

INSERT INTO schema_migrations (version)
VALUES ('059_phase1_business_correctness')
ON CONFLICT (version) DO NOTHING;

COMMIT;
