-- Patch 12: Real Workflow Execution Pack
-- Purpose: daily execution layer for standards, evidence, gaps, CAPA, exceptions, management responses, audit findings, and workflow actions.
-- Important: creates real operating structures only. No mock/demo records are inserted.

create extension if not exists pgcrypto;

create table if not exists public.real_workflow_action_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  action_code text not null,
  action_name text not null,
  module_key text not null,
  action_category text not null default 'review'
    check (action_category in ('create', 'submit', 'review', 'approve', 'reject', 'close', 'reopen', 'escalate', 'delegate', 'evidence', 'exception', 'capa', 'management_response', 'audit_finding')),
  required_role_code text,
  requires_comment boolean not null default false,
  requires_evidence boolean not null default false,
  creates_activity_log boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, action_code, module_key)
);

create table if not exists public.real_workflow_execution_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete set null,
  module_key text not null,
  source_type text not null,
  source_id uuid,
  source_code text,
  item_title text not null,
  execution_status text not null default 'open'
    check (execution_status in ('draft', 'open', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'closed', 'cancelled', 'overdue')),
  priority text not null default 'normal'
    check (priority in ('critical', 'high', 'normal', 'low')),
  owner_name text,
  reviewer_name text,
  approver_name text,
  due_date date,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete cascade,
  requirement_code text,
  evidence_taxonomy_code text,
  evidence_title text not null,
  evidence_url text,
  submitted_by_name text,
  submitted_at timestamptz not null default now(),
  evidence_status text not null default 'submitted'
    check (evidence_status in ('submitted', 'under_review', 'accepted', 'rejected', 'expired', 'withdrawn')),
  confidentiality_level text not null default 'internal'
    check (confidentiality_level in ('public', 'internal', 'confidential', 'restricted', 'patient_sensitive')),
  review_due_date date
);

create table if not exists public.real_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_submission_id uuid not null references public.real_evidence_submissions(id) on delete cascade,
  reviewer_name text,
  review_decision text not null
    check (review_decision in ('accepted', 'rejected', 'changes_requested', 'not_applicable')),
  review_notes text,
  reviewed_at timestamptz not null default now(),
  next_action_required text
);

create table if not exists public.real_gap_closure_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete set null,
  gap_code text not null,
  gap_title text not null,
  requirement_code text,
  department_code text,
  root_cause_summary text,
  closure_action text not null,
  closure_status text not null default 'open'
    check (closure_status in ('open', 'assigned', 'in_progress', 'evidence_submitted', 'under_review', 'closed', 'rejected', 'overdue')),
  owner_name text,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, gap_code)
);

create table if not exists public.real_capa_issuance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gap_closure_id uuid references public.real_gap_closure_actions(id) on delete set null,
  capa_code text not null,
  capa_title text not null,
  capa_source text not null default 'gap'
    check (capa_source in ('gap', 'ovr', 'audit_finding', 'risk_event', 'survey_finding', 'management_review')),
  corrective_action text not null,
  preventive_action text,
  capa_status text not null default 'issued'
    check (capa_status in ('issued', 'assigned', 'in_progress', 'implemented', 'retest_due', 'closed', 'cancelled', 'overdue')),
  owner_name text,
  target_completion_date date,
  issued_by_name text,
  issued_at timestamptz not null default now(),
  unique (organization_id, capa_code)
);

create table if not exists public.real_capa_retests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  capa_id uuid not null references public.real_capa_issuance_records(id) on delete cascade,
  retest_code text not null,
  retest_method text,
  retest_result text not null default 'pending'
    check (retest_result in ('pending', 'passed', 'failed', 'partially_effective', 'not_due')),
  retested_by_name text,
  retest_date date,
  retest_notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, capa_id, retest_code)
);

create table if not exists public.real_exception_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete set null,
  exception_code text not null,
  exception_title text not null,
  exception_reason text not null,
  risk_acceptance_summary text,
  approval_status text not null default 'requested'
    check (approval_status in ('requested', 'under_review', 'approved', 'rejected', 'expired', 'withdrawn')),
  requested_by_name text,
  approver_name text,
  valid_until date,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, exception_code)
);

create table if not exists public.real_management_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete set null,
  response_code text not null,
  finding_code text,
  response_owner_name text,
  response_text text not null,
  response_status text not null default 'draft'
    check (response_status in ('draft', 'submitted', 'accepted', 'rejected', 'overdue', 'closed')),
  target_date date,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, response_code)
);

