BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 020: Concurrency & Race Conditions
-- ================================================================

-- 1. register_profile RPC (Atomic insertion + sync support)
CREATE OR REPLACE FUNCTION register_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_state TEXT,
  p_role TEXT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_profile json;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, role, full_name, phone, city, state)
  VALUES (p_user_id, 'user', p_full_name, p_phone, p_city, p_state)
  ON CONFLICT (id) DO NOTHING;

  -- Select the profile
  SELECT row_to_json(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- If role is lawyer, insert into lawyer_profiles
  IF p_role = 'lawyer' THEN
    INSERT INTO public.lawyer_profiles (id)
    VALUES (p_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN v_profile;
END;
$$;


-- 2. schedule_meeting RPC (FOR UPDATE locking on consultations)
CREATE OR REPLACE FUNCTION schedule_meeting(
  p_matter_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_notes TEXT,
  p_meeting_link TEXT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_sessions_used INTEGER;
  v_sessions_total INTEGER;
  v_scheduled_count INTEGER;
  v_meeting json;
BEGIN
  -- 1. Lock the consultation row to serialize meeting creations for this matter
  SELECT sessions_used, sessions_total 
  INTO v_sessions_used, v_sessions_total
  FROM public.consultations
  WHERE matter_id = p_matter_id
  FOR UPDATE;

  -- 2. If a consultation exists, enforce limits
  IF FOUND THEN
    SELECT COUNT(*) INTO v_scheduled_count
    FROM public.meetings
    WHERE matter_id = p_matter_id AND status = 'scheduled';

    IF (v_sessions_used + v_scheduled_count) >= v_sessions_total THEN
      RAISE EXCEPTION 'Session limit reached' USING ERRCODE = 'P0005';
    END IF;
  END IF;

  -- 3. Insert the meeting
  INSERT INTO public.meetings (matter_id, scheduled_at, duration_minutes, notes, meeting_link, status)
  VALUES (p_matter_id, p_scheduled_at, p_duration_minutes, p_notes, p_meeting_link, 'scheduled')
  RETURNING row_to_json(meetings) INTO v_meeting;

  RETURN v_meeting;
END;
$$;


-- 3. transition_matter_status RPC (FOR UPDATE locking on matters)
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
  -- 1. Lock the matter row using FOR UPDATE
  SELECT status INTO v_current
  FROM public.matters
  WHERE id = p_matter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matter not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Define valid transitions
  IF v_current = 'draft'::matter_status AND p_new_status = 'intake'::matter_status THEN
    -- Allowed
  ELSIF v_current = 'intake'::matter_status AND p_new_status IN ('assessment'::matter_status, 'matching'::matter_status) THEN
    -- Allowed
  ELSIF v_current = 'assessment'::matter_status AND p_new_status IN ('matching'::matter_status, 'active'::matter_status) THEN
    -- Allowed
  ELSIF v_current = 'matching'::matter_status AND p_new_status = 'active'::matter_status THEN
    -- Allowed
  ELSIF v_current = 'active'::matter_status AND p_new_status = 'resolved'::matter_status THEN
    -- Allowed
  ELSIF v_current = 'resolved'::matter_status AND p_new_status = 'archived'::matter_status THEN
    -- Allowed
  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current, p_new_status USING ERRCODE = 'P0006';
  END IF;

  -- 3. Perform update
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
  ELSE
    UPDATE public.matters
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_matter_id;
  END IF;

  RETURN QUERY SELECT v_current::TEXT, TRUE;
END;
$$;


-- 4. assign_free_lawyer_rpc RPC (FOR UPDATE SKIP LOCKED on lawyer_profiles)
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

  -- Select first available opted-in lawyer; lock is held until this transaction commits.
  SELECT id INTO v_lawyer_id
  FROM public.lawyer_profiles
  WHERE is_available = true AND offers_free_consultation = true
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


-- 5. contact_lawyer_rpc RPC (FOR UPDATE locking on lawyer_requests)
CREATE OR REPLACE FUNCTION contact_lawyer_rpc(
  p_user_id UUID,
  p_lawyer_id UUID,
  p_matter_id UUID,
  p_message TEXT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_existing_id UUID;
  v_request json;
BEGIN
  -- 1. Check for duplicates under FOR UPDATE locking to prevent concurrent inserts
  IF p_matter_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.lawyer_requests
    WHERE user_id = p_user_id AND lawyer_id = p_lawyer_id AND matter_id = p_matter_id
    FOR UPDATE;
  ELSE
    SELECT id INTO v_existing_id
    FROM public.lawyer_requests
    WHERE user_id = p_user_id AND lawyer_id = p_lawyer_id AND matter_id IS NULL
    FOR UPDATE;
  END IF;

  -- 2. If duplicate exists, return success message
  IF FOUND THEN
    RETURN json_build_object('ok', true, 'message', 'Request already sent', 'already_exists', true);
  END IF;

  -- 3. Insert new request
  INSERT INTO public.lawyer_requests (user_id, lawyer_id, matter_id, message, status)
  VALUES (p_user_id, p_lawyer_id, p_matter_id, p_message, 'pending')
  RETURNING row_to_json(lawyer_requests) INTO v_request;

  RETURN json_build_object('ok', true, 'message', 'Request sent to lawyer', 'already_exists', false);
END;
$$;

COMMIT;
