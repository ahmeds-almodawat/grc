-- =========================================================
-- Patch 37: Audit + OVR Clinical Governance Engine
-- DB-backed audit execution plus OVR/RCA/CAPA/evidence/accreditation governance bridges.
-- Additive only: no destructive changes to existing OVR, CAPA, evidence, audit, or accreditation tables.
-- =========================================================

create table if not exists public.audit_execution_engagements (
  id uuid primary key default gen_random_uuid(),
  engagement_title text not null,
  engagement_type text not null default 'internal_audit',
  scope_summary text,
  department_id uuid references public.departments(id) on delete set null,
  lead_auditor_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','active','fieldwork','reporting','closed','cancelled')),
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.audit_execution_programs (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_execution_engagements(id) on delete cascade,
  program_title text not null,
  program_area text,
  linked_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  linked_control_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.audit_execution_test_steps (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.audit_execution_programs(id) on delete cascade,
  step_code text,
  step_title text not null,
  step_description text,
  test_type text not null default 'inspection' check (test_type in ('inspection','inquiry','observation','reperformance','sampling','document_review')),
  expected_evidence text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','failed','not_applicable','waived')),
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_execution_samples (
  id uuid primary key default gen_random_uuid(),
  test_step_id uuid not null references public.audit_execution_test_steps(id) on delete cascade,
  sample_reference text not null,
  sample_description text,
  sample_date date,
  sample_status text not null default 'selected' check (sample_status in ('selected','tested','exception_found','passed','excluded')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_execution_results (
  id uuid primary key default gen_random_uuid(),
  test_step_id uuid not null references public.audit_execution_test_steps(id) on delete cascade,
  sample_id uuid references public.audit_execution_samples(id) on delete set null,
  result_status text not null default 'pending' check (result_status in ('pending','passed','failed','exception','not_applicable')),
  result_summary text,
  evidence_id uuid,
  tested_by uuid references public.profiles(id) on delete set null,
  tested_at timestamptz not null default now()
);

create table if not exists public.audit_execution_findings (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_execution_engagements(id) on delete cascade,
  test_step_id uuid references public.audit_execution_test_steps(id) on delete set null,
  finding_title text not null,
  finding_description text,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  finding_status text not null default 'open' check (finding_status in ('open','under_review','capa_required','evidence_required','accepted','closed','waived')),
  linked_capa_id uuid,
  linked_evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  linked_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.audit_execution_signoffs (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.audit_execution_engagements(id) on delete cascade,
  signoff_type text not null default 'lead_auditor' check (signoff_type in ('lead_auditor','quality','executive','department_owner')),
  signoff_status text not null default 'pending' check (signoff_status in ('pending','signed_off','rejected','reopened','waived')),
  signed_by uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  signoff_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ovr_rca_cases (
  id uuid primary key default gen_random_uuid(),
  ovr_id uuid,
  incident_reference text,
  rca_title text not null,
  rca_status text not null default 'open' check (rca_status in ('open','in_progress','awaiting_review','capa_required','closed','waived','cancelled')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical','sentinel')),
  department_id uuid references public.departments(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  due_date date,
  root_cause_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.ovr_capa_evidence_links (
  id uuid primary key default gen_random_uuid(),
  ovr_id uuid,
  rca_case_id uuid references public.ovr_rca_cases(id) on delete cascade,
  linked_entity_type text not null check (linked_entity_type in ('capa','evidence_bridge','accreditation_clause','risk','audit_finding','document','training','control')),
  linked_entity_id uuid not null,
  link_role text not null default 'supporting' check (link_role in ('primary','supporting','closure_evidence','corrective_action','accreditation_support','risk_control')),
  link_status text not null default 'active' check (link_status in ('active','inactive','pending_review','accepted','rejected')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_governance_escalations (
  id uuid primary key default gen_random_uuid(),
  ovr_id uuid,
  rca_case_id uuid references public.ovr_rca_cases(id) on delete set null,
  audit_finding_id uuid references public.audit_execution_findings(id) on delete set null,
  escalation_level text not null default 'department' check (escalation_level in ('department','quality','medical_director','executive','sentinel')),
  escalation_reason text not null,
  escalation_status text not null default 'open' check (escalation_status in ('open','acknowledged','action_required','resolved','cancelled')),
  escalated_to_user_id uuid references public.profiles(id) on delete set null,
  escalated_to_department_id uuid references public.departments(id) on delete set null,
  escalated_by uuid references public.profiles(id) on delete set null,
  escalated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text
);

create table if not exists public.clinical_governance_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch37_audit_engagement_status on public.audit_execution_engagements(status, starts_on, ends_on);
create index if not exists idx_patch37_audit_engagement_department on public.audit_execution_engagements(department_id, status);
create index if not exists idx_patch37_audit_program_engagement on public.audit_execution_programs(engagement_id, active);
create index if not exists idx_patch37_audit_program_clause on public.audit_execution_programs(linked_clause_id);
create index if not exists idx_patch37_audit_step_program on public.audit_execution_test_steps(program_id, status);
create index if not exists idx_patch37_audit_step_assignee on public.audit_execution_test_steps(assigned_to_user_id, status);
create index if not exists idx_patch37_audit_step_due on public.audit_execution_test_steps(due_date, status);
create index if not exists idx_patch37_audit_sample_step on public.audit_execution_samples(test_step_id, sample_status);
create index if not exists idx_patch37_audit_result_step on public.audit_execution_results(test_step_id, result_status);
create index if not exists idx_patch37_audit_result_evidence on public.audit_execution_results(evidence_id);
create index if not exists idx_patch37_audit_finding_engagement on public.audit_execution_findings(engagement_id, finding_status);
create index if not exists idx_patch37_audit_finding_due on public.audit_execution_findings(due_date, finding_status);
create index if not exists idx_patch37_audit_finding_links on public.audit_execution_findings(linked_capa_id, linked_evidence_bridge_link_id, linked_clause_id);
create index if not exists idx_patch37_audit_signoff_engagement on public.audit_execution_signoffs(engagement_id, signoff_status);
create index if not exists idx_patch37_rca_ovr on public.ovr_rca_cases(ovr_id, rca_status);
create index if not exists idx_patch37_rca_owner on public.ovr_rca_cases(owner_user_id, rca_status);
create index if not exists idx_patch37_rca_due on public.ovr_rca_cases(due_date, rca_status);
create index if not exists idx_patch37_ovr_bridge_ovr on public.ovr_capa_evidence_links(ovr_id, link_status);
create index if not exists idx_patch37_ovr_bridge_rca on public.ovr_capa_evidence_links(rca_case_id, link_status);
create index if not exists idx_patch37_ovr_bridge_entity on public.ovr_capa_evidence_links(linked_entity_type, linked_entity_id);
create index if not exists idx_patch37_escalation_status on public.clinical_governance_escalations(escalation_status, escalation_level);
create index if not exists idx_patch37_escalation_owner on public.clinical_governance_escalations(escalated_to_user_id, escalation_status);
create index if not exists idx_patch37_events_entity on public.clinical_governance_events(entity_type, entity_id, created_at desc);

alter table public.audit_execution_engagements enable row level security;
alter table public.audit_execution_programs enable row level security;
alter table public.audit_execution_test_steps enable row level security;
alter table public.audit_execution_samples enable row level security;
alter table public.audit_execution_results enable row level security;
alter table public.audit_execution_findings enable row level security;
alter table public.audit_execution_signoffs enable row level security;
alter table public.ovr_rca_cases enable row level security;
alter table public.ovr_capa_evidence_links enable row level security;
alter table public.clinical_governance_escalations enable row level security;
alter table public.clinical_governance_events enable row level security;

drop policy if exists audit_execution_engagements_read on public.audit_execution_engagements;
create policy audit_execution_engagements_read on public.audit_execution_engagements
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or lead_auditor_user_id = auth.uid()
);
drop policy if exists audit_execution_engagements_write on public.audit_execution_engagements;
create policy audit_execution_engagements_write on public.audit_execution_engagements
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists audit_execution_programs_read on public.audit_execution_programs;
create policy audit_execution_programs_read on public.audit_execution_programs
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists audit_execution_programs_write on public.audit_execution_programs;
create policy audit_execution_programs_write on public.audit_execution_programs
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists audit_execution_test_steps_read on public.audit_execution_test_steps;
create policy audit_execution_test_steps_read on public.audit_execution_test_steps
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or assigned_to_user_id = auth.uid()
);
drop policy if exists audit_execution_test_steps_write_governance on public.audit_execution_test_steps;
create policy audit_execution_test_steps_write_governance on public.audit_execution_test_steps
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));
drop policy if exists audit_execution_test_steps_update_assignee on public.audit_execution_test_steps;
create policy audit_execution_test_steps_update_assignee on public.audit_execution_test_steps
for update using (assigned_to_user_id = auth.uid() and status in ('not_started','in_progress','failed'))
with check (assigned_to_user_id = auth.uid() and status in ('in_progress','completed','failed','not_applicable'));

drop policy if exists audit_execution_samples_read on public.audit_execution_samples;
create policy audit_execution_samples_read on public.audit_execution_samples
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists audit_execution_samples_write on public.audit_execution_samples;
create policy audit_execution_samples_write on public.audit_execution_samples
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists audit_execution_results_read on public.audit_execution_results;
create policy audit_execution_results_read on public.audit_execution_results
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists audit_execution_results_write on public.audit_execution_results;
create policy audit_execution_results_write on public.audit_execution_results
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]) or tested_by = auth.uid())
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]) or tested_by = auth.uid());

drop policy if exists audit_execution_findings_read on public.audit_execution_findings;
create policy audit_execution_findings_read on public.audit_execution_findings
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or owner_user_id = auth.uid()
);
drop policy if exists audit_execution_findings_write on public.audit_execution_findings;
create policy audit_execution_findings_write on public.audit_execution_findings
for all using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists audit_execution_signoffs_read on public.audit_execution_signoffs;
create policy audit_execution_signoffs_read on public.audit_execution_signoffs
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists audit_execution_signoffs_write on public.audit_execution_signoffs;
create policy audit_execution_signoffs_write on public.audit_execution_signoffs
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists ovr_rca_cases_read on public.ovr_rca_cases;
create policy ovr_rca_cases_read on public.ovr_rca_cases
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or owner_user_id = auth.uid()
);
drop policy if exists ovr_rca_cases_write on public.ovr_rca_cases;
create policy ovr_rca_cases_write on public.ovr_rca_cases
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid())
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());

