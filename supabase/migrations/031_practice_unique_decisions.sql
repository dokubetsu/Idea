-- Create unique index to prevent duplicate submissions on the same node
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_decisions_unique_node 
ON practice_decisions (session_id, node_id);

-- Drop existing function if any to support parameter type changes
DROP FUNCTION IF EXISTS submit_practice_decision(
  UUID, UUID, TEXT, TEXT, BOOLEAN, INT, TEXT, TEXT, INT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);
DROP FUNCTION IF EXISTS submit_practice_decision(
  UUID, UUID, TEXT, TEXT, BOOLEAN, INT, TEXT, JSONB, INT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);

-- Create atomic RPC function to wrap decision insertion, session update, and profile upsert
CREATE OR REPLACE FUNCTION submit_practice_decision(
  p_session_id UUID,
  p_user_id UUID,
  p_node_id TEXT,
  p_choice_id TEXT,
  p_is_correct BOOLEAN,
  p_score_awarded INT,
  p_issue_tag TEXT,
  p_input_value JSONB,
  p_time_taken_ms INT,
  p_new_node TEXT,
  p_new_status TEXT,
  p_completed_at TIMESTAMPTZ,
  p_domain TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Insert decision log
  INSERT INTO practice_decisions (
    session_id, node_id, choice_id, is_correct, score_awarded, issue_tag, input_value, time_taken_ms
  ) VALUES (
    p_session_id, p_node_id, COALESCE(p_choice_id, ''), p_is_correct, p_score_awarded, p_issue_tag, p_input_value, p_time_taken_ms
  );

  -- 2. Update session
  UPDATE practice_sessions
  SET
    current_node = p_new_node,
    status = p_new_status::practice_session_status,
    score = GREATEST(0, score + p_score_awarded),
    decisions_count = decisions_count + 1,
    correct_count = correct_count + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    completed_at = p_completed_at,
    updated_at = NOW()
  WHERE id = p_session_id;

  -- 3. Upsert profile if issue_tag is present
  IF p_issue_tag IS NOT NULL AND p_issue_tag <> '' THEN
    INSERT INTO practice_profiles (
      user_id, issue_tag, domain, attempts, correct, streak, last_attempted, updated_at
    ) VALUES (
      p_user_id, p_issue_tag, p_domain, 1, CASE WHEN p_is_correct THEN 1 ELSE 0 END, CASE WHEN p_is_correct THEN 1 ELSE 0 END, NOW(), NOW()
    )
    ON CONFLICT (user_id, issue_tag) DO UPDATE SET
      attempts = practice_profiles.attempts + 1,
      correct = practice_profiles.correct + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
      streak = CASE WHEN p_is_correct THEN practice_profiles.streak + 1 ELSE 0 END,
      last_attempted = NOW(),
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;
