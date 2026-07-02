-- Alter matters table user_id column constraint to allow NULL on delete
ALTER TABLE public.matters ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.matters DROP CONSTRAINT IF EXISTS matters_user_id_fkey;
ALTER TABLE public.matters DROP CONSTRAINT IF EXISTS cases_user_id_fkey;
ALTER TABLE public.matters ADD CONSTRAINT matters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
