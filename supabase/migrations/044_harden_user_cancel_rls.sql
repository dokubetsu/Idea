BEGIN;

DROP POLICY IF EXISTS "consultations:user_cancel_own" ON public.consultations;

CREATE POLICY "consultations:user_cancel_own"
  ON public.consultations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    status = 'cancelled'
    -- user_id must stay the same (cannot transfer ownership)
    AND user_id = auth.uid()
    -- lawyer_id cannot be changed
    AND lawyer_id = (SELECT c2.lawyer_id FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- payment_status is immutable
    AND payment_status = (SELECT c2.payment_status FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- sessions_total must not be altered
    AND sessions_total = (SELECT c2.sessions_total FROM public.consultations c2 WHERE c2.id = consultations.id)
    -- package is immutable after booking
    AND package = (SELECT c2.package FROM public.consultations c2 WHERE c2.id = consultations.id)
  );

COMMIT;
