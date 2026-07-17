-- Migration 062: Retainer trust ledger + e-invoice metadata
BEGIN;

-- ── Trust / retainer ledger (full audit of deposits, draws, refunds) ──
CREATE TABLE IF NOT EXISTS public.retainer_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id       UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  fee_arrangement_id UUID REFERENCES public.fee_arrangements(id) ON DELETE SET NULL,
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'deposit', 'drawdown', 'refund', 'adjustment'
  )),
  amount_inr      NUMERIC(12,2) NOT NULL CHECK (amount_inr > 0),
  balance_after   NUMERIC(12,2) NOT NULL,
  invoice_id      UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_id      UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  note            TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retainer_ledger_matter
  ON public.retainer_ledger(matter_id, created_at DESC);

ALTER TABLE public.retainer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retainer_ledger:read_participant" ON public.retainer_ledger;
CREATE POLICY "retainer_ledger:read_participant"
  ON public.retainer_ledger FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'::public.user_role
    )
  );

-- Writes only via service_role / SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "retainer_ledger:no_client_write" ON public.retainer_ledger;
CREATE POLICY "retainer_ledger:no_client_write"
  ON public.retainer_ledger FOR INSERT TO authenticated
  WITH CHECK (false);

-- ── Atomic ledger entry + fee_arrangement balance ───────────────
CREATE OR REPLACE FUNCTION public.post_retainer_ledger(
  p_matter_id UUID,
  p_entry_type TEXT,
  p_amount_inr NUMERIC,
  p_invoice_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_fa public.fee_arrangements%ROWTYPE;
  v_used NUMERIC(14,2);
  v_amount NUMERIC(14,2) := abs(p_amount_inr);
  v_balance NUMERIC(14,2);
  v_row public.retainer_ledger%ROWTYPE;
BEGIN
  IF p_entry_type NOT IN ('deposit', 'drawdown', 'refund', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid entry_type' USING ERRCODE = 'P0006';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive' USING ERRCODE = 'P0006';
  END IF;

  SELECT * INTO v_fa
  FROM public.fee_arrangements
  WHERE matter_id = p_matter_id AND type = 'retainer'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No retainer fee arrangement for matter' USING ERRCODE = 'P0002';
  END IF;

  v_used := COALESCE(v_fa.retainer_used, 0);

  IF p_entry_type = 'deposit' THEN
    -- Increase retainer_amount capacity and leave used unchanged
    UPDATE public.fee_arrangements
    SET retainer_amount = COALESCE(retainer_amount, 0) + v_amount,
        updated_at = NOW()
    WHERE id = v_fa.id
    RETURNING * INTO v_fa;
  ELSIF p_entry_type = 'drawdown' THEN
    IF COALESCE(v_fa.retainer_amount, 0) - v_used < v_amount THEN
      RAISE EXCEPTION 'Insufficient retainer balance' USING ERRCODE = 'P0006';
    END IF;
    UPDATE public.fee_arrangements
    SET retainer_used = v_used + v_amount,
        updated_at = NOW()
    WHERE id = v_fa.id
    RETURNING * INTO v_fa;
  ELSIF p_entry_type = 'refund' THEN
    -- Refund reduces remaining trust: prefer reducing unused deposit first via used decrease
    IF COALESCE(v_fa.retainer_amount, 0) - v_used < v_amount THEN
      RAISE EXCEPTION 'Refund exceeds available balance' USING ERRCODE = 'P0006';
    END IF;
    UPDATE public.fee_arrangements
    SET retainer_amount = GREATEST(0, COALESCE(retainer_amount, 0) - v_amount),
        updated_at = NOW()
    WHERE id = v_fa.id
    RETURNING * INTO v_fa;
  ELSE
    -- adjustment: signed via note; amount always positive, increases used
    UPDATE public.fee_arrangements
    SET retainer_used = GREATEST(0, v_used + v_amount),
        updated_at = NOW()
    WHERE id = v_fa.id
    RETURNING * INTO v_fa;
  END IF;

  v_balance := COALESCE(v_fa.retainer_amount, 0) - COALESCE(v_fa.retainer_used, 0);

  INSERT INTO public.retainer_ledger (
    matter_id, fee_arrangement_id, entry_type, amount_inr, balance_after,
    invoice_id, payment_id, note, created_by
  ) VALUES (
    p_matter_id, v_fa.id, p_entry_type, v_amount, v_balance,
    p_invoice_id, p_payment_id, p_note, COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_retainer_ledger(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_retainer_ledger(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, UUID)
  TO authenticated, service_role;

-- ── E-invoice IRP fields on invoices ────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS e_invoice_status TEXT
    CHECK (e_invoice_status IS NULL OR e_invoice_status IN (
      'not_applicable', 'pending', 'generated', 'cancelled', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS e_invoice_ack_no TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_ack_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS e_invoice_signed_qr TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_error TEXT;

-- Court holiday feed cache (JSON per state/year)
CREATE TABLE IF NOT EXISTS public.court_holiday_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_key   TEXT NOT NULL,
  year        INT NOT NULL,
  holidays    JSONB NOT NULL DEFAULT '[]',
  source_url  TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state_key, year)
);

ALTER TABLE public.court_holiday_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "court_holiday_cache:read_all" ON public.court_holiday_cache;
CREATE POLICY "court_holiday_cache:read_all"
  ON public.court_holiday_cache FOR SELECT TO authenticated
  USING (true);

INSERT INTO schema_migrations (version)
VALUES ('062_retainer_ledger_einvoice')
ON CONFLICT (version) DO NOTHING;

COMMIT;
