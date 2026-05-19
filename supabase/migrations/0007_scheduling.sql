-- ============================================================
-- diabetes.care — Sprint 7: Scheduling + SMS
-- ============================================================
-- Migration: 0007_scheduling.sql
-- Adds:
--   * appointments (extends existing encounter scheduling model)
--   * provider_availability (weekly recurring schedule)
--   * appointment_reminders (SMS queue + delivery log)
--   * patients.phone_mobile (if not already present)
-- ============================================================

-- 1. Ensure patient has a mobile number column for SMS
alter table patients add column if not exists phone_mobile text;
alter table patients add column if not exists sms_consent boolean not null default false;
alter table patients add column if not exists sms_consent_at timestamptz;

-- 2. Appointments
do $$ begin
  create type appointment_status as enum (
    'scheduled', 'confirmed', 'arrived', 'in_progress',
    'completed', 'no_show', 'cancelled', 'rescheduled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_type as enum (
    'new_patient', 'follow_up', 'cgm_review', 'glp1_initiation',
    'lab_review', 'urgent', 'telehealth', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  provider_id uuid not null references users(id) on delete restrict,
  encounter_id uuid references encounters(id) on delete set null,

  appointment_type appointment_type not null default 'follow_up',
  status appointment_status not null default 'scheduled',

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes int generated always as (extract(epoch from (ends_at - starts_at))/60) stored,
  timezone text not null default 'America/New_York',

  reason text,
  notes text,
  location text default 'in_office',

  -- Workflow timestamps
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  no_show_marked_at timestamptz,

  -- Reschedule tracking
  rescheduled_from_id uuid references appointments(id) on delete set null,

  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_appointment_time check (ends_at > starts_at)
);

create index if not exists idx_appointments_provider_date on appointments (provider_id, starts_at) where deleted_at is null;
create index if not exists idx_appointments_patient on appointments (patient_id, starts_at desc) where deleted_at is null;
create index if not exists idx_appointments_org_date on appointments (organization_id, starts_at) where deleted_at is null;
create index if not exists idx_appointments_status on appointments (organization_id, status, starts_at) where deleted_at is null;

alter table appointments enable row level security;
create policy "View appointments in same org" on appointments for select using (organization_id = auth.organization_id());
create policy "Insert appointments in same org" on appointments for insert with check (organization_id = auth.organization_id() and created_by = auth.uid());
create policy "Update appointments in same org" on appointments for update using (organization_id = auth.organization_id());
create policy "Soft delete appointments in same org" on appointments for delete using (organization_id = auth.organization_id());

create trigger trg_appointments_updated before update on appointments for each row execute function set_updated_at();

-- 3. Provider weekly availability (recurring schedule)
create table if not exists provider_availability (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider_id uuid not null references users(id) on delete cascade,
  -- 0 = Sunday ... 6 = Saturday
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 30 check (slot_duration_minutes between 5 and 120),
  is_active boolean not null default true,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_availability_time check (end_time > start_time)
);

create index if not exists idx_availability_provider on provider_availability (provider_id, day_of_week) where is_active = true;
alter table provider_availability enable row level security;
create policy "View availability in same org" on provider_availability for select using (organization_id = auth.organization_id());
create policy "Manage own availability" on provider_availability for all using (organization_id = auth.organization_id() and (provider_id = auth.uid() or auth.has_role('owner'))) with check (organization_id = auth.organization_id());
create trigger trg_availability_updated before update on provider_availability for each row execute function set_updated_at();

-- 4. Provider time-off (overrides availability)
create table if not exists provider_time_off (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider_id uuid not null references users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint chk_time_off check (ends_at > starts_at)
);

create index if not exists idx_time_off_provider on provider_time_off (provider_id, starts_at);
alter table provider_time_off enable row level security;
create policy "View time off in same org" on provider_time_off for select using (organization_id = auth.organization_id());
create policy "Manage own time off" on provider_time_off for all using (organization_id = auth.organization_id() and (provider_id = auth.uid() or auth.has_role('owner'))) with check (organization_id = auth.organization_id());

-- 5. Appointment reminders (SMS queue)
do $$ begin
  create type reminder_kind as enum ('confirm_24h', 'confirm_2h', 'cancellation', 'reschedule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_status as enum ('pending', 'queued', 'sent', 'delivered', 'failed', 'opted_out', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists appointment_reminders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,

  kind reminder_kind not null,
  status reminder_status not null default 'pending',

  -- Scheduling
  scheduled_for timestamptz not null,
  to_phone text not null,
  message_body text not null,

  -- Twilio response
  twilio_sid text,
  twilio_error_code text,
  twilio_error_message text,

  -- Lifecycle
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  attempts int not null default 0,

  -- Patient response handling (link clicked, replied STOP, etc.)
  patient_action text, -- 'confirmed', 'cancel_requested', 'stop', null
  patient_action_at timestamptz,
  cancellation_token text unique, -- opaque token for cancel-via-link

  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_scheduled on appointment_reminders (scheduled_for, status) where status in ('pending', 'queued');
create index if not exists idx_reminders_appointment on appointment_reminders (appointment_id);
create index if not exists idx_reminders_token on appointment_reminders (cancellation_token) where cancellation_token is not null;
alter table appointment_reminders enable row level security;
create policy "View reminders in same org" on appointment_reminders for select using (organization_id = auth.organization_id());
create policy "No client insert reminders" on appointment_reminders for insert with check (false);
create policy "No client update reminders" on appointment_reminders for update using (false);

-- 6. SMS opt-out list (patient-level, applies across all reminders)
create table if not exists sms_opt_outs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phone text not null,
  patient_id uuid references patients(id) on delete set null,
  opted_out_at timestamptz not null default now(),
  source text not null default 'sms_stop' check (source in ('sms_stop', 'manual', 'consent_revoked')),
  unique (organization_id, phone)
);

create index if not exists idx_opt_outs_phone on sms_opt_outs (organization_id, phone);
alter table sms_opt_outs enable row level security;
create policy "View opt-outs in same org" on sms_opt_outs for select using (organization_id = auth.organization_id());
create policy "No client insert opt-outs" on sms_opt_outs for insert with check (false);

-- 7. Org-level SMS settings
alter table organizations add column if not exists sms_enabled boolean not null default true;
alter table organizations add column if not exists sms_24h_reminder_enabled boolean not null default true;
alter table organizations add column if not exists sms_2h_reminder_enabled boolean not null default true;
alter table organizations add column if not exists sms_from_name text;

-- 8. Function to detect appointment conflicts
create or replace function check_appointment_conflict(
  p_provider_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_id uuid default null
) returns table (id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable as $$
  select a.id, a.starts_at, a.ends_at
  from appointments a
  where a.provider_id = p_provider_id
    and a.deleted_at is null
    and a.status not in ('cancelled', 'no_show', 'completed')
    and a.starts_at < p_ends_at
    and a.ends_at > p_starts_at
    and (p_exclude_id is null or a.id != p_exclude_id);
$$;
