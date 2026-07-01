BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 030: Practice Scenarios & Sessions
-- ================================================================

CREATE TYPE practice_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE practice_session_status AS ENUM ('active', 'completed', 'abandoned');

-- ── 1. practice_scenarios ───────────────────────────────────────
CREATE TABLE practice_scenarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key        TEXT UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  domain              TEXT NOT NULL,
  difficulty          practice_difficulty NOT NULL,
  based_on            TEXT,
  estimated_minutes   INT NOT NULL DEFAULT 5,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  version             INT NOT NULL DEFAULT 1,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. practice_sessions ────────────────────────────────────────
CREATE TABLE practice_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario_id         UUID NOT NULL REFERENCES practice_scenarios(id) ON DELETE CASCADE,
  current_node        TEXT NOT NULL,
  status              practice_session_status NOT NULL DEFAULT 'active',
  generated_facts     JSONB NOT NULL DEFAULT '{}',
  score               INT NOT NULL DEFAULT 0,
  max_score           INT NOT NULL DEFAULT 0,
  decisions_count     INT NOT NULL DEFAULT 0,
  correct_count       INT NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. practice_decisions ───────────────────────────────────────
CREATE TABLE practice_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  node_id             TEXT NOT NULL,
  choice_id           TEXT NOT NULL,
  is_correct          BOOLEAN NOT NULL,
  score_awarded       INT NOT NULL,
  issue_tag           TEXT,
  input_value         JSONB,
  time_taken_ms       INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. practice_profiles ────────────────────────────────────────
CREATE TABLE practice_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issue_tag           TEXT NOT NULL,
  domain              TEXT NOT NULL,
  attempts            INT NOT NULL DEFAULT 0,
  correct             INT NOT NULL DEFAULT 0,
  streak              INT NOT NULL DEFAULT 0,
  last_attempted      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_tag)
);

-- ── updated_at triggers ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_practice_scenarios_updated_at
    BEFORE UPDATE ON practice_scenarios
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_practice_sessions_updated_at
    BEFORE UPDATE ON practice_sessions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_practice_profiles_updated_at
    BEFORE UPDATE ON practice_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Row Level Security ──────────────────────────────────────────
ALTER TABLE practice_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_profiles ENABLE ROW LEVEL SECURITY;

-- ── Policies: practice_scenarios ───────────────────────────────
CREATE POLICY "practice_scenarios:select_all"
  ON practice_scenarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "practice_scenarios:admin_all"
  ON practice_scenarios FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- ── Policies: practice_sessions ────────────────────────────────
CREATE POLICY "practice_sessions:select_own"
  ON practice_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "practice_sessions:insert_own"
  ON practice_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "practice_sessions:update_own"
  ON practice_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "practice_sessions:admin_all"
  ON practice_sessions FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- ── Policies: practice_decisions ───────────────────────────────
CREATE POLICY "practice_decisions:select_own"
  ON practice_decisions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions s
     WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "practice_decisions:insert_own"
  ON practice_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM practice_sessions s
     WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "practice_decisions:admin_all"
  ON practice_decisions FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- ── Policies: practice_profiles ────────────────────────────────
CREATE POLICY "practice_profiles:select_own"
  ON practice_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "practice_profiles:insert_own"
  ON practice_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "practice_profiles:update_own"
  ON practice_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "practice_profiles:admin_all"
  ON practice_profiles FOR ALL TO authenticated
  USING (auth_role() = 'admin');

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_status ON practice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_domain ON practice_scenarios(domain);
CREATE INDEX IF NOT EXISTS idx_practice_profiles_user_id ON practice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_profiles_issue_tag ON practice_profiles(issue_tag);
CREATE INDEX IF NOT EXISTS idx_practice_decisions_session_id ON practice_decisions(session_id);

COMMIT;
