-- Migration 052: Placeholder (intentional sequence gap)
--
-- No schema changes. This file exists so the migration series is continuous
-- from 051 → 052 → 053 and tooling/audits do not report a missing file.
-- Hardening work continues in 053+.

BEGIN;

INSERT INTO schema_migrations (version)
VALUES ('052_placeholder')
ON CONFLICT (version) DO NOTHING;

COMMIT;
