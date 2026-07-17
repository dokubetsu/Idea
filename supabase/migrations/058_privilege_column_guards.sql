-- Migration 058: Privilege-column guards + lock down create_notification_rpc
--
-- Closes direct PostgREST privilege-escalation paths:
--   1. profiles: clients cannot set role / is_active
--   2. lawyer_profiles: clients cannot set is_verified
--   3. matters: clients cannot mutate ownership/status/lifecycle columns
--   4. create_notification_rpc: service_role only

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. profiles — freeze role and is_active for non-admin clients
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_profiles_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  -- Service role (backend) may update anything
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Active admins may update privilege columns
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::public.user_role
      AND p.is_active = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot change profile role'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Cannot change profile is_active'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privilege_columns ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privilege_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_privilege_columns();

-- ═══════════════════════════════════════════════════════════════════
-- 2. lawyer_profiles — freeze is_verified for non-admin clients
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_lawyer_profiles_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::public.user_role
      AND p.is_active = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'Cannot change is_verified; use admin verification RPC'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lawyer_profiles_privilege_columns ON public.lawyer_profiles;
CREATE TRIGGER trg_guard_lawyer_profiles_privilege_columns
  BEFORE UPDATE ON public.lawyer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lawyer_profiles_privilege_columns();

-- ═══════════════════════════════════════════════════════════════════
-- 3. matters — freeze ownership / lifecycle columns for clients
--    Lawyers may still self-assign (matching accept) and update status.
--    Clients (role=user) cannot change privileged columns.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_matters_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Prefer DB role (authoritative) over JWT metadata for this check
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active = TRUE;

  IF v_role = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  -- Never allow rebinding intake session
  IF NEW.intake_session_id IS DISTINCT FROM OLD.intake_session_id THEN
    RAISE EXCEPTION 'Cannot change matter intake_session_id'
      USING ERRCODE = '42501';
  END IF;

  -- Soft-delete / archive timestamps: service or admin only
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'Cannot change matter deleted_at/archived_at'
      USING ERRCODE = '42501';
  END IF;

  -- Clients cannot mutate ownership or lifecycle status
  IF v_role IS NULL OR v_role = 'user'::public.user_role THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Clients cannot change matter user_id'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.lawyer_id IS DISTINCT FROM OLD.lawyer_id THEN
      RAISE EXCEPTION 'Clients cannot change matter lawyer_id'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Clients cannot change matter status'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
       OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
      RAISE EXCEPTION 'Clients cannot change matter lifecycle timestamps'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Lawyers: may only assign themselves (or clear is not allowed here)
  IF v_role = 'lawyer'::public.user_role THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Lawyers cannot change matter user_id'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.lawyer_id IS DISTINCT FROM OLD.lawyer_id THEN
      -- Allow self-assign when previously unassigned (matching accept)
      IF NOT (
        NEW.lawyer_id = auth.uid()
        AND (OLD.lawyer_id IS NULL OR OLD.lawyer_id = auth.uid())
      ) THEN
        RAISE EXCEPTION 'Lawyers can only self-assign as matter lawyer'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_matters_privilege_columns ON public.matters;
CREATE TRIGGER trg_guard_matters_privilege_columns
  BEFORE UPDATE ON public.matters
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_matters_privilege_columns();

-- ═══════════════════════════════════════════════════════════════════
-- 4. create_notification_rpc — service_role only
-- ═══════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.create_notification_rpc(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_notification_rpc(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT[]
) TO service_role;

INSERT INTO schema_migrations (version)
VALUES ('058_privilege_column_guards')
ON CONFLICT (version) DO NOTHING;

COMMIT;
