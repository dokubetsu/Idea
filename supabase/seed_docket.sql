-- ================================================================
-- LEAD PLATFORM — Docket Demo Seed Data
-- Realistic Indian legal scenarios for testing dashboards.
-- Run AFTER the base seed.sql and migration 037.
-- ================================================================

-- ── Demo Users ──────────────────────────────────────────────────

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
VALUES
(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'adv.mehta@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"lawyer"}',
    '{"full_name":"Adv. A. Mehta"}',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '10000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'priya.patel@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"user"}',
    '{"full_name":"Priya Patel"}',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'rahul.sharma@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"user"}',
    '{"full_name":"Rahul Sharma"}',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '10000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'sunita.desai@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"user"}',
    '{"full_name":"Sunita Desai"}',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '10000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000000',
    'vikram.joshi@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"user"}',
    '{"full_name":"Vikram Joshi"}',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '10000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000000',
    'anita.gupta@lead.ai',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    'authenticated',
    '{"provider":"email","providers":["email"],"role":"user"}',
    '{"full_name":"Anita Gupta"}',
    'authenticated',
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- Profiles
INSERT INTO public.profiles (id, role, full_name, phone, city, state, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'lawyer', 'Adv. A. Mehta', '9820012345', 'Mumbai', 'Maharashtra', true),
  ('10000000-0000-0000-0000-000000000010', 'user', 'Priya Patel', '9876543210', 'Mumbai', 'Maharashtra', true),
  ('10000000-0000-0000-0000-000000000011', 'user', 'Rahul Sharma', '9812345678', 'Mumbai', 'Maharashtra', true),
  ('10000000-0000-0000-0000-000000000012', 'user', 'Sunita Desai', '9898765432', 'Pune', 'Maharashtra', true),
  ('10000000-0000-0000-0000-000000000013', 'user', 'Vikram Joshi', '9765432100', 'Mumbai', 'Maharashtra', true),
  ('10000000-0000-0000-0000-000000000014', 'user', 'Anita Gupta', '9654321098', 'Thane', 'Maharashtra', true)
ON CONFLICT (id) DO NOTHING;

-- Lawyer profile
INSERT INTO public.lawyer_profiles (id, bar_council_id, enrollment_state, specializations, court_types, languages, experience_years, bio, consultation_fee, is_verified, is_available, rating, total_matters)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'MAH/1247/2012', 'Maharashtra', '{"property","consumer","cheque_bounce","family","labour"}', '{"High Court","District Court","Consumer Forum"}', '{"English","Hindi","Marathi"}', 12, 'Senior litigation counsel with 12 years of practice before the Bombay High Court and subordinate courts. Specializes in property disputes, consumer complaints, and commercial litigation.', 3500.00, true, true, 4.85, 5)
ON CONFLICT (id) DO NOTHING;

-- ── Matters (5 cases) ───────────────────────────────────────────

