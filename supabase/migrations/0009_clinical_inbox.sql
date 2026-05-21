-- ============================================================
-- diabetes.care — Sprint 9: Clinical inbox
-- ============================================================
-- Migration: 0009_clinical_inbox.sql
-- Adds:
--   * lab_values: reviewed_at, reviewed_by, review_action, review_note (lab review workflow)
--   * users: inbox_filter_default ("mine" vs "all")
--   * encounters: last_addended_at (helper for inbox)
--   * Materialized inbox counts view for fast dashboard loads
-- ============================================================

-- 1. Lab review workflow fields
alter table lab_values add column if not exists reviewed_at timestamptz;
alter table lab_values add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table lab_values add column if not exists review_action text check (review_action in ('acknowledged', 'flagged', 'escalated', 'no_action'));
alter table lab_values add column if not exists review_note text;

create index if not exists idx_lab_values_unreviewed on lab_values (organization_id, collected_at desc) where reviewed_at is null and deleted_at is null;
create index if not exists idx_lab_values_unreviewed_abnormal on lab_values (organization_id, collected_at desc) where reviewed_at is null and deleted_at is null and (
  (reference_low is not null and value < reference_low) or (reference_high is not null and value > reference_high)
);

-- 2. User-level inbox preferences
alter table users add column if not exists inbox_filter_default text not null default 'mine' check (inbox_filter_default in ('mine', 'all'));
alter table users add column if not exists inbox_layout text not null default 'sections' check (inbox_layout in ('sections', 'unified'));

-- 3. Encounter helper: track last addendum/edit to encounter (for in-progress filter)
alter table encounters add column if not exists last_addended_at timestamptz;

-- 4. Inbox counts view (single query for dashboard tiles)
-- Computed per-org, scoped via RLS at the parent table level
create or replace view v_inbox_counts as
select
  e.organization_id,
  -- Unsigned encounters
  (select count(*) from encounters
     where organization_id = e.organization_id
       and status in ('in_progress', 'pending_signature')
       and deleted_at is null) as unsigned_encounters,
  -- Unsigned encounters owned by current user (computed at query time, not in view)
  -- Unreviewed labs
  (select count(*) from lab_values
     where organization_id = e.organization_id
       and reviewed_at is null
       and deleted_at is null) as unreviewed_labs,
  -- Unreviewed abnormal labs (critical)
  (select count(*) from lab_values
     where organization_id = e.organization_id
       and reviewed_at is null
       and deleted_at is null
       and ((reference_low is not null and value < reference_low) or (reference_high is not null and value > reference_high))) as unreviewed_abnormal_labs,
  -- Unresolved CGM alerts
  (select count(*) from cgm_alerts
     where organization_id = e.organization_id
       and resolved_at is null) as unresolved_cgm_alerts,
  -- Critical CGM alerts
  (select count(*) from cgm_alerts
     where organization_id = e.organization_id
       and resolved_at is null
       and severity = 'critical') as critical_cgm_alerts,
  -- Ready scribe drafts
  (select count(*) from scribe_sessions
     where organization_id = e.organization_id
       and status = 'ready'
       and deleted_at is null) as ready_scribe_drafts,
  -- Today appointments
  (select count(*) from appointments
     where organization_id = e.organization_id
       and starts_at >= date_trunc('day', now())
       and starts_at < date_trunc('day', now()) + interval '1 day'
       and deleted_at is null
       and status not in ('cancelled', 'no_show')) as today_appointments,
  -- Patients arrived but not started
  (select count(*) from appointments
     where organization_id = e.organization_id
       and status = 'arrived'
       and starts_at >= date_trunc('day', now()) - interval '1 day'
       and deleted_at is null) as waiting_room_count
from (select distinct organization_id from organizations) e;

-- 5. Helper function for auto-flagging encounter status on edit
create or replace function update_encounter_addended() returns trigger language plpgsql as $$
begin
  if old.signed_at is not null and new.signed_at is not null and (
    old.subjective is distinct from new.subjective or
    old.objective is distinct from new.objective or
    old.assessment is distinct from new.assessment or
    old.plan is distinct from new.plan
  ) then
    new.last_addended_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_encounter_addended on encounters;
create trigger trg_encounter_addended before update on encounters for each row execute function update_encounter_addended();
