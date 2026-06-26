-- ================================================================
--  LEAD PLATFORM — Row Level Security
-- ================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_updates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_requests    ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies to ensure idempotency ─────────────────
DROP POLICY IF EXISTS "profiles:read_participant" ON public.profiles;
DROP POLICY IF EXISTS "profiles:insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles:update_own" ON public.profiles;
DROP POLICY IF EXISTS "lp:read_all" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lp:insert_own" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lp:update_own_or_admin" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "intake:own_only" ON public.intake_sessions;
DROP POLICY IF EXISTS "matters:read_participant" ON public.matters;
DROP POLICY IF EXISTS "matters:insert_by_user" ON public.matters;
DROP POLICY IF EXISTS "matters:update_participant" ON public.matters;
DROP POLICY IF EXISTS "facts:read_participant" ON public.facts;
DROP POLICY IF EXISTS "facts:insert_participant" ON public.facts;
DROP POLICY IF EXISTS "facts:update_lawyer_admin" ON public.facts;
DROP POLICY IF EXISTS "events:read_participant" ON public.events;
DROP POLICY IF EXISTS "events:no_client_insert" ON public.events;
DROP POLICY IF EXISTS "updates:read_participant_gated" ON public.matter_updates;
DROP POLICY IF EXISTS "updates:insert_participant" ON public.matter_updates;
DROP POLICY IF EXISTS "assignments:read" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments:insert" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments:update_lawyer_admin" ON public.matter_assignments;
DROP POLICY IF EXISTS "docs:read_participant" ON public.documents;
DROP POLICY IF EXISTS "docs:insert_participant" ON public.documents;
DROP POLICY IF EXISTS "requests:read_own" ON public.lawyer_requests;
DROP POLICY IF EXISTS "requests:insert_user" ON public.lawyer_requests;
DROP POLICY IF EXISTS "requests:update_lawyer_admin" ON public.lawyer_requests;

-- ── Helper ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ── profiles ─────────────────────────────────────────────────────
CREATE POLICY "profiles:read_participant" ON profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR role = 'lawyer'
  OR auth_role() = 'admin'
  OR id IN (
    SELECT user_id FROM matters WHERE lawyer_id = auth.uid()
    UNION
    SELECT lawyer_id FROM matters WHERE user_id = auth.uid()
  )
);
CREATE POLICY "profiles:insert_own"    ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles:update_own"    ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR auth_role() = 'admin');

-- ── lawyer_profiles ──────────────────────────────────────────────
CREATE POLICY "lp:read_all"            ON lawyer_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "lp:insert_own"          ON lawyer_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "lp:update_own_or_admin" ON lawyer_profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR auth_role() = 'admin');

-- ── intake_sessions ──────────────────────────────────────────────
CREATE POLICY "intake:own_only"        ON intake_sessions FOR ALL TO authenticated USING (user_id = auth.uid());

-- ── matters ──────────────────────────────────────────────────────
CREATE POLICY "matters:read_participant"
  ON matters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');

CREATE POLICY "matters:insert_by_user"
  ON matters FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_role() = 'user');

CREATE POLICY "matters:update_participant"
  ON matters FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');

-- ── facts ────────────────────────────────────────────────────────
CREATE POLICY "facts:read_participant"
  ON facts FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM matters
    WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ) OR auth_role() = 'admin');

CREATE POLICY "facts:insert_participant"
  ON facts FOR INSERT TO authenticated
  WITH CHECK (matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ));

CREATE POLICY "facts:update_lawyer_admin"
  ON facts FOR UPDATE TO authenticated
  USING (
    auth_role() = 'admin'
    OR matter_id IN (
      SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
    )
  );

-- ── events ───────────────────────────────────────────────────────
CREATE POLICY "events:read_participant"
  ON events FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ) OR auth_role() = 'admin');

-- Events are insert-only from service role (never direct client insert)
CREATE POLICY "events:no_client_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK (false);  -- only service role can insert

-- ── matter_updates ───────────────────────────────────────────────
CREATE POLICY "updates:read_participant_gated"
  ON matter_updates FOR SELECT TO authenticated
  USING (
    (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid())
     AND (is_internal = false OR auth_role() IN ('lawyer','admin')))
    OR auth_role() = 'admin'
  );

CREATE POLICY "updates:insert_participant"
  ON matter_updates FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ));

-- ── matter_assignments ───────────────────────────────────────────
CREATE POLICY "assignments:read"
  ON matter_assignments FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid() OR assigned_by = auth.uid() OR auth_role() = 'admin');

CREATE POLICY "assignments:insert"
  ON matter_assignments FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin','user'));

CREATE POLICY "assignments:update_lawyer_admin"
  ON matter_assignments FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin');

-- ── documents ────────────────────────────────────────────────────
CREATE POLICY "docs:read_participant"
  ON documents FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ) OR auth_role() = 'admin');

CREATE POLICY "docs:insert_participant"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()
  ));

-- ── lawyer_requests ──────────────────────────────────────────────
CREATE POLICY "requests:read_own"
  ON lawyer_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');

CREATE POLICY "requests:insert_user"
  ON lawyer_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_role() = 'user');

CREATE POLICY "requests:update_lawyer_admin"
  ON lawyer_requests FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin');
