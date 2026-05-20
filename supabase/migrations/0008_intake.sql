-- ============================================================
-- diabetes.care — Sprint 8: Onboarding + intake
-- ============================================================
-- Migration: 0008_intake.sql
-- Adds:
--   * patients: address fields, emergency contact, race/ethnicity (USCDI)
--   * patient_consents: append-only log of every consent flip
--   * onboarding_state: track signup wizard completion per org
-- ============================================================

-- 1. Extend patients with intake fields
alter table patients add column if not exists address_line1 text;
alter table patients add column if not exists address_line2 text;
alter table patients add column if not exists city text;
alter table patients add column if not exists state text;
alter table patients add column if not exists postal_code text;
alter table patients add column if not exists country text default 'US';

alter table patients add column if not exists race text;
alter table patients add column if not exists ethnicity text;
alter table patients add column if not exists preferred_language text default 'en';

alter table patients add column if not exists emergency_contact_name text;
alter table patients add column if not exists emergency_contact_relationship text;
alter table patients add column if not exists emergency_contact_phone text;

alter table patients add column if not exists insurance_carrier text;
alter table patients add column if not exists insurance_member_id text;
alter table patients add column if not exists insurance_group_number text;

-- 2. Patient consents log (append-only audit trail of consent changes)
do $$ begin
  create type consent_kind as enum ('sms', 'email', 'telehealth', 'data_sharing', 'cgm_data_collection');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_action as enum ('granted', 'revoked');
exception when duplicate_object then null; end $$;

create table if not exists patient_consents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  kind consent_kind not null,
  action consent_action not null,
  granted_at timestamptz not null default now(),
  granted_via text not null default 'staff_collected' check (granted_via in ('staff_collected', 'patient_portal', 'paper_form', 'verbal', 'sms_reply')),
  recorded_by uuid references users(id) on delete set null,
  notes text
);

create index if not exists idx_consents_patient on patient_consents (patient_id, kind, granted_at desc);
alter table patient_consents enable row level security;
create policy "View consents in same org" on patient_consents for select using (organization_id = auth.organization_id());
create policy "Insert consents in same org" on patient_consents for insert with check (organization_id = auth.organization_id() and recorded_by = auth.uid());

-- 3. Onboarding state per org (tracks wizard completion)
create table if not exists onboarding_state (
  organization_id uuid primary key references organizations(id) on delete cascade,
  practice_profile_complete boolean not null default false,
  availability_set boolean not null default false,
  first_patient_added boolean not null default false,
  sms_configured boolean not null default false,
  scribe_tested boolean not null default false,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table onboarding_state enable row level security;
create policy "View onboarding in same org" on onboarding_state for select using (organization_id = auth.organization_id());
create policy "Update onboarding in same org" on onboarding_state for all using (organization_id = auth.organization_id()) with check (organization_id = auth.organization_id());
create trigger trg_onboarding_updated before update on onboarding_state for each row execute function set_updated_at();

-- 4. Helper: auto-create onboarding_state row when org is created
create or replace function ensure_onboarding_state() returns trigger language plpgsql as $$
begin
  insert into onboarding_state (organization_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_onboarding_state_create on organizations;
create trigger trg_onboarding_state_create after insert on organizations for each row execute function ensure_onboarding_state();

-- Backfill for existing orgs
insert into onboarding_state (organization_id)
select id from organizations where id not in (select organization_id from onboarding_state);

-- 5. Auto-update onboarding_state when relevant events happen
create or replace function update_onboarding_first_patient() returns trigger language plpgsql as $$
begin
  update onboarding_state set first_patient_added = true where organization_id = new.organization_id and first_patient_added = false;
  return new;
end;
$$;
drop trigger if exists trg_onboarding_first_patient on patients;
create trigger trg_onboarding_first_patient after insert on patients for each row execute function update_onboarding_first_patient();

create or replace function update_onboarding_availability() returns trigger language plpgsql as $$
begin
  update onboarding_state set availability_set = true where organization_id = new.organization_id and availability_set = false;
  return new;
end;
$$;
drop trigger if exists trg_onboarding_availability on provider_availability;
create trigger trg_onboarding_availability after insert on provider_availability for each row execute function update_onboarding_availability();
