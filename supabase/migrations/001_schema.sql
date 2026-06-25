-- ================================================================
--  LEAD PLATFORM — Production Schema v1
--  Run in order in Supabase SQL Editor
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Enums ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user','lawyer','admin');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matter_status AS ENUM ('draft','intake','assessment','matching','active','resolved','archived');
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
  CREATE TYPE assignment_status AS ENUM ('pending','accepted','rejected','withdrawn');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fact_source AS ENUM ('user','ai','lawyer','system');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fact_value_type AS ENUM ('string','number','date','boolean','json');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role    NOT NULL DEFAULT 'user',
  full_name    TEXT         NOT NULL,
  phone        TEXT,
  city         TEXT,
  state        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  metadata     JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── lawyer_profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bar_council_id    TEXT UNIQUE,
  enrollment_state  TEXT,
  specializations   TEXT[]       NOT NULL DEFAULT '{}',
  court_types       TEXT[]       NOT NULL DEFAULT '{}',
  languages         TEXT[]       NOT NULL DEFAULT '{"Hindi","English"}',
  experience_years  INTEGER      NOT NULL DEFAULT 0,
  bio               TEXT,
  consultation_fee  NUMERIC(10,2),
  is_verified       BOOLEAN      NOT NULL DEFAULT false,
  is_available      BOOLEAN      NOT NULL DEFAULT true,
  rating            NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating >= 0.00 AND rating <= 5.00),
  total_matters     INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── intake_sessions ───────────────────────────────────────────────
-- Ephemeral pre-matter state. Committed = turned into a matter.
CREATE TABLE IF NOT EXISTS intake_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matter_id         UUID,       -- null until committed
  step              TEXT        NOT NULL DEFAULT 'describe',
  -- describe | facts_review | assessment | confirm
  raw_description   TEXT,
  extracted_facts   JSONB       NOT NULL DEFAULT '{}',
  assessment_result JSONB,
  provider_used     TEXT,
  is_committed      BOOLEAN     NOT NULL DEFAULT false,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── matters ──────────────────────────────────────────────────────
-- Legal matter — the core entity. Started from intake.
CREATE TABLE IF NOT EXISTS matters (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lawyer_id        UUID                    REFERENCES profiles(id) ON DELETE SET NULL,
  intake_session_id UUID                   UNIQUE REFERENCES intake_sessions(id),
  title            TEXT           NOT NULL,
  summary          TEXT           NOT NULL,  -- AI-generated from facts, not raw description
  category         matter_category NOT NULL DEFAULT 'other',
  status           matter_status  NOT NULL DEFAULT 'intake',
  priority         matter_priority NOT NULL DEFAULT 'medium',
  court_name       TEXT,
  case_number      TEXT,
  next_hearing_at  DATE,
  assigned_at      TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── facts ────────────────────────────────────────────────────────
-- Structured, durable facts per matter.
-- AI can change. Facts remain.
CREATE TABLE IF NOT EXISTS facts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID         NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  key          TEXT         NOT NULL,   -- e.g. "cheque_amount", "opponent_name"
  value        TEXT         NOT NULL,
  value_type   fact_value_type NOT NULL DEFAULT 'string',
  source       fact_source  NOT NULL DEFAULT 'ai',
  confidence   NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.00 AND confidence <= 1.00),  -- 0.00–1.00
  is_verified  BOOLEAN      NOT NULL DEFAULT false, -- lawyer/user confirmed
  label        TEXT,                               -- human-readable label
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (matter_id, key)
);

-- ── events ───────────────────────────────────────────────────────
-- Immutable audit log. Drives analytics + notifications.
-- NEVER delete from this table.
CREATE TABLE IF NOT EXISTS events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID        REFERENCES matters(id) ON DELETE RESTRICT,
  actor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,   -- e.g. "matter.created", "fact.verified"
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── matter_assignments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matter_assignments (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID              NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  lawyer_id    UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by  UUID              NOT NULL REFERENCES profiles(id),
  status       assignment_status NOT NULL DEFAULT 'pending',
  notes        TEXT,
  assigned_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- ── matter_updates ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matter_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID        NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id),
  content     TEXT        NOT NULL,
  is_internal BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── documents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id      UUID        NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  uploaded_by    UUID        NOT NULL REFERENCES profiles(id),
  name           TEXT        NOT NULL,
  storage_path   TEXT        NOT NULL,
  file_type      TEXT,
  file_size      INTEGER,
  classification TEXT,         -- e.g. "cheque", "contract", "court_notice"
  metadata       JSONB        NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── lawyer_requests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id),
  lawyer_id   UUID        NOT NULL REFERENCES profiles(id),
  matter_id   UUID                 REFERENCES matters(id),
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lawyer_id, matter_id)
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matters_user_id        ON matters(user_id);
CREATE INDEX IF NOT EXISTS idx_matters_lawyer_id      ON matters(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_matters_status         ON matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_category       ON matters(category);
CREATE INDEX IF NOT EXISTS idx_facts_matter_id        ON facts(matter_id);
CREATE INDEX IF NOT EXISTS idx_facts_key              ON facts(key);
CREATE INDEX IF NOT EXISTS idx_facts_source           ON facts(source);
CREATE INDEX IF NOT EXISTS idx_events_matter_id       ON events(matter_id);
CREATE INDEX IF NOT EXISTS idx_events_type            ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at      ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_user   ON intake_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_updates_matter  ON matter_updates(matter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_matter     ON matter_assignments(matter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lawyer     ON matter_assignments(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_lp_specializations     ON lawyer_profiles USING GIN(specializations);
CREATE INDEX IF NOT EXISTS idx_profiles_city_trgm     ON profiles USING GIN(city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_payload         ON events USING GIN(payload);
CREATE INDEX IF NOT EXISTS idx_facts_matter_key       ON facts(matter_id, key);

-- ── Triggers: updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_lawyer_profiles_updated_at BEFORE UPDATE ON lawyer_profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_matters_updated_at BEFORE UPDATE ON matters FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_facts_updated_at BEFORE UPDATE ON facts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_intake_sessions_updated_at BEFORE UPDATE ON intake_sessions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