drop policy if exists ovr_capa_evidence_links_read on public.ovr_capa_evidence_links;
create policy ovr_capa_evidence_links_read on public.ovr_capa_evidence_links
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists ovr_capa_evidence_links_write on public.ovr_capa_evidence_links;
create policy ovr_capa_evidence_links_write on public.ovr_capa_evidence_links
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor','department_manager']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor','department_manager']::public.app_role[]));

drop policy if exists clinical_governance_escalations_read on public.clinical_governance_escalations;
create policy clinical_governance_escalations_read on public.clinical_governance_escalations
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or escalated_to_user_id = auth.uid()
  or escalated_by = auth.uid()
);
drop policy if exists clinical_governance_escalations_write on public.clinical_governance_escalations;
create policy clinical_governance_escalations_write on public.clinical_governance_escalations
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','department_manager']::public.app_role[]) or escalated_to_user_id = auth.uid())
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','department_manager']::public.app_role[]) or escalated_to_user_id = auth.uid());

drop policy if exists clinical_governance_events_read on public.clinical_governance_events;
create policy clinical_governance_events_read on public.clinical_governance_events
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists clinical_governance_events_insert on public.clinical_governance_events;
create policy clinical_governance_events_insert on public.clinical_governance_events
for insert with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

create or replace view public.v_patch37_audit_engagement_register as
select
  e.*,
  d.name as department_name,
  p.full_name as lead_auditor_name,
  count(distinct pr.id) as program_count,
  count(distinct ts.id) as test_step_count,
  count(distinct ts.id) filter (where ts.status = 'completed') as completed_step_count,
  count(distinct f.id) filter (where f.finding_status not in ('closed','waived')) as open_finding_count,
  count(distinct s.id) filter (where s.signoff_status = 'pending') as pending_signoff_count
