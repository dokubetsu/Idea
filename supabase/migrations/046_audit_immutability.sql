BEGIN;

-- 1. Create raise_immutable function
CREATE OR REPLACE FUNCTION raise_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable. Updates and deletes are not permitted.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind raise_immutable to events table
DROP TRIGGER IF EXISTS events_immutable_trg ON public.events;
CREATE TRIGGER events_immutable_trg
BEFORE UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION raise_immutable();

-- 3. Bind raise_immutable to audit_logs table (since audit logs must also be immutable)
DROP TRIGGER IF EXISTS audit_logs_immutable_trg ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable_trg
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION raise_immutable();

-- 4. Create trigger function to auto-write to audit_logs
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
  v_target_id UUID;
  v_target_type TEXT;
  v_actor_id UUID;
BEGIN
  v_action := TG_OP;
  v_target_type := TG_TABLE_NAME;
  
  -- Set target_id and capture state
  IF TG_OP = 'DELETE' THEN
    v_target_id := OLD.id;
    v_changes := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_target_id := NEW.id;
    v_changes := jsonb_build_object('new', to_jsonb(NEW));
  ELSE -- UPDATE
    v_target_id := NEW.id;
    
    -- Special case for lawyer_profiles: only audit if is_verified changes
    IF TG_TABLE_NAME = 'lawyer_profiles' THEN
      IF OLD.is_verified IS NOT DISTINCT FROM NEW.is_verified THEN
        RETURN NEW;
      END IF;
    END IF;
    
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  END IF;

  -- Attempt to get the auth user id if executing in an auth session context
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    changes
  ) VALUES (
    v_actor_id,
    LOWER(v_action),
    v_target_type,
    v_target_id,
    v_changes
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create triggers on the relevant tables
DROP TRIGGER IF EXISTS audit_matters_trg ON public.matters;
CREATE TRIGGER audit_matters_trg
AFTER INSERT OR UPDATE OR DELETE ON public.matters
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_consultations_trg ON public.consultations;
CREATE TRIGGER audit_consultations_trg
AFTER INSERT OR UPDATE OR DELETE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_invoices_trg ON public.invoices;
CREATE TRIGGER audit_invoices_trg
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_payments_trg ON public.payments;
CREATE TRIGGER audit_payments_trg
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_lawyer_profiles_trg ON public.lawyer_profiles;
CREATE TRIGGER audit_lawyer_profiles_trg
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_fee_arrangements_trg ON public.fee_arrangements;
CREATE TRIGGER audit_fee_arrangements_trg
AFTER INSERT OR UPDATE OR DELETE ON public.fee_arrangements
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

COMMIT;