create table if not exists public.real_audit_finding_generation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete set null,
  finding_code text not null,
  finding_title text not null,
  finding_source text not null default 'audit'
    check (finding_source in ('audit', 'tracer', 'survey', 'risk_review', 'compliance_review', 'evidence_review')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  finding_status text not null default 'draft'
    check (finding_status in ('draft', 'issued', 'management_response', 'action_plan', 'retest', 'closed', 'cancelled')),
  finding_summary text,
  owner_name text,
  due_date date,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, finding_code)
);

create table if not exists public.real_workflow_execution_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid not null references public.real_workflow_execution_items(id) on delete cascade,
  decision_type text not null
    check (decision_type in ('submit', 'approve', 'reject', 'request_changes', 'close', 'reopen', 'escalate', 'accept_evidence', 'reject_evidence', 'approve_exception')),
  decision_by_name text,
  decision_notes text,
  from_status text,
  to_status text,
  decided_at timestamptz not null default now()
);

create table if not exists public.real_workflow_execution_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  execution_item_id uuid references public.real_workflow_execution_items(id) on delete cascade,
  activity_type text not null,
  actor_name text,
  activity_summary text not null,
  activity_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_real_exec_items_org_status on public.real_workflow_execution_items(organization_id, execution_status, priority, due_date);
create index if not exists idx_real_evidence_org_status on public.real_evidence_submissions(organization_id, evidence_status, review_due_date);
create index if not exists idx_real_gap_org_status on public.real_gap_closure_actions(organization_id, closure_status, due_date);
create index if not exists idx_real_capa_org_status on public.real_capa_issuance_records(organization_id, capa_status, target_completion_date);
create index if not exists idx_real_exception_org_status on public.real_exception_approvals(organization_id, approval_status, valid_until);
create index if not exists idx_real_mgmt_response_org_status on public.real_management_responses(organization_id, response_status, target_date);
create index if not exists idx_real_finding_org_status on public.real_audit_finding_generation(organization_id, finding_status, severity, due_date);

alter table public.real_workflow_action_templates enable row level security;
alter table public.real_workflow_execution_items enable row level security;
alter table public.real_evidence_submissions enable row level security;
alter table public.real_evidence_reviews enable row level security;
alter table public.real_gap_closure_actions enable row level security;
alter table public.real_capa_issuance_records enable row level security;
alter table public.real_capa_retests enable row level security;
alter table public.real_exception_approvals enable row level security;
alter table public.real_management_responses enable row level security;
alter table public.real_audit_finding_generation enable row level security;
alter table public.real_workflow_execution_decisions enable row level security;
alter table public.real_workflow_execution_activity enable row level security;