from public.audit_execution_engagements e
left join public.departments d on d.id = e.department_id
left join public.profiles p on p.id = e.lead_auditor_user_id
left join public.audit_execution_programs pr on pr.engagement_id = e.id
left join public.audit_execution_test_steps ts on ts.program_id = pr.id
left join public.audit_execution_findings f on f.engagement_id = e.id
left join public.audit_execution_signoffs s on s.engagement_id = e.id
group by e.id, d.name, p.full_name;

create or replace view public.v_patch37_audit_test_step_queue as
select
  ts.*,
  pr.engagement_id,
  pr.program_title,
  pr.program_area,
  pr.linked_clause_id,
  c.clause_code,
  c.clause_title,
  e.engagement_title,
  e.status as engagement_status,
  assignee.full_name as assigned_to_name,
  case when ts.due_date is not null and ts.due_date < current_date and ts.status not in ('completed','not_applicable','waived') then true else false end as is_overdue
from public.audit_execution_test_steps ts
join public.audit_execution_programs pr on pr.id = ts.program_id
join public.audit_execution_engagements e on e.id = pr.engagement_id
left join public.accreditation_clauses c on c.id = pr.linked_clause_id
left join public.profiles assignee on assignee.id = ts.assigned_to_user_id
where e.status not in ('closed','cancelled') and ts.status not in ('completed','not_applicable','waived');

create or replace view public.v_patch37_audit_sample_result_register as
select
  sm.id as sample_id,
  sm.test_step_id,
  sm.sample_reference,
  sm.sample_description,
  sm.sample_date,
  sm.sample_status,
  rs.id as result_id,
  rs.result_status,
  rs.result_summary,
  rs.evidence_id,
  rs.tested_by,
  tester.full_name as tested_by_name,
  rs.tested_at,
  ts.step_code,
  ts.step_title,
  pr.program_title,
  e.id as engagement_id,
  e.engagement_title
from public.audit_execution_samples sm
join public.audit_execution_test_steps ts on ts.id = sm.test_step_id
join public.audit_execution_programs pr on pr.id = ts.program_id
join public.audit_execution_engagements e on e.id = pr.engagement_id
left join public.audit_execution_results rs on rs.sample_id = sm.id
left join public.profiles tester on tester.id = rs.tested_by;

create or replace view public.v_patch37_audit_finding_register as
select
  f.*,
  e.engagement_title,
  ts.step_code,
  ts.step_title,
  d.name as department_name,
  owner.full_name as owner_name,
  c.clause_code,
  c.clause_title,
  case when f.due_date is not null and f.due_date < current_date and f.finding_status not in ('closed','waived') then true else false end as is_overdue
from public.audit_execution_findings f
join public.audit_execution_engagements e on e.id = f.engagement_id
left join public.audit_execution_test_steps ts on ts.id = f.test_step_id
left join public.departments d on d.id = f.department_id
left join public.profiles owner on owner.id = f.owner_user_id
left join public.accreditation_clauses c on c.id = f.linked_clause_id;

create or replace view public.v_patch37_audit_findings_requiring_capa_or_evidence as
select *
from public.v_patch37_audit_finding_register
where finding_status in ('capa_required','evidence_required')
   or linked_capa_id is null
   or linked_evidence_bridge_link_id is null;

create or replace view public.v_patch37_audit_signoff_queue as
select
  s.*,
  e.engagement_title,
  e.status as engagement_status,
  signer.full_name as signed_by_name
from public.audit_execution_signoffs s
join public.audit_execution_engagements e on e.id = s.engagement_id
left join public.profiles signer on signer.id = s.signed_by
where s.signoff_status in ('pending','rejected','reopened');

