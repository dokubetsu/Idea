-- Note: Concurrent index drops are not wrapped in a transaction block
DROP INDEX IF EXISTS public.idx_matters_deleted_at;
DROP INDEX IF EXISTS public.idx_matters_client_email;
DROP INDEX IF EXISTS public.idx_documents_matter_id;
DROP INDEX IF EXISTS public.idx_consultations_user_id;
DROP INDEX IF EXISTS public.idx_consultations_lawyer_id;
DROP INDEX IF EXISTS public.idx_consultations_status;
DROP INDEX IF EXISTS public.idx_meetings_matter_id;
DROP INDEX IF EXISTS public.idx_meetings_scheduled_at;
DROP INDEX IF EXISTS public.idx_lawyer_profiles_free_consult;
DROP INDEX IF EXISTS public.idx_hearings_reminder_sent;
