BEGIN;

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_updates DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles:read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles:update_own" ON public.profiles;
DROP POLICY IF EXISTS "lawyer_profiles:read_all" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer_profiles:update_own" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "matters:read_participant" ON public.matters;
DROP POLICY IF EXISTS "matters:insert_by_user" ON public.matters;
DROP POLICY IF EXISTS "matters:update_participant" ON public.matters;
DROP POLICY IF EXISTS "docs:read_participant" ON public.documents;
DROP POLICY IF EXISTS "docs:insert_participant" ON public.documents;
DROP POLICY IF EXISTS "assignments:read" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments:insert" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments:update_lawyer_admin" ON public.matter_assignments;
DROP POLICY IF EXISTS "updates:read_participant_gated" ON public.matter_updates;
DROP POLICY IF EXISTS "updates:insert_participant" ON public.matter_updates;

COMMIT;
