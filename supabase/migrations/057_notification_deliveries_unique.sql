-- Migration: Add UNIQUE constraint on (notification_id, channel) in public.notification_deliveries

BEGIN;

-- Add the unique constraint to prevent duplicate deliveries per channel for a given notification.
ALTER TABLE public.notification_deliveries
ADD CONSTRAINT uq_notification_deliveries_notification_id_channel UNIQUE (notification_id, channel);

COMMIT;
