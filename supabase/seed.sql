-- Minimal seed data
-- Insert test users into auth.users (local development only)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, raw_app_meta_data, raw_user_meta_data, aud, confirmation_token)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'client@lead.ai', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', '{"provider":"email","providers":["email"],"role":"user"}', '{"full_name":"Test Client"}', 'authenticated', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'lawyer@lead.ai', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', '{"provider":"email","providers":["email"],"role":"lawyer"}', '{"full_name":"Test Lawyer"}', 'authenticated', ''),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'admin@lead.ai', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', '{"provider":"email","providers":["email"],"role":"admin"}', '{"full_name":"Test Admin"}', 'authenticated', '')
ON CONFLICT (id) DO NOTHING;

-- Insert corresponding profiles
INSERT INTO public.profiles (id, role, full_name, phone, city, state, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'user', 'Test Client', '9999999999', 'New Delhi', 'Delhi', true),
  ('00000000-0000-0000-0000-000000000002', 'lawyer', 'Test Lawyer', '8888888888', 'Mumbai', 'Maharashtra', true),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Test Admin', '7777777777', 'Bangalore', 'Karnataka', true)
ON CONFLICT (id) DO NOTHING;

-- Insert lawyer profile
INSERT INTO public.lawyer_profiles (id, bar_council_id, enrollment_state, specializations, court_types, languages, experience_years, bio, consultation_fee, is_verified, is_available, rating)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'BAR-12345', 'Maharashtra', '{"property","family"}', '{"High Court","District Court"}', '{"English","Hindi"}', 10, 'Experienced legal professional specializing in property and family law.', 1500.00, true, true, 4.80)
ON CONFLICT (id) DO NOTHING;
