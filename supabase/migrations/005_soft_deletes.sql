BEGIN;

-- ================================================================
--  LEAD PLATFORM — Soft-Delete Migration
-- ================================================================

-- 1. Add deleted_at column to matters and documents
ALTER TABLE matters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Create soft delete trigger function for matters
CREATE OR REPLACE FUNCTION soft_delete_matter()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE matters
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL; -- Cancels the actual hard delete
END;
$$ LANGUAGE plpgsql;

-- Create trigger on matters
DROP TRIGGER IF EXISTS trg_matters_soft_delete ON matters;
CREATE TRIGGER trg_matters_soft_delete
  BEFORE DELETE ON matters
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_matter();

-- 3. Create soft delete trigger function for documents
CREATE OR REPLACE FUNCTION soft_delete_document()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE documents
  SET deleted_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL; -- Cancels the actual hard delete
END;
$$ LANGUAGE plpgsql;

-- Create trigger on documents
DROP TRIGGER IF EXISTS trg_documents_soft_delete ON documents;
CREATE TRIGGER trg_documents_soft_delete
  BEFORE DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_document();

-- 4. Recreate RLS Select policies to respect soft deletes
DROP POLICY IF EXISTS "matters:read_participant" ON matters;
CREATE POLICY "matters:read_participant" ON matters FOR SELECT TO authenticated
  USING ((user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "docs:read_participant" ON documents;
CREATE POLICY "docs:read_participant" ON documents FOR SELECT TO authenticated
  USING ((matter_id IN (SELECT id FROM matters WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL) OR auth_role() = 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "facts:read_participant" ON facts;
CREATE POLICY "facts:read_participant" ON facts FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM matters
    WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin');

DROP POLICY IF EXISTS "events:read_participant" ON events;
CREATE POLICY "events:read_participant" ON events FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM matters
    WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin');

DROP POLICY IF EXISTS "updates:read_participant_gated" ON matter_updates;
CREATE POLICY "updates:read_participant_gated" ON matter_updates FOR SELECT TO authenticated
  USING (
    (matter_id IN (SELECT id FROM matters WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL)
     AND (is_internal = false OR auth_role() IN ('lawyer','admin')))
    OR auth_role() = 'admin'
  );

COMMIT;
