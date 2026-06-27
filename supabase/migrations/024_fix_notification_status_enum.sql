BEGIN;

-- ================================================================
--  LEAD PLATFORM — Migration v24 (Fix Notification Status Enum)
-- ================================================================

-- 1. Temporarily alter the notifications table status column to text
ALTER TABLE public.notifications ALTER COLUMN status TYPE text;

-- 2. Drop the old enum type if it exists
DROP TYPE IF EXISTS public.notification_status CASCADE;

-- 3. Re-create the enum type with correct lowercase values
CREATE TYPE public.notification_status AS ENUM ('unread', 'read', 'dismissed');

-- 4. Update any existing values in notifications table to lowercase
UPDATE public.notifications SET status = 'unread' WHERE status IS NULL OR status = '' OR LOWER(status) = 'unread';
UPDATE public.notifications SET status = 'read' WHERE LOWER(status) = 'read';
UPDATE public.notifications SET status = 'dismissed' WHERE LOWER(status) = 'dismissed';

-- 5. Alter the status column type back to the new enum, with default 'unread'
ALTER TABLE public.notifications ALTER COLUMN status TYPE public.notification_status USING status::public.notification_status;
ALTER TABLE public.notifications ALTER COLUMN status SET DEFAULT 'unread';

COMMIT;