INSERT INTO public.matters (id, user_id, lawyer_id, title, summary, category, status, priority, court_name, case_number, next_hearing_at, matter_health, created_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Property dispute — Bandra flat', 'Dispute over ownership of 2BHK flat at Bandra West, Mumbai. Defendant claims adverse possession since 2018. Plaintiff has rent receipts establishing ownership.', 'property', 'active', 'high', 'Bombay High Court', 'CS 432/2024', (CURRENT_DATE + INTERVAL '12 days')::date, 'in_progress', now() - INTERVAL '8 months'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Cheque bounce — ₹15,00,000', 'Dishonoured cheque under Section 138 NI Act. Cheque dated 15-Mar-2023 for ₹15,00,000 drawn on Axis Bank returned unpaid with reason "funds insufficient".', 'cheque_bounce', 'active', 'urgent', 'Metropolitan Magistrate Court, Andheri', 'CC 891/2023', (CURRENT_DATE + INTERVAL '6 days')::date, 'waiting_on_court', now() - INTERVAL '14 months'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Consumer complaint — Defective vehicle', 'New Hyundai Creta delivered with persistent engine knocking. Service centre failed to resolve after 4 attempts. Claiming replacement under Consumer Protection Act 2019.', 'consumer', 'active', 'medium', 'District Consumer Forum, Pune', 'CWP 2847/2024', (CURRENT_DATE + INTERVAL '21 days')::date, 'waiting_on_client', now() - INTERVAL '4 months'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Labour dispute — Wrongful termination', 'Terminated without notice from TechCorp India Pvt Ltd after 7 years of service. No termination letter issued. Claiming reinstatement with back wages under ID Act.', 'labour', 'active', 'medium', 'Industrial Tribunal, Mumbai', 'OS 156/2024', (CURRENT_DATE + INTERVAL '35 days')::date, 'in_progress', now() - INTERVAL '2 months'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Family matter — Maintenance petition', 'Wife seeking maintenance under Section 125 CrPC and Section 24 Hindu Marriage Act. Husband earning ₹2,40,000/month, wife is homemaker with 2 minor children.', 'family', 'active', 'high', 'Family Court, Thane', 'MA 423/2024', (CURRENT_DATE + INTERVAL '18 days')::date, 'waiting_on_lawyer', now() - INTERVAL '5 months')
ON CONFLICT (id) DO NOTHING;

-- ── Hearings ────────────────────────────────────────────────────

INSERT INTO public.hearings (id, matter_id, hearing_date, courtroom, judge, purpose, status)
VALUES
  -- Priya's case (property) - past + upcoming
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', (CURRENT_DATE - INTERVAL '45 days')::timestamptz, 'Court Room 12', 'Hon. Justice R.K. Deshpande', 'Framing of issues', 'completed'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', (CURRENT_DATE - INTERVAL '15 days')::timestamptz, 'Court Room 12', 'Hon. Justice R.K. Deshpande', 'Evidence of plaintiff', 'completed'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', (CURRENT_DATE + INTERVAL '12 days')::timestamptz, 'Court Room 12', 'Hon. Justice R.K. Deshpande', 'Cross-examination of PW-2', 'scheduled'),
  -- Rahul's case (cheque bounce) - URGENT
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', CURRENT_DATE::timestamptz + INTERVAL '10 hours', 'Court Room 3', 'Shri. M.P. Kulkarni, MM', 'Arguments on Section 145(2)', 'scheduled'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', (CURRENT_DATE + INTERVAL '6 days')::timestamptz, 'Court Room 3', 'Shri. M.P. Kulkarni, MM', 'Final arguments', 'scheduled'),
  -- Sunita's case
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', (CURRENT_DATE + INTERVAL '21 days')::timestamptz, 'Consumer Forum Hall', 'Smt. A. Joshi, President', 'Filing of written statement', 'scheduled'),
  -- Vikram's case
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', (CURRENT_DATE + INTERVAL '35 days')::timestamptz, 'Tribunal Room 2', 'Shri. V. Patil, PO', 'Preliminary hearing', 'scheduled'),
  -- Anita's case
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000005', (CURRENT_DATE + INTERVAL '18 days')::timestamptz, 'Family Court Room 1', 'Smt. K. Menon', 'Evidence of respondent', 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ── Fee Arrangements ────────────────────────────────────────────

INSERT INTO public.fee_arrangements (id, matter_id, type, rate_per_hour, retainer_amount, retainer_used, description)
VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'retainer', 3500, 200000, 128500, 'Retainer arrangement of ₹2,00,000 covering all professional fees. Court fees and disbursements billed separately. GST at 18% applicable on professional fees.'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'hourly', 3500, NULL, NULL, 'Hourly billing at ₹3,500 per hour. Invoiced monthly. Payment due within 15 days of invoice. GST at 18% applicable.'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'fixed', NULL, NULL, NULL, 'Fixed fee of ₹75,000 for complete representation before the Consumer Forum. Payable in 3 installments. GST at 18% applicable.'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'hourly', 3500, NULL, NULL, 'Hourly billing at ₹3,500 per hour. Monthly invoicing.'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'hourly', 3500, NULL, NULL, 'Hourly billing at ₹3,500 per hour for family court proceedings.')
ON CONFLICT (id) DO NOTHING;

-- ── Time Entries ────────────────────────────────────────────────

