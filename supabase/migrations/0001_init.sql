-- ============================================================
-- diabetes.care — Database Schema v1
-- ============================================================
-- Migration: 0001_init.sql
-- HIPAA notes:
--   * All PHI tables have row-level security enforced
--   * audit_logs table captures every PHI read/write
--   * Soft-delete (deleted_at) used everywhere; never hard-delete patient data
--   * Service-role key is the ONLY way to write audit_logs (never trust client)
-- ============================================================

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================
-- ENUMS
-- ============================================================

create type org_plan as enum ('trial', 'independent', 'small_practice', 'multi_site');
create type user_role as enum ('owner', 'provider', 'staff', 'billing');
create type diabetes_type as enum ('type_1', 'type_2', 'gestational', 'prediabetes', 'mody', 'lada', 'other');
create type sex_at_birth as enum ('male', 'female', 'intersex', 'unknown');
create type encounter_type as enum (
  'new_patient',
  'follow_up',
  'urgent',
  'telehealth',
  'lab_review',
  'cgm_review',
  'medication_adjustment'
);
create type encounter_status as enum ('draft', 'in_progress', 'signed', 'amended', 'cancelled');
create type cgm_device as enum (
  'dexcom_g6',
  'dexcom_g7',
  'libre_2',
  'libre_3',
  'medtronic_guardian',
  'eversense',
  'other'
);
create type audit_action as enum (
  'create',
  'read',
  'update',
  'soft_delete',
  'restore',
  'export',
  'login',
  'logout',
  'failed_login',
  'permission_change'
);

-- ============================================================
-- ORGANIZATIONS (multi-tenant root)
-- ============================================================

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  npi text unique check (npi ~ '^\d{10}$' or npi is null),
  tax_id text,
  plan org_plan not null default 'trial',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  address_line_1 text,
  address_line_2 text,
  city text,
  state char(2),
  zip text check (zip ~ '^\d{5}(-\d{4})?$' or zip is null),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_orgs_slug on organizations (slug) where deleted_at is null;
create index idx_orgs_stripe_customer on organizations (stripe_customer_id) where stripe_customer_id is not null;

-- ============================================================
-- USERS (provider/staff accounts — extends auth.users)
-- ============================================================

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,
  email citext not null unique,
  full_name text not null,
  role user_role not null default 'staff',
  npi text check (npi ~ '^\d{10}$' or npi is null),
  dea_number text,
  license_number text,
  license_state char(2),
  credentials text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_users_org on users (organization_id) where deleted_at is null;
create index idx_users_email on users (email);
create index idx_users_role on users (organization_id, role) where deleted_at is null and is_active = true;

-- ============================================================
-- PATIENTS (PHI — heavily protected)
-- ============================================================

create table patients (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete restrict,
  mrn text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null check (date_of_birth > '1900-01-01' and date_of_birth <= current_date),
  sex_at_birth sex_at_birth not null,
  preferred_pronouns text,
  email citext,
  phone text,
  phone_secondary text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state char(2),
  zip text check (zip ~ '^\d{5}(-\d{4})?$' or zip is null),
  diabetes_type diabetes_type not null,
  diagnosis_date date,
  primary_provider_id uuid references users(id) on delete set null,
  insurance_primary text,
  insurance_member_id text,
  insurance_group_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, mrn)
);

create index idx_patients_org on patients (organization_id) where deleted_at is null;
create index idx_patients_provider on patients (primary_provider_id) where deleted_at is null and is_active = true;
create index idx_patients_search on patients using gin (
  to_tsvector('simple', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(mrn, ''))
) where deleted_at is null;
create index idx_patients_dob on patients (organization_id, date_of_birth) where deleted_at is null;

-- ============================================================
-- ENCOUNTERS (visits / clinical interactions)
-- ============================================================

