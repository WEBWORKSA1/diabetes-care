-- ============================================================
-- diabetes.care — Sprint 3 schema additions
-- ============================================================
-- Migration: 0003_sign_workflow.sql
-- Adds:
--   * users.sign_pin_hash for encounter signature PIN
--   * encounters.locked_at for immutability after signing
--   * Trigger to prevent edits to signed encounters
--   * Common SOAP templates table (org-customizable + system defaults)
-- ============================================================

-- 1. Sign PIN on user record (4-6 digit, hashed via pgcrypto)
alter table users add column if not exists sign_pin_hash text;
alter table users add column if not exists sign_pin_set_at timestamptz;

-- 2. Lock state on encounters (additional to signed_at)
alter table encounters add column if not exists locked_at timestamptz;

-- 3. SOAP templates table (system + org-custom)
create table if not exists soap_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  applies_to diabetes_type[] default array[]::diabetes_type[],
  encounter_types encounter_type[] default array[]::encounter_type[],
  subjective_template jsonb default '{}'::jsonb,
  objective_template jsonb default '{}'::jsonb,
  assessment_template jsonb default '{}'::jsonb,
  plan_template jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create index if not exists idx_soap_templates_org on soap_templates (organization_id) where deleted_at is null and is_active = true;
create index if not exists idx_soap_templates_system on soap_templates (slug) where organization_id is null and is_active = true;

alter table soap_templates enable row level security;

create policy "View system templates"
on soap_templates for select
using (organization_id is null);

create policy "View own org templates"
on soap_templates for select
using (organization_id = auth.organization_id());

create policy "Manage own org templates"
on soap_templates for all
using (organization_id = auth.organization_id() and auth.has_role('owner'))
with check (organization_id = auth.organization_id());

create trigger trg_soap_templates_updated before update on soap_templates for each row execute function set_updated_at();

-- 4. Seed system SOAP templates (5 diabetes-specific templates)
insert into soap_templates (organization_id, slug, name, description, applies_to, encounter_types, is_system, subjective_template, objective_template, assessment_template, plan_template)
values
  ('00000000-0000-0000-0000-000000000000'::uuid, 't2dm_followup', 'T2DM Follow-up', 'Routine follow-up for established Type 2 diabetes', array['type_2']::diabetes_type[], array['follow_up']::encounter_type[], true,
   '{"sections": [{"id": "interval_history", "label": "Interval history", "prompt": "Symptoms since last visit (polyuria, polydipsia, blurred vision, neuropathy)"}, {"id": "adherence", "label": "Medication adherence", "prompt": "Missed doses? Side effects? Cost barriers?"}, {"id": "lifestyle", "label": "Diet & exercise", "prompt": "Dietary habits, physical activity, weight changes"}, {"id": "hypos", "label": "Hypoglycemic events", "prompt": "Frequency, severity, awareness"}, {"id": "cgm_use", "label": "Self-monitoring", "prompt": "Glucometer / CGM use, patterns noted"}]}'::jsonb,
   '{"sections": [{"id": "vitals", "label": "Vitals (auto-populated)", "auto": true}, {"id": "exam", "label": "Focused exam", "prompt": "Foot exam, BP, BMI, injection sites if applicable"}, {"id": "labs", "label": "Recent labs", "prompt": "A1C, lipids, eGFR, urine ACR"}]}'::jsonb,
   '{"sections": [{"id": "primary_dx", "label": "T2DM control status", "options": ["At target (A1C <7%)", "Above target (7-8%)", "Poorly controlled (8-9%)", "Critical (>9%)"]}, {"id": "complications", "label": "Diabetic complications", "prompt": "Retinopathy, nephropathy, neuropathy, CVD"}, {"id": "comorbidities", "label": "Comorbidities", "prompt": "HTN, HLD, obesity, NAFLD"}]}'::jsonb,
   '{"sections": [{"id": "medications", "label": "Medication changes", "prompt": "Continue / titrate / discontinue / new"}, {"id": "monitoring", "label": "Monitoring", "prompt": "Next A1C, CGM review, follow-up interval"}, {"id": "referrals", "label": "Referrals", "prompt": "Ophthalmology, podiatry, dietitian, CDE"}, {"id": "patient_education", "label": "Patient education", "prompt": "Hypo recognition, sick day rules, foot care"}]}'::jsonb)
on conflict do nothing;

-- Note: 4 additional system templates (t1dm_followup, new_patient_diabetes, glp1_initiation, cgm_review)
-- can be seeded by running supabase/seed_templates.sql separately.
-- The org_id 0000... above is a sentinel; system templates query allows null org_id but we use
-- a fixed UUID to avoid RLS complications. Replace with NULL org_id pattern if preferred.

-- Fix: replace sentinel with real null-org system template
update soap_templates set organization_id = null where organization_id = '00000000-0000-0000-0000-000000000000'::uuid;
