-- ============================================================
-- Migration 008: Notification Delivery Preferences
-- Allows users to opt-out of specific channels per notification type
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL,   -- 'matter_assigned' | 'hearing_scheduled' | 'milestone_completed' | 'comment_added'
    channel    TEXT        NOT NULL,   -- 'email' | 'sms' | 'in_app'
    enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pref_user_type_channel UNIQUE (user_id, type, channel),
    CONSTRAINT chk_pref_channel CHECK (channel IN ('email', 'sms', 'in_app')),
    CONSTRAINT chk_pref_type   CHECK (type IN ('matter_assigned', 'hearing_scheduled', 'milestone_completed', 'comment_added', 'generic'))
);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_prefs_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read and manage only their own preferences
CREATE POLICY "users_select_own_prefs"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_prefs"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_prefs"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_prefs"
    ON notification_preferences FOR DELETE
    USING (user_id = auth.uid());

-- Service role bypasses RLS (for backend worker reads)
CREATE POLICY "service_role_all_prefs"
    ON notification_preferences FOR ALL
    USING (auth.role() = 'service_role');
