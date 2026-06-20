-- ================================================================
--  NYAY PLATFORM — Transaction-Safe commit_intake RPC
-- ================================================================

CREATE OR REPLACE FUNCTION commit_intake(
  p_session_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_summary TEXT,
  p_category matter_category,
  p_status matter_status,
  p_priority matter_priority,
  p_facts JSONB,
  p_assessment_summary TEXT
) RETURNS TABLE (
  matter_id UUID,
  already_committed BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_matter_id UUID;
  v_is_committed BOOLEAN;
  v_existing_matter_id UUID;
BEGIN
  -- 1. Check if already committed and verify owner with row locking (FOR UPDATE)
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
  
  -- 2. Insert into matters
  INSERT INTO matters (
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
  
  -- 3. Insert into facts
  IF p_facts IS NOT NULL AND jsonb_array_length(p_facts) > 0 THEN
    INSERT INTO facts (matter_id, key, value, value_type, label, source, confidence)
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
  
  -- 4. Insert into matter_updates
  IF p_assessment_summary IS NOT NULL AND p_assessment_summary <> '' THEN
    INSERT INTO matter_updates (matter_id, author_id, content, is_internal)
    VALUES (v_matter_id, p_user_id, p_assessment_summary, FALSE);
  END IF;
  
  -- 5. Mark intake session as committed
  UPDATE intake_sessions
  SET is_committed = TRUE,
      matter_id = v_matter_id,
      updated_at = NOW()
  WHERE id = p_session_id;
  
  RETURN QUERY SELECT v_matter_id, FALSE;
END;
$$;
