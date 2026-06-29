-- v24.0 Assurance, SoD, immutable audit log and auditor evidence pack
-- Add-only schema contract for external-review-ready assurance evidence.
-- Live access remains blocked pending reviewed org-scoped policies or Edge bridges.

create table if not exists public.v240_sod_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  rule_code text not null,
  title text not null,
  restricted_combination text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  enforcement_rule text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v240_sod_violations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  sod_rule_id uuid references public.v240_sod_rules(id) on delete set null,
  subject_type text not null,
  subject_id uuid,
  conflicting_user_id uuid,
  violation_status text not null default 'open' check (violation_status in ('open', 'reviewing', 'waived', 'remediated', 'false_positive')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  reviewer_id uuid,
  remediation_note text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.v240_immutable_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  source_table text not null,
  source_record_id uuid,
  action_type text not null check (action_type in ('insert', 'update', 'delete', 'approve', 'reject', 'export', 'login', 'policy_change')),
  actor_user_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  evidence_hash text,
  correlation_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.v240_evidence_integrity_index (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  evidence_id uuid,
  source_module text not null,
  linked_item_type text not null,
  linked_item_id uuid,
  file_name text,
  file_hash text,
  review_status text not null default 'review_required' check (review_status in ('indexed', 'missing_hash', 'stale', 'rejected', 'review_required')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  auditor_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v240_auditor_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  workspace_name text not null,
  framework_code text not null,
  access_mode text not null default 'read_only' check (access_mode in ('read_only', 'export_only', 'restricted', 'not_enabled')),
  scope_description text,
  owner_user_id uuid,
  status text not null default 'review_required' check (status in ('ready', 'review_required', 'blocked', 'monitoring', 'evidence_required')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v240_auditor_export_manifests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  auditor_workspace_id uuid references public.v240_auditor_workspaces(id) on delete cascade,
  export_title text not null,
  framework_code text not null,
  included_records jsonb not null default '[]'::jsonb,
  exported_by uuid,
  export_reason text,
  export_hash text,
  exported_at timestamptz not null default now()
);

create index if not exists idx_v240_sod_rules_org_active on public.v240_sod_rules(organization_id, is_active);
create index if not exists idx_v240_sod_violations_org_status on public.v240_sod_violations(organization_id, violation_status);
create index if not exists idx_v240_immutable_audit_events_org_record on public.v240_immutable_audit_events(organization_id, source_table, source_record_id);
create index if not exists idx_v240_evidence_integrity_org_status on public.v240_evidence_integrity_index(organization_id, review_status);
create index if not exists idx_v240_auditor_workspaces_org_framework on public.v240_auditor_workspaces(organization_id, framework_code);
create index if not exists idx_v240_auditor_export_manifests_workspace on public.v240_auditor_export_manifests(auditor_workspace_id);

alter table public.v240_sod_rules enable row level security;
alter table public.v240_sod_violations enable row level security;
alter table public.v240_immutable_audit_events enable row level security;
alter table public.v240_evidence_integrity_index enable row level security;
alter table public.v240_auditor_workspaces enable row level security;
alter table public.v240_auditor_export_manifests enable row level security;

-- Deny-by-default policies keep live access blocked until reviewed org-scoped policies or Edge bridges are added.
create policy "v240_sod_rules authenticated select blocked pending bridge"
  on public.v240_sod_rules for select to authenticated using (false);
create policy "v240_sod_rules authenticated insert blocked pending bridge"
  on public.v240_sod_rules for insert to authenticated with check (false);
create policy "v240_sod_rules authenticated update blocked pending bridge"
  on public.v240_sod_rules for update to authenticated using (false) with check (false);

create policy "v240_sod_violations authenticated select blocked pending bridge"
  on public.v240_sod_violations for select to authenticated using (false);
create policy "v240_sod_violations authenticated insert blocked pending bridge"
  on public.v240_sod_violations for insert to authenticated with check (false);
create policy "v240_sod_violations authenticated update blocked pending bridge"
  on public.v240_sod_violations for update to authenticated using (false) with check (false);

create policy "v240_immutable_audit_events authenticated select blocked pending bridge"
  on public.v240_immutable_audit_events for select to authenticated using (false);
create policy "v240_immutable_audit_events authenticated insert blocked pending bridge"
  on public.v240_immutable_audit_events for insert to authenticated with check (false);
create policy "v240_immutable_audit_events authenticated update blocked pending bridge"
  on public.v240_immutable_audit_events for update to authenticated using (false) with check (false);

create policy "v240_evidence_integrity_index authenticated select blocked pending bridge"
  on public.v240_evidence_integrity_index for select to authenticated using (false);
create policy "v240_evidence_integrity_index authenticated insert blocked pending bridge"
  on public.v240_evidence_integrity_index for insert to authenticated with check (false);
create policy "v240_evidence_integrity_index authenticated update blocked pending bridge"
  on public.v240_evidence_integrity_index for update to authenticated using (false) with check (false);

create policy "v240_auditor_workspaces authenticated select blocked pending bridge"
  on public.v240_auditor_workspaces for select to authenticated using (false);
create policy "v240_auditor_workspaces authenticated insert blocked pending bridge"
  on public.v240_auditor_workspaces for insert to authenticated with check (false);
create policy "v240_auditor_workspaces authenticated update blocked pending bridge"
  on public.v240_auditor_workspaces for update to authenticated using (false) with check (false);

create policy "v240_auditor_export_manifests authenticated select blocked pending bridge"
  on public.v240_auditor_export_manifests for select to authenticated using (false);
create policy "v240_auditor_export_manifests authenticated insert blocked pending bridge"
  on public.v240_auditor_export_manifests for insert to authenticated with check (false);
create policy "v240_auditor_export_manifests authenticated update blocked pending bridge"
  on public.v240_auditor_export_manifests for update to authenticated using (false) with check (false);
