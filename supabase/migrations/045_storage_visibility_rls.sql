BEGIN;

-- Drop the old policy
DROP POLICY IF EXISTS "Users can manage documents for their matters" ON storage.objects;

-- Recreate the policy with visibility checks on public.documents
CREATE POLICY "Users can manage documents for their matters"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'matter_documents' AND
  EXISTS (
    SELECT 1 FROM public.matters m
    LEFT JOIN public.documents d ON d.matter_id = m.id AND d.storage_path = name
    WHERE m.id = get_matter_id_from_path(bucket_id, name)
    AND m.user_id = auth.uid()
    AND (d.id IS NULL OR d.visibility IN ('client_visible', 'court_filed'))
  )
)
WITH CHECK (
  bucket_id = 'matter_documents' AND
  EXISTS (
    SELECT 1 FROM public.matters m
    WHERE m.id = get_matter_id_from_path(bucket_id, name)
    AND m.user_id = auth.uid()
  )
);

COMMIT;
