BEGIN;

-- ================================================================
-- LEAD PLATFORM — Migration 037: Docket Tables
-- Time entries, invoices, disbursements, tasks, timeline events,
-- internal notes, fee arrangements, document visibility.
-- ================================================================

-- ── 1. time_entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id     UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  lawyer_id     UUID        NOT NULL REFERENCES public.profiles(id),
  activity      TEXT        NOT NULL,
  hours         NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  rate_per_hour NUMERIC(10,2),
  amount_inr    NUMERIC(12,2) GENERATED ALWAYS AS (hours * COALESCE(rate_per_hour, 0)) STORED,
  entry_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT        NOT NULL DEFAULT 'unbilled' CHECK (status IN ('unbilled','billed','written_off')),
  invoice_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. invoices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id      UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  invoice_number TEXT        NOT NULL,
  period_start   DATE,
  period_end     DATE,
  subtotal_inr   NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percent    NUMERIC(4,2) NOT NULL DEFAULT 18.00,
  gst_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_inr      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  due_date       DATE,
  paid_at        TIMESTAMPTZ,
  work_summary   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. disbursements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disbursements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  invoice_id  UUID        REFERENCES public.invoices(id) ON DELETE SET NULL,
  description TEXT        NOT NULL,
  amount_inr  NUMERIC(12,2) NOT NULL CHECK (amount_inr >= 0),
  incurred_on DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. case_tasks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  assigned_to  UUID        REFERENCES public.profiles(id),
  title        TEXT        NOT NULL,
  description  TEXT,
  due_date     DATE,
  is_completed BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. timeline_events ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id           UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL,
  lawyer_description  TEXT        NOT NULL,
  client_description  TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB       DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. internal_notes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id  UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.profiles(id),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. fee_arrangements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_arrangements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id       UUID        NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE UNIQUE,
  type            TEXT        NOT NULL CHECK (type IN ('hourly','fixed','retainer','contingency')),
  rate_per_hour   NUMERIC(10,2),
  fixed_amount    NUMERIC(12,2),
  retainer_amount NUMERIC(12,2),
  retainer_used   NUMERIC(12,2) DEFAULT 0,
  description     TEXT,
  engagement_doc_path TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. Add FK: time_entries.invoice_id → invoices ───────────────
DO $$ BEGIN
  ALTER TABLE public.time_entries
    ADD CONSTRAINT fk_time_entries_invoice
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 9. Add visibility column to documents ───────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'client_visible';

