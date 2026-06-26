-- ================================================================
--  LEAD PLATFORM — Migration v6 (Hearings, Milestones, Threading)
-- ================================================================

-- 1. Modify matters table to allow direct invites and nullable user_id
ALTER TABLE public.matters ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- 2. Add parent_id to matter_updates for threaded comment replies
ALTER TABLE public.matter_updates ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.matter_updates(id) ON DELETE CASCADE;

-- 3. Create hearings table
CREATE TABLE IF NOT EXISTS public.hearings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  hearing_date TIMESTAMPTZ NOT NULL,
  courtroom    TEXT,
  judge        TEXT,
  purpose      TEXT,
  notes        TEXT,
  status       TEXT        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'adjourned', 'completed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create milestones table
CREATE TABLE IF NOT EXISTS public.matter_milestones (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  order_index  INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_matter_milestone_order UNIQUE (matter_id, order_index) DEFERRABLE INITIALLY DEFERRED
);

-- 5. Set up updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER trg_hearings_updated_at BEFORE UPDATE ON public.hearings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_matter_milestones_updated_at BEFORE UPDATE ON public.matter_milestones FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Enable RLS
ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_milestones ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing conflicting policies if any
DROP POLICY IF EXISTS "hearings:read_participant" ON public.hearings;
DROP POLICY IF EXISTS "hearings:write_lawyer_admin" ON public.hearings;
DROP POLICY IF EXISTS "milestones:read_participant" ON public.matter_milestones;
DROP POLICY IF EXISTS "milestones:write_lawyer_admin" ON public.matter_milestones;
DROP POLICY IF EXISTS "matters:insert_by_lawyer" ON public.matters;

-- 8. Create policies for hearings
CREATE POLICY "hearings:read_participant" ON public.hearings FOR SELECT TO authenticated USING (
  matter_id IN (
    SELECT id FROM public.matters
    WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin'
);

CREATE POLICY "hearings:write_lawyer_admin" ON public.hearings FOR ALL TO authenticated USING (
  auth_role() = 'admin' OR matter_id IN (
    SELECT id FROM public.matters WHERE lawyer_id = auth.uid()
  )
);

-- 9. Create policies for milestones
CREATE POLICY "milestones:read_participant" ON public.matter_milestones FOR SELECT TO authenticated USING (
  matter_id IN (
    SELECT id FROM public.matters
    WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin'
);

CREATE POLICY "milestones:write_lawyer_admin" ON public.matter_milestones FOR ALL TO authenticated USING (
  auth_role() = 'admin' OR matter_id IN (
    SELECT id FROM public.matters WHERE lawyer_id = auth.uid()
  )
);

-- 10. Allow lawyers to insert matters directly
CREATE POLICY "matters:insert_by_lawyer" ON public.matters FOR INSERT TO authenticated WITH CHECK (
  auth_role() = 'lawyer' AND lawyer_id = auth.uid()
);

-- 11. Recreate all other matter-related SELECT policies to support client_email fallback & soft delete checks
DROP POLICY IF EXISTS "matters:read_participant" ON public.matters;
CREATE POLICY "matters:read_participant" ON public.matters FOR SELECT TO authenticated
  USING ((user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid() OR auth_role() = 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "docs:read_participant" ON public.documents;
CREATE POLICY "docs:read_participant" ON public.documents FOR SELECT TO authenticated
  USING ((matter_id IN (SELECT id FROM public.matters WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL) OR auth_role() = 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "facts:read_participant" ON public.facts;
CREATE POLICY "facts:read_participant" ON public.facts FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM public.matters
    WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin');

DROP POLICY IF EXISTS "events:read_participant" ON public.events;
CREATE POLICY "events:read_participant" ON public.events FOR SELECT TO authenticated
  USING (matter_id IN (
    SELECT id FROM public.matters
    WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL
  ) OR auth_role() = 'admin');

DROP POLICY IF EXISTS "updates:read_participant_gated" ON public.matter_updates;
CREATE POLICY "updates:read_participant_gated" ON public.matter_updates FOR SELECT TO authenticated
  USING (
    (matter_id IN (SELECT id FROM public.matters WHERE (user_id = auth.uid() OR client_email = auth.jwt() ->> 'email' OR lawyer_id = auth.uid()) AND deleted_at IS NULL)
     AND (is_internal = false OR auth_role() IN ('lawyer','admin')))
    OR auth_role() = 'admin'
  );

-- 11. Create indexes
CREATE INDEX IF NOT EXISTS idx_hearings_matter_id ON public.hearings(matter_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON public.hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_milestones_matter_id ON public.matter_milestones(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_updates_parent_id ON public.matter_updates(parent_id);
