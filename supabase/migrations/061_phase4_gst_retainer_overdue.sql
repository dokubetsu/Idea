-- Migration 061: Phase 4 — GST breakdown, retainer drawdown, invoice overdue
BEGIN;

-- ── Invoice GST split columns ───────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_state TEXT,
  ADD COLUMN IF NOT EXISTS cgst_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Extend create_invoice_rpc with place of supply + GST split + retainer ──
CREATE OR REPLACE FUNCTION public.create_invoice_rpc(
  p_matter_id UUID,
  p_lawyer_id UUID,
  p_time_entry_ids UUID[],
  p_disbursement_ids UUID[],
  p_period_start DATE,
  p_period_end DATE,
  p_work_summary TEXT,
  p_due_date DATE,
  p_place_of_supply TEXT DEFAULT NULL,
  p_supplier_state TEXT DEFAULT NULL,
  p_draw_retainer BOOLEAN DEFAULT TRUE
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
  v_half NUMERIC(5, 2) := 9.00;
  v_gst_amount NUMERIC(14, 2);
  v_cgst NUMERIC(14, 2) := 0;
  v_sgst NUMERIC(14, 2) := 0;
  v_igst NUMERIC(14, 2) := 0;
  v_total NUMERIC(14, 2);
  v_invoice public.invoices%ROWTYPE;
  v_irn TEXT;
  v_qr TEXT;
  v_ids UUID[];
  v_locked_ids UUID[];
  v_matter_check UUID;
  v_client_state TEXT;
  v_lawyer_state TEXT;
  v_place TEXT;
  v_supplier TEXT;
  v_inter BOOLEAN := FALSE;
  v_fa RECORD;
  v_draw NUMERIC(14, 2);
  v_remaining NUMERIC(14, 2);
BEGIN
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

  SELECT m.id INTO v_matter_check
  FROM public.matters m
  WHERE m.id = p_matter_id AND m.deleted_at IS NULL
  FOR UPDATE;
  IF v_matter_check IS NULL THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  -- Resolve place of supply: explicit → client profile state → lawyer state → Delhi
  SELECT cp.state, lp.state
    INTO v_client_state, v_lawyer_state
  FROM public.matters m
  LEFT JOIN public.profiles cp ON cp.id = m.user_id
  LEFT JOIN public.profiles lp ON lp.id = m.lawyer_id
  WHERE m.id = p_matter_id;

  v_place := COALESCE(NULLIF(TRIM(p_place_of_supply), ''), NULLIF(TRIM(v_client_state), ''), NULLIF(TRIM(v_lawyer_state), ''), 'Delhi');
  v_supplier := COALESCE(NULLIF(TRIM(p_supplier_state), ''), NULLIF(TRIM(v_lawyer_state), ''), 'Delhi');
  v_inter := lower(v_place) IS DISTINCT FROM lower(v_supplier);

  v_ids := coalesce(p_time_entry_ids, ARRAY[]::UUID[]);
  IF cardinality(v_ids) > 0 THEN
    SELECT array_agg(te.id ORDER BY te.id)
    INTO v_locked_ids
    FROM public.time_entries te
    WHERE te.id = ANY (v_ids)
      AND te.matter_id = p_matter_id
      AND te.status = 'unbilled'
    FOR UPDATE;

    IF v_locked_ids IS NULL OR cardinality(v_locked_ids) <> cardinality(v_ids) THEN
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

    IF v_locked_ids IS NULL OR cardinality(v_locked_ids) <> cardinality(v_ids) THEN
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
  IF v_inter THEN
    v_igst := v_gst_amount;
    v_cgst := 0;
    v_sgst := 0;
  ELSE
    v_cgst := ROUND(v_subtotal * v_half / 100, 2);
    v_sgst := v_gst_amount - v_cgst;
    v_igst := 0;
  END IF;
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
    supplier_state,
    cgst_amount_inr,
    sgst_amount_inr,
    igst_amount_inr,
    is_inter_state,
    irn,
    qr_code_data,
    status
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
    '07LEADG1234A1Z5',
    '998211',
    v_place,
    v_supplier,
    v_cgst,
    v_sgst,
    v_igst,
    v_inter,
    v_irn,
    v_qr,
    'draft'
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

  -- Retainer drawdown: apply invoice total against remaining retainer
  IF p_draw_retainer AND v_total > 0 THEN
    SELECT * INTO v_fa
    FROM public.fee_arrangements
    WHERE matter_id = p_matter_id
      AND type = 'retainer'
    FOR UPDATE;

    IF FOUND THEN
      v_remaining := COALESCE(v_fa.retainer_amount, 0) - COALESCE(v_fa.retainer_used, 0);
      IF v_remaining > 0 THEN
        v_draw := LEAST(v_remaining, v_total);
        UPDATE public.fee_arrangements
        SET retainer_used = COALESCE(retainer_used, 0) + v_draw,
            updated_at = NOW()
        WHERE id = v_fa.id;
      END IF;
    END IF;
  END IF;

  RETURN to_jsonb(v_invoice);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE, TEXT, TEXT, BOOLEAN
) TO authenticated, service_role;

-- Keep 8-arg overload for older callers (forwards with defaults)
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
BEGIN
  RETURN public.create_invoice_rpc(
    p_matter_id, p_lawyer_id, p_time_entry_ids, p_disbursement_ids,
    p_period_start, p_period_end, p_work_summary, p_due_date,
    NULL, NULL, TRUE
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_rpc(
  UUID, UUID, UUID[], UUID[], DATE, DATE, TEXT, DATE
) TO authenticated, service_role;

-- ── Mark overdue invoices ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_invoices_overdue(p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_count INT;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'mark_invoices_overdue requires service_role' USING ERRCODE = '42501';
  END IF;

  UPDATE public.invoices
  SET status = 'overdue',
      updated_at = NOW()
  WHERE status = 'sent'
    AND due_date IS NOT NULL
    AND due_date < p_as_of;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_invoices_overdue(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoices_overdue(DATE) TO service_role;

INSERT INTO schema_migrations (version)
VALUES ('061_phase4_gst_retainer_overdue')
ON CONFLICT (version) DO NOTHING;

COMMIT;
