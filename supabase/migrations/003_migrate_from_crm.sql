-- ================================================================
--  LEAD PLATFORM — Migration from lead-crm schema
--
--  Run this ONLY if you already have the lead-crm schema deployed.
--  If starting fresh, run 001_schema.sql + 002_rls.sql instead.
--
--  What this does:
--    1. Renames tables: cases→matters, case_*→matter_*
--    2. Adds new columns required by the platform schema
--    3. Maps old status values to new workflow states
--    4. Creates new tables: facts, events, intake_sessions
--    5. Drops old RLS policies and recreates them for new names
-- ================================================================

-- ── Step 1: New enums (safe — won't fail if already exists) ──────
DO $$ BEGIN
  CREATE TYPE matter_status   AS ENUM ('draft','intake','assessment','matching','active','resolved','archived');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_category AS ENUM ('consumer','cheque_bounce','property','family','labour','criminal','cyber','rera','other');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_priority AS ENUM ('low','medium','high','urgent');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fact_source     AS ENUM ('user','ai','lawyer','system');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fact_value_type AS ENUM ('string','number','date','boolean','json');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending','accepted','rejected','withdrawn');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 2: Rename tables ─────────────────────────────────────────
ALTER TABLE IF EXISTS cases            RENAME TO matters;
ALTER TABLE IF EXISTS case_assignments RENAME TO matter_assignments;
ALTER TABLE IF EXISTS case_updates     RENAME TO matter_updates;

-- Rename foreign key columns from case_id to matter_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matter_assignments' AND column_name='case_id') THEN
    ALTER TABLE matter_assignments RENAME COLUMN case_id TO matter_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matter_updates' AND column_name='case_id') THEN
    ALTER TABLE matter_updates RENAME COLUMN case_id TO matter_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='case_id') THEN
    ALTER TABLE documents RENAME COLUMN case_id TO matter_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lawyer_requests' AND column_name='case_id') THEN
    ALTER TABLE lawyer_requests RENAME COLUMN case_id TO matter_id;
  END IF;
END $$;

-- ── Step 3: Rename columns on matters ────────────────────────────
-- old: description → new: summary (add summary, keep description as fallback)
ALTER TABLE matters ADD COLUMN IF NOT EXISTS summary TEXT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='description') THEN
    UPDATE matters SET summary = description WHERE summary IS NULL;
    ALTER TABLE matters ALTER COLUMN description DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE matters ALTER COLUMN summary SET NOT NULL;

-- New columns
ALTER TABLE matters ADD COLUMN IF NOT EXISTS intake_session_id UUID;
ALTER TABLE matters ADD COLUMN IF NOT EXISTS resolved_at       TIMESTAMPTZ;
ALTER TABLE matters ADD COLUMN IF NOT EXISTS archived_at       TIMESTAMPTZ;
ALTER TABLE matters ADD COLUMN IF NOT EXISTS ai_analysis       JSONB;

-- ── Step 4: Migrate status values ────────────────────────────────
-- old case_status: open, assigned, in_progress, resolved, closed
-- new matter_status: draft, intake, assessment, matching, active, resolved, archived
-- Add new status column, migrate values, drop old

ALTER TABLE matters ADD COLUMN IF NOT EXISTS new_status matter_status;

UPDATE matters SET new_status = CASE
  WHEN status::text = 'open'        THEN 'intake'::matter_status
  WHEN status::text = 'assigned'    THEN 'active'::matter_status
  WHEN status::text = 'in_progress' THEN 'active'::matter_status
  WHEN status::text = 'resolved'    THEN 'resolved'::matter_status
  WHEN status::text = 'closed'      THEN 'archived'::matter_status
  ELSE 'intake'::matter_status
END;

-- Swap columns
ALTER TABLE matters DROP COLUMN IF EXISTS status;
ALTER TABLE matters RENAME COLUMN new_status TO status;
ALTER TABLE matters ALTER COLUMN status SET NOT NULL;
ALTER TABLE matters ALTER COLUMN status SET DEFAULT 'intake';

