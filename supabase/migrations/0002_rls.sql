-- ============================================================
-- diabetes.care — Row Level Security
-- ============================================================
-- Migration: 0002_rls.sql
-- HIPAA: every PHI table MUST have RLS enabled
-- Pattern: users can only see rows where organization_id = their org
-- ============================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table patients enable row level security;
alter table encounters enable row level security;
alter table lab_values enable row level security;
alter table medications enable row level security;
alter table cgm_connections enable row level security;
alter table cgm_readings enable row level security;
alter table appointments enable row level security;
alter table audit_logs enable row level security;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create policy "Users can view their own organization"
on organizations for select
using (id = auth.organization_id());

create policy "Owners can update their organization"
on organizations for update
using (id = auth.organization_id() and auth.has_role('owner'));

-- ============================================================
-- USERS
-- ============================================================

create policy "Users can view colleagues in same org"
on users for select
using (organization_id = auth.organization_id());

create policy "Users can update their own profile"
on users for update
using (id = auth.uid());

create policy "Owners can manage users in their org"
on users for all
using (organization_id = auth.organization_id() and auth.has_role('owner'));

-- ============================================================
-- PATIENTS
-- ============================================================

create policy "View patients in same org"
on patients for select
using (organization_id = auth.organization_id());

create policy "Insert patients in own org"
on patients for insert
with check (organization_id = auth.organization_id());

create policy "Update patients in own org"
on patients for update
using (organization_id = auth.organization_id());

create policy "No hard delete of patients"
on patients for delete
using (false);

-- ============================================================
-- ENCOUNTERS
-- ============================================================

create policy "View encounters in same org"
on encounters for select
using (organization_id = auth.organization_id());

create policy "Insert encounters in own org"
on encounters for insert
with check (organization_id = auth.organization_id() and provider_id = auth.uid());

create policy "Update own encounters"
on encounters for update
using (
  organization_id = auth.organization_id()
  and (provider_id = auth.uid() or auth.has_role('owner'))
);

-- ============================================================
-- LAB VALUES
-- ============================================================

create policy "View labs in same org"
on lab_values for select
using (organization_id = auth.organization_id());

create policy "Insert labs in own org"
on lab_values for insert
with check (organization_id = auth.organization_id());

create policy "Update labs in own org"
on lab_values for update
using (organization_id = auth.organization_id());

-- ============================================================
-- MEDICATIONS
-- ============================================================

create policy "View meds in same org"
on medications for select
using (organization_id = auth.organization_id());

create policy "Insert meds in own org"
on medications for insert
with check (organization_id = auth.organization_id());

create policy "Update meds in own org"
on medications for update
using (organization_id = auth.organization_id());

-- ============================================================
-- CGM
-- ============================================================

create policy "View CGM connections in same org"
on cgm_connections for select
using (organization_id = auth.organization_id());

create policy "Manage CGM connections in own org"
on cgm_connections for all
using (organization_id = auth.organization_id())
with check (organization_id = auth.organization_id());

create policy "View CGM readings in same org"
on cgm_readings for select
using (organization_id = auth.organization_id());

create policy "No client-side insert of CGM readings"
on cgm_readings for insert
with check (false);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

create policy "View appointments in same org"
on appointments for select
using (organization_id = auth.organization_id());

create policy "Manage appointments in own org"
on appointments for all
using (organization_id = auth.organization_id())
with check (organization_id = auth.organization_id());

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create policy "View audit logs for own org"
on audit_logs for select
using (organization_id = auth.organization_id() and auth.has_role('owner'));

create policy "No client-side audit log inserts"
on audit_logs for insert
with check (false);

create policy "No updates to audit logs"
on audit_logs for update
using (false);

create policy "No deletes of audit logs"
on audit_logs for delete
using (false);
