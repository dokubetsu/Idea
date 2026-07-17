BEGIN;

CREATE OR REPLACE FUNCTION assign_free_lawyer_rpc(p_consultation_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_lawyer_id UUID;
  v_user_id UUID;
BEGIN
  -- Lock the consultation so assignment is atomic with lawyer selection.
  SELECT user_id INTO v_user_id
  FROM public.consultations
  WHERE id = p_consultation_id
    AND package = 'free'
    AND lawyer_id IS NULL
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to assign lawyer to this consultation' USING ERRCODE = '42501';
  END IF;

  -- Select available lawyer with the lowest caseload (count of assigned consultations) to balance load
  SELECT lp.id INTO v_lawyer_id
  FROM public.lawyer_profiles lp
  WHERE lp.is_available = true AND lp.offers_free_consultation = true
  ORDER BY (
    SELECT COUNT(*)
    FROM public.consultations c
    WHERE c.lawyer_id = lp.id
  ) ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.consultations
  SET lawyer_id = v_lawyer_id,
      updated_at = NOW()
  WHERE id = p_consultation_id;

  RETURN v_lawyer_id;
END;
$$;

COMMIT;
