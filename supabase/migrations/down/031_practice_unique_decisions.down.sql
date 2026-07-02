DROP FUNCTION IF EXISTS submit_practice_decision(
  UUID, UUID, TEXT, TEXT, BOOLEAN, INT, TEXT, TEXT, INT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);

DROP INDEX IF EXISTS idx_practice_decisions_unique_node;
