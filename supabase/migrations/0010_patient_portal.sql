-- ============================================================
-- diabetes.care — Sprint 10: Patient portal
-- ============================================================
-- Migration: 0010_patient_portal.sql
-- Adds:
--   * portal_magic_links — short-lived tokens for patient authentication
--   * portal_sessions — active patient sessions (separate from provider auth)
--   * intake_forms + intake_form_responses — pre-visit questionnaires
--   * patient_messages — one-way patient → practice messaging
--   * patient_releasable_lab_view — which labs patients can see (default: all)
-- ============================================================

-- 1. Magic links (one-shot, short-lived)
create table if not exists portal_magic_links (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  token text not null unique,
  -- Where did this link send the patient? deep-link target
  destination text not null default 'home' check (destination in ('home', 'appointment', 'intake', 'results', 'message')),
  destination_ref uuid, -- e.g. appointment_id or intake_form_id
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  consumed_ip text,
  consumed_user_agent text,
  -- Source of the link delivery
  sent_via text not null default 'sms' check (sent_via in ('sms', 'email', 'manual')),
  sent_at timestamptz
);

create index if not exists idx_magic_links_token on portal_magic_links (token) where consumed_at is null;
create index if not exists idx_magic_links_patient on portal_magic_links (patient_id, created_at desc);
create index if not exists idx_magic_links_expires on portal_magic_links (expires_at) where consumed_at is null;

alter table portal_magic_links enable row level security;
create policy "View magic links in same org" on portal_magic_links for select using (organization_id = auth.organization_id());
create policy "No client mutation magic links" on portal_magic_links for all using (false) with check (false);

-- 2. Portal sessions (HTTP-only cookie sessions; not Supabase Auth)
create table if not exists portal_sessions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  session_token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_active_at timestamptz not null default now(),
  user_agent text,
  ip text,
  revoked_at timestamptz
);

create index if not exists idx_portal_sessions_token on portal_sessions (session_token) where revoked_at is null;
create index if not exists idx_portal_sessions_patient on portal_sessions (patient_id, created_at desc);

alter table portal_sessions enable row level security;
create policy "View sessions in same org" on portal_sessions for select using (organization_id = auth.organization_id());
create policy "No client mutation portal sessions" on portal_sessions for all using (false) with check (false);

-- 3. Intake form templates (per-org, optionally reusable)
do $$ begin
  create type intake_form_kind as enum ('pre_visit', 'new_patient', 'glp1_screening', 'pre_op', 'symptom_check');
exception when duplicate_object then null; end $$;

create table if not exists intake_forms (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind intake_form_kind not null default 'pre_visit',
  description text,
  -- JSON schema-like field definitions: [{ id, label, type: 'text'|'number'|'select'|'radio'|'checkbox'|'date'|'scale'|'textarea', required, options, scale_min, scale_max, help_text }]
  fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_default_for_new_patient boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intake_forms_org on intake_forms (organization_id) where is_active = true;
alter table intake_forms enable row level security;
create policy "View intake forms in same org" on intake_forms for select using (organization_id = auth.organization_id());
create policy "Manage intake forms in same org" on intake_forms for all using (organization_id = auth.organization_id()) with check (organization_id = auth.organization_id());
create trigger trg_intake_forms_updated before update on intake_forms for each row execute function set_updated_at();

-- 4. Intake form responses (one per patient per form instance)
do $$ begin
  create type intake_response_status as enum ('sent', 'started', 'submitted', 'reviewed', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists intake_form_responses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  intake_form_id uuid not null references intake_forms(id) on delete restrict,
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,

  status intake_response_status not null default 'sent',
  responses jsonb not null default '{}'::jsonb, -- { field_id: value }

  -- Lifecycle
  sent_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references users(id) on delete set null,
  review_notes text,
  expires_at timestamptz not null default (now() + interval '30 days'),

  -- Magic link for patient access
  access_token text not null unique
);

create index if not exists idx_intake_responses_patient on intake_form_responses (patient_id, sent_at desc);
create index if not exists idx_intake_responses_org_status on intake_form_responses (organization_id, status, sent_at desc);
create index if not exists idx_intake_responses_appointment on intake_form_responses (appointment_id) where appointment_id is not null;
create index if not exists idx_intake_responses_token on intake_form_responses (access_token);
alter table intake_form_responses enable row level security;
create policy "View intake responses in same org" on intake_form_responses for select using (organization_id = auth.organization_id());
create policy "Update intake responses in same org" on intake_form_responses for update using (organization_id = auth.organization_id());
create policy "No client insert intake responses" on intake_form_responses for insert with check (false);

-- 5. Patient messages (one-way patient → practice; replies happen out of band)
do $$ begin
  create type patient_message_priority as enum ('routine', 'urgent');
exception when duplicate_object then null; end $$;

create table if not exists patient_messages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  subject text not null,
  body text not null,
  priority patient_message_priority not null default 'routine',
  -- Lifecycle
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null,
  resolution_note text,
  -- IMPORTANT: NOT for emergencies banner is shown in the UI; flag any 'urgent' for triage
  triage_flag boolean not null default false
);

create index if not exists idx_messages_org_unresolved on patient_messages (organization_id, sent_at desc) where resolved_at is null;
create index if not exists idx_messages_patient on patient_messages (patient_id, sent_at desc);
alter table patient_messages enable row level security;
create policy "View messages in same org" on patient_messages for select using (organization_id = auth.organization_id());
create policy "Update messages in same org" on patient_messages for update using (organization_id = auth.organization_id());
create policy "No client insert messages" on patient_messages for insert with check (false);

-- 6. Patient-releasable labs (control which labs patients can see in portal)
-- Default: lab is releasable unless explicitly held
alter table lab_values add column if not exists patient_release_held boolean not null default false;
alter table lab_values add column if not exists patient_release_held_by uuid references users(id) on delete set null;
alter table lab_values add column if not exists patient_release_held_reason text;

-- 7. Org-level portal config
alter table organizations add column if not exists portal_enabled boolean not null default false;
alter table organizations add column if not exists portal_subdomain text;
alter table organizations add column if not exists portal_emergency_text text not null default 'If this is a medical emergency, call 911 or go to your nearest emergency room. Do not use this portal for urgent issues.';

-- 8. Seed: default pre-visit intake form for diabetes follow-up
-- Created lazily by app code on first run; SQL below is example/reference only
-- See app/api/intake-forms/seed-defaults for the actual seed

-- 9. Cleanup function for expired tokens
create or replace function cleanup_expired_portal_tokens() returns int language plpgsql as $$
declare
  cleaned int := 0;
begin
  -- Expire unconsumed magic links past their deadline
  delete from portal_magic_links where consumed_at is null and expires_at < now() - interval '30 days';
  get diagnostics cleaned = row_count;

  -- Revoke expired sessions
  update portal_sessions set revoked_at = now() where revoked_at is null and expires_at < now();

  return cleaned;
end;
$$;
