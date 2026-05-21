-- ============================================================
-- diabetes.care — Sprint 11: Reporting + analytics
-- ============================================================
-- Migration: 0011_reporting.sql
--
-- Strategy: thin views over existing tables. No materialized views yet
-- (pilot scale is fine with on-demand aggregation). Convert to mat views
-- if any single report exceeds 500ms.
--
-- Adds:
--   * v_visit_volume_weekly   — per-org weekly counts by status
--   * v_a1c_latest_per_patient — latest A1C per patient with band
--   * v_a1c_population_bands  — per-org distribution across A1C bands
--   * v_cgm_engagement        — per-org connection + sync stats
--   * v_lab_gap_a1c           — patients overdue for A1C
--   * v_lab_gap_kidney        — patients missing eGFR or urine_acr in last 12mo
--   * v_revenue_proxy_monthly — completed visits per month with CPT estimate
--
-- Permissions: views inherit RLS from underlying tables; users only see
-- their own org's rows via existing policies on patients/appointments/etc.
-- ============================================================

-- 1. Weekly visit volume by status
create or replace view v_visit_volume_weekly as
select
  organization_id,
  date_trunc('week', starts_at)::date as week_start,
  count(*) filter (where status = 'completed') as completed,
  count(*) filter (where status = 'no_show') as no_show,
  count(*) filter (where status = 'cancelled') as cancelled,
  count(*) filter (where status not in ('completed', 'no_show', 'cancelled')) as other,
  count(*) as total
from appointments
where deleted_at is null
and starts_at >= now() - interval '12 months'
group by organization_id, date_trunc('week', starts_at);

-- 2. Visit volume by provider (last 90d)
create or replace view v_visit_volume_by_provider as
select
  a.organization_id,
  a.provider_id,
  u.full_name as provider_name,
  count(*) filter (where a.status = 'completed') as completed,
  count(*) filter (where a.status = 'no_show') as no_show,
  count(*) filter (where a.status = 'cancelled') as cancelled,
  count(*) as total,
  round(
    100.0 * count(*) filter (where a.status = 'no_show') / nullif(count(*) filter (where a.status in ('completed', 'no_show')), 0),
    1
  ) as no_show_rate_pct
from appointments a
left join users u on u.id = a.provider_id
where a.deleted_at is null
and a.starts_at >= now() - interval '90 days'
and a.starts_at < now()
group by a.organization_id, a.provider_id, u.full_name;

-- 3. Latest A1C per patient + computed band
create or replace view v_a1c_latest_per_patient as
with ranked as (
  select
    organization_id, patient_id, value, collected_at,
    row_number() over (partition by patient_id order by collected_at desc) as rn
  from lab_values
  where test_name = 'a1c' and deleted_at is null
)
select
  organization_id,
  patient_id,
  value as a1c_value,
  collected_at as a1c_date,
  case
    when value < 5.7 then 'normal'
    when value < 7.0 then 'at_goal'
    when value < 8.0 then 'borderline'
    when value < 9.0 then 'high'
    else 'very_high'
  end as a1c_band
from ranked where rn = 1;

-- 4. A1C band distribution per org
create or replace view v_a1c_population_bands as
select
  l.organization_id,
  count(*) as patients_with_a1c,
  count(*) filter (where a1c_band = 'normal') as band_normal,
  count(*) filter (where a1c_band = 'at_goal') as band_at_goal,
  count(*) filter (where a1c_band = 'borderline') as band_borderline,
  count(*) filter (where a1c_band = 'high') as band_high,
  count(*) filter (where a1c_band = 'very_high') as band_very_high,
  round(avg(a1c_value)::numeric, 2) as mean_a1c,
  round(percentile_cont(0.5) within group (order by a1c_value)::numeric, 2) as median_a1c
from v_a1c_latest_per_patient l
group by l.organization_id;

