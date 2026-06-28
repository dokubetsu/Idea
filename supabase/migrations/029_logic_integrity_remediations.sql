BEGIN;

-- ================================================================
-- LEAD PLATFORM -- Migration 029: Logic Integrity Remediations
-- ================================================================

-- ── 1. Re-define commit_intake to accept p_extracted_facts ──
DROP FUNCTION IF EXISTS commit_intake(UUID, UUID, TEXT, TEXT, matter_category, matter_status, matter_priority, JSONB, TEXT);

CREATE OR REPLACE FUNCTION commit_intake(
  p_session_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_summary TEXT,
  p_category matter_category,
  p_status matter_status,
  p_priority matter_priority,
  p_facts JSONB,
  p_assessment_summary TEXT,
  p_extracted_facts JSONB DEFAULT NULL
) RETURNS TABLE (
  matter_id UUID,
  already_committed BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_matter_id UUID;
  v_is_committed BOOLEAN;
  v_existing_matter_id UUID;
BEGIN
  -- Check if already committed and verify owner with row locking (FOR UPDATE)
  SELECT is_committed, intake_sessions.matter_id INTO v_is_committed, v_existing_matter_id
  FROM intake_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake session not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  
  IF v_is_committed THEN
    RETURN QUERY SELECT v_existing_matter_id, TRUE;
    RETURN;
  END IF;

  -- Update extracted_facts under the FOR UPDATE lock if new facts are provided
  IF p_extracted_facts IS NOT NULL THEN
    UPDATE intake_sessions
    SET extracted_facts = p_extracted_facts,
        updated_at = NOW()
    WHERE id = p_session_id;
  END IF;
  
  -- Insert into matters
  INSERT INTO public.matters (
    user_id,
    intake_session_id,
    title,
    summary,
    category,
    status,
    priority
  ) VALUES (
    p_user_id,
    p_session_id,
    p_title,
    p_summary,
    p_category,
    p_status,
    p_priority
  ) RETURNING id INTO v_matter_id;
  
  -- Insert into facts
  IF p_facts IS NOT NULL AND jsonb_array_length(p_facts) > 0 THEN
    INSERT INTO public.facts (matter_id, key, value, value_type, label, source, confidence)
    SELECT
      v_matter_id,
      (elem->>'key')::TEXT,
      (elem->>'value')::TEXT,
      COALESCE((elem->>'value_type'), 'string')::fact_value_type,
      COALESCE((elem->>'label'), INITCAP(REPLACE((elem->>'key'), '_', ' ')))::TEXT,
      COALESCE((elem->>'source'), 'ai')::fact_source,
      COALESCE((elem->>'confidence'), '0.9')::NUMERIC(3,2)
    FROM jsonb_array_elements(p_facts) AS elem
    WHERE elem->>'key' IS NOT NULL AND elem->>'value' IS NOT NULL;
  END IF;
  
  -- Insert into matter_updates
  IF p_assessment_summary IS NOT NULL AND p_assessment_summary <> '' THEN
    INSERT INTO public.matter_updates (matter_id, author_id, content, is_internal)
    VALUES (v_matter_id, p_user_id, p_assessment_summary, FALSE);
  END IF;
  
  -- Mark intake session as committed
  UPDATE intake_sessions
  SET is_committed = TRUE,
      matter_id = v_matter_id,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT v_matter_id, FALSE;
END;
$$;


-- ── 2. Atomic lawyer verification RPC ──
CREATE OR REPLACE FUNCTION verify_lawyer_rpc(p_lawyer_id UUID)
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

  -- Update lawyer_profiles
  UPDATE public.lawyer_profiles
  SET is_verified = TRUE,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Update profiles role
  UPDATE public.profiles
  SET role = 'lawyer'::public.user_role,
      updated_at = NOW()
  WHERE id = p_lawyer_id;

  -- Update auth.users app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "lawyer"}'::jsonb
  WHERE id = p_lawyer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_lawyer_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_lawyer_rpc(UUID) TO authenticated, service_role;


-- ── 3. Atomic lawyer suspension RPC ──
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

REVOKE EXECUTE ON FUNCTION suspend_lawyer_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION suspend_lawyer_rpc(UUID) TO authenticated, service_role;


-- Register migration
INSERT INTO schema_migrations (version) VALUES ('029_logic_integrity_remediations') ON CONFLICT (version) DO NOTHING;

COMMIT;
