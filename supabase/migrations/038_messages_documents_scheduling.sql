BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 038: Messages, Document Requests,
-- Document update policy, and Meeting mode/location
-- ================================================================

-- ── 1. case_messages ─────────────────────────────────────────────
-- This table backs the Communications/Messages tab on both the
-- lawyer and client dashboards. It previously did not exist, which
-- is why sent messages never appeared in the chat.

CREATE TABLE IF NOT EXISTS public.case_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id       UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.profiles(id),
  content         TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  attachment_path TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_messages_matter_id  ON public.case_messages(matter_id);
CREATE INDEX IF NOT EXISTS idx_case_messages_created_at ON public.case_messages(created_at);

ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_messages:read_participant" ON public.case_messages;
CREATE POLICY "case_messages:read_participant" ON public.case_messages FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "case_messages:insert_participant" ON public.case_messages;
CREATE POLICY "case_messages:insert_participant" ON public.case_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      matter_id IN (
        SELECT id FROM public.matters
        WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
      ) OR auth_role() = 'admin'
    )
  );

-- Allows the recipient (or the sender, harmlessly) to mark messages as read.
DROP POLICY IF EXISTS "case_messages:update_participant" ON public.case_messages;
CREATE POLICY "case_messages:update_participant" ON public.case_messages FOR UPDATE TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

-- ── 2. document_requests ─────────────────────────────────────────
-- Lets a lawyer ask a client to upload a specific document (with a
-- title, description, and label). The client fulfills the request
-- from their Documents tab, which creates a row in `documents`.

DO $$ BEGIN
  CREATE TYPE public.document_request_label AS ENUM ('evidence', 'research', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_request_status AS ENUM ('pending', 'fulfilled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.document_requests (
  id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id     UUID                       NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  requested_by  UUID                       NOT NULL REFERENCES public.profiles(id),
  title         TEXT                       NOT NULL,
  description   TEXT,
  label         public.document_request_label NOT NULL DEFAULT 'other',
  status        public.document_request_status NOT NULL DEFAULT 'pending',
  document_id   UUID                       REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  fulfilled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_requests_matter_id ON public.document_requests(matter_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status    ON public.document_requests(status);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_requests:read_participant" ON public.document_requests;
CREATE POLICY "document_requests:read_participant" ON public.document_requests FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "document_requests:insert_lawyer_admin" ON public.document_requests;
CREATE POLICY "document_requests:insert_lawyer_admin" ON public.document_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid() AND (
      matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
      OR auth_role() = 'admin'
    )
  );

-- Both the lawyer (e.g. to cancel) and the client (to fulfill) can update.
DROP POLICY IF EXISTS "document_requests:update_participant" ON public.document_requests;
CREATE POLICY "document_requests:update_participant" ON public.document_requests FOR UPDATE TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

-- ── 3. documents: add missing UPDATE policy ─────────────────────
-- Approve/reject and lawyer-note actions on documents were silently
-- failing under RLS because there was no UPDATE policy at all.
DROP POLICY IF EXISTS "docs:update_lawyer_admin" ON public.documents;
CREATE POLICY "docs:update_lawyer_admin" ON public.documents FOR UPDATE TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ── 3.5. documents: review workflow ──────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'under_review';

DO $$
BEGIN
  ALTER TABLE public.documents
    ADD CONSTRAINT chk_documents_review_status
    CHECK (
      review_status IN (
        'under_review',
        'approved',
        'rejected',
        'needs_revision'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. meetings: add mode + location for calls ──────────────────
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'video';
DO $$ BEGIN
  ALTER TABLE public.meetings
    ADD CONSTRAINT chk_meetings_mode CHECK (mode IN ('video', 'phone', 'in_person'));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS location TEXT;

-- Recreate schedule_meeting RPC with optional mode/location params
-- (defaulted, so existing 5-argument callers keep working unchanged).
DROP FUNCTION IF EXISTS public.schedule_meeting(UUID, TIMESTAMPTZ, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.schedule_meeting(
  p_matter_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_notes TEXT,
  p_meeting_link TEXT,
  p_mode TEXT DEFAULT 'video',
  p_location TEXT DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_sessions_used INTEGER;
  v_sessions_total INTEGER;
  v_scheduled_count INTEGER;
  v_meeting json;
BEGIN
  SELECT sessions_used, sessions_total
  INTO v_sessions_used, v_sessions_total
  FROM public.consultations
  WHERE matter_id = p_matter_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT COUNT(*) INTO v_scheduled_count
    FROM public.meetings
    WHERE matter_id = p_matter_id AND status = 'scheduled';

    IF (v_sessions_used + v_scheduled_count) >= v_sessions_total THEN
      RAISE EXCEPTION 'Session limit reached' USING ERRCODE = 'P0005';
    END IF;
  END IF;

  INSERT INTO public.meetings (matter_id, scheduled_at, duration_minutes, notes, meeting_link, mode, location, status)
  VALUES (p_matter_id, p_scheduled_at, p_duration_minutes, p_notes, p_meeting_link, COALESCE(p_mode, 'video'), p_location, 'scheduled')
  RETURNING row_to_json(meetings) INTO v_meeting;

  RETURN v_meeting;
END;
$$;

COMMIT;
