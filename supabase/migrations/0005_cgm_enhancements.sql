-- ============================================================
-- diabetes.care — Sprint 5: CGM enhancements
-- ============================================================
-- Migration: 0005_cgm_enhancements.sql
-- Adds:
--   * cgm_thresholds table (per-patient alert thresholds)
--   * cgm_alerts table (generated alerts from threshold breaches + patterns)
--   * cgm_sync_log table (audit trail of sync jobs)
--   * cgm_oauth_states table (CSRF protection for OAuth flow)
--   * cgm_connections.sync_status, cgm_connections.last_error
--   * pgcrypto helpers for token encrypt/decrypt
-- ============================================================

-- 1. Extend cgm_connections with sync state
alter table cgm_connections add column if not exists sync_status text default 'idle' check (sync_status in ('idle', 'syncing', 'error'));
alter table cgm_connections add column if not exists last_error text;
alter table cgm_connections add column if not exists last_error_at timestamptz;
alter table cgm_connections add column if not exists consecutive_failures int default 0;
alter table cgm_connections add column if not exists patient_display_name text;

-- 2. Per-patient CGM thresholds (override clinical defaults)
create table if not exists cgm_thresholds (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  -- Glucose targets (mg/dL)
  target_low numeric not null default 70 check (target_low between 40 and 120),
  target_high numeric not null default 180 check (target_high between 120 and 300),
  urgent_low numeric not null default 54 check (urgent_low between 40 and 80),
  urgent_high numeric not null default 250 check (urgent_high between 200 and 400),
  -- Alert preferences
  alert_nocturnal_hypo boolean not null default true,
  alert_postprandial_spike boolean not null default true,
  alert_dawn_phenomenon boolean not null default true,
  alert_high_variability boolean not null default true,
  -- Variability threshold (CV %)
  cv_threshold numeric not null default 36,
  set_by uuid references users(id) on delete set null,
  set_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id)
);

create index if not exists idx_cgm_thresholds_patient on cgm_thresholds (patient_id);
alter table cgm_thresholds enable row level security;
create policy "View thresholds in same org" on cgm_thresholds for select using (organization_id = auth.organization_id());
create policy "Manage thresholds in same org" on cgm_thresholds for all using (organization_id = auth.organization_id()) with check (organization_id = auth.organization_id());
create trigger trg_cgm_thresholds_updated before update on cgm_thresholds for each row execute function set_updated_at();

-- 3. CGM alerts (threshold breaches + pattern detections)
do $$ begin
  create type cgm_alert_type as enum (
    'nocturnal_hypo', 'urgent_low', 'urgent_high', 'high_variability',
    'postprandial_spike', 'dawn_phenomenon', 'extended_high', 'extended_low',
    'sensor_offline', 'rapid_drop', 'rapid_rise'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cgm_alert_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

create table if not exists cgm_alerts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  connection_id uuid references cgm_connections(id) on delete cascade,
  alert_type cgm_alert_type not null,
  severity cgm_alert_severity not null,
  title text not null,
  description text,
  detected_at timestamptz not null default now(),
  observation_window_start timestamptz,
  observation_window_end timestamptz,
  -- Numeric context for the alert (count of episodes, glucose values, etc.)
  context jsonb default '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references users(id) on delete set null,
  resolution_note text
);

create index if not exists idx_cgm_alerts_patient_unresolved on cgm_alerts (patient_id, detected_at desc) where resolved_at is null;
create index if not exists idx_cgm_alerts_org_unresolved on cgm_alerts (organization_id, detected_at desc) where resolved_at is null;
create index if not exists idx_cgm_alerts_severity on cgm_alerts (organization_id, severity, detected_at desc) where resolved_at is null;

alter table cgm_alerts enable row level security;
create policy "View alerts in same org" on cgm_alerts for select using (organization_id = auth.organization_id());
create policy "Update alerts in same org" on cgm_alerts for update using (organization_id = auth.organization_id());
-- Inserts are service-role only (worker writes alerts)
create policy "No client insert alerts" on cgm_alerts for insert with check (false);

-- 4. CGM sync log (audit + observability)
create table if not exists cgm_sync_log (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid not null references cgm_connections(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'error')),
  readings_fetched int default 0,
  readings_inserted int default 0,
  oldest_reading timestamptz,
  newest_reading timestamptz,
  error_message text,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual', 'initial', 'webhook'))
);

create index if not exists idx_cgm_sync_log_connection on cgm_sync_log (connection_id, started_at desc);
create index if not exists idx_cgm_sync_log_org on cgm_sync_log (organization_id, started_at desc);
alter table cgm_sync_log enable row level security;
create policy "View sync log in same org" on cgm_sync_log for select using (organization_id = auth.organization_id());
create policy "No client insert sync log" on cgm_sync_log for insert with check (false);

-- 5. OAuth state (CSRF token for Dexcom OAuth callback)
create table if not exists cgm_oauth_states (
  state text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  device text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists idx_oauth_states_expires on cgm_oauth_states (expires_at);
alter table cgm_oauth_states enable row level security;
create policy "No client access to oauth states" on cgm_oauth_states for all using (false) with check (false);

-- 6. Token encryption helper functions (pgcrypto)
-- Token encryption key lives in vault.encryption_key (Supabase managed) or app-level env.
-- These functions assume the caller passes the key. For app-level encryption, prefer doing it
-- in Node before insertion. We expose helpers for symmetric demonstration.
create or replace function encrypt_token(plain text, key text)
returns text language sql stable as $$
  select encode(
    encrypt(plain::bytea, key::bytea, 'aes-cbc/pad:pkcs'),
    'base64'
  );
$$;

create or replace function decrypt_token(encrypted text, key text)
returns text language sql stable as $$
  select convert_from(
    decrypt(decode(encrypted, 'base64'), key::bytea, 'aes-cbc/pad:pkcs'),
    'UTF8'
  );
$$;

-- 7. Cleanup function for expired OAuth states
create or replace function cleanup_expired_oauth_states() returns void language sql as $$
  delete from cgm_oauth_states where expires_at < now();
$$;
