-- Migration 016: Session counter atomicity + consultation uniqueness constraint
-- ──────────────────────────────────────────────────────────────────────────────
-- Fixes two issues identified in code review:
--
-- 1. ATOMIC SESSION INCREMENT RPC
--    The application layer previously did a read-then-write to increment
--    sessions_used, creating a race condition where two concurrent meeting
--    completions could both read the same value and lose one increment.
--    This RPC uses a single atomic UPDATE ... RETURNING to eliminate the race.
--
-- 2. UNIQUE CONSTRAINT ON consultations.matter_id
--    The codebase assumes "one consultation per matter" (meetings join consultations
--    via matter_id). This constraint makes that assumption explicit and enforced
--    at the database level rather than relying on application code.
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Atomic session increment RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_sessions_used(p_matter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sessions_used integer;
    v_sessions_total integer;
BEGIN
    -- Atomically increment sessions_used for the consultation linked to this matter.
    -- Uses a single UPDATE statement so concurrent calls cannot both read the
    -- same stale value and both write +1 (losing one increment).
    UPDATE consultations
    SET    sessions_used = sessions_used + 1,
           updated_at    = now()
    WHERE  matter_id = p_matter_id
    RETURNING sessions_used, sessions_total
    INTO v_sessions_used, v_sessions_total;

    -- Log when the cap is reached (informational only — booking gate is in the router)
    IF v_sessions_used IS NOT NULL AND v_sessions_used >= v_sessions_total THEN
        RAISE NOTICE 'Consultation for matter % has reached its session limit (% / %)',
            p_matter_id, v_sessions_used, v_sessions_total;
    END IF;
END;
$$;


-- ── 2. Unique constraint: one consultation per matter ────────────────────────
-- Add only if it doesn't already exist (idempotent).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'consultations_matter_id_unique'
    ) THEN
        ALTER TABLE consultations
            ADD CONSTRAINT consultations_matter_id_unique UNIQUE (matter_id);
    END IF;
END;
$$;
