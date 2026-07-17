BEGIN;

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
  -- Insert into profiles using the provided p_role parameter (COALESCE to 'user' as fallback)
  INSERT INTO public.profiles (id, role, full_name, phone, city, state)
  VALUES (p_user_id, COALESCE(p_role, 'user'), p_full_name, p_phone, p_city, p_state)
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

COMMIT;
