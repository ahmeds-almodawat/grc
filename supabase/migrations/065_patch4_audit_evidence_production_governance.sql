-- Patch 4: Audit, Evidence Integrity, and Production Governance
-- Purpose: complete professional audit workbench, immutable evidence integrity, external auditor workspace, and go-live gates.
-- This migration creates operating tables only; do not mark production ready without real signed evidence and approval.

create extension if not exists pgcrypto;

create table if not exists public.patch4_audit_universe (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  universe_code text not null,
  auditable_entity text not null,
  entity_type text not null default 'process'
    check (entity_type in ('process', 'department', 'system', 'vendor', 'regulation', 'project', 'clinical_area', 'other')),
  inherent_risk text not null default 'medium'
    check (inherent_risk in ('critical', 'high', 'medium', 'low')),
  last_audit_date date,
  next_audit_due_date date,
  owner_id uuid,
  owner_name text,
  universe_status text not null default 'active'
    check (universe_status in ('active', 'retired', 'under_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, universe_code)
);

create table if not exists public.patch4_audit_annual_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  plan_year integer not null,
  plan_name text not null,
  plan_status text not null default 'draft'
    check (plan_status in ('draft', 'submitted', 'approved', 'in_progress', 'closed')),
  risk_based_methodology text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plan_year, plan_name)
);

create table if not exists public.patch4_audit_engagements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  annual_plan_id uuid references public.patch4_audit_annual_plans(id) on delete set null,
  universe_id uuid references public.patch4_audit_universe(id) on delete set null,
  engagement_code text not null,
  title text not null,
  engagement_type text not null default 'assurance'
    check (engagement_type in ('assurance', 'consulting', 'follow_up', 'investigation', 'mock_survey')),
  scope_summary text,
  criteria_summary text,
  lead_auditor_id uuid,
  lead_auditor_name text,
  engagement_status text not null default 'planned'
    check (engagement_status in ('planned', 'fieldwork', 'reporting', 'management_response', 'follow_up', 'closed', 'cancelled')),
  start_date date,
  target_report_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_code)
);

create table if not exists public.patch4_audit_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.patch4_audit_engagements(id) on delete cascade,
  criteria_code text not null,
  criteria_type text not null default 'policy'
    check (criteria_type in ('policy', 'procedure', 'standard', 'regulation', 'contract', 'control', 'accreditation_requirement')),
  criteria_reference text not null,
  criteria_description text,
  created_at timestamptz not null default now(),
  unique (engagement_id, criteria_code)
);

create table if not exists public.patch4_audit_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.patch4_audit_engagements(id) on delete cascade,
  procedure_code text not null,
  objective text not null,
  procedure_description text not null,
  sampling_approach text,
  procedure_status text not null default 'not_started'
    check (procedure_status in ('not_started', 'in_progress', 'completed', 'not_applicable')),
  prepared_by uuid,
  reviewed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, procedure_code)
);

create table if not exists public.patch4_audit_workpapers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.patch4_audit_engagements(id) on delete cascade,
  procedure_id uuid references public.patch4_audit_procedures(id) on delete set null,
  workpaper_code text not null,
  title text not null,
  conclusion text,
  prepared_by uuid,
  reviewed_by uuid,
  review_status text not null default 'prepared'
    check (review_status in ('prepared', 'reviewed', 'needs_revision', 'approved')),
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, workpaper_code)
);

create table if not exists public.patch4_audit_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid references public.patch4_audit_engagements(id) on delete cascade,
  request_code text not null,
  requested_from_id uuid,
  requested_from_name text,
  evidence_title text not null,
  evidence_description text,
  due_date date,
  request_status text not null default 'requested'
    check (request_status in ('requested', 'submitted', 'accepted', 'rejected', 'cancelled', 'overdue')),
  submitted_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_code)
);

create table if not exists public.patch4_audit_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.patch4_audit_engagements(id) on delete cascade,
  finding_code text not null,
  title text not null,
  condition_text text not null,
  criteria_text text,
  cause_text text,
  effect_text text,
  recommendation text,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  finding_status text not null default 'open'
    check (finding_status in ('draft', 'open', 'management_response', 'action_agreed', 'closed', 'accepted_risk')),
  owner_id uuid,
  owner_name text,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, finding_code)
);

