-- LEAD PLATFORM - Migration 055: Transactional notifications and deliveries creation

BEGIN;

CREATE OR REPLACE FUNCTION create_notification_rpc(
  p_user_id UUID,
  p_type TEXT,
  p_data JSONB,
  p_action JSONB,
  p_idempotency_key TEXT,
  p_channels TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_notif_id UUID;
  v_result JSONB;
  v_channel TEXT;
BEGIN
  -- Insert into notifications
  INSERT INTO public.notifications (user_id, type, data, action, status, idempotency_key)
  VALUES (p_user_id, p_type, p_data, p_action, 'unread', p_idempotency_key)
  ON CONFLICT (idempotency_key) DO UPDATE SET type = EXCLUDED.type
  RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'type', type,
    'data', data,
    'action', action,
    'status', status,
    'idempotency_key', idempotency_key,
    'created_at', created_at
  ) INTO v_result;

  v_notif_id := (v_result->>'id')::UUID;

  -- Only insert deliveries if we actually created/found a notification ID
  IF v_notif_id IS NOT NULL AND p_channels IS NOT NULL THEN
    FOREACH v_channel IN ARRAY p_channels LOOP
      INSERT INTO public.notification_deliveries (notification_id, channel, status)
      VALUES (v_notif_id, v_channel::public.delivery_channel, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_result;
END;
$$;

-- Register this migration
INSERT INTO schema_migrations (version) VALUES ('055_transactional_notifications') ON CONFLICT (version) DO NOTHING;

COMMIT;