INSERT INTO public.time_entries (id, matter_id, lawyer_id, activity, hours, rate_per_hour, entry_date, status)
VALUES
  -- Priya's case
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Drafted written statement on behalf of plaintiff', 4.5, 3500, CURRENT_DATE - INTERVAL '30 days', 'unbilled'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Court appearance — evidence hearing', 3.0, 3500, CURRENT_DATE - INTERVAL '15 days', 'unbilled'),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Prepared list of documents for indexing', 2.0, 3500, CURRENT_DATE - INTERVAL '10 days', 'unbilled'),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Conference with client re: cross-examination strategy', 1.5, 3500, CURRENT_DATE - INTERVAL '5 days', 'unbilled'),
  -- Rahul's case
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Drafted reply to WS under Section 145(2)', 4.5, 3500, CURRENT_DATE - INTERVAL '8 days', 'unbilled'),
  ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Research on limitation period under NI Act', 2.0, 3500, CURRENT_DATE - INTERVAL '3 days', 'unbilled'),
  -- Sunita's case
  ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Drafted consumer complaint under CPA 2019', 5.0, 3500, CURRENT_DATE - INTERVAL '20 days', 'billed'),
  ('50000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Reviewed service centre correspondence', 1.5, 3500, CURRENT_DATE - INTERVAL '12 days', 'unbilled')
ON CONFLICT (id) DO NOTHING;

-- ── Invoices ────────────────────────────────────────────────────

INSERT INTO public.invoices (id, matter_id, invoice_number, period_start, period_end, subtotal_inr, gst_percent, gst_amount_inr, total_inr, status, due_date, paid_at, work_summary)
VALUES
  -- Priya's case — OVERDUE invoice
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'INV-2024-001', '2024-10-01', '2024-10-31', 42000, 18.00, 7560, 49560, 'overdue', (CURRENT_DATE - INTERVAL '20 days')::date, NULL, '12 hours · 2 hearings · document preparation'),
  -- Priya's case — Paid invoice
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'INV-2024-002', '2024-09-01', '2024-09-30', 35000, 18.00, 6300, 41300, 'paid', '2024-10-15', '2024-10-18T10:30:00Z', '10 hours · 1 hearing · case strategy consultation'),
  -- Sunita's case — Paid
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'INV-2024-003', '2024-11-01', '2024-11-30', 17500, 18.00, 3150, 20650, 'paid', '2024-12-10', '2024-12-12T14:00:00Z', '5 hours · complaint drafting')
ON CONFLICT (id) DO NOTHING;

-- ── Disbursements ───────────────────────────────────────────────

INSERT INTO public.disbursements (id, matter_id, description, amount_inr, incurred_on)
VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Court filing fees — suit filing', 1000, CURRENT_DATE - INTERVAL '8 months'),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Notarization of affidavit', 200, CURRENT_DATE - INTERVAL '45 days'),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Demand notice — registered post', 150, CURRENT_DATE - INTERVAL '14 months'),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'Consumer forum filing fees', 500, CURRENT_DATE - INTERVAL '4 months'),
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'Court fees — maintenance petition', 500, CURRENT_DATE - INTERVAL '5 months')
ON CONFLICT (id) DO NOTHING;

-- ── Case Tasks ──────────────────────────────────────────────────

