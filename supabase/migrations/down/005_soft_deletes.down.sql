BEGIN;

DROP TRIGGER IF EXISTS trg_matters_soft_delete ON public.matters;
DROP TRIGGER IF EXISTS trg_documents_soft_delete ON public.documents;
DROP FUNCTION IF EXISTS public.handle_soft_delete();
ALTER TABLE public.matters DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.documents DROP COLUMN IF EXISTS deleted_at;

COMMIT;