create or replace view public.v_patch37_ovr_rca_case_register as
select
  r.*,
  d.name as department_name,
  owner.full_name as owner_name,
  count(l.id) filter (where l.link_status in ('active','accepted')) as active_link_count,
  count(l.id) filter (where l.linked_entity_type = 'capa' and l.link_status in ('active','accepted')) as capa_link_count,
  count(l.id) filter (where l.linked_entity_type = 'evidence_bridge' and l.link_status in ('active','accepted')) as evidence_bridge_link_count,
  count(l.id) filter (where l.linked_entity_type = 'accreditation_clause' and l.link_status in ('active','accepted')) as accreditation_clause_link_count,
  case when r.due_date is not null and r.due_date < current_date and r.rca_status not in ('closed','waived','cancelled') then true else false end as is_overdue
from public.ovr_rca_cases r
left join public.departments d on d.id = r.department_id
left join public.profiles owner on owner.id = r.owner_user_id
left join public.ovr_capa_evidence_links l on l.rca_case_id = r.id
group by r.id, d.name, owner.full_name;

create or replace view public.v_patch37_ovr_capa_evidence_bridge as
select
  l.*,
  r.incident_reference,
  r.rca_title,
  r.rca_status,
  r.severity,
  eb.evidence_status,
  eb.freshness_status,
  eb.clause_code,
  eb.clause_title
from public.ovr_capa_evidence_links l
left join public.ovr_rca_cases r on r.id = l.rca_case_id
left join public.v_patch33_clause_control_evidence_bridge eb
  on l.linked_entity_type = 'evidence_bridge' and eb.bridge_link_id = l.linked_entity_id;

create or replace view public.v_patch37_clinical_governance_escalation_register as
select
  e.*,
  r.incident_reference,
  r.rca_title,
  r.severity as rca_severity,
  f.finding_title,
  f.severity as finding_severity,
  u.full_name as escalated_to_name,
  d.name as escalated_to_department_name
from public.clinical_governance_escalations e
left join public.ovr_rca_cases r on r.id = e.rca_case_id
left join public.audit_execution_findings f on f.id = e.audit_finding_id
left join public.profiles u on u.id = e.escalated_to_user_id
left join public.departments d on d.id = e.escalated_to_department_id;

create or replace view public.v_patch37_overdue_audit_ovr_governance_items as
select 'audit_test_step'::text as item_type, id as item_id, step_title as item_title, status as item_status, due_date, assigned_to_user_id as owner_user_id, null::uuid as department_id
from public.audit_execution_test_steps
where due_date < current_date and status not in ('completed','not_applicable','waived')
union all
select 'audit_finding', id, finding_title, finding_status, due_date, owner_user_id, department_id
from public.audit_execution_findings
where due_date < current_date and finding_status not in ('closed','waived')
union all
select 'ovr_rca', id, rca_title, rca_status, due_date, owner_user_id, department_id
from public.ovr_rca_cases
where due_date < current_date and rca_status not in ('closed','waived','cancelled');

create or replace view public.v_patch37_department_clinical_governance_workload as
select
  d.id as department_id,
  d.name as department_name,
  count(distinct e.id) filter (where e.status not in ('closed','cancelled')) as active_audit_engagement_count,
  count(distinct f.id) filter (where f.finding_status not in ('closed','waived')) as open_audit_finding_count,
  count(distinct r.id) filter (where r.rca_status not in ('closed','waived','cancelled')) as open_rca_case_count,
  count(distinct g.id) filter (where g.escalation_status in ('open','acknowledged','action_required')) as open_escalation_count,
  count(distinct f.id) filter (where f.due_date < current_date and f.finding_status not in ('closed','waived')) +
  count(distinct r.id) filter (where r.due_date < current_date and r.rca_status not in ('closed','waived','cancelled')) as overdue_item_count
from public.departments d
left join public.audit_execution_engagements e on e.department_id = d.id
left join public.audit_execution_findings f on f.department_id = d.id
left join public.ovr_rca_cases r on r.department_id = d.id
left join public.clinical_governance_escalations g on g.escalated_to_department_id = d.id
group by d.id, d.name;

create or replace view public.v_patch37_executive_clinical_governance_summary as
select
  (select count(*) from public.audit_execution_engagements where status in ('active','fieldwork','reporting')) as active_audit_engagement_count,
  (select count(*) from public.audit_execution_test_steps where status in ('not_started','in_progress','failed')) as open_audit_test_step_count,
  (select count(*) from public.audit_execution_findings where finding_status not in ('closed','waived')) as open_audit_finding_count,
  (select count(*) from public.audit_execution_findings where finding_status in ('capa_required','evidence_required')) as audit_finding_action_required_count,
  (select count(*) from public.ovr_rca_cases where rca_status not in ('closed','waived','cancelled')) as open_rca_case_count,
  (select count(*) from public.ovr_rca_cases where severity in ('critical','sentinel') and rca_status not in ('closed','waived','cancelled')) as severe_rca_case_count,
  (select count(*) from public.clinical_governance_escalations where escalation_status in ('open','acknowledged','action_required')) as open_escalation_count,
  (select count(*) from public.v_patch37_overdue_audit_ovr_governance_items) as overdue_governance_item_count,
  case
    when (select count(*) from public.ovr_rca_cases where severity = 'sentinel' and rca_status not in ('closed','waived','cancelled')) > 0 then 'sentinel_attention'
    when (select count(*) from public.v_patch37_overdue_audit_ovr_governance_items) > 0 then 'attention_required'
    when (select count(*) from public.clinical_governance_escalations where escalation_status in ('open','action_required')) > 0 then 'watch'
    else 'on_track'
  end as executive_signal;

