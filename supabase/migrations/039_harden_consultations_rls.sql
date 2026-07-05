BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 039: Harden consultations RLS (H10 fix)
-- ================================================================
--
-- The original consultations:lawyer_update_assigned policy granted UPDATE
-- with USING (lawyer_id = auth.uid()) but had NO WITH CHECK clause.
-- This allowed a lawyer hitting Supabase REST directly to freely set
-- payment_status='paid', sessions_total=999, user_id=<anything>, etc.
--
-- Fix: re-create the policy with a WITH CHECK that pins every sensitive
-- column to its current persisted value, so a lawyer can only change the
-- columns the application legitimately writes (status, notes, meeting_link).

DROP POLICY IF EXISTS "consultations:lawyer_update_assigned" ON public.consultations;

CREATE POLICY "consultations:lawyer_update_assigned"
  ON public.consultations FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid())
  WITH CHECK (
    -- lawyer_id must stay the same (cannot re-assign to self or another)
    lawyer_id = auth.uid()
    -- payment_status is immutable through this path — payment goes via webhook
    AND payment_status = (SELECT c2.payment_status FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- sessions_total is set at booking time and must not be altered
    AND sessions_total = (SELECT c2.sessions_total FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- package is immutable after booking
    AND package = (SELECT c2.package FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- user_id must never change — ownership is fixed
    AND user_id = (SELECT c2.user_id FROM public.consultations c2 WHERE c2.id = consultations.id)
  );

COMMIT;