create table if not exists public.patch4_audit_management_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  finding_id uuid not null references public.patch4_audit_findings(id) on delete cascade,
  response_text text not null,
  action_owner_id uuid,
  action_owner_name text,
  target_date date,
  response_status text not null default 'submitted'
    check (response_status in ('draft', 'submitted', 'accepted', 'rejected', 'revised')),
  submitted_by uuid,
  submitted_at timestamptz default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);

create table if not exists public.patch4_audit_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  finding_id uuid not null references public.patch4_audit_findings(id) on delete cascade,
  followup_round integer not null default 1,
  followup_status text not null default 'planned'
    check (followup_status in ('planned', 'in_progress', 'implemented', 'not_implemented', 'deferred', 'closed')),
  evidence_request_id uuid references public.patch4_audit_evidence_requests(id) on delete set null,
  followup_notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patch4_audit_qaip_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid references public.patch4_audit_engagements(id) on delete set null,
  qaip_code text not null,
  review_type text not null default 'engagement_quality'
    check (review_type in ('engagement_quality', 'annual_program', 'external_assessment_readiness')),
  review_status text not null default 'planned'
    check (review_status in ('planned', 'in_progress', 'completed', 'action_required')),
  rating text check (rating in ('conforms', 'partially_conforms', 'does_not_conform', 'not_rated')),
  reviewer_id uuid,
  reviewer_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, qaip_code)
);

create table if not exists public.patch4_evidence_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_type text not null,
  source_id uuid,
  evidence_code text not null,
  evidence_title text not null,
  version_no integer not null default 1,
  storage_path text,
  external_url text,
  file_hash text,
  version_status text not null default 'submitted'
    check (version_status in ('draft', 'submitted', 'accepted', 'rejected', 'expired', 'superseded')),
  submitted_by uuid,
  submitted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, evidence_code, version_no)
);

create table if not exists public.patch4_evidence_review_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_version_id uuid not null references public.patch4_evidence_versions(id) on delete cascade,
  decision text not null default 'pending'
    check (decision in ('pending', 'accepted', 'rejected', 'needs_revision')),
  decision_notes text,
  reviewer_id uuid,
  reviewer_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patch4_immutable_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_scope text not null,
  event_type text not null,
  source_type text not null,
  source_id uuid,
  actor_id uuid,
  actor_name text,
  event_payload jsonb not null default '{}'::jsonb,
  previous_event_hash text,
  event_hash text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, event_hash)
);

create table if not exists public.patch4_evidence_integrity_hashes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_version_id uuid not null references public.patch4_evidence_versions(id) on delete cascade,
  hash_algorithm text not null default 'sha256',
  content_hash text not null,
  previous_hash text,
  chain_hash text not null,
  verified_by uuid,
  verified_at timestamptz,
  integrity_status text not null default 'pending'
    check (integrity_status in ('pending', 'verified', 'failed', 'superseded')),
  created_at timestamptz not null default now(),
  unique (evidence_version_id, content_hash)
);

create table if not exists public.patch4_external_auditor_access_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  session_code text not null,
  auditor_name text not null,
  auditor_email text,
  access_scope text not null,
  access_status text not null default 'requested'
    check (access_status in ('requested', 'approved', 'active', 'expired', 'revoked')),
  readonly_only boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, session_code)
);

