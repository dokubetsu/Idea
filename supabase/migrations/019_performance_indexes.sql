-- ================================================================
-- LEAD PLATFORM — Migration 019: Performance Indexes
-- ================================================================

-- 1. matters indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matters_deleted_at ON public.matters(deleted_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matters_client_email ON public.matters(client_email);

-- 2. documents indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_matter_id ON public.documents(matter_id);

-- 3. consultations indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_user_id ON public.consultations(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_lawyer_id ON public.consultations(lawyer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_status ON public.consultations(status);

-- 4. meetings indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_matter_id ON public.meetings(matter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_scheduled_at ON public.meetings(scheduled_at);

-- 5. lawyer_profiles indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lawyer_profiles_free_consult ON public.lawyer_profiles(offers_free_consultation);

-- 6. hearings indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hearings_reminder_sent ON public.hearings(reminder_sent);
