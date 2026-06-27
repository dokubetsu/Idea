BEGIN;

ALTER TABLE public.notifications ALTER COLUMN status TYPE text;
DROP TYPE IF EXISTS public.notification_status CASCADE;
CREATE TYPE public.notification_status AS ENUM ('UNREAD', 'READ', 'DISMISSED');
ALTER TABLE public.notifications ALTER COLUMN status TYPE public.notification_status USING status::text::public.notification_status;

COMMIT;
