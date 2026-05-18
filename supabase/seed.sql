-- ============================================================
-- diabetes.care — Development Seed Data
-- ============================================================
-- Run AFTER 0001_init.sql and 0002_rls.sql
-- Creates one demo organization + one provider + one patient
-- Use this for local dev only. Never run in production.
-- ============================================================

do $$
declare
  demo_org_id uuid := '00000000-0000-0000-0000-000000000001';
  demo_user_id uuid := '00000000-0000-0000-0000-000000000002';
  demo_patient_id uuid := '00000000-0000-0000-0000-000000000003';
  enc_id uuid;
begin

insert into organizations (id, name, slug, plan, npi, address_line_1, city, state, zip, phone, trial_ends_at)
values (
  demo_org_id,
  'Demo Endocrinology Associates',
  'demo-endo',
  'trial',
  '1234567890',
  '100 Health Plaza',
  'Boston',
  'MA',
  '02101',
  '+16175550100',
  now() + interval '60 days'
)
on conflict (id) do nothing;

insert into users (id, organization_id, email, full_name, role, npi, credentials, license_state, is_active)
values (
  demo_user_id,
  demo_org_id,
  'demo@diabetes.care',
  'Dr. Demo Endocrinologist',
  'owner',
  '9876543210',
  'MD',
  'MA',
  true
)
on conflict (id) do nothing;

insert into patients (
  id, organization_id, mrn, first_name, last_name, date_of_birth, sex_at_birth,
  email, phone, diabetes_type, diagnosis_date, primary_provider_id, is_active
)
values (
  demo_patient_id,
  demo_org_id,
  'MRN-100001',
  'Maria',
  'Sanchez',
  '1971-03-15',
  'female',
  'maria.sanchez@example.com',
  '+16175550199',
  'type_2',
  '2018-06-01',
  demo_user_id,
  true
)
on conflict (id) do nothing;

insert into lab_values (organization_id, patient_id, test_name, loinc_code, value, unit, reference_low, reference_high, collected_at, source)
values
  (demo_org_id, demo_patient_id, 'a1c', '4548-4', 8.4, '%', 4.0, 5.6, now() - interval '12 months', 'manual'),
  (demo_org_id, demo_patient_id, 'a1c', '4548-4', 8.1, '%', 4.0, 5.6, now() - interval '9 months', 'manual'),
  (demo_org_id, demo_patient_id, 'a1c', '4548-4', 7.8, '%', 4.0, 5.6, now() - interval '6 months', 'manual'),
  (demo_org_id, demo_patient_id, 'a1c', '4548-4', 7.5, '%', 4.0, 5.6, now() - interval '3 months', 'manual'),
  (demo_org_id, demo_patient_id, 'a1c', '4548-4', 7.2, '%', 4.0, 5.6, now() - interval '7 days', 'manual')
on conflict do nothing;

insert into medications (organization_id, patient_id, name, brand_name, dose, route, frequency, indication, is_diabetes_med, prescribed_by, prescribed_at)
values
  (demo_org_id, demo_patient_id, 'Metformin', 'Glucophage', '1000 mg', 'oral', 'twice daily', 'T2DM', true, demo_user_id, now() - interval '5 years'),
  (demo_org_id, demo_patient_id, 'Semaglutide', 'Ozempic', '1 mg', 'subcutaneous', 'weekly', 'T2DM', true, demo_user_id, now() - interval '6 months'),
  (demo_org_id, demo_patient_id, 'Atorvastatin', 'Lipitor', '20 mg', 'oral', 'daily', 'hyperlipidemia', false, demo_user_id, now() - interval '3 years')
on conflict do nothing;

insert into encounters (
  organization_id, patient_id, provider_id, encounter_type, status,
  scheduled_at, started_at, ended_at, signed_at, signed_by,
  chief_complaint, vitals
)
values (
  demo_org_id, demo_patient_id, demo_user_id, 'follow_up', 'signed',
  now() - interval '7 days',
  now() - interval '7 days' + interval '15 minutes',
  now() - interval '7 days' + interval '40 minutes',
  now() - interval '7 days' + interval '45 minutes',
  demo_user_id,
  'Q3 diabetes follow-up; CGM review',
  '{"bp_sys": 124, "bp_dia": 78, "hr": 72, "weight_kg": 82.5, "height_cm": 170, "bmi": 28.5}'::jsonb
)
returning id into enc_id;

insert into appointments (
  organization_id, patient_id, provider_id, starts_at, ends_at, encounter_type, reason, status, created_by
)
values (
  demo_org_id, demo_patient_id, demo_user_id,
  now() + interval '12 weeks',
  now() + interval '12 weeks' + interval '30 minutes',
  'follow_up',
  '12-week A1C check + CGM review',
  'scheduled',
  demo_user_id
)
on conflict do nothing;

end $$;