-- Explicit org-scoped RLS policies for static audit detection.
drop policy if exists real_workflow_action_templates_org_read on public.real_workflow_action_templates;
create policy real_workflow_action_templates_org_read on public.real_workflow_action_templates for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_action_templates_org_insert on public.real_workflow_action_templates;
create policy real_workflow_action_templates_org_insert on public.real_workflow_action_templates for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_action_templates_org_update on public.real_workflow_action_templates;
create policy real_workflow_action_templates_org_update on public.real_workflow_action_templates for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_workflow_execution_items_org_read on public.real_workflow_execution_items;
create policy real_workflow_execution_items_org_read on public.real_workflow_execution_items for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_execution_items_org_insert on public.real_workflow_execution_items;
create policy real_workflow_execution_items_org_insert on public.real_workflow_execution_items for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_execution_items_org_update on public.real_workflow_execution_items;
create policy real_workflow_execution_items_org_update on public.real_workflow_execution_items for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_evidence_submissions_org_read on public.real_evidence_submissions;
create policy real_evidence_submissions_org_read on public.real_evidence_submissions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_submissions_org_insert on public.real_evidence_submissions;
create policy real_evidence_submissions_org_insert on public.real_evidence_submissions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_submissions_org_update on public.real_evidence_submissions;
create policy real_evidence_submissions_org_update on public.real_evidence_submissions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_evidence_reviews_org_read on public.real_evidence_reviews;
create policy real_evidence_reviews_org_read on public.real_evidence_reviews for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_reviews_org_insert on public.real_evidence_reviews;
create policy real_evidence_reviews_org_insert on public.real_evidence_reviews for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_reviews_org_update on public.real_evidence_reviews;
create policy real_evidence_reviews_org_update on public.real_evidence_reviews for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_gap_closure_actions_org_read on public.real_gap_closure_actions;
create policy real_gap_closure_actions_org_read on public.real_gap_closure_actions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_gap_closure_actions_org_insert on public.real_gap_closure_actions;
create policy real_gap_closure_actions_org_insert on public.real_gap_closure_actions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_gap_closure_actions_org_update on public.real_gap_closure_actions;
create policy real_gap_closure_actions_org_update on public.real_gap_closure_actions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_capa_issuance_records_org_read on public.real_capa_issuance_records;
create policy real_capa_issuance_records_org_read on public.real_capa_issuance_records for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_capa_issuance_records_org_insert on public.real_capa_issuance_records;
create policy real_capa_issuance_records_org_insert on public.real_capa_issuance_records for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_capa_issuance_records_org_update on public.real_capa_issuance_records;
create policy real_capa_issuance_records_org_update on public.real_capa_issuance_records for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_capa_retests_org_read on public.real_capa_retests;
create policy real_capa_retests_org_read on public.real_capa_retests for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_capa_retests_org_insert on public.real_capa_retests;
create policy real_capa_retests_org_insert on public.real_capa_retests for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_capa_retests_org_update on public.real_capa_retests;
create policy real_capa_retests_org_update on public.real_capa_retests for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_exception_approvals_org_read on public.real_exception_approvals;
create policy real_exception_approvals_org_read on public.real_exception_approvals for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_exception_approvals_org_insert on public.real_exception_approvals;
create policy real_exception_approvals_org_insert on public.real_exception_approvals for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_exception_approvals_org_update on public.real_exception_approvals;
create policy real_exception_approvals_org_update on public.real_exception_approvals for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_management_responses_org_read on public.real_management_responses;
create policy real_management_responses_org_read on public.real_management_responses for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_management_responses_org_insert on public.real_management_responses;
create policy real_management_responses_org_insert on public.real_management_responses for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_management_responses_org_update on public.real_management_responses;
create policy real_management_responses_org_update on public.real_management_responses for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_audit_finding_generation_org_read on public.real_audit_finding_generation;
create policy real_audit_finding_generation_org_read on public.real_audit_finding_generation for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_audit_finding_generation_org_insert on public.real_audit_finding_generation;
create policy real_audit_finding_generation_org_insert on public.real_audit_finding_generation for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_audit_finding_generation_org_update on public.real_audit_finding_generation;
create policy real_audit_finding_generation_org_update on public.real_audit_finding_generation for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_workflow_execution_decisions_org_read on public.real_workflow_execution_decisions;
create policy real_workflow_execution_decisions_org_read on public.real_workflow_execution_decisions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_execution_decisions_org_insert on public.real_workflow_execution_decisions;
create policy real_workflow_execution_decisions_org_insert on public.real_workflow_execution_decisions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_workflow_execution_activity_org_read on public.real_workflow_execution_activity;
create policy real_workflow_execution_activity_org_read on public.real_workflow_execution_activity for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_workflow_execution_activity_org_insert on public.real_workflow_execution_activity;
create policy real_workflow_execution_activity_org_insert on public.real_workflow_execution_activity for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_real_workflow_execution_summary
with (security_invoker = true) as
select
  i.organization_id,
  count(distinct i.id)::integer as execution_item_count,
  count(distinct i.id) filter (where i.execution_status in ('open', 'submitted', 'under_review', 'changes_requested', 'overdue'))::integer as active_item_count,
  count(distinct i.id) filter (where i.execution_status = 'overdue' or (i.due_date is not null and i.due_date < current_date and i.execution_status not in ('closed', 'cancelled', 'approved', 'rejected')))::integer as overdue_item_count,
  count(distinct ev.id) filter (where ev.evidence_status in ('submitted', 'under_review', 'rejected'))::integer as evidence_attention_count,
  count(distinct gap.id) filter (where gap.closure_status not in ('closed', 'rejected'))::integer as open_gap_count,
  count(distinct capa.id) filter (where capa.capa_status not in ('closed', 'cancelled'))::integer as open_capa_count,
  count(distinct ex.id) filter (where ex.approval_status in ('requested', 'under_review'))::integer as pending_exception_count,
  count(distinct mr.id) filter (where mr.response_status in ('draft', 'submitted', 'overdue'))::integer as management_response_count,
  count(distinct f.id) filter (where f.finding_status not in ('closed', 'cancelled'))::integer as open_finding_count
