BEGIN;

DELETE FROM storage.buckets WHERE id = 'documents';

COMMIT;