-- 5. CGM engagement
create or replace view v_cgm_engagement as
select
  p.organization_id,
  count(distinct p.id) as total_patients,
  count(distinct c.patient_id) filter (where c.is_active = true and c.deleted_at is null) as patients_with_cgm,
  count(distinct c.patient_id) filter (where c.is_active = true and c.last_synced_at > now() - interval '24 hours') as syncing_24h,
  count(distinct c.patient_id) filter (where c.is_active = true and c.last_synced_at > now() - interval '7 days') as syncing_7d,
  count(distinct c.patient_id) filter (where c.is_active = true and (c.last_synced_at is null or c.last_synced_at < now() - interval '7 days')) as stale_connections
from patients p
left join cgm_connections c on c.patient_id = p.id
where p.deleted_at is null and p.is_active = true
group by p.organization_id;

-- 6. Lab gap: A1C overdue (>3mo for high-risk patients, >6mo for all)
create or replace view v_lab_gap_a1c as
select
  p.organization_id,
  p.id as patient_id,
  p.first_name, p.last_name, p.mrn,
  p.diabetes_type,
  p.primary_provider_id,
  l.a1c_value as last_a1c,
  l.a1c_date as last_a1c_date,
  l.a1c_band as last_a1c_band,
  case
    when l.a1c_date is null then 'never'
    when l.a1c_band in ('high', 'very_high') and l.a1c_date < now() - interval '3 months' then 'overdue_high_risk'
    when l.a1c_date < now() - interval '6 months' then 'overdue'
    else 'current'
  end as gap_status,
  case
    when l.a1c_date is null then extract(day from now() - p.created_at)::int
    else extract(day from now() - l.a1c_date)::int
  end as days_since_last
from patients p
left join v_a1c_latest_per_patient l on l.patient_id = p.id
where p.deleted_at is null and p.is_active = true
and p.diabetes_type in ('type_1', 'type_2', 'lada', 'mody');

-- 7. Lab gap: kidney monitoring (eGFR + urine ACR yearly per ADA)
create or replace view v_lab_gap_kidney as
with recent_egfr as (
  select patient_id, max(collected_at) as last_date
  from lab_values
  where test_name = 'egfr' and deleted_at is null
  group by patient_id
),
recent_acr as (
  select patient_id, max(collected_at) as last_date
  from lab_values
  where test_name = 'urine_acr' and deleted_at is null
  group by patient_id
)
select
  p.organization_id,
  p.id as patient_id,
  p.first_name, p.last_name, p.mrn,
  p.diabetes_type,
  e.last_date as last_egfr_date,
  a.last_date as last_acr_date,
  (e.last_date is null or e.last_date < now() - interval '12 months') as egfr_overdue,
  (a.last_date is null or a.last_date < now() - interval '12 months') as acr_overdue
from patients p
left join recent_egfr e on e.patient_id = p.id
left join recent_acr a on a.patient_id = p.id
where p.deleted_at is null and p.is_active = true
and p.diabetes_type in ('type_1', 'type_2', 'lada', 'mody');

-- 8. Revenue proxy: completed visits per month with rough CPT estimate
-- Pilot estimates per encounter_type (USD, rough national avg before payer mix)
--   follow_up         → $108  (99213)
--   new_patient       → $180  (99204)
--   cgm_review        → $108  (99213 + 95251 not counted)
--   glp1_initiation   → $135  (99213.5)
--   urgent            → $135
--   telehealth        → $108
--   lab_review        → $80
--   other             → $108
create or replace view v_revenue_proxy_monthly as
select
  organization_id,
  date_trunc('month', starts_at)::date as month_start,
  count(*) as completed_visits,
  sum(case appointment_type
    when 'new_patient'     then 180
    when 'follow_up'       then 108
    when 'cgm_review'      then 108
    when 'glp1_initiation' then 135
    when 'urgent'          then 135
    when 'telehealth'      then 108
    when 'lab_review'      then 80
    else 108
  end)::numeric as estimated_revenue_usd
from appointments
where deleted_at is null
and status = 'completed'
and starts_at >= now() - interval '12 months'
group by organization_id, date_trunc('month', starts_at);
