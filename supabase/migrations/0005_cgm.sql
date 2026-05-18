-- ============================================================
-- diabetes.care — Sprint 5: CGM enhancements
-- ============================================================
-- Migration: 0005_cgm.sql
-- Adds:
--   * cgm_alert_thresholds (per-patient custom thresholds)
--   * Index for sync worker (find connections due for sync)
--   * Function to encrypt/decrypt CGM tokens via pgcrypto
-- ============================================================

-- 1. Per-patient alert thresholds (overrides org defaults)
create table if not exists cgm_alert_thresholds (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,

  -- Glucose thresholds (mg/dL)
  low_threshold int not null default 70 check (low_threshold between 40 and 100),
  critical_low_threshold int not null default 54 check (critical_low_threshold between 30 and 70),
  high_threshold int not null default 180 check (high_threshold between 140 and 300),
  critical_high_threshold int not null default 250 check (critical_high_threshold between 200 and 600),

  -- Target range (TIR calculation)
  target_low int not null default 70 check (target_low between 50 and 100),
  target_high int not null default 180 check (target_high between 140 and 250),

  -- Alert preferences
  alert_on_nocturnal_hypo boolean not null default true,
  alert_on_postprandial_spike boolean not null default true,
  alert_on_dawn_phenomenon boolean not null default false,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (patient_id)
);

create index if not exists idx_cgm_thresholds_patient on cgm_alert_thresholds (patient_id) where deleted_at is null;
create index if not exists idx_cgm_thresholds_org on cgm_alert_thresholds (organization_id) where deleted_at is null;

alter table cgm_alert_thresholds enable row level security;

create policy "View thresholds in same org"
on cgm_alert_thresholds for select
using (organization_id = auth.organization_id());

create policy "Manage thresholds in own org"
on cgm_alert_thresholds for all
using (organization_id = auth.organization_id())
with check (organization_id = auth.organization_id());

create trigger trg_cgm_thresholds_updated before update on cgm_alert_thresholds for each row execute function set_updated_at();

-- 2. CGM-detected patterns (cached results from analysis runs)
create table if not exists cgm_patterns (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,
  pattern_type text not null check (pattern_type in ('nocturnal_hypo', 'dawn_phenomenon', 'postprandial_spike', 'hypo_unawareness', 'high_variability')),
  detected_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  -- Pattern-specific details (e.g., affected times of day, frequency)
  details jsonb default '{}'::jsonb,
  -- Has the provider reviewed/acknowledged?
  acknowledged_at timestamptz,
  acknowledged_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cgm_patterns_patient on cgm_patterns (patient_id, detected_at desc);
create index if not exists idx_cgm_patterns_unacked on cgm_patterns (organization_id, detected_at desc) where acknowledged_at is null;

alter table cgm_patterns enable row level security;

create policy "View patterns in same org"
on cgm_patterns for select
using (organization_id = auth.organization_id());

create policy "Insert patterns via service"
on cgm_patterns for insert
with check (false);

create policy "Acknowledge own org patterns"
on cgm_patterns for update
using (organization_id = auth.organization_id())
with check (organization_id = auth.organization_id());

-- 3. Add sync state columns to cgm_connections for better worker tracking
alter table cgm_connections add column if not exists sync_status text default 'idle' check (sync_status in ('idle', 'syncing', 'error', 'expired'));
alter table cgm_connections add column if not exists last_sync_error text;
alter table cgm_connections add column if not exists readings_synced_total int default 0;

-- 4. Index for sync scheduler: find connections due for sync (>1hr since last sync, active, not currently syncing)
drop index if exists idx_cgm_sync_due;
create index idx_cgm_sync_due on cgm_connections (last_synced_at nulls first)
where is_active = true and deleted_at is null and sync_status in ('idle', 'error');

-- 5. Encryption key (set via Supabase Vault in production)
-- For dev, this is a generated key. ROTATE BEFORE PRODUCTION.
-- Provider should run: ALTER DATABASE postgres SET app.cgm_encryption_key = '<base64-32-bytes>';

create or replace function encrypt_cgm_token(plaintext text)
returns text
language plpgsql
security definer
as $$
declare
  encryption_key text;
begin
  if plaintext is null or plaintext = '' then
    return null;
  end if;
  encryption_key := coalesce(current_setting('app.cgm_encryption_key', true), 'dev_only_replace_in_production_32b');
  return encode(pgp_sym_encrypt(plaintext, encryption_key), 'base64');
end;
$$;

create or replace function decrypt_cgm_token(ciphertext text)
returns text
language plpgsql
security definer
as $$
declare
  encryption_key text;
begin
  if ciphertext is null or ciphertext = '' then
    return null;
  end if;
  encryption_key := coalesce(current_setting('app.cgm_encryption_key', true), 'dev_only_replace_in_production_32b');
  return pgp_sym_decrypt(decode(ciphertext, 'base64'), encryption_key);
exception when others then
  return null;
end;
$$;

revoke execute on function encrypt_cgm_token(text) from public;
revoke execute on function decrypt_cgm_token(text) from public;