INSERT INTO public.case_tasks (id, matter_id, assigned_to, title, due_date, is_completed, completed_at)
VALUES
  -- Priya's case — client tasks
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'Upload sale agreement (original scan)', (CURRENT_DATE + INTERVAL '3 days')::date, false, NULL),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'Sign affidavit of evidence', (CURRENT_DATE + INTERVAL '5 days')::date, false, NULL),
  -- Priya's case — lawyer tasks
  ('80000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Prepare brief for cross-examination', (CURRENT_DATE + INTERVAL '10 days')::date, false, NULL),
  ('80000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Index all exhibits', (CURRENT_DATE - INTERVAL '2 days')::date, false, NULL),
  -- Rahul's case
  ('80000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Draft final arguments brief', (CURRENT_DATE + INTERVAL '4 days')::date, false, NULL),
  ('80000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011', 'Provide bank statement showing bounced cheque', (CURRENT_DATE + INTERVAL '2 days')::date, false, NULL),
  -- Sunita's case
  ('80000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000012', 'Upload service centre visit receipts', (CURRENT_DATE + INTERVAL '7 days')::date, false, NULL),
  -- Completed tasks
  ('80000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'File written statement', NULL, true, now() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- ── Timeline Events ─────────────────────────────────────────────

INSERT INTO public.timeline_events (id, matter_id, event_type, lawyer_description, client_description, occurred_at)
VALUES
  -- Priya's case
  ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'document_filed', 'Filed written statement with 14 exhibits (8.5h)', 'Your lawyer filed all the necessary documents with the court.', now() - INTERVAL '30 days'),
  ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'hearing_completed', 'Evidence hearing completed. PW-1 examined. Cross-exam deferred.', 'Court hearing completed. Your lawyer presented evidence on your behalf.', now() - INTERVAL '15 days'),
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'hearing_scheduled', 'Next date for cross-examination of PW-2 fixed.', 'Next hearing date has been set by the court.', now() - INTERVAL '15 days'),
  ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'strategy_note', 'Reviewed defendant WS — adverse possession claim weakened by Exh P-3 to P-14 (rent receipts). Focus cross on timeline gaps.', NULL, now() - INTERVAL '10 days'),
  ('90000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'client_upload', 'Client uploaded property tax receipts (3 docs)', 'You uploaded new documents for your case.', now() - INTERVAL '3 days'),
  -- Rahul's case
  ('90000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'document_filed', 'Filed complaint u/s 138 NI Act with cheque, return memo, demand notice (4h)', 'Your lawyer has filed the cheque bounce complaint.', now() - INTERVAL '14 months'),
  ('90000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'hearing_completed', 'Section 145(2) evidence filed. Accused cross-examination pending.', 'A hearing was held and your lawyer presented key evidence.', now() - INTERVAL '2 months'),
  ('90000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'research', 'Researched limitation period issue — filing within 30+15 days confirmed. No risk.', NULL, now() - INTERVAL '3 days'),
  -- Sunita's case
  ('90000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000003', 'document_filed', 'Consumer complaint filed with all annexures (5h)', 'Your complaint has been officially filed with the Consumer Forum.', now() - INTERVAL '4 months'),
  ('90000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000003', 'hearing_scheduled', 'Notice issued to Hyundai. Next date for WS.', 'The court has notified Hyundai and asked them to respond.', now() - INTERVAL '3 months')
ON CONFLICT (id) DO NOTHING;

-- ── Internal Notes ──────────────────────────────────────────────

INSERT INTO public.internal_notes (id, matter_id, author_id, content)
VALUES
  ('A0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Case theory: Defendant''s adverse possession claim fails on two fronts — (1) rent receipts from 2015-2023 establish continuous acknowledgement of plaintiff''s ownership (S. 27 Limitation Act), (2) defendant''s own WS at para 7 admits "occupying on behalf of plaintiff" which negates hostile possession. Focus cross on the timeline gap between 2018 (when def claims adverse) and 2020 (last rent receipt). Cite Hemaji Waghaji Jat v. Bhikhabhai (2009) 16 SCC 517.'),
  ('A0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Client note: Priya is anxious about timeline. Reassured re: evidence stage progress. She has strong docs — keep encouraging document uploads. Payment prompt needed for overdue INV-2024-001.'),
  ('A0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'URGENT: Limitation expiry approaching. Section 142(b) NI Act requires complaint within 30 days of cause of action. Cause = day after reply period expires (15 days from demand notice receipt). Demand notice sent 15-Apr-2023, deemed received 22-Apr, reply period expired 07-May. Filing on 20-May = within time. Document this clearly for arguments.')
ON CONFLICT (id) DO NOTHING;

-- ── Documents (with visibility) ─────────────────────────────────

INSERT INTO public.documents (id, matter_id, uploaded_by, name, storage_path, file_type, classification, visibility)
VALUES
  ('B0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'Sale Agreement 2015.pdf', 'documents/priya/sale-agreement.pdf', 'application/pdf', 'agreement', 'court_filed'),
  ('B0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'Rent receipts 2015-2023.pdf', 'documents/priya/rent-receipts.pdf', 'application/pdf', 'evidence', 'court_filed'),
  ('B0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Cross-examination notes.docx', 'documents/priya/cross-exam-notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'brief', 'lawyer_only'),
  ('B0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'Property tax receipts.pdf', 'documents/priya/property-tax.pdf', 'application/pdf', 'evidence', 'client_visible'),
  ('B0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011', 'Bounced cheque scan.pdf', 'documents/rahul/cheque-scan.pdf', 'application/pdf', 'evidence', 'court_filed'),
  ('B0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Limitation calculation sheet.xlsx', 'documents/rahul/limitation-calc.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'research', 'lawyer_only')
ON CONFLICT (id) DO NOTHING;