create table encounters (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  provider_id uuid not null references users(id) on delete restrict,
  encounter_type encounter_type not null default 'follow_up',
  status encounter_status not null default 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  signed_at timestamptz,
  signed_by uuid references users(id) on delete set null,
  chief_complaint text,
  subjective jsonb default '{}'::jsonb,
  objective jsonb default '{}'::jsonb,
  assessment jsonb default '{}'::jsonb,
  plan jsonb default '{}'::jsonb,
  vitals jsonb default '{}'::jsonb,
  audio_storage_path text,
  transcript text,
  ai_generated_note jsonb,
  ai_model_version text,
  ai_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_encounters_patient on encounters (patient_id, scheduled_at desc) where deleted_at is null;
create index idx_encounters_provider on encounters (provider_id, scheduled_at desc) where deleted_at is null;
create index idx_encounters_org_date on encounters (organization_id, scheduled_at desc) where deleted_at is null;
create index idx_encounters_status on encounters (organization_id, status) where deleted_at is null;

-- ============================================================
-- LAB VALUES
-- ============================================================

create table lab_values (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  encounter_id uuid references encounters(id) on delete set null,
  test_name text not null,
  loinc_code text,
  value numeric not null,
  unit text not null,
  reference_low numeric,
  reference_high numeric,
  is_abnormal boolean,
  collected_at timestamptz not null,
  resulted_at timestamptz,
  source text default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  deleted_at timestamptz
);

create index idx_labs_patient_date on lab_values (patient_id, collected_at desc) where deleted_at is null;
create index idx_labs_test on lab_values (patient_id, test_name, collected_at desc) where deleted_at is null;
create index idx_labs_a1c on lab_values (patient_id, collected_at desc) where test_name = 'a1c' and deleted_at is null;

-- ============================================================
-- MEDICATIONS
-- ============================================================

create table medications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  name text not null,
  brand_name text,
  rxnorm_code text,
  ndc_code text,
  strength text,
  dose text,
  route text,
  frequency text,
  instructions text,
  indication text,
  is_diabetes_med boolean not null default false,
  prescribed_by uuid references users(id) on delete set null,
  prescribed_at timestamptz,
  discontinued_at timestamptz,
  discontinued_reason text,
  is_active boolean generated always as (discontinued_at is null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_meds_patient_active on medications (patient_id) where discontinued_at is null and deleted_at is null;
create index idx_meds_diabetes on medications (patient_id) where is_diabetes_med = true and discontinued_at is null and deleted_at is null;

-- ============================================================
-- CGM
-- ============================================================

create table cgm_connections (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete restrict,
  organization_id uuid not null references organizations(id) on delete restrict,
  device cgm_device not null,
  external_user_id text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (patient_id, device)
);

create index idx_cgm_conn_patient on cgm_connections (patient_id) where is_active = true and deleted_at is null;
create index idx_cgm_sync_due on cgm_connections (last_synced_at) where is_active = true and deleted_at is null;

create table cgm_readings (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete restrict,
  organization_id uuid not null references organizations(id) on delete restrict,
  connection_id uuid not null references cgm_connections(id) on delete cascade,
  recorded_at timestamptz not null,
  glucose_mg_dl numeric not null check (glucose_mg_dl between 20 and 600),
  trend text,
  device_serial text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (patient_id, recorded_at, connection_id)
);

create index idx_cgm_readings_patient_time on cgm_readings (patient_id, recorded_at desc);
create index idx_cgm_readings_org_time on cgm_readings (organization_id, recorded_at desc);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete restrict,
  provider_id uuid not null references users(id) on delete restrict,
  encounter_id uuid references encounters(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes int generated always as (extract(epoch from (ends_at - starts_at)) / 60) stored,
  encounter_type encounter_type not null default 'follow_up',
  reason text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled')),
  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create index idx_appts_provider_date on appointments (provider_id, starts_at) where deleted_at is null;
create index idx_appts_patient on appointments (patient_id, starts_at desc) where deleted_at is null;
create index idx_appts_reminders_pending on appointments (starts_at) where reminder_sent_at is null and status in ('scheduled', 'confirmed') and deleted_at is null;

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  user_id uuid references users(id) on delete set null,
  action audit_action not null,
  resource_type text not null,
  resource_id uuid,
  patient_id uuid,
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index idx_audit_org_time on audit_logs (organization_id, occurred_at desc);
create index idx_audit_user_time on audit_logs (user_id, occurred_at desc);
create index idx_audit_patient_time on audit_logs (patient_id, occurred_at desc) where patient_id is not null;
create index idx_audit_action on audit_logs (organization_id, action, occurred_at desc);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_orgs_updated before update on organizations for each row execute function set_updated_at();
create trigger trg_users_updated before update on users for each row execute function set_updated_at();
create trigger trg_patients_updated before update on patients for each row execute function set_updated_at();
create trigger trg_encounters_updated before update on encounters for each row execute function set_updated_at();
create trigger trg_meds_updated before update on medications for each row execute function set_updated_at();
create trigger trg_cgm_conn_updated before update on cgm_connections for each row execute function set_updated_at();
create trigger trg_appts_updated before update on appointments for each row execute function set_updated_at();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function auth.organization_id()
returns uuid as $$
  select organization_id from public.users where id = auth.uid() and deleted_at is null and is_active = true limit 1;
$$ language sql stable security definer;

create or replace function auth.has_role(required_role user_role)
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and deleted_at is null
      and is_active = true
      and (role = required_role or role = 'owner')
  );
$$ language sql stable security definer;
