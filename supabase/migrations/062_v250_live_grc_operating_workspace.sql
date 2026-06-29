-- v25.0 Live GRC operating workspace
-- Add-only schema contract for moving from static professional proof to controlled live operation.
-- Direct authenticated access remains blocked pending reviewed org-scoped policies or Edge bridges.

create table if not exists public.v250_operating_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  cycle_code text not null,
  title text not null,
  cadence text not null,
  owner_role text not null,
  readiness_status text not null default 'review_required' check (readiness_status in ('ready', 'monitoring', 'evidence_required', 'blocked', 'review_required')),
  evidence_gate text not null,
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v250_data_intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  source_system text not null,
  target_module text not null,
  intake_reason text not null,
  data_classification text not null default 'internal' check (data_classification in ('public', 'internal', 'confidential', 'restricted')),
  approval_status text not null default 'review_required' check (approval_status in ('approved', 'rejected', 'review_required', 'blocked', 'monitoring')),
  reviewer_user_id uuid,
  evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v250_live_bridge_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  bridge_code text not null,
  source_table text not null,
  target_table text not null,
  bridge_type text not null default 'edge_function' check (bridge_type in ('edge_function', 'org_scoped_policy', 'read_only_view', 'manual_import', 'not_enabled')),
  security_review_status text not null default 'review_required' check (security_review_status in ('approved', 'monitoring', 'evidence_required', 'blocked', 'review_required')),
  reviewer_user_id uuid,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v250_access_review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  role_name text not null,
  subject_user_id uuid,
  access_scope text not null,
  sod_rule_summary text not null,
  review_status text not null default 'review_required' check (review_status in ('approved', 'waived', 'remediation_required', 'blocked', 'review_required')),
  reviewer_user_id uuid,
  evidence_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v250_framework_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  framework_code text not null,
  snapshot_title text not null,
  coverage_summary jsonb not null default '{}'::jsonb,
  included_evidence jsonb not null default '[]'::jsonb,
  generated_by uuid,
  snapshot_status text not null default 'review_required' check (snapshot_status in ('ready', 'monitoring', 'evidence_required', 'blocked', 'review_required')),
  generated_at timestamptz not null default now()
);

create table if not exists public.v250_production_exception_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  exception_code text not null,
  exception_type text not null check (exception_type in ('security', 'data_quality', 'access_review', 'evidence_gap', 'control_gap', 'uat_gap')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  owner_user_id uuid,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'reviewing', 'accepted_risk', 'remediated', 'closed')),
  evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_v250_operating_cycles_org_status on public.v250_operating_cycles(organization_id, readiness_status);
create index if not exists idx_v250_data_intake_org_status on public.v250_data_intake_requests(organization_id, approval_status);
create index if not exists idx_v250_live_bridge_org_status on public.v250_live_bridge_registry(organization_id, security_review_status);
create index if not exists idx_v250_access_review_org_status on public.v250_access_review_items(organization_id, review_status);
create index if not exists idx_v250_framework_snapshots_org_framework on public.v250_framework_evidence_snapshots(organization_id, framework_code);
create index if not exists idx_v250_production_exceptions_org_status on public.v250_production_exception_register(organization_id, status);

alter table public.v250_operating_cycles enable row level security;
alter table public.v250_data_intake_requests enable row level security;
alter table public.v250_live_bridge_registry enable row level security;
alter table public.v250_access_review_items enable row level security;
alter table public.v250_framework_evidence_snapshots enable row level security;
alter table public.v250_production_exception_register enable row level security;

drop policy if exists "v250_operating_cycles authenticated select blocked pending bridge" on public.v250_operating_cycles;
create policy "v250_operating_cycles authenticated select blocked pending bridge"
  on public.v250_operating_cycles for select to authenticated using (false);
drop policy if exists "v250_operating_cycles authenticated insert blocked pending bridge" on public.v250_operating_cycles;
create policy "v250_operating_cycles authenticated insert blocked pending bridge"
  on public.v250_operating_cycles for insert to authenticated with check (false);
drop policy if exists "v250_operating_cycles authenticated update blocked pending bridge" on public.v250_operating_cycles;
create policy "v250_operating_cycles authenticated update blocked pending bridge"
  on public.v250_operating_cycles for update to authenticated using (false) with check (false);

