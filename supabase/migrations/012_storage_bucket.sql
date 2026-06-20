-- ================================================================
-- LEAD PLATFORM — Migration 012: Document Vault Storage
-- ================================================================

-- Create the Storage Bucket for matter documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'matter_documents', 
  'matter_documents', 
  false, -- private bucket
  10485760, -- 10MB limit
  '{image/png,image/jpeg,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
) ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = '{image/png,image/jpeg,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}';

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything
CREATE POLICY "Admins have full access"
ON storage.objects FOR ALL
TO authenticated
USING (auth_role() = 'admin');

-- To define matter-based access, we need a helper function since we can't easily JOIN inside standard storage policies
-- without slowing down queries. We will extract the matter_id from the first part of the storage object path.
-- The object path will follow the convention: matter_id/filename.ext
CREATE OR REPLACE FUNCTION get_matter_id_from_path(bucket_id TEXT, name TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  -- Only attempt UUID cast if bucket is matter_documents
  -- We use a regex to extract the first path segment and cast it to UUID
  SELECT CASE 
    WHEN bucket_id = 'matter_documents' AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    THEN (regexp_replace(name, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.*', '\1'))::UUID
    ELSE NULL
  END;
$$;

-- Policy: Users can read/insert/update/delete objects in matters they own
CREATE POLICY "Users can manage documents for their matters"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'matter_documents' AND
  EXISTS (
    SELECT 1 FROM matters m
    WHERE m.id = get_matter_id_from_path(bucket_id, name)
    AND m.user_id = auth.uid()
  )
);

-- Policy: Lawyers can read/insert/update/delete objects in matters they are assigned to
CREATE POLICY "Lawyers can manage documents for assigned matters"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'matter_documents' AND
  EXISTS (
    SELECT 1 FROM matters m
    WHERE m.id = get_matter_id_from_path(bucket_id, name)
    AND m.lawyer_id = auth.uid()
  )
);
