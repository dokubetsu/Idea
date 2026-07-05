BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 043: Harden Docket RLS Policies
-- Prevent message tampering, global write pollution, task hijacking,
-- and document request fulfillment bypass.
-- ================================================================

-- ── Helper Functions: Security Definer to prevent RLS recursion ─

-- Helper 1: Case Messages unchanged check
CREATE OR REPLACE FUNCTION check_case_message_unmodified(
  p_msg_id UUID,
  p_content TEXT,
  p_sender_id UUID,
  p_message_type TEXT,
  p_attachment_path TEXT,
  p_matter_id UUID,
  p_created_at TIMESTAMPTZ
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_content TEXT;
  v_sender_id UUID;
  v_message_type TEXT;
  v_attachment_path TEXT;
  v_matter_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  SELECT content, sender_id, message_type, attachment_path, matter_id, created_at
  INTO v_content, v_sender_id, v_message_type, v_attachment_path, v_matter_id, v_created_at
  FROM public.case_messages
  WHERE id = p_msg_id;

  RETURN (
    p_content IS NOT DISTINCT FROM v_content AND
    p_sender_id IS NOT DISTINCT FROM v_sender_id AND
    p_message_type IS NOT DISTINCT FROM v_message_type AND
    p_attachment_path IS NOT DISTINCT FROM v_attachment_path AND
    p_matter_id IS NOT DISTINCT FROM v_matter_id AND
    p_created_at IS NOT DISTINCT FROM v_created_at
  );
END;
$$;

-- Helper 2: Case Tasks unchanged check
CREATE OR REPLACE FUNCTION check_case_task_unmodified(
  p_task_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_due_date DATE,
  p_matter_id UUID,
  p_assigned_to UUID
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_due_date DATE;
  v_matter_id UUID;
  v_assigned_to UUID;
BEGIN
  SELECT title, description, due_date, matter_id, assigned_to
  INTO v_title, v_description, v_due_date, v_matter_id, v_assigned_to
  FROM public.case_tasks
  WHERE id = p_task_id;

  RETURN (
    p_title IS NOT DISTINCT FROM v_title AND
    p_description IS NOT DISTINCT FROM v_description AND
    p_due_date IS NOT DISTINCT FROM v_due_date AND
    p_matter_id IS NOT DISTINCT FROM v_matter_id AND
    p_assigned_to IS NOT DISTINCT FROM v_assigned_to
  );
END;
$$;

-- Helper 3: Document Requests fulfillment check
CREATE OR REPLACE FUNCTION check_document_request_fulfillment(
  p_req_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_label TEXT,
  p_requested_by UUID,
  p_matter_id UUID,
  p_status TEXT,
  p_document_id UUID,
  p_fulfilled_at TIMESTAMPTZ
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_label TEXT;
  v_requested_by UUID;
  v_matter_id UUID;
  v_status TEXT;
BEGIN
  SELECT title, description, label::text, requested_by, matter_id, status::text
  INTO v_title, v_description, v_label, v_requested_by, v_matter_id, v_status
  FROM public.document_requests
  WHERE id = p_req_id;

  RETURN (
    -- Read-only columns must remain unchanged
    p_title IS NOT DISTINCT FROM v_title AND
    p_description IS NOT DISTINCT FROM v_description AND
    p_label IS NOT DISTINCT FROM v_label AND
    p_requested_by IS NOT DISTINCT FROM v_requested_by AND
    p_matter_id IS NOT DISTINCT FROM v_matter_id AND
    
    -- Status transition must be pending -> fulfilled
    v_status = 'pending' AND
    p_status = 'fulfilled' AND
    
    -- Document ID and fulfilled timestamp must be provided
    p_document_id IS NOT NULL AND
    p_fulfilled_at IS NOT NULL
  );
END;
$$;


-- ── 1. Harden public.time_entries write policy ─────────────────
-- Verify that the user is the assigned lawyer on the matter and has the lawyer role.
DROP POLICY IF EXISTS "time_entries:write_lawyer" ON public.time_entries;
CREATE POLICY "time_entries:write_lawyer" ON public.time_entries FOR ALL TO authenticated
  USING (
    (auth_role() = 'lawyer' AND lawyer_id = auth.uid() AND matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid()))
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    (auth_role() = 'lawyer' AND lawyer_id = auth.uid() AND matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid()))
    OR auth_role() = 'admin'
  );

-- ── 2. Harden public.internal_notes write policy ───────────────
-- Verify that the user is the assigned lawyer on the matter and has the lawyer role.
DROP POLICY IF EXISTS "internal_notes:write_lawyer" ON public.internal_notes;
CREATE POLICY "internal_notes:write_lawyer" ON public.internal_notes FOR ALL TO authenticated
  USING (
    (auth_role() = 'lawyer' AND author_id = auth.uid() AND matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid()))
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    (auth_role() = 'lawyer' AND author_id = auth.uid() AND matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid()))
    OR auth_role() = 'admin'
  );

-- ── 3. Harden public.case_messages update policy ───────────────
-- Ensure that participants can only update the read_at column of messages,
-- preventing message content, sender, type, or timestamp tampering.
DROP POLICY IF EXISTS "case_messages:update_participant" ON public.case_messages;
CREATE POLICY "case_messages:update_participant" ON public.case_messages FOR UPDATE TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  )
  WITH CHECK (
    auth_role() = 'admin' OR (
      matter_id IN (
        SELECT id FROM public.matters
        WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
      )
      -- Read-only protection: all other columns must remain unchanged
      AND check_case_message_unmodified(id, content, sender_id, message_type, attachment_path, matter_id, created_at)
    )
  );

-- ── 4. Harden public.case_tasks update policy ──────────────────
-- Allow the assigned client to only update task completion columns,
-- preventing due date changes, title edits, or reassignments.
DROP POLICY IF EXISTS "case_tasks:update_participant" ON public.case_tasks;
CREATE POLICY "case_tasks:update_participant" ON public.case_tasks FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
    OR (
      assigned_to = auth.uid()
      -- If the user is only the client, all other fields must remain unchanged
      AND check_case_task_unmodified(id, title, description, due_date, matter_id, assigned_to)
    )
  );

-- ── 5. Harden public.document_requests update policy ───────────
-- Allow the client to only transition status from pending to fulfilled
-- and attach document metadata, preventing parameter forging.
DROP POLICY IF EXISTS "document_requests:update_participant" ON public.document_requests;
CREATE POLICY "document_requests:update_participant" ON public.document_requests FOR UPDATE TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
    OR (
      matter_id IN (SELECT id FROM public.matters WHERE user_id = auth.uid())
      -- Client can only fulfill a pending request by attaching a document_id
      AND check_document_request_fulfillment(
        id, title, description, label::text, requested_by, matter_id, status::text, document_id, fulfilled_at
      )
    )
  );

COMMIT;
