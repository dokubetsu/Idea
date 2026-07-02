BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 036: Atomic emit_event_with_outbox (C2 fix)
-- ================================================================
--
-- Replaces two separate REST calls (events insert + pending_notifications
-- insert) with a single plpgsql function executed in one DB transaction.
-- If the outbox insert fails, the event insert is also rolled back, so the
-- system never logs an event without a corresponding outbox row, eliminating
-- the "notification permanently lost on partial failure" bug.

CREATE OR REPLACE FUNCTION emit_event_with_outbox(
  p_event_type      TEXT,
  p_actor_id        UUID,
  p_matter_id       UUID,
  p_payload         JSONB,
  p_pending         JSONB   -- array of {subscriber_name: TEXT} objects
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- 1. Insert the immutable event record
  INSERT INTO public.events (event_type, actor_id, matter_id, payload)
  VALUES (
    p_event_type,
    p_actor_id,
    p_matter_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  -- 2. Insert one outbox row per subscriber (same transaction)
  INSERT INTO public.pending_notifications
    (event_type, actor_id, matter_id, payload, subscriber_name, status, attempts)
  SELECT
    p_event_type,
    p_actor_id,
    p_matter_id,
    COALESCE(p_payload, '{}'::jsonb),
    (r->>'subscriber_name'),
    'pending',
    0
  FROM jsonb_array_elements(p_pending) AS r;

  RETURN v_event_id;
END;
$$;

COMMIT;