alter view public.v_patch37_audit_engagement_register set (security_invoker = true);
alter view public.v_patch37_audit_test_step_queue set (security_invoker = true);
alter view public.v_patch37_audit_sample_result_register set (security_invoker = true);
alter view public.v_patch37_audit_finding_register set (security_invoker = true);
alter view public.v_patch37_audit_findings_requiring_capa_or_evidence set (security_invoker = true);
alter view public.v_patch37_audit_signoff_queue set (security_invoker = true);
alter view public.v_patch37_ovr_rca_case_register set (security_invoker = true);
alter view public.v_patch37_ovr_capa_evidence_bridge set (security_invoker = true);
alter view public.v_patch37_clinical_governance_escalation_register set (security_invoker = true);
alter view public.v_patch37_overdue_audit_ovr_governance_items set (security_invoker = true);
alter view public.v_patch37_department_clinical_governance_workload set (security_invoker = true);
alter view public.v_patch37_executive_clinical_governance_summary set (security_invoker = true);

grant select on public.v_patch37_audit_engagement_register to authenticated;
grant select on public.v_patch37_audit_test_step_queue to authenticated;
grant select on public.v_patch37_audit_sample_result_register to authenticated;
grant select on public.v_patch37_audit_finding_register to authenticated;
grant select on public.v_patch37_audit_findings_requiring_capa_or_evidence to authenticated;
grant select on public.v_patch37_audit_signoff_queue to authenticated;
grant select on public.v_patch37_ovr_rca_case_register to authenticated;
grant select on public.v_patch37_ovr_capa_evidence_bridge to authenticated;
grant select on public.v_patch37_clinical_governance_escalation_register to authenticated;
grant select on public.v_patch37_overdue_audit_ovr_governance_items to authenticated;
grant select on public.v_patch37_department_clinical_governance_workload to authenticated;
grant select on public.v_patch37_executive_clinical_governance_summary to authenticated;

create or replace function public.patch37_service_role_required()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'PATCH37_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.patch37_actor_has_clinical_governance_authority(p_actor_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.is_active = true
      and ur.role in ('super_admin','executive','governance_admin','auditor','compliance_officer','department_manager')
  );
$$;

