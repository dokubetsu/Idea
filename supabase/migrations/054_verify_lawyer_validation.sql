-- LEAD PLATFORM - Migration 054: verify_lawyer_rpc target verification safety

BEGIN;

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

  -- Security check: p_lawyer_id must actually exist in lawyer_profiles
  IF NOT EXISTS (
    SELECT 1 FROM public.lawyer_profiles
    WHERE id = p_lawyer_id
  ) THEN
    RAISE EXCEPTION 'Target user does not have a lawyer profile' USING ERRCODE = '45000';
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

-- Register this migration
INSERT INTO schema_migrations (version) VALUES ('054_verify_lawyer_validation') ON CONFLICT (version) DO NOTHING;

COMMIT;