from public.real_workflow_execution_items i
left join public.real_evidence_submissions ev on ev.execution_item_id = i.id
left join public.real_gap_closure_actions gap on gap.execution_item_id = i.id
left join public.real_capa_issuance_records capa on capa.gap_closure_id = gap.id
left join public.real_exception_approvals ex on ex.execution_item_id = i.id
left join public.real_management_responses mr on mr.execution_item_id = i.id
left join public.real_audit_finding_generation f on f.execution_item_id = i.id
group by i.organization_id;

create or replace view public.v_real_action_queue
with (security_invoker = true) as
select
  organization_id,
  id as execution_item_id,
  module_key,
  source_type,
  source_code,
  item_title,
  execution_status,
  priority,
  owner_name,
  reviewer_name,
  approver_name,
  due_date,
  case
    when due_date is not null and due_date < current_date and execution_status not in ('closed', 'cancelled') then 'overdue'
    when priority in ('critical', 'high') then 'high_priority'
    when execution_status = 'changes_requested' then 'changes_requested'
    else 'normal'
  end as queue_signal
from public.real_workflow_execution_items
where execution_status not in ('closed', 'cancelled', 'rejected');

create or replace view public.v_real_evidence_review_queue
with (security_invoker = true) as
select
  e.organization_id,
  e.id as evidence_submission_id,
  i.item_title,
  e.requirement_code,
  e.evidence_taxonomy_code,
  e.evidence_title,
  e.submitted_by_name,
  e.evidence_status,
  e.confidentiality_level,
  e.review_due_date,
  case
    when e.evidence_status = 'rejected' then 'rejected'
    when e.review_due_date is not null and e.review_due_date < current_date and e.evidence_status not in ('accepted', 'withdrawn') then 'overdue_review'
    when e.confidentiality_level in ('restricted', 'patient_sensitive') then 'sensitive_review'
    else 'normal'
  end as queue_signal
from public.real_evidence_submissions e
left join public.real_workflow_execution_items i on i.id = e.execution_item_id
where e.evidence_status not in ('accepted', 'withdrawn');

create or replace view public.v_real_gap_capa_queue
with (security_invoker = true) as
select
  g.organization_id,
  g.gap_code,
  g.gap_title,
  g.requirement_code,
  g.department_code,
  g.closure_status,
  g.owner_name,
  g.due_date,
  count(c.id)::integer as capa_count,
  count(r.id) filter (where r.retest_result = 'failed')::integer as failed_retest_count,
  case
    when g.due_date is not null and g.due_date < current_date and g.closure_status not in ('closed', 'rejected') then 'overdue'
    when count(r.id) filter (where r.retest_result = 'failed') > 0 then 'failed_retest'
    when g.closure_status in ('open', 'assigned') then 'open'
    else 'normal'
  end as queue_signal
from public.real_gap_closure_actions g
left join public.real_capa_issuance_records c on c.gap_closure_id = g.id
left join public.real_capa_retests r on r.capa_id = c.id
group by g.organization_id, g.gap_code, g.gap_title, g.requirement_code, g.department_code, g.closure_status, g.owner_name, g.due_date;

create or replace view public.v_real_management_response_queue
with (security_invoker = true) as
select
  mr.organization_id,
  mr.response_code,
  coalesce(f.finding_code, mr.finding_code) as finding_code,
  coalesce(f.finding_title, mr.finding_code, 'Management response') as finding_title,
  mr.response_owner_name,
  mr.response_status,
  mr.target_date,
  f.severity,
  case
    when mr.target_date is not null and mr.target_date < current_date and mr.response_status not in ('accepted', 'closed') then 'overdue'
    when f.severity in ('critical', 'high') then 'high_severity'
    when mr.response_status = 'rejected' then 'rejected'
    else 'normal'
  end as queue_signal
from public.real_management_responses mr
left join public.real_audit_finding_generation f on f.finding_code = mr.finding_code and f.organization_id = mr.organization_id;

comment on table public.real_workflow_execution_items is 'Patch 12 real daily workflow execution items across standards, quality, audit, risk, compliance, evidence, gaps, CAPA, and exceptions.';
comment on table public.real_evidence_submissions is 'Patch 12 real evidence submission records for review and acceptance/rejection decisions.';
comment on table public.real_gap_closure_actions is 'Patch 12 real gap closure action tracker linked to requirements and departments.';
comment on table public.real_capa_issuance_records is 'Patch 12 real CAPA issuance records with retesting linkage.';
comment on view public.v_real_action_queue is 'Patch 12 executable daily action queue.';