create or replace function public.record_clinical_governance_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_event_id uuid;
begin
  perform public.patch37_service_role_required();
  if nullif(trim(p_event_summary), '') is null then raise exception 'PATCH37_EVENT_SUMMARY_REQUIRED'; end if;
  insert into public.clinical_governance_events(entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.create_audit_execution_engagement(p_engagement_title text, p_engagement_type text, p_scope_summary text, p_department_id uuid, p_lead_auditor_user_id uuid, p_starts_on date, p_ends_on date, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_engagements(engagement_title, engagement_type, scope_summary, department_id, lead_auditor_user_id, starts_on, ends_on, created_by)
  values (p_engagement_title, coalesce(nullif(p_engagement_type, ''), 'internal_audit'), p_scope_summary, p_department_id, p_lead_auditor_user_id, p_starts_on, p_ends_on, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_engagement', v_id, 'audit_engagement_created', 'Audit execution engagement created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.start_audit_execution_engagement(p_engagement_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  update public.audit_execution_engagements set status = 'active' where id = p_engagement_id and status in ('planned','active');
  perform public.record_clinical_governance_event('audit_engagement', p_engagement_id, 'audit_engagement_started', 'Audit execution engagement started.', p_actor_user_id);
  return jsonb_build_object('status','active','engagement_id',p_engagement_id);
end; $$;

create or replace function public.close_audit_execution_engagement(p_engagement_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  update public.audit_execution_engagements set status = 'closed', closed_at = now() where id = p_engagement_id;
  perform public.record_clinical_governance_event('audit_engagement', p_engagement_id, 'audit_engagement_closed', coalesce(p_notes, 'Audit execution engagement closed.'), p_actor_user_id);
  return jsonb_build_object('status','closed','engagement_id',p_engagement_id);
end; $$;

create or replace function public.reopen_audit_execution_engagement(p_engagement_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH37_REOPEN_REASON_REQUIRED'; end if;
  update public.audit_execution_engagements set status = 'active', closed_at = null where id = p_engagement_id;
  perform public.record_clinical_governance_event('audit_engagement', p_engagement_id, 'audit_engagement_reopened', p_reason, p_actor_user_id);
  return jsonb_build_object('status','active','engagement_id',p_engagement_id);
end; $$;

create or replace function public.create_audit_execution_program(p_engagement_id uuid, p_program_title text, p_program_area text, p_linked_clause_id uuid, p_linked_control_id uuid, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_programs(engagement_id, program_title, program_area, linked_clause_id, linked_control_id, created_by)
  values (p_engagement_id, p_program_title, p_program_area, p_linked_clause_id, p_linked_control_id, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_program', v_id, 'audit_program_created', 'Audit execution program created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.create_audit_execution_test_step(p_program_id uuid, p_step_code text, p_step_title text, p_step_description text, p_test_type text, p_expected_evidence text, p_assigned_to_user_id uuid, p_due_date date, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_test_steps(program_id, step_code, step_title, step_description, test_type, expected_evidence, assigned_to_user_id, due_date)
  values (p_program_id, p_step_code, p_step_title, p_step_description, coalesce(nullif(p_test_type, ''), 'inspection'), p_expected_evidence, p_assigned_to_user_id, p_due_date)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_test_step', v_id, 'audit_test_step_created', 'Audit execution test step created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.update_audit_execution_test_step_status(p_test_step_id uuid, p_status text, p_actor_user_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assigned uuid;
begin
  perform public.patch37_service_role_required();
  select assigned_to_user_id into v_assigned from public.audit_execution_test_steps where id = p_test_step_id;
  if v_assigned is distinct from p_actor_user_id and not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_STEP_ASSIGNEE_OR_AUTHORITY_REQUIRED'; end if;
  update public.audit_execution_test_steps set status = p_status where id = p_test_step_id;
  perform public.record_clinical_governance_event('audit_test_step', p_test_step_id, 'audit_test_step_status_updated', coalesce(p_notes, 'Audit test step status updated.'), p_actor_user_id);
  return jsonb_build_object('status',p_status,'test_step_id',p_test_step_id);
end; $$;

create or replace function public.create_audit_execution_sample(p_test_step_id uuid, p_sample_reference text, p_sample_description text, p_sample_date date, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_samples(test_step_id, sample_reference, sample_description, sample_date)
  values (p_test_step_id, p_sample_reference, p_sample_description, p_sample_date)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_sample', v_id, 'audit_sample_created', 'Audit execution sample created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.record_audit_execution_result(p_test_step_id uuid, p_sample_id uuid, p_result_status text, p_result_summary text, p_evidence_id uuid, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_results(test_step_id, sample_id, result_status, result_summary, evidence_id, tested_by)
  values (p_test_step_id, p_sample_id, coalesce(nullif(p_result_status, ''), 'pending'), p_result_summary, p_evidence_id, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_result', v_id, 'audit_result_recorded', coalesce(p_result_summary, 'Audit execution result recorded.'), p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.create_audit_execution_finding(p_engagement_id uuid, p_test_step_id uuid, p_finding_title text, p_finding_description text, p_severity text, p_owner_user_id uuid, p_department_id uuid, p_due_date date, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_findings(engagement_id, test_step_id, finding_title, finding_description, severity, owner_user_id, department_id, due_date, created_by)
  values (p_engagement_id, p_test_step_id, p_finding_title, p_finding_description, coalesce(nullif(p_severity, ''), 'medium'), p_owner_user_id, p_department_id, p_due_date, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_finding', v_id, 'audit_finding_created', 'Audit execution finding created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.link_audit_finding_to_capa(p_audit_finding_id uuid, p_capa_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  update public.audit_execution_findings set linked_capa_id = p_capa_id, finding_status = 'capa_required' where id = p_audit_finding_id;
  perform public.record_clinical_governance_event('audit_finding', p_audit_finding_id, 'audit_finding_linked_to_capa', 'Audit finding linked to CAPA.', p_actor_user_id);
  return jsonb_build_object('status','linked','audit_finding_id',p_audit_finding_id,'capa_id',p_capa_id);
end; $$;

create or replace function public.link_audit_finding_to_evidence_bridge(p_audit_finding_id uuid, p_evidence_bridge_link_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  update public.audit_execution_findings set linked_evidence_bridge_link_id = p_evidence_bridge_link_id, finding_status = 'evidence_required' where id = p_audit_finding_id;
  perform public.record_clinical_governance_event('audit_finding', p_audit_finding_id, 'audit_finding_linked_to_evidence_bridge', 'Audit finding linked to evidence bridge.', p_actor_user_id);
  return jsonb_build_object('status','linked','audit_finding_id',p_audit_finding_id,'evidence_bridge_link_id',p_evidence_bridge_link_id);
end; $$;

create or replace function public.signoff_audit_execution_engagement(p_engagement_id uuid, p_signoff_type text, p_actor_user_id uuid, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_SIGNOFF_AUTHORITY_REQUIRED'; end if;
  insert into public.audit_execution_signoffs(engagement_id, signoff_type, signoff_status, signed_by, signed_at, signoff_notes)
  values (p_engagement_id, coalesce(nullif(p_signoff_type, ''), 'lead_auditor'), 'signed_off', p_actor_user_id, now(), p_notes)
  returning id into v_id;
  perform public.record_clinical_governance_event('audit_signoff', v_id, 'audit_engagement_signed_off', coalesce(p_notes, 'Audit execution engagement signed off.'), p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.reject_audit_execution_signoff(p_signoff_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_SIGNOFF_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH37_REJECTION_REASON_REQUIRED'; end if;
  update public.audit_execution_signoffs set signoff_status = 'rejected', signoff_notes = p_reason where id = p_signoff_id;
  perform public.record_clinical_governance_event('audit_signoff', p_signoff_id, 'audit_signoff_rejected', p_reason, p_actor_user_id);
  return jsonb_build_object('status','rejected','signoff_id',p_signoff_id);
end; $$;

create or replace function public.create_ovr_rca_case(p_ovr_id uuid, p_incident_reference text, p_rca_title text, p_severity text, p_department_id uuid, p_owner_user_id uuid, p_due_date date, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.ovr_rca_cases(ovr_id, incident_reference, rca_title, severity, department_id, owner_user_id, due_date, created_by)
  values (p_ovr_id, p_incident_reference, p_rca_title, coalesce(nullif(p_severity, ''), 'medium'), p_department_id, p_owner_user_id, p_due_date, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('ovr_rca_case', v_id, 'ovr_rca_case_created', 'OVR RCA case created.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.update_ovr_rca_status(p_rca_case_id uuid, p_status text, p_actor_user_id uuid, p_root_cause_summary text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  perform public.patch37_service_role_required();
  select owner_user_id into v_owner from public.ovr_rca_cases where id = p_rca_case_id;
  if v_owner is distinct from p_actor_user_id and not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_RCA_OWNER_OR_AUTHORITY_REQUIRED'; end if;
  update public.ovr_rca_cases set rca_status = p_status, root_cause_summary = coalesce(p_root_cause_summary, root_cause_summary) where id = p_rca_case_id;
  perform public.record_clinical_governance_event('ovr_rca_case', p_rca_case_id, 'ovr_rca_status_updated', coalesce(p_root_cause_summary, 'OVR RCA status updated.'), p_actor_user_id);
  return jsonb_build_object('status',p_status,'rca_case_id',p_rca_case_id);
end; $$;

create or replace function public.close_ovr_rca_case(p_rca_case_id uuid, p_actor_user_id uuid, p_root_cause_summary text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_RCA_CLOSE_AUTHORITY_REQUIRED'; end if;
  update public.ovr_rca_cases set rca_status = 'closed', root_cause_summary = p_root_cause_summary, closed_at = now() where id = p_rca_case_id;
  perform public.record_clinical_governance_event('ovr_rca_case', p_rca_case_id, 'ovr_rca_case_closed', coalesce(p_root_cause_summary, 'OVR RCA case closed.'), p_actor_user_id);
  return jsonb_build_object('status','closed','rca_case_id',p_rca_case_id);
end; $$;

create or replace function public.link_ovr_to_capa_evidence_or_clause(p_ovr_id uuid, p_rca_case_id uuid, p_linked_entity_type text, p_linked_entity_id uuid, p_link_role text, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_AUTHORITY_REQUIRED'; end if;
  insert into public.ovr_capa_evidence_links(ovr_id, rca_case_id, linked_entity_type, linked_entity_id, link_role, created_by)
  values (p_ovr_id, p_rca_case_id, p_linked_entity_type, p_linked_entity_id, coalesce(nullif(p_link_role, ''), 'supporting'), p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('ovr_capa_evidence_link', v_id, 'ovr_link_created', 'OVR/RCA link created for CAPA, evidence, accreditation, risk, audit, document, training, or control.', p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.escalate_clinical_governance_item(p_ovr_id uuid, p_rca_case_id uuid, p_audit_finding_id uuid, p_escalation_level text, p_escalation_reason text, p_escalated_to_user_id uuid, p_escalated_to_department_id uuid, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_ESCALATION_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_escalation_reason), '') is null then raise exception 'PATCH37_ESCALATION_REASON_REQUIRED'; end if;
  insert into public.clinical_governance_escalations(ovr_id, rca_case_id, audit_finding_id, escalation_level, escalation_reason, escalated_to_user_id, escalated_to_department_id, escalated_by)
  values (p_ovr_id, p_rca_case_id, p_audit_finding_id, coalesce(nullif(p_escalation_level, ''), 'department'), p_escalation_reason, p_escalated_to_user_id, p_escalated_to_department_id, p_actor_user_id)
  returning id into v_id;
  perform public.record_clinical_governance_event('clinical_governance_escalation', v_id, 'clinical_governance_item_escalated', p_escalation_reason, p_actor_user_id);
  return v_id;
end; $$;

create or replace function public.acknowledge_clinical_governance_escalation(p_escalation_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_target uuid;
begin
  perform public.patch37_service_role_required();
  select escalated_to_user_id into v_target from public.clinical_governance_escalations where id = p_escalation_id;
  if v_target is distinct from p_actor_user_id and not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_ESCALATION_ACK_AUTHORITY_REQUIRED'; end if;
  update public.clinical_governance_escalations set escalation_status = 'acknowledged', acknowledged_at = now(), resolution_notes = coalesce(p_notes, resolution_notes) where id = p_escalation_id;
  perform public.record_clinical_governance_event('clinical_governance_escalation', p_escalation_id, 'clinical_governance_escalation_acknowledged', coalesce(p_notes, 'Clinical governance escalation acknowledged.'), p_actor_user_id);
  return jsonb_build_object('status','acknowledged','escalation_id',p_escalation_id);
end; $$;

create or replace function public.resolve_clinical_governance_escalation(p_escalation_id uuid, p_actor_user_id uuid, p_resolution_notes text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_ESCALATION_RESOLVE_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_resolution_notes), '') is null then raise exception 'PATCH37_ESCALATION_RESOLUTION_REQUIRED'; end if;
  update public.clinical_governance_escalations set escalation_status = 'resolved', resolved_at = now(), resolution_notes = p_resolution_notes where id = p_escalation_id;
  perform public.record_clinical_governance_event('clinical_governance_escalation', p_escalation_id, 'clinical_governance_escalation_resolved', p_resolution_notes, p_actor_user_id);
  return jsonb_build_object('status','resolved','escalation_id',p_escalation_id);
end; $$;

create or replace function public.get_clinical_governance_summary(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_SUMMARY_AUTHORITY_REQUIRED'; end if;
  select to_jsonb(s) into v_result from public.v_patch37_executive_clinical_governance_summary s limit 1;
  perform public.record_clinical_governance_event('clinical_governance_summary', null, 'clinical_governance_summary_viewed', 'Clinical governance summary viewed.', p_actor_user_id);
  return coalesce(v_result, '{}'::jsonb);
end; $$;

create or replace function public.get_audit_execution_summary(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  perform public.patch37_service_role_required();
  if not public.patch37_actor_has_clinical_governance_authority(p_actor_user_id) then raise exception 'PATCH37_SUMMARY_AUTHORITY_REQUIRED'; end if;
  select jsonb_build_object(
    'engagements', coalesce((select jsonb_agg(to_jsonb(e)) from public.v_patch37_audit_engagement_register e), '[]'::jsonb),
    'step_queue', coalesce((select jsonb_agg(to_jsonb(q)) from public.v_patch37_audit_test_step_queue q), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(f)) from public.v_patch37_audit_finding_register f), '[]'::jsonb)
  ) into v_result;
  perform public.record_clinical_governance_event('audit_execution_summary', null, 'audit_execution_summary_viewed', 'Audit execution summary viewed.', p_actor_user_id);
  return coalesce(v_result, '{}'::jsonb);
end; $$;

revoke all on function public.patch37_service_role_required() from public, anon, authenticated;
grant execute on function public.patch37_service_role_required() to service_role;
revoke all on function public.patch37_actor_has_clinical_governance_authority(uuid) from public, anon, authenticated;
grant execute on function public.patch37_actor_has_clinical_governance_authority(uuid) to service_role;
revoke all on function public.record_clinical_governance_event(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_clinical_governance_event(text, uuid, text, text, uuid) to service_role;
revoke all on function public.create_audit_execution_engagement(text, text, text, uuid, uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_execution_engagement(text, text, text, uuid, uuid, date, date, uuid) to service_role;
revoke all on function public.start_audit_execution_engagement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_audit_execution_engagement(uuid, uuid) to service_role;
revoke all on function public.close_audit_execution_engagement(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_audit_execution_engagement(uuid, uuid, text) to service_role;
revoke all on function public.create_audit_execution_program(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_execution_program(uuid, text, text, uuid, uuid, uuid) to service_role;
revoke all on function public.create_audit_execution_test_step(uuid, text, text, text, text, text, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_execution_test_step(uuid, text, text, text, text, text, uuid, date, uuid) to service_role;
revoke all on function public.update_audit_execution_test_step_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_audit_execution_test_step_status(uuid, text, uuid, text) to service_role;
revoke all on function public.create_audit_execution_sample(uuid, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_execution_sample(uuid, text, text, date, uuid) to service_role;
revoke all on function public.record_audit_execution_result(uuid, uuid, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_audit_execution_result(uuid, uuid, text, text, uuid, uuid) to service_role;
revoke all on function public.create_audit_execution_finding(uuid, uuid, text, text, text, uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_execution_finding(uuid, uuid, text, text, text, uuid, uuid, date, uuid) to service_role;
revoke all on function public.link_audit_finding_to_capa(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_audit_finding_to_capa(uuid, uuid, uuid) to service_role;
revoke all on function public.link_audit_finding_to_evidence_bridge(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_audit_finding_to_evidence_bridge(uuid, uuid, uuid) to service_role;
revoke all on function public.signoff_audit_execution_engagement(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.signoff_audit_execution_engagement(uuid, text, uuid, text) to service_role;
revoke all on function public.reject_audit_execution_signoff(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_audit_execution_signoff(uuid, uuid, text) to service_role;
revoke all on function public.reopen_audit_execution_engagement(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_audit_execution_engagement(uuid, uuid, text) to service_role;
revoke all on function public.create_ovr_rca_case(uuid, text, text, text, uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.create_ovr_rca_case(uuid, text, text, text, uuid, uuid, date, uuid) to service_role;
revoke all on function public.update_ovr_rca_status(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_ovr_rca_status(uuid, text, uuid, text) to service_role;
revoke all on function public.close_ovr_rca_case(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_ovr_rca_case(uuid, uuid, text) to service_role;
revoke all on function public.link_ovr_to_capa_evidence_or_clause(uuid, uuid, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.link_ovr_to_capa_evidence_or_clause(uuid, uuid, text, uuid, text, uuid) to service_role;
revoke all on function public.escalate_clinical_governance_item(uuid, uuid, uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.escalate_clinical_governance_item(uuid, uuid, uuid, text, text, uuid, uuid, uuid) to service_role;
revoke all on function public.acknowledge_clinical_governance_escalation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.acknowledge_clinical_governance_escalation(uuid, uuid, text) to service_role;
revoke all on function public.resolve_clinical_governance_escalation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_clinical_governance_escalation(uuid, uuid, text) to service_role;
revoke all on function public.get_clinical_governance_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_clinical_governance_summary(uuid) to service_role;
revoke all on function public.get_audit_execution_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_audit_execution_summary(uuid) to service_role;

comment on table public.audit_execution_engagements is 'Patch 37 real audit engagement execution register.';
comment on table public.audit_execution_programs is 'Patch 37 audit program/checklist structure.';
comment on table public.audit_execution_test_steps is 'Patch 37 DB-backed audit checklist and test step queue.';
comment on table public.audit_execution_samples is 'Patch 37 audit sample tracking.';
comment on table public.audit_execution_results is 'Patch 37 audit test result records with evidence linkage.';
comment on table public.audit_execution_findings is 'Patch 37 audit findings linked to CAPA, evidence bridge, and accreditation clauses.';
comment on table public.audit_execution_signoffs is 'Patch 37 audit engagement signoff register.';
comment on table public.ovr_rca_cases is 'Patch 37 RCA workflow for OVR and patient safety incidents.';
comment on table public.ovr_capa_evidence_links is 'Patch 37 bridge from OVR/RCA to CAPA, evidence bridge, accreditation, risk, audit, documents, training, and controls.';
comment on table public.clinical_governance_escalations is 'Patch 37 severe and sentinel clinical governance escalation register.';
comment on table public.clinical_governance_events is 'Patch 37 audit event trail for audit execution, OVR RCA, CAPA/evidence links, and escalations.';