DO $$ BEGIN
  ALTER TABLE public.documents
    ADD CONSTRAINT chk_documents_visibility
    CHECK (visibility IN ('lawyer_only','client_visible','court_filed'));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 10. Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_matter     ON public.time_entries(matter_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status     ON public.time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_lawyer     ON public.time_entries(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_matter         ON public.invoices(matter_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status         ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_disbursements_matter    ON public.disbursements(matter_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_matter       ON public.case_tasks(matter_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_assigned     ON public.case_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_timeline_events_matter  ON public.timeline_events(matter_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_date    ON public.timeline_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_internal_notes_matter   ON public.internal_notes(matter_id);
CREATE INDEX IF NOT EXISTS idx_fee_arrangements_matter ON public.fee_arrangements(matter_id);

-- ── 11. Triggers: updated_at ────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_case_tasks_updated_at BEFORE UPDATE ON public.case_tasks FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_internal_notes_updated_at BEFORE UPDATE ON public.internal_notes FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_fee_arrangements_updated_at BEFORE UPDATE ON public.fee_arrangements FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 12. RLS: Enable ─────────────────────────────────────────────
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_arrangements ENABLE ROW LEVEL SECURITY;

-- ── 13. RLS Policies: time_entries (lawyer/admin only) ──────────
DROP POLICY IF EXISTS "time_entries:read_lawyer_admin" ON public.time_entries;
CREATE POLICY "time_entries:read_lawyer_admin" ON public.time_entries FOR SELECT TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin');

DROP POLICY IF EXISTS "time_entries:write_lawyer" ON public.time_entries;
CREATE POLICY "time_entries:write_lawyer" ON public.time_entries FOR ALL TO authenticated
  USING (lawyer_id = auth.uid() OR auth_role() = 'admin')
  WITH CHECK (lawyer_id = auth.uid() OR auth_role() = 'admin');

-- ── 14. RLS Policies: invoices (participant read, lawyer write) ─
DROP POLICY IF EXISTS "invoices:read_participant" ON public.invoices;
CREATE POLICY "invoices:read_participant" ON public.invoices FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "invoices:write_lawyer_admin" ON public.invoices;
CREATE POLICY "invoices:write_lawyer_admin" ON public.invoices FOR ALL TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ── 15. RLS Policies: disbursements ─────────────────────────────
DROP POLICY IF EXISTS "disbursements:read_participant" ON public.disbursements;
CREATE POLICY "disbursements:read_participant" ON public.disbursements FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "disbursements:write_lawyer_admin" ON public.disbursements;
CREATE POLICY "disbursements:write_lawyer_admin" ON public.disbursements FOR ALL TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ── 16. RLS Policies: case_tasks ────────────────────────────────
DROP POLICY IF EXISTS "case_tasks:read_participant" ON public.case_tasks;
CREATE POLICY "case_tasks:read_participant" ON public.case_tasks FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "case_tasks:write_lawyer_admin" ON public.case_tasks;
CREATE POLICY "case_tasks:write_lawyer_admin" ON public.case_tasks FOR INSERT TO authenticated
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "case_tasks:delete_lawyer_admin" ON public.case_tasks;
CREATE POLICY "case_tasks:delete_lawyer_admin" ON public.case_tasks FOR DELETE TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "case_tasks:update_participant" ON public.case_tasks;
CREATE POLICY "case_tasks:update_participant" ON public.case_tasks FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ── 17. RLS Policies: timeline_events ───────────────────────────
-- Lawyers/admin see all events on their matters
DROP POLICY IF EXISTS "timeline_events:read_lawyer_admin" ON public.timeline_events;
CREATE POLICY "timeline_events:read_lawyer_admin" ON public.timeline_events FOR SELECT TO authenticated
  USING (
    (matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid()) OR auth_role() = 'admin')
  );

-- Clients see only events with non-null client_description
DROP POLICY IF EXISTS "timeline_events:read_client" ON public.timeline_events;
CREATE POLICY "timeline_events:read_client" ON public.timeline_events FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND client_description IS NOT NULL
  );

DROP POLICY IF EXISTS "timeline_events:write_lawyer_admin" ON public.timeline_events;
CREATE POLICY "timeline_events:write_lawyer_admin" ON public.timeline_events FOR ALL TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ── 18. RLS Policies: internal_notes (lawyer/admin ONLY) ────────
-- NO client policy. Client cannot SELECT at all.
DROP POLICY IF EXISTS "internal_notes:read_lawyer_admin" ON public.internal_notes;
CREATE POLICY "internal_notes:read_lawyer_admin" ON public.internal_notes FOR SELECT TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "internal_notes:write_lawyer" ON public.internal_notes;
CREATE POLICY "internal_notes:write_lawyer" ON public.internal_notes FOR ALL TO authenticated
  USING (author_id = auth.uid() OR auth_role() = 'admin')
  WITH CHECK (author_id = auth.uid() OR auth_role() = 'admin');

-- ── 19. RLS Policies: fee_arrangements ──────────────────────────
DROP POLICY IF EXISTS "fee_arrangements:read_participant" ON public.fee_arrangements;
CREATE POLICY "fee_arrangements:read_participant" ON public.fee_arrangements FOR SELECT TO authenticated
  USING (
    matter_id IN (
      SELECT id FROM public.matters
      WHERE (user_id = auth.uid() OR lawyer_id = auth.uid()) AND deleted_at IS NULL
    ) OR auth_role() = 'admin'
  );

DROP POLICY IF EXISTS "fee_arrangements:write_lawyer_admin" ON public.fee_arrangements;
CREATE POLICY "fee_arrangements:write_lawyer_admin" ON public.fee_arrangements FOR ALL TO authenticated
  USING (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  )
  WITH CHECK (
    matter_id IN (SELECT id FROM public.matters WHERE lawyer_id = auth.uid())
    OR auth_role() = 'admin'
  );

COMMIT;
