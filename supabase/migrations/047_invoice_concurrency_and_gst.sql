BEGIN;

-- Add UNIQUE constraint to invoice_number
ALTER TABLE public.invoices ADD CONSTRAINT unique_invoice_number UNIQUE (invoice_number);

-- Add GST compliance columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS hsn_sac TEXT NOT NULL DEFAULT '998211',
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
  ADD COLUMN IF NOT EXISTS irn TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT;

-- Create secure atomic invoice number generator
CREATE OR REPLACE FUNCTION generate_next_invoice_number(p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq INT;
  v_invoice_num TEXT;
BEGIN
  -- Acquire transaction-level advisory lock on the combination of invoice sequence and the specific year
  -- hashtext('invoice_seq_' || p_year) ensures different years don't block each other
  PERFORM pg_advisory_xact_lock(hashtext('invoice_seq_' || p_year));

  SELECT COALESCE(
    MAX(SUBSTRING(invoice_number FROM 'INV-[0-9]+-([0-9]+)')::INT),
    0
  ) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-' || p_year || '-%';

  v_invoice_num := 'INV-' || p_year || '-' || TO_CHAR(v_seq, 'FM000');
  RETURN v_invoice_num;
END;
$$;

COMMIT;
