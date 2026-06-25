-- ================================================================
--  LEAD PLATFORM — Migration v7 (Notifications)
-- ================================================================

-- 1. Create enum types if not exists
DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('unread', 'read', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_channel AS ENUM ('email', 'sms', 'in_app');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID                       NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT                       NOT NULL,
  data        JSONB                      NOT NULL DEFAULT '{}'::jsonb,
  action      JSONB,                     -- complex action object: { "label": "View Matter", "url": "/user/matters/<id>" }
  status      public.notification_status NOT NULL DEFAULT 'unread',
  created_at  TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

-- 3. Create notification_deliveries table
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID                    NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel         public.delivery_channel NOT NULL,
  status          public.delivery_status  NOT NULL DEFAULT 'pending',
  error_msg       TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- 4. Set up updated_at trigger for notification_deliveries
DO $$ BEGIN
  CREATE TRIGGER trg_notification_deliveries_updated_at BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for notifications
CREATE POLICY "notifications:read_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications:update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 7. Create indexes for quick feeds
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_notification_id ON public.notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.notification_deliveries(status);
