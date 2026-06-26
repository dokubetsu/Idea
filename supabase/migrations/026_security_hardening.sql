-- ================================================================
-- LEAD PLATFORM -- Migration 026: Security Hardening (C2, C6, C7)
-- ================================================================

-- C2: Drop legacy 2-param confirm_consultation
-- Migration 022 created a secure 1-param version that uses auth.uid().
-- The old 2-param function (p_consultation_id UUID, p_lawyer_id UUID)
-- from migration 010 was left in place. Any authenticated user who
-- guessed a valid consultation_id + lawyer_id pair could call the old
-- function and impersonate any lawyer.
DROP FUNCTION IF EXISTS confirm_consultation(UUID, UUID);


-- C6: Secure get_admin_stats RPC
-- Previous version had no auth guard and no search_path restriction.
-- Now raises an exception if the calling session is not an admin.
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_total_users INT;
  v_total_lawyers INT;
  v_total_matters INT;
  v_open_matters INT;
  v_pending_verifications INT;
  v_total_facts INT;
BEGIN
  -- Admin-only guard: derived from JWT, cannot be spoofed by the caller.
  SELECT raw_app_meta_data->>'role'
    INTO v_role
    FROM auth.users
    WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)::INT INTO v_total_users           FROM public.profiles WHERE role = 'user';
  SELECT COUNT(*)::INT INTO v_total_lawyers         FROM public.profiles WHERE role = 'lawyer';
  SELECT COUNT(*)::INT INTO v_total_matters         FROM public.matters;
  SELECT COUNT(*)::INT INTO v_open_matters          FROM public.matters WHERE status IN ('intake', 'assessment', 'matching', 'active');
  SELECT COUNT(*)::INT INTO v_pending_verifications FROM public.lawyer_profiles WHERE is_verified = FALSE;
  SELECT COUNT(*)::INT INTO v_total_facts           FROM public.facts;

  RETURN json_build_object(
    'total_users',           v_total_users,
    'total_lawyers',         v_total_lawyers,
    'total_matters',         v_total_matters,
    'open_matters',          v_open_matters,
    'pending_verifications', v_pending_verifications,
    'total_facts',           v_total_facts
  );
END;
$$;


-- C7: Secure contact_lawyer_rpc
-- Previous version accepted p_user_id as a caller-supplied parameter.
-- Any authenticated user could pass any user_id and create lawyer
-- requests on behalf of another user.
-- Fix: remove p_user_id entirely and derive from auth.uid().
-- NOTE: The old 3-param signature contact_lawyer_rpc(UUID, UUID, UUID, TEXT)
-- is replaced by this 3-param (UUID, UUID, TEXT). The matching router.py
-- has been updated to omit the p_user_id argument.
DROP FUNCTION IF EXISTS contact_lawyer_rpc(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION contact_lawyer_rpc(
  p_lawyer_id UUID,
  p_matter_id UUID,
  p_message   TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_existing_id UUID;
  v_request     json;
BEGIN
  -- Derive caller identity from JWT -- cannot be spoofed by the caller.
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- 1. Check for duplicates under FOR UPDATE locking to prevent concurrent inserts.
  IF p_matter_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.lawyer_requests
      WHERE user_id = v_user_id AND lawyer_id = p_lawyer_id AND matter_id = p_matter_id
      FOR UPDATE;
  ELSE
    SELECT id INTO v_existing_id
      FROM public.lawyer_requests
      WHERE user_id = v_user_id AND lawyer_id = p_lawyer_id AND matter_id IS NULL
      FOR UPDATE;
  END IF;

  -- 2. Idempotency: if duplicate exists, return success.
  IF FOUND THEN
    RETURN json_build_object('ok', true, 'message', 'Request already sent', 'already_exists', true);
  END IF;

  -- 3. Insert new request.
  INSERT INTO public.lawyer_requests (user_id, lawyer_id, matter_id, message, status)
    VALUES (v_user_id, p_lawyer_id, p_matter_id, p_message, 'pending')
    RETURNING row_to_json(lawyer_requests) INTO v_request;

  RETURN json_build_object('ok', true, 'message', 'Request sent to lawyer', 'already_exists', false);
END;
$$;
