BEGIN;

CREATE OR REPLACE FUNCTION claim_pending_notifications(
  p_batch_size INT DEFAULT 50
)
RETURNS SETOF public.pending_notifications
LANGUAGE sql
AS $$
  UPDATE public.pending_notifications
  SET
    status     = 'processing',
    updated_at = now()
  WHERE id IN (
    SELECT id
    FROM public.pending_notifications
    WHERE
      (
        status IN ('pending', 'failed')
        AND (
          last_attempt_at IS NULL
          OR last_attempt_at <= now() - (power(2, attempts - 1) * interval '5 seconds')
        )
      )
      OR (
        status = 'processing'
        AND updated_at <= now() - interval '10 minutes'
      )
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMIT;
