BEGIN;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS trg_practice_scenarios_updated_at ON practice_scenarios;
DROP TRIGGER IF EXISTS trg_practice_sessions_updated_at ON practice_sessions;
DROP TRIGGER IF EXISTS trg_practice_profiles_updated_at ON practice_profiles;

-- Drop tables
DROP TABLE IF EXISTS practice_decisions CASCADE;
DROP TABLE IF EXISTS practice_profiles CASCADE;
DROP TABLE IF EXISTS practice_sessions CASCADE;
DROP TABLE IF EXISTS practice_scenarios CASCADE;

-- Drop enums
DROP TYPE IF EXISTS practice_session_status CASCADE;
DROP TYPE IF EXISTS practice_difficulty CASCADE;

COMMIT;