create table if not exists public.patch4_production_governance_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gate_code text not null,
  gate_name text not null,
  gate_area text not null default 'production_governance',
  is_critical boolean not null default true,
  gate_status text not null default 'not_started'
    check (gate_status in ('not_started', 'in_progress', 'evidence_submitted', 'approved', 'rejected', 'waived')),
  owner_id uuid,
  owner_name text,
  approved_by uuid,
  approved_at timestamptz,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists public.patch4_production_gate_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gate_id uuid not null references public.patch4_production_governance_gates(id) on delete cascade,
  evidence_version_id uuid references public.patch4_evidence_versions(id) on delete set null,
  evidence_title text not null,
  evidence_status text not null default 'missing'
    check (evidence_status in ('missing', 'requested', 'submitted', 'accepted', 'rejected')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patch4_production_governance_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  decision_code text not null,
  decision_title text not null,
  decision_status text not null default 'draft'
    check (decision_status in ('draft', 'submitted', 'approved', 'rejected', 'deferred')),
  decision_summary text,
  go_live_recommendation text not null default 'not_ready'
    check (go_live_recommendation in ('not_ready', 'conditional_go', 'go', 'no_go')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

create or replace function public.patch4_compute_event_hash(
  p_previous_hash text,
  p_event_payload jsonb,
  p_created_at timestamptz,
  p_actor_id uuid
)
returns text
language sql
stable
as $$
  select encode(
    digest(
      coalesce(p_previous_hash, '') || '|' ||
      coalesce(p_event_payload::text, '{}') || '|' ||
      coalesce(p_created_at at time zone 'UTC', timestamp 'epoch')::text || '|' ||
      coalesce(p_actor_id::text, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.patch4_set_immutable_event_hash()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at := now();
  end if;

  new.event_hash := public.patch4_compute_event_hash(
    new.previous_event_hash,
    new.event_payload,
    new.created_at,
    new.actor_id
  );

  return new;
end;
$$;

drop trigger if exists trg_patch4_immutable_event_hash on public.patch4_immutable_audit_events;
create trigger trg_patch4_immutable_event_hash
before insert on public.patch4_immutable_audit_events
for each row execute function public.patch4_set_immutable_event_hash();

create index if not exists idx_patch4_audit_engagements_org_status on public.patch4_audit_engagements(organization_id, engagement_status, target_report_date);
create index if not exists idx_patch4_audit_findings_org_status on public.patch4_audit_findings(organization_id, finding_status, severity, due_date);
create index if not exists idx_patch4_evidence_versions_org_status on public.patch4_evidence_versions(organization_id, version_status, submitted_at desc);
create index if not exists idx_patch4_immutable_events_org_source on public.patch4_immutable_audit_events(organization_id, source_type, source_id, created_at desc);
create index if not exists idx_patch4_gate_org_status on public.patch4_production_governance_gates(organization_id, gate_status, is_critical);

alter table public.patch4_audit_universe enable row level security;
alter table public.patch4_audit_annual_plans enable row level security;
alter table public.patch4_audit_engagements enable row level security;
alter table public.patch4_audit_criteria enable row level security;
alter table public.patch4_audit_procedures enable row level security;
alter table public.patch4_audit_workpapers enable row level security;
alter table public.patch4_audit_evidence_requests enable row level security;
alter table public.patch4_audit_findings enable row level security;
alter table public.patch4_audit_management_responses enable row level security;
alter table public.patch4_audit_followups enable row level security;
alter table public.patch4_audit_qaip_reviews enable row level security;
alter table public.patch4_evidence_versions enable row level security;
alter table public.patch4_evidence_review_decisions enable row level security;
alter table public.patch4_immutable_audit_events enable row level security;
alter table public.patch4_evidence_integrity_hashes enable row level security;
alter table public.patch4_external_auditor_access_sessions enable row level security;
alter table public.patch4_production_governance_gates enable row level security;
alter table public.patch4_production_gate_evidence enable row level security;
alter table public.patch4_production_governance_decisions enable row level security;

do $do$
declare
  table_name text;
  org_expr text := $sql$coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')$sql$;
begin
  foreach table_name in array array[
    'patch4_audit_universe',
    'patch4_audit_annual_plans',
    'patch4_audit_engagements',
    'patch4_audit_criteria',
    'patch4_audit_procedures',
    'patch4_audit_workpapers',
    'patch4_audit_evidence_requests',
    'patch4_audit_findings',
    'patch4_audit_management_responses',
    'patch4_audit_followups',
    'patch4_audit_qaip_reviews',
    'patch4_evidence_versions',
    'patch4_evidence_review_decisions',
    'patch4_evidence_integrity_hashes',
    'patch4_external_auditor_access_sessions',
    'patch4_production_governance_gates',
    'patch4_production_gate_evidence',
    'patch4_production_governance_decisions'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_org_read', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id::text = %s)', table_name || '_org_read', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id::text = %s)', table_name || '_org_insert', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id::text = %s) with check (organization_id::text = %s)', table_name || '_org_update', table_name, org_expr, org_expr);
end loop;
end $do$;

-- Explicit org-scoped read policies for static proof on sensitive Patch 4 tables.
-- The loop above creates full org-scoped read/insert/update policies; these make
-- the sensitive table controls visible to the repository static RLS audit.
drop policy if exists patch4_audit_annual_plans_static_read on public.patch4_audit_annual_plans;
create policy patch4_audit_annual_plans_static_read on public.patch4_audit_annual_plans
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_criteria_static_read on public.patch4_audit_criteria;
create policy patch4_audit_criteria_static_read on public.patch4_audit_criteria
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_engagements_static_read on public.patch4_audit_engagements;
create policy patch4_audit_engagements_static_read on public.patch4_audit_engagements
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_evidence_requests_static_read on public.patch4_audit_evidence_requests;
create policy patch4_audit_evidence_requests_static_read on public.patch4_audit_evidence_requests
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_findings_static_read on public.patch4_audit_findings;
create policy patch4_audit_findings_static_read on public.patch4_audit_findings
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_followups_static_read on public.patch4_audit_followups;
create policy patch4_audit_followups_static_read on public.patch4_audit_followups
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_management_responses_static_read on public.patch4_audit_management_responses;
create policy patch4_audit_management_responses_static_read on public.patch4_audit_management_responses
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_procedures_static_read on public.patch4_audit_procedures;
create policy patch4_audit_procedures_static_read on public.patch4_audit_procedures
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_qaip_reviews_static_read on public.patch4_audit_qaip_reviews;
create policy patch4_audit_qaip_reviews_static_read on public.patch4_audit_qaip_reviews
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_universe_static_read on public.patch4_audit_universe;
create policy patch4_audit_universe_static_read on public.patch4_audit_universe
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_audit_workpapers_static_read on public.patch4_audit_workpapers;
create policy patch4_audit_workpapers_static_read on public.patch4_audit_workpapers
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_evidence_integrity_hashes_static_read on public.patch4_evidence_integrity_hashes;
create policy patch4_evidence_integrity_hashes_static_read on public.patch4_evidence_integrity_hashes
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_evidence_review_decisions_static_read on public.patch4_evidence_review_decisions;
create policy patch4_evidence_review_decisions_static_read on public.patch4_evidence_review_decisions
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_evidence_versions_static_read on public.patch4_evidence_versions;
create policy patch4_evidence_versions_static_read on public.patch4_evidence_versions
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_external_auditor_access_sessions_static_read on public.patch4_external_auditor_access_sessions;
create policy patch4_external_auditor_access_sessions_static_read on public.patch4_external_auditor_access_sessions
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_production_gate_evidence_static_read on public.patch4_production_gate_evidence;
create policy patch4_production_gate_evidence_static_read on public.patch4_production_gate_evidence
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

-- Immutable events are insert/read only through normal authenticated clients.
drop policy if exists patch4_immutable_audit_events_org_read on public.patch4_immutable_audit_events;
create policy patch4_immutable_audit_events_org_read on public.patch4_immutable_audit_events
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch4_immutable_audit_events_org_insert on public.patch4_immutable_audit_events;
create policy patch4_immutable_audit_events_org_insert on public.patch4_immutable_audit_events
for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_patch4_audit_evidence_governance_summary
with (security_invoker = true) as
with orgs as (
  select organization_id from public.patch4_audit_engagements
  union select organization_id from public.patch4_audit_findings
  union select organization_id from public.patch4_evidence_versions
  union select organization_id from public.patch4_production_governance_gates
  union select organization_id from public.patch4_immutable_audit_events
)
select
  orgs.organization_id,
  coalesce((select count(*) from public.patch4_audit_engagements e where e.organization_id = orgs.organization_id), 0)::integer as engagement_count,
  coalesce((select count(*) from public.patch4_audit_findings f where f.organization_id = orgs.organization_id and f.finding_status not in ('closed', 'accepted_risk')), 0)::integer as open_finding_count,
  coalesce((select count(*) from public.patch4_evidence_versions ev where ev.organization_id = orgs.organization_id), 0)::integer as evidence_version_count,
  coalesce((select count(*) from public.patch4_evidence_integrity_hashes ih where ih.organization_id = orgs.organization_id and ih.integrity_status = 'verified'), 0)::integer as verified_hash_count,
  coalesce((select count(*) from public.patch4_immutable_audit_events ae where ae.organization_id = orgs.organization_id), 0)::integer as immutable_event_count,
  coalesce((select count(*) from public.patch4_external_auditor_access_sessions s where s.organization_id = orgs.organization_id and s.access_status in ('approved', 'active')), 0)::integer as active_auditor_session_count,
  coalesce((select count(*) from public.patch4_production_governance_gates g where g.organization_id = orgs.organization_id and g.is_critical and g.gate_status <> 'approved'), 0)::integer as critical_gate_not_approved_count
from orgs;

create or replace view public.v_patch4_audit_engagement_dashboard
with (security_invoker = true) as
select
  e.organization_id,
  e.engagement_code,
  e.title,
  e.engagement_type,
  e.engagement_status,
  e.lead_auditor_name,
  e.target_report_date,
  count(distinct f.id)::integer as finding_count,
  count(distinct f.id) filter (where f.finding_status not in ('closed', 'accepted_risk'))::integer as open_finding_count,
  count(distinct wp.id)::integer as workpaper_count,
  count(distinct er.id)::integer as evidence_request_count
from public.patch4_audit_engagements e
left join public.patch4_audit_findings f on f.engagement_id = e.id
left join public.patch4_audit_workpapers wp on wp.engagement_id = e.id
left join public.patch4_audit_evidence_requests er on er.engagement_id = e.id
group by e.organization_id, e.engagement_code, e.title, e.engagement_type, e.engagement_status, e.lead_auditor_name, e.target_report_date;

create or replace view public.v_patch4_evidence_integrity_index
with (security_invoker = true) as
select
  ev.organization_id,
  ev.source_type,
  ev.evidence_code,
  ev.evidence_title,
  ev.version_no,
  ev.version_status,
  ih.hash_algorithm,
  ih.integrity_status,
  ih.verified_at,
  ih.chain_hash,
  count(ae.id)::integer as related_event_count
from public.patch4_evidence_versions ev
left join public.patch4_evidence_integrity_hashes ih on ih.evidence_version_id = ev.id
left join public.patch4_immutable_audit_events ae on ae.source_type = 'evidence_version' and ae.source_id = ev.id
group by ev.organization_id, ev.source_type, ev.evidence_code, ev.evidence_title, ev.version_no, ev.version_status, ih.hash_algorithm, ih.integrity_status, ih.verified_at, ih.chain_hash;

create or replace view public.v_patch4_production_governance_gate_dashboard
with (security_invoker = true) as
select
  g.organization_id,
  g.gate_code,
  g.gate_name,
  g.gate_area,
  g.is_critical,
  g.gate_status,
  g.owner_name,
  g.due_date,
  count(ge.id)::integer as evidence_item_count,
  count(ge.id) filter (where ge.evidence_status = 'accepted')::integer as accepted_evidence_count
from public.patch4_production_governance_gates g
left join public.patch4_production_gate_evidence ge on ge.gate_id = g.id
group by g.organization_id, g.gate_code, g.gate_name, g.gate_area, g.is_critical, g.gate_status, g.owner_name, g.due_date;

comment on table public.patch4_immutable_audit_events is 'Patch 4 immutable event register. Inserts receive a SHA-256 hash chain value through trigger.';
comment on table public.patch4_evidence_integrity_hashes is 'Patch 4 evidence integrity index linked to evidence versions and hash chain.';
comment on table public.patch4_production_governance_gates is 'Patch 4 go-live gates. Production readiness requires real approved gate evidence, not proof-pack status alone.';
comment on view public.v_patch4_audit_evidence_governance_summary is 'Patch 4 executive summary for audit, evidence integrity, external auditor access, and production governance.';