drop policy if exists "v250_data_intake_requests authenticated select blocked pending bridge" on public.v250_data_intake_requests;
create policy "v250_data_intake_requests authenticated select blocked pending bridge"
  on public.v250_data_intake_requests for select to authenticated using (false);
drop policy if exists "v250_data_intake_requests authenticated insert blocked pending bridge" on public.v250_data_intake_requests;
create policy "v250_data_intake_requests authenticated insert blocked pending bridge"
  on public.v250_data_intake_requests for insert to authenticated with check (false);
drop policy if exists "v250_data_intake_requests authenticated update blocked pending bridge" on public.v250_data_intake_requests;
create policy "v250_data_intake_requests authenticated update blocked pending bridge"
  on public.v250_data_intake_requests for update to authenticated using (false) with check (false);

drop policy if exists "v250_live_bridge_registry authenticated select blocked pending bridge" on public.v250_live_bridge_registry;
create policy "v250_live_bridge_registry authenticated select blocked pending bridge"
  on public.v250_live_bridge_registry for select to authenticated using (false);
drop policy if exists "v250_live_bridge_registry authenticated insert blocked pending bridge" on public.v250_live_bridge_registry;
create policy "v250_live_bridge_registry authenticated insert blocked pending bridge"
  on public.v250_live_bridge_registry for insert to authenticated with check (false);
drop policy if exists "v250_live_bridge_registry authenticated update blocked pending bridge" on public.v250_live_bridge_registry;
create policy "v250_live_bridge_registry authenticated update blocked pending bridge"
  on public.v250_live_bridge_registry for update to authenticated using (false) with check (false);

drop policy if exists "v250_access_review_items authenticated select blocked pending bridge" on public.v250_access_review_items;
create policy "v250_access_review_items authenticated select blocked pending bridge"
  on public.v250_access_review_items for select to authenticated using (false);
drop policy if exists "v250_access_review_items authenticated insert blocked pending bridge" on public.v250_access_review_items;
create policy "v250_access_review_items authenticated insert blocked pending bridge"
  on public.v250_access_review_items for insert to authenticated with check (false);
drop policy if exists "v250_access_review_items authenticated update blocked pending bridge" on public.v250_access_review_items;
create policy "v250_access_review_items authenticated update blocked pending bridge"
  on public.v250_access_review_items for update to authenticated using (false) with check (false);

drop policy if exists "v250_framework_evidence_snapshots authenticated select blocked pending bridge" on public.v250_framework_evidence_snapshots;
create policy "v250_framework_evidence_snapshots authenticated select blocked pending bridge"
  on public.v250_framework_evidence_snapshots for select to authenticated using (false);
drop policy if exists "v250_framework_evidence_snapshots authenticated insert blocked pending bridge" on public.v250_framework_evidence_snapshots;
create policy "v250_framework_evidence_snapshots authenticated insert blocked pending bridge"
  on public.v250_framework_evidence_snapshots for insert to authenticated with check (false);
drop policy if exists "v250_framework_evidence_snapshots authenticated update blocked pending bridge" on public.v250_framework_evidence_snapshots;
create policy "v250_framework_evidence_snapshots authenticated update blocked pending bridge"
  on public.v250_framework_evidence_snapshots for update to authenticated using (false) with check (false);

drop policy if exists "v250_production_exception_register authenticated select blocked pending bridge" on public.v250_production_exception_register;
create policy "v250_production_exception_register authenticated select blocked pending bridge"
  on public.v250_production_exception_register for select to authenticated using (false);
drop policy if exists "v250_production_exception_register authenticated insert blocked pending bridge" on public.v250_production_exception_register;
create policy "v250_production_exception_register authenticated insert blocked pending bridge"
  on public.v250_production_exception_register for insert to authenticated with check (false);
drop policy if exists "v250_production_exception_register authenticated update blocked pending bridge" on public.v250_production_exception_register;
create policy "v250_production_exception_register authenticated update blocked pending bridge"
  on public.v250_production_exception_register for update to authenticated using (false) with check (false);
