BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 038: Profile cascade FK fixes (H9 fix)
-- ================================================================
--
-- Migration 034 only patched matters.user_id → ON DELETE SET NULL.
-- The following FK columns still default to RESTRICT, blocking
-- Supabase Auth's CASCADE delete of auth.users → public.profiles:
--
--   consultations.lawyer_id
--   matter_assignments.assigned_by
--   matter_updates.author_id
--   documents.uploaded_by
--   lawyer_requests.user_id
--   lawyer_requests.lawyer_id
--
-- Fix: Re-add all constraints with ON DELETE SET NULL (for authorship
-- columns) or ON DELETE CASCADE (for ownership columns).
-- Columns that were NOT NULL are also relaxed to nullable since the
-- referenced profile will no longer exist after deletion.

-- ── consultations.lawyer_id ──────────────────────────────────────
ALTER TABLE public.consultations
  DROP CONSTRAINT IF EXISTS consultations_lawyer_id_fkey;
ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_lawyer_id_fkey
  FOREIGN KEY (lawyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── matter_assignments.assigned_by ───────────────────────────────
ALTER TABLE public.matter_assignments
  DROP CONSTRAINT IF EXISTS matter_assignments_assigned_by_fkey;
ALTER TABLE public.matter_assignments
  ADD CONSTRAINT matter_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
-- Allow assigned_by to become NULL when the assigning user is deleted
ALTER TABLE public.matter_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;

-- ── matter_updates.author_id ─────────────────────────────────────
ALTER TABLE public.matter_updates
  DROP CONSTRAINT IF EXISTS matter_updates_author_id_fkey;
ALTER TABLE public.matter_updates
  ADD CONSTRAINT matter_updates_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.matter_updates
  ALTER COLUMN author_id DROP NOT NULL;

-- ── documents.uploaded_by ────────────────────────────────────────
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

-- ── lawyer_requests.user_id ──────────────────────────────────────
-- Requests belong to a user; if user is deleted, cascade-delete the request.
ALTER TABLE public.lawyer_requests
  DROP CONSTRAINT IF EXISTS lawyer_requests_user_id_fkey;
ALTER TABLE public.lawyer_requests
  ADD CONSTRAINT lawyer_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── lawyer_requests.lawyer_id ────────────────────────────────────
-- If the lawyer profile is deleted, nullify the request's lawyer reference.
ALTER TABLE public.lawyer_requests
  DROP CONSTRAINT IF EXISTS lawyer_requests_lawyer_id_fkey;
ALTER TABLE public.lawyer_requests
  ADD CONSTRAINT lawyer_requests_lawyer_id_fkey
  FOREIGN KEY (lawyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