-- ── Step 5: Migrate category ──────────────────────────────────────
ALTER TABLE matters ADD COLUMN IF NOT EXISTS new_category matter_category;
UPDATE matters SET new_category = CASE
  WHEN category::text = 'consumer'      THEN 'consumer'::matter_category
  WHEN category::text = 'cheque_bounce' THEN 'cheque_bounce'::matter_category
  WHEN category::text = 'property'      THEN 'property'::matter_category
  WHEN category::text = 'family'        THEN 'family'::matter_category
  WHEN category::text = 'labour'        THEN 'labour'::matter_category
  WHEN category::text = 'criminal'      THEN 'criminal'::matter_category
  WHEN category::text = 'cyber'         THEN 'cyber'::matter_category
  WHEN category::text = 'rera'          THEN 'rera'::matter_category
  ELSE 'other'::matter_category
END;
ALTER TABLE matters DROP COLUMN IF EXISTS category;
ALTER TABLE matters RENAME COLUMN new_category TO category;
-- Fix: re-add not null
ALTER TABLE matters ALTER COLUMN category SET NOT NULL;
ALTER TABLE matters ALTER COLUMN category SET DEFAULT 'other';

-- ── Step 6: Migrate priority ──────────────────────────────────────
ALTER TABLE matters ADD COLUMN IF NOT EXISTS new_priority matter_priority;
UPDATE matters SET new_priority = priority::text::matter_priority;
ALTER TABLE matters DROP COLUMN IF EXISTS priority;
ALTER TABLE matters RENAME COLUMN new_priority TO priority;
ALTER TABLE matters ALTER COLUMN priority SET NOT NULL;
ALTER TABLE matters ALTER COLUMN priority SET DEFAULT 'medium';

-- ── Step 7: Fix assignment_status if old enum exists ─────────────
-- matter_assignments was case_assignments — check status column
DO $$
BEGIN
  -- If old assignment_status enum exists with different values, migrate
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    -- Column already exists with correct name from Step 1
    NULL;
  END IF;
END $$;

-- ── Step 8: Add metadata to profiles if missing ──────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- ── Step 9: Create new tables ────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matter_id         UUID        REFERENCES matters(id),
  step              TEXT        NOT NULL DEFAULT 'describe',
  raw_description   TEXT,
  extracted_facts   JSONB       NOT NULL DEFAULT '{}',
  assessment_result JSONB,
  provider_used     TEXT,
  is_committed      BOOLEAN     NOT NULL DEFAULT false,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facts (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID             NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  key          TEXT             NOT NULL,
  value        TEXT             NOT NULL,
  value_type   fact_value_type  NOT NULL DEFAULT 'string',
  source       fact_source      NOT NULL DEFAULT 'ai',
  confidence   NUMERIC(3,2)     NOT NULL DEFAULT 1.0,
  is_verified  BOOLEAN          NOT NULL DEFAULT false,
  label        TEXT,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (matter_id, key)
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID        REFERENCES matters(id) ON DELETE RESTRICT,
  actor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 10: Add missing indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matters_user_id       ON matters(user_id);
CREATE INDEX IF NOT EXISTS idx_matters_lawyer_id     ON matters(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_matters_status        ON matters(status);
CREATE INDEX IF NOT EXISTS idx_facts_matter_id       ON facts(matter_id);
CREATE INDEX IF NOT EXISTS idx_facts_matter_key      ON facts(matter_id, key);
CREATE INDEX IF NOT EXISTS idx_events_matter_id      ON events(matter_id);
CREATE INDEX IF NOT EXISTS idx_events_type           ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_user  ON intake_sessions(user_id);

-- ── Step 11: Add triggers for new tables ─────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_facts_updated_at
    BEFORE UPDATE ON facts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_intake_sessions_updated_at
    BEFORE UPDATE ON intake_sessions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 12: RLS for new tables ───────────────────────────────────
ALTER TABLE intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events           ENABLE ROW LEVEL SECURITY;

-- Drop old CRM policy names if they exist
DROP POLICY IF EXISTS "cases: read participant or admin" ON public.matters;
DROP POLICY IF EXISTS "cases: insert by user role" ON public.matters;
DROP POLICY IF EXISTS "cases: update participant or admin" ON public.matters;
DROP POLICY IF EXISTS "assignments: read participant or admin" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments: insert admin or user" ON public.matter_assignments;
DROP POLICY IF EXISTS "assignments: update lawyer or admin" ON public.matter_assignments;
DROP POLICY IF EXISTS "updates: read participant, internal gated" ON public.matter_updates;
DROP POLICY IF EXISTS "updates: insert participant" ON public.matter_updates;
DROP POLICY IF EXISTS "documents: read case participant or admin" ON public.documents;
DROP POLICY IF EXISTS "documents: insert case participant" ON public.documents;
DROP POLICY IF EXISTS "requests: read own or admin" ON public.lawyer_requests;
DROP POLICY IF EXISTS "requests: insert by user" ON public.lawyer_requests;
DROP POLICY IF EXISTS "requests: update lawyer (accept/decline) or admin" ON public.lawyer_requests;

-- Drop new platform policy names if they exist (idempotency)
DROP POLICY IF EXISTS "intake:own_only" ON public.intake_sessions;
DROP POLICY IF EXISTS "facts:read_participant" ON public.facts;
DROP POLICY IF EXISTS "facts:insert_participant" ON public.facts;
DROP POLICY IF EXISTS "facts:update_lawyer_admin" ON public.facts;
DROP POLICY IF EXISTS "events:read_participant" ON public.events;
DROP POLICY IF EXISTS "events:no_client_insert" ON public.events;
DROP POLICY IF EXISTS "matters:read_participant" ON public.matters;
DROP POLICY IF EXISTS "matters:insert_by_user" ON public.matters;
DROP POLICY IF EXISTS "matters:update_participant" ON public.matters;
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

-- Recreate policies (idempotent with 002_rls.sql)
-- intake_sessions
CREATE POLICY "intake:own_only" ON intake_sessions FOR ALL TO authenticated USING (user_id = auth.uid());

-- facts
CREATE POLICY "facts:read_participant" ON facts FOR SELECT TO authenticated
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()) OR auth_role() = 'admin');
CREATE POLICY "facts:insert_participant" ON facts FOR INSERT TO authenticated
  WITH CHECK (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()));
