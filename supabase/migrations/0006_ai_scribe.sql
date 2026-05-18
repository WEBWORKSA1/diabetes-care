-- ============================================================
-- diabetes.care — Sprint 6: AI Scribe
-- ============================================================
-- Migration: 0006_ai_scribe.sql
-- Adds:
--   * scribe_sessions — audio recording + transcription state
--   * scribe_drafts — generated SOAP drafts with source links
--   * scribe_audit — every accept/reject/edit decision logged
--   * organizations.scribe_llm_preference
--   * organizations.audio_retention_days
-- ============================================================

-- 1. Per-org scribe configuration
alter table organizations add column if not exists scribe_llm_preference text not null default 'claude' check (scribe_llm_preference in ('claude', 'gpt4o'));
alter table organizations add column if not exists audio_retention_days int not null default 30 check (audio_retention_days between 1 and 90);
alter table organizations add column if not exists scribe_enabled boolean not null default true;

-- 2. Scribe sessions — one row per recording
do $$ begin
  create type scribe_status as enum (
    'recording', 'uploading', 'uploaded',
    'transcribing', 'transcribed', 'transcription_failed',
    'generating', 'ready', 'generation_failed',
    'accepted', 'rejected', 'expired'
  );
exception when duplicate_object then null; end $$;

create table if not exists scribe_sessions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  provider_id uuid not null references users(id) on delete restrict,
  encounter_id uuid references encounters(id) on delete set null,

  status scribe_status not null default 'recording',
  duration_seconds numeric,

  -- Storage references
  audio_storage_path text, -- supabase storage key, e.g. 'org-uuid/session-uuid.webm'
  audio_mime_type text,
  audio_bytes int,

  -- Transcription
  transcript_text text,
  transcript_segments jsonb, -- [{ start: 0.0, end: 4.2, text: '...', confidence: 0.94 }, ...]
  transcription_model text, -- 'whisper-1' etc.
  transcription_completed_at timestamptz,
  transcription_error text,

  -- Audit
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_scribe_sessions_patient on scribe_sessions (patient_id, started_at desc) where deleted_at is null;
create index if not exists idx_scribe_sessions_org_status on scribe_sessions (organization_id, status, started_at desc) where deleted_at is null;
create index if not exists idx_scribe_sessions_expires on scribe_sessions (expires_at) where deleted_at is null and status not in ('accepted', 'rejected');
create index if not exists idx_scribe_sessions_provider on scribe_sessions (provider_id, started_at desc) where deleted_at is null;

alter table scribe_sessions enable row level security;

create policy "View scribe sessions in same org" on scribe_sessions for select using (organization_id = auth.organization_id());
create policy "Insert scribe sessions in same org" on scribe_sessions for insert with check (organization_id = auth.organization_id() and created_by = auth.uid());
create policy "Update own scribe sessions" on scribe_sessions for update using (organization_id = auth.organization_id() and (provider_id = auth.uid() or auth.has_role('owner')));
create policy "Soft delete own scribe sessions" on scribe_sessions for delete using (organization_id = auth.organization_id() and (created_by = auth.uid() or auth.has_role('owner')));

create trigger trg_scribe_sessions_updated before update on scribe_sessions for each row execute function set_updated_at();

-- 3. Generated SOAP drafts (one session can have multiple drafts — e.g. re-run with different LLM)
do $$ begin
  create type scribe_llm as enum ('claude', 'gpt4o');
exception when duplicate_object then null; end $$;

create table if not exists scribe_drafts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references scribe_sessions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,

  llm scribe_llm not null,
  model_version text, -- 'claude-opus-4-7', 'gpt-4o-2024-11-20' etc.
  prompt_version text not null default 'v1',

  -- Structured SOAP output — same shape as encounters table for direct copy
  -- Each section's content array has items with: { text, source_segments: [seg_idx], confidence }
  chief_complaint jsonb, -- { text, source_segments, confidence }
  subjective jsonb,      -- { sections: [{ id, label, content, source_segments, confidence }] }
  objective jsonb,
  assessment jsonb,
  plan jsonb,

  -- Aggregate scores
  overall_confidence numeric check (overall_confidence between 0 and 1),
  low_confidence_section_count int default 0,
  guardrail_flags jsonb default '[]'::jsonb, -- ['dose_quoted', 'symptom_explicit', ...]

  -- LLM metrics
  input_tokens int,
  output_tokens int,
  cost_cents numeric,
  generation_latency_ms int,

  generated_at timestamptz not null default now(),
  generation_error text
);

create index if not exists idx_scribe_drafts_session on scribe_drafts (session_id, generated_at desc);
alter table scribe_drafts enable row level security;
create policy "View drafts in same org" on scribe_drafts for select using (organization_id = auth.organization_id());
create policy "No client insert drafts" on scribe_drafts for insert with check (false);

-- 4. Audit log of every accept/reject/edit decision on draft content
do $$ begin
  create type scribe_action as enum ('accept', 'reject', 'edit', 'regenerate', 'view_audio');
exception when duplicate_object then null; end $$;

create table if not exists scribe_audit (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references scribe_sessions(id) on delete cascade,
  draft_id uuid references scribe_drafts(id) on delete set null,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,

  action scribe_action not null,
  section text, -- 'subjective.interval_history', 'plan.medications', etc.
  original_text text,
  edited_text text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scribe_audit_session on scribe_audit (session_id, created_at);
create index if not exists idx_scribe_audit_org on scribe_audit (organization_id, created_at desc);
alter table scribe_audit enable row level security;
create policy "View audit in same org" on scribe_audit for select using (organization_id = auth.organization_id());
create policy "Insert audit in same org" on scribe_audit for insert with check (organization_id = auth.organization_id() and user_id = auth.uid());

-- 5. Audio purge function (called by cron)
create or replace function purge_expired_scribe_audio() returns int language plpgsql as $$
declare
  purged_count int := 0;
begin
  -- Mark expired sessions; actual storage object deletion happens in app code
  update scribe_sessions
  set status = 'expired',
      audio_storage_path = null,
      updated_at = now()
  where deleted_at is null
    and status not in ('expired')
    and audio_storage_path is not null
    and expires_at < now();
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

-- 6. Storage bucket for scribe audio (run separately in Supabase dashboard if not exists)
-- This is here as documentation — actual bucket creation is done via Supabase API or dashboard:
--
--   bucket name: 'scribe-audio'
--   public: false
--   file size limit: 200MB
--   allowed mime types: audio/webm, audio/mp4, audio/mpeg, audio/wav, audio/ogg
--
-- RLS policy on storage.objects for this bucket:
--   - SELECT: org members can read paths starting with their org_id
--   - INSERT: authenticated users can write to paths starting with their org_id
--   - DELETE: service role only (worker purges)
