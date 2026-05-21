-- ============================================================
-- diabetes.care — Sprint 12: Compliance tracking
-- ============================================================
-- Migration: 0012_compliance.sql
-- Adds:
--   * compliance_items: per-org checklist of HIPAA tasks
--   * baa_log: signed Business Associate Agreement tracking
-- ============================================================

create table if not exists compliance_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category text not null check (category in ('administrative', 'physical', 'technical', 'baa', 'training', 'breach_plan', 'risk_assessment')),
  item_key text not null,
  label text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete', 'na')),
  completed_at timestamptz,
  completed_by uuid references users(id) on delete set null,
  notes text,
  evidence_url text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, item_key)
);

create index if not exists idx_compliance_org_cat on compliance_items (organization_id, category);
alter table compliance_items enable row level security;
create policy "View compliance in same org" on compliance_items for select using (organization_id = auth.organization_id());
create policy "Manage compliance in same org" on compliance_items for all using (organization_id = auth.organization_id()) with check (organization_id = auth.organization_id());
create trigger trg_compliance_updated before update on compliance_items for each row execute function set_updated_at();

create table if not exists baa_log (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vendor_name text not null,
  category text not null check (category in ('cloud_infra', 'ai_inference', 'sms', 'email', 'cgm', 'storage', 'analytics', 'other')),
  status text not null default 'pending' check (status in ('pending', 'requested', 'signed', 'not_required', 'declined')),
  signed_at date,
  effective_until date,
  contact_email text,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_baa_org on baa_log (organization_id, status);
alter table baa_log enable row level security;
create policy "View BAAs in same org" on baa_log for select using (organization_id = auth.organization_id());
create policy "Manage BAAs in same org" on baa_log for all using (organization_id = auth.organization_id()) with check (organization_id = auth.organization_id());
create trigger trg_baa_updated before update on baa_log for each row execute function set_updated_at();
