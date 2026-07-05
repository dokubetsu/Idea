BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 037: pending_notifications indexes (H8 fix)
-- ================================================================
--
-- process_pending_notifications() / claim_pending_notifications() query
-- status IN ('pending','failed') every 5 seconds.  Without indexes, this
-- becomes a sequential scan that degrades linearly as completed rows
-- accumulate.  Two partial indexes cover all access patterns:
--
--   1. Work-queue index  — drives the claim query (pending/failed rows
--      ordered by created_at for FIFO delivery).
--   2. Cleanup index     — lets a periodic purge scan only completed /
--      permanently-failed rows efficiently.

CREATE INDEX IF NOT EXISTS idx_pending_notifications_status_created
  ON public.pending_notifications (status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_pending_notifications_cleanup
  ON public.pending_notifications (status, updated_at)
  WHERE status IN ('completed', 'failed_permanently');

COMMIT;