CREATE POLICY "facts:update_lawyer_admin" ON facts FOR UPDATE TO authenticated
  USING (auth_role() IN ('lawyer','admin') OR matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid()));

-- events (insert only from service role)
CREATE POLICY "events:read_participant" ON events FOR SELECT TO authenticated
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()) OR auth_role() = 'admin');
CREATE POLICY "events:no_client_insert" ON events FOR INSERT TO authenticated WITH CHECK (false);

-- matters
CREATE POLICY "matters:read_participant" ON matters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');
CREATE POLICY "matters:insert_by_user" ON matters FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_role() = 'user');
CREATE POLICY "matters:update_participant" ON matters FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');

-- matter_updates
CREATE POLICY "updates:read_participant_gated" ON matter_updates FOR SELECT TO authenticated
  USING ((matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid())
    AND (is_internal = false OR auth_role() IN ('lawyer','admin'))) OR auth_role() = 'admin');
CREATE POLICY "updates:insert_participant" ON matter_updates FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND matter_id IN (
    SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()));

-- matter_assignments
CREATE POLICY "assignments:read" ON matter_assignments FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid() OR assigned_by = auth.uid() OR auth_role() = 'admin');
CREATE POLICY "assignments:insert" ON matter_assignments FOR INSERT TO authenticated
  WITH CHECK (auth_role() IN ('admin','user'));
CREATE POLICY "assignments:update_lawyer_admin" ON matter_assignments FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin');

-- documents
CREATE POLICY "docs:read_participant" ON documents FOR SELECT TO authenticated
  USING (matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()) OR auth_role() = 'admin');
CREATE POLICY "docs:insert_participant" ON documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND matter_id IN (SELECT id FROM matters WHERE user_id = auth.uid() OR lawyer_id = auth.uid()));

-- lawyer_requests
CREATE POLICY "requests:read_own" ON lawyer_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lawyer_id = auth.uid() OR auth_role() = 'admin');
CREATE POLICY "requests:insert_user" ON lawyer_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND auth_role() = 'user');
CREATE POLICY "requests:update_lawyer_admin" ON lawyer_requests FOR UPDATE TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin');

-- ── Done ──────────────────────────────────────────────────────────
-- Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
