-- =========================================================
-- Patch 38: Unified Work Queue + Hospital Master Data Governance
-- Additive hospital master data overlays plus one operational work queue.
-- =========================================================

create table if not exists public.hospital_master_locations (
  id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  location_name text not null,
  location_name_ar text,
  location_type text not null default 'hospital_area' check (location_type in ('hospital','building','floor','ward','clinic','department_area','support_area','external_site','hospital_area')),
  parent_location_id uuid references public.hospital_master_locations(id) on delete set null,
  active boolean not null default true,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_services (
  id uuid primary key default gen_random_uuid(),
  service_code text not null unique,
  service_name text not null,
  service_name_ar text,
  service_type text not null default 'clinical' check (service_type in ('clinical','non_clinical','diagnostic','support','administrative','outsourced')),
  department_id uuid references public.departments(id) on delete set null,
  active boolean not null default true,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_clinical_areas (
  id uuid primary key default gen_random_uuid(),
  area_code text not null unique,
  area_name text not null,
  area_name_ar text,
  area_type text not null default 'clinical' check (area_type in ('clinical','non_clinical','support','administrative','high_risk')),
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.hospital_master_locations(id) on delete set null,
  active boolean not null default true,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_committees (
  id uuid primary key default gen_random_uuid(),
  committee_code text not null unique,
  committee_name text not null,
  committee_name_ar text,
  committee_type text not null default 'governance' check (committee_type in ('quality','patient_safety','infection_control','medication_safety','credentialing','executive','risk','audit','governance')),
  chair_user_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_job_titles (
  id uuid primary key default gen_random_uuid(),
  job_title_code text not null unique,
  job_title_name text not null,
  job_title_name_ar text,
  staff_category text not null default 'employee' check (staff_category in ('physician','nurse','allied_health','admin','support','leadership','contractor','employee')),
  clinical_role boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_quality_indicators (
  id uuid primary key default gen_random_uuid(),
  indicator_code text not null unique,
  indicator_name text not null,
  indicator_name_ar text,
  indicator_domain text not null default 'quality' check (indicator_domain in ('quality','patient_safety','infection_control','clinical_outcome','operational','accreditation','risk')),
  numerator_definition text,
  denominator_definition text,
  target_value numeric,
  target_direction text not null default 'higher_is_better' check (target_direction in ('higher_is_better','lower_is_better','range')),
  department_id uuid references public.departments(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_master_ownership_mappings (
  id uuid primary key default gen_random_uuid(),
  owner_entity_type text not null check (owner_entity_type in ('department','location','service','clinical_area','committee','job_title','quality_indicator','user')),
  owner_entity_id uuid not null,
  governed_entity_type text not null check (governed_entity_type in ('accreditation_clause','evidence_request','audit_engagement','audit_finding','ovr','rca_case','capa','training_assignment','document','approval','risk','committee_action')),
  governed_entity_id uuid not null,
  ownership_role text not null default 'owner' check (ownership_role in ('owner','reviewer','approver','observer','accountable','responsible')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.unified_work_queue_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch38_locations_parent on public.hospital_master_locations(parent_location_id, active);
create index if not exists idx_patch38_locations_owner on public.hospital_master_locations(owner_user_id, active);
create index if not exists idx_patch38_services_department on public.hospital_master_services(department_id, active);
create index if not exists idx_patch38_services_owner on public.hospital_master_services(owner_user_id, active);
create index if not exists idx_patch38_areas_department on public.hospital_master_clinical_areas(department_id, active);
create index if not exists idx_patch38_areas_location on public.hospital_master_clinical_areas(location_id, active);
create index if not exists idx_patch38_committees_department on public.hospital_master_committees(department_id, active);
create index if not exists idx_patch38_job_titles_category on public.hospital_master_job_titles(staff_category, active);
create index if not exists idx_patch38_indicators_department on public.hospital_master_quality_indicators(department_id, active);
create index if not exists idx_patch38_indicators_owner on public.hospital_master_quality_indicators(owner_user_id, active);
create index if not exists idx_patch38_ownership_owner on public.hospital_master_ownership_mappings(owner_entity_type, owner_entity_id, active);
create index if not exists idx_patch38_ownership_governed on public.hospital_master_ownership_mappings(governed_entity_type, governed_entity_id, active);
create index if not exists idx_patch38_queue_events_entity on public.unified_work_queue_events(entity_type, entity_id, created_at desc);

alter table public.hospital_master_locations enable row level security;
alter table public.hospital_master_services enable row level security;
alter table public.hospital_master_clinical_areas enable row level security;
alter table public.hospital_master_committees enable row level security;
alter table public.hospital_master_job_titles enable row level security;
alter table public.hospital_master_quality_indicators enable row level security;
alter table public.hospital_master_ownership_mappings enable row level security;
alter table public.unified_work_queue_events enable row level security;

drop policy if exists hospital_master_locations_read on public.hospital_master_locations;
create policy hospital_master_locations_read on public.hospital_master_locations for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists hospital_master_locations_write on public.hospital_master_locations;
create policy hospital_master_locations_write on public.hospital_master_locations for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_services_read on public.hospital_master_services;
create policy hospital_master_services_read on public.hospital_master_services for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists hospital_master_services_write on public.hospital_master_services;
create policy hospital_master_services_write on public.hospital_master_services for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_clinical_areas_read on public.hospital_master_clinical_areas;
create policy hospital_master_clinical_areas_read on public.hospital_master_clinical_areas for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists hospital_master_clinical_areas_write on public.hospital_master_clinical_areas;
create policy hospital_master_clinical_areas_write on public.hospital_master_clinical_areas for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_committees_read on public.hospital_master_committees;
create policy hospital_master_committees_read on public.hospital_master_committees for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or chair_user_id = auth.uid());
drop policy if exists hospital_master_committees_write on public.hospital_master_committees;
create policy hospital_master_committees_write on public.hospital_master_committees for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_job_titles_read on public.hospital_master_job_titles;
create policy hospital_master_job_titles_read on public.hospital_master_job_titles for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists hospital_master_job_titles_write on public.hospital_master_job_titles;
create policy hospital_master_job_titles_write on public.hospital_master_job_titles for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_quality_indicators_read on public.hospital_master_quality_indicators;
create policy hospital_master_quality_indicators_read on public.hospital_master_quality_indicators for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists hospital_master_quality_indicators_write on public.hospital_master_quality_indicators;
create policy hospital_master_quality_indicators_write on public.hospital_master_quality_indicators for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists hospital_master_ownership_mappings_read on public.hospital_master_ownership_mappings;
create policy hospital_master_ownership_mappings_read on public.hospital_master_ownership_mappings for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists hospital_master_ownership_mappings_write on public.hospital_master_ownership_mappings;
create policy hospital_master_ownership_mappings_write on public.hospital_master_ownership_mappings for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[])) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists unified_work_queue_events_read on public.unified_work_queue_events;
create policy unified_work_queue_events_read on public.unified_work_queue_events for select using (actor_user_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists unified_work_queue_events_insert on public.unified_work_queue_events;
create policy unified_work_queue_events_insert on public.unified_work_queue_events for insert with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

create or replace view public.v_patch38_hospital_location_register as
select l.*, p.full_name_en as owner_name_en, parent.location_name as parent_location_name
from public.hospital_master_locations l
left join public.profiles p on p.id = l.owner_user_id
left join public.hospital_master_locations parent on parent.id = l.parent_location_id;

create or replace view public.v_patch38_hospital_service_register as
select s.*, d.name_en as department_name_en, p.full_name_en as owner_name_en
from public.hospital_master_services s
left join public.departments d on d.id = s.department_id
left join public.profiles p on p.id = s.owner_user_id;

create or replace view public.v_patch38_clinical_area_register as
select a.*, d.name_en as department_name_en, l.location_name, p.full_name_en as owner_name_en
from public.hospital_master_clinical_areas a
left join public.departments d on d.id = a.department_id
left join public.hospital_master_locations l on l.id = a.location_id
left join public.profiles p on p.id = a.owner_user_id;

create or replace view public.v_patch38_committee_register as
select c.*, d.name_en as department_name_en, chair.full_name_en as chair_name_en
from public.hospital_master_committees c
left join public.departments d on d.id = c.department_id
left join public.profiles chair on chair.id = c.chair_user_id;

create or replace view public.v_patch38_job_title_register as
select *
from public.hospital_master_job_titles;

create or replace view public.v_patch38_quality_indicator_register as
select qi.*, d.name_en as department_name_en, p.full_name_en as owner_name_en
from public.hospital_master_quality_indicators qi
left join public.departments d on d.id = qi.department_id
left join public.profiles p on p.id = qi.owner_user_id;

create or replace view public.v_patch38_master_data_exception_register as
select 'location'::text as item_type, id as item_id, location_code as item_code, location_name as item_name, active, owner_user_id, null::uuid as department_id, case when owner_user_id is null then 'missing_owner' else 'inactive' end as exception_type
from public.hospital_master_locations where active = false or owner_user_id is null
union all
select 'service', id, service_code, service_name, active, owner_user_id, department_id, case when owner_user_id is null then 'missing_owner' else 'inactive' end
from public.hospital_master_services where active = false or owner_user_id is null
union all
select 'clinical_area', id, area_code, area_name, active, owner_user_id, department_id, case when owner_user_id is null then 'missing_owner' else 'inactive' end
from public.hospital_master_clinical_areas where active = false or owner_user_id is null
union all
select 'committee', id, committee_code, committee_name, active, chair_user_id, department_id, case when chair_user_id is null then 'missing_chair' else 'inactive' end
from public.hospital_master_committees where active = false or chair_user_id is null
union all
select 'job_title', id, job_title_code, job_title_name, active, null::uuid, null::uuid, 'inactive'
from public.hospital_master_job_titles where active = false
union all
select 'quality_indicator', id, indicator_code, indicator_name, active, owner_user_id, department_id, case when owner_user_id is null then 'missing_owner' else 'inactive' end
from public.hospital_master_quality_indicators where active = false or owner_user_id is null;

create or replace view public.v_patch38_master_data_ownership_register as
select
  m.*,
  case
    when m.owner_entity_type = 'department' then d.name_en
    when m.owner_entity_type = 'location' then l.location_name
    when m.owner_entity_type = 'service' then s.service_name
    when m.owner_entity_type = 'clinical_area' then a.area_name
    when m.owner_entity_type = 'committee' then c.committee_name
    when m.owner_entity_type = 'job_title' then jt.job_title_name
    when m.owner_entity_type = 'quality_indicator' then qi.indicator_name
    when m.owner_entity_type = 'user' then p.full_name_en
    else null
  end as owner_entity_name
from public.hospital_master_ownership_mappings m
left join public.departments d on m.owner_entity_type = 'department' and d.id = m.owner_entity_id
left join public.hospital_master_locations l on m.owner_entity_type = 'location' and l.id = m.owner_entity_id
left join public.hospital_master_services s on m.owner_entity_type = 'service' and s.id = m.owner_entity_id
left join public.hospital_master_clinical_areas a on m.owner_entity_type = 'clinical_area' and a.id = m.owner_entity_id
left join public.hospital_master_committees c on m.owner_entity_type = 'committee' and c.id = m.owner_entity_id
left join public.hospital_master_job_titles jt on m.owner_entity_type = 'job_title' and jt.id = m.owner_entity_id
left join public.hospital_master_quality_indicators qi on m.owner_entity_type = 'quality_indicator' and qi.id = m.owner_entity_id
left join public.profiles p on m.owner_entity_type = 'user' and p.id = m.owner_entity_id;

create or replace view public.v_patch38_unified_work_queue as
select 'accreditation'::text as source_module, 'accreditation_clause_task'::text as work_type, t.id as work_id, t.task_type as work_title, t.clause_title as work_description, t.status as work_status, t.priority, t.assigned_to_user_id, t.assigned_to_department_id as department_id, t.assigned_department_name as department_name, t.due_date, t.created_at, t.is_overdue, (t.status in ('submitted','under_review')) as waiting_for_review, (t.status = 'escalated') as is_escalated, t.clause_id as linked_entity_id, 'accreditation_clause'::text as linked_entity_type
from public.v_patch35_clause_owner_task_queue t
union all
select 'evidence_bridge','evidence_collection_request', e.id, e.request_title, e.request_description, e.status, e.priority, e.assigned_to_user_id, e.assigned_to_department_id, e.assigned_department_name, e.due_date, e.requested_at, e.is_overdue, (e.status in ('submitted','under_review')) as waiting_for_review, false, e.bridge_link_id, 'evidence_bridge'
from public.v_patch33_evidence_collection_queue e
union all
select 'training','training_assignment', tr.id, tr.program_title, tr.training_type, tr.status, null::text, tr.assigned_to_user_id, tr.assigned_to_department_id, tr.department_name_en, tr.due_date, tr.assigned_at, (tr.due_date < current_date and tr.status in ('assigned','in_progress')) as is_overdue, (tr.status = 'pending_review') as waiting_for_review, false, tr.program_id, 'training_program'
from public.v_patch29_training_assignment_queue tr
where tr.status not in ('completed','waived','cancelled')
union all
select 'audit','audit_test_step', a.id, a.step_title, a.expected_evidence, a.status, null::text, a.assigned_to_user_id, null::uuid, null::text, a.due_date, a.created_at, a.is_overdue, false, false, a.engagement_id, 'audit_engagement'
from public.v_patch37_audit_test_step_queue a
union all
select 'audit','audit_finding', f.id, f.finding_title, f.finding_description, f.finding_status, f.severity, f.owner_user_id, f.department_id, f.department_name, f.due_date, f.created_at, f.is_overdue, (f.finding_status = 'under_review'), false, f.engagement_id, 'audit_engagement'
from public.v_patch37_audit_finding_register f
where f.finding_status not in ('closed','waived')
union all
select 'audit','audit_signoff', s.id, s.signoff_type, s.engagement_title, s.signoff_status, null::text, s.signed_by, null::uuid, null::text, null::date, s.created_at, false, true, false, s.engagement_id, 'audit_engagement'
from public.v_patch37_audit_signoff_queue s
union all
select 'ovr','ovr_rca_case', r.id, r.rca_title, r.root_cause_summary, r.rca_status, r.severity, r.owner_user_id, r.department_id, r.department_name, r.due_date, r.created_at, r.is_overdue, (r.rca_status = 'awaiting_review'), false, r.ovr_id, 'ovr'
from public.v_patch37_ovr_rca_case_register r
where r.rca_status not in ('closed','waived','cancelled')
union all
select 'clinical_governance','clinical_governance_escalation', g.id, g.escalation_reason, coalesce(g.rca_title, g.finding_title), g.escalation_status, g.escalation_level, g.escalated_to_user_id, g.escalated_to_department_id, g.escalated_to_department_name, null::date, g.escalated_at, false, false, (g.escalation_status in ('open','acknowledged','action_required')), coalesce(g.rca_case_id, g.audit_finding_id), case when g.rca_case_id is not null then 'rca_case' else 'audit_finding' end
from public.v_patch37_clinical_governance_escalation_register g
where g.escalation_status in ('open','acknowledged','action_required')
union all
select 'capa','capa_action_item', ci.id, ci.action_item_title, ci.action_item_description, ci.status, ci.priority_level, ci.action_owner_id, ci.department_id, d.name_en, ci.due_date, ci.created_at, (ci.due_date < current_date and ci.status not in ('completed','cancelled')) as is_overdue, (ci.status = 'evidence_required') as waiting_for_review, (ci.status = 'blocked') as is_escalated, ci.capa_id, 'capa'
from public.capa_action_items ci
left join public.departments d on d.id = ci.department_id
where ci.status not in ('completed','cancelled')
union all
select 'document','document_acknowledgment', req.id, coalesce(doc.document_title, req.requirement_scope), req.requirement_scope, 'pending', null::text, req.user_id, req.department_id, d.name_en, req.due_date, req.created_at, (req.due_date < current_date) as is_overdue, false, false, req.document_id, 'document'
from public.document_acknowledgment_requirements req
left join public.controlled_documents doc on doc.id = req.document_id
left join public.departments d on d.id = req.department_id
where req.required_flag = true and not exists (
  select 1 from public.document_acknowledgments ack
  where ack.document_id = req.document_id and ack.user_id = req.user_id
)
union all
select 'approval','approval_request', ar.id, ar.action_type, ar.request_reason, ar.request_status, coalesce(ar.criticality_level, ar.severity_level, ar.risk_level), ar.escalated_to, ar.department_id, d.name_en, ar.due_date, ar.created_at, (ar.due_date < current_date and ar.request_status not in ('approved','rejected','cancelled','expired')) as is_overdue, (ar.request_status in ('pending','partially_approved')) as waiting_for_review, ar.escalation_required, ar.linked_item_id, ar.linked_item_type
from public.approval_requests ar
left join public.departments d on d.id = ar.department_id
where ar.request_status not in ('approved','rejected','cancelled','expired');

create or replace view public.v_patch38_my_work_queue as
select *
from public.v_patch38_unified_work_queue
where assigned_to_user_id = auth.uid();

create or replace view public.v_patch38_department_work_queue as
select q.*
from public.v_patch38_unified_work_queue q
where q.department_id in (
  select ur.department_id from public.user_roles ur
  where ur.user_id = auth.uid() and ur.is_active = true and ur.department_id is not null
)
or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]);

create or replace view public.v_patch38_overdue_work_queue as
select * from public.v_patch38_unified_work_queue where is_overdue = true;

create or replace view public.v_patch38_escalated_work_queue as
select * from public.v_patch38_unified_work_queue where is_escalated = true or work_status in ('escalated','blocked','action_required');

create or replace view public.v_patch38_waiting_for_review_queue as
select * from public.v_patch38_unified_work_queue where waiting_for_review = true;

create or replace view public.v_patch38_executive_workload_summary as
select
  source_module,
  count(*) as open_work_count,
  count(*) filter (where is_overdue) as overdue_work_count,
  count(*) filter (where waiting_for_review) as waiting_for_review_count,
  count(*) filter (where is_escalated) as escalated_work_count
from public.v_patch38_unified_work_queue
group by source_module;

create or replace view public.v_patch38_user_workload_summary as
select
  assigned_to_user_id,
  p.full_name_en as assigned_to_name,
  count(*) as open_work_count,
  count(*) filter (where is_overdue) as overdue_work_count,
  min(due_date) as nearest_due_date
from public.v_patch38_unified_work_queue q
left join public.profiles p on p.id = q.assigned_to_user_id
where assigned_to_user_id is not null
group by assigned_to_user_id, p.full_name_en;

create or replace view public.v_patch38_department_workload_summary as
select
  department_id,
  department_name,
  count(*) as open_work_count,
  count(*) filter (where is_overdue) as overdue_work_count,
  count(*) filter (where waiting_for_review) as waiting_for_review_count,
  count(*) filter (where is_escalated) as escalated_work_count,
  min(due_date) as nearest_due_date
from public.v_patch38_unified_work_queue
where department_id is not null
group by department_id, department_name;

create or replace view public.v_patch38_governance_operating_summary as
select
  (select count(*) from public.v_patch38_unified_work_queue) as open_work_count,
  (select count(*) from public.v_patch38_my_work_queue) as my_work_count,
  (select count(*) from public.v_patch38_overdue_work_queue) as overdue_work_count,
  (select count(*) from public.v_patch38_escalated_work_queue) as escalated_work_count,
  (select count(*) from public.v_patch38_waiting_for_review_queue) as waiting_for_review_count,
  (select count(*) from public.v_patch38_master_data_exception_register) as master_data_exception_count,
  case
    when (select count(*) from public.v_patch38_overdue_work_queue) > 0 then 'attention_required'
    when (select count(*) from public.v_patch38_escalated_work_queue) > 0 then 'watch'
    else 'on_track'
  end as executive_signal;

alter view public.v_patch38_hospital_location_register set (security_invoker = true);
alter view public.v_patch38_hospital_service_register set (security_invoker = true);
alter view public.v_patch38_clinical_area_register set (security_invoker = true);
alter view public.v_patch38_committee_register set (security_invoker = true);
alter view public.v_patch38_job_title_register set (security_invoker = true);
alter view public.v_patch38_quality_indicator_register set (security_invoker = true);
alter view public.v_patch38_master_data_exception_register set (security_invoker = true);
alter view public.v_patch38_master_data_ownership_register set (security_invoker = true);
alter view public.v_patch38_unified_work_queue set (security_invoker = true);
alter view public.v_patch38_my_work_queue set (security_invoker = true);
alter view public.v_patch38_department_work_queue set (security_invoker = true);
alter view public.v_patch38_overdue_work_queue set (security_invoker = true);
alter view public.v_patch38_escalated_work_queue set (security_invoker = true);
alter view public.v_patch38_waiting_for_review_queue set (security_invoker = true);
alter view public.v_patch38_executive_workload_summary set (security_invoker = true);
alter view public.v_patch38_user_workload_summary set (security_invoker = true);
alter view public.v_patch38_department_workload_summary set (security_invoker = true);
alter view public.v_patch38_governance_operating_summary set (security_invoker = true);

grant select on public.v_patch38_hospital_location_register to authenticated;
grant select on public.v_patch38_hospital_service_register to authenticated;
grant select on public.v_patch38_clinical_area_register to authenticated;
grant select on public.v_patch38_committee_register to authenticated;
grant select on public.v_patch38_job_title_register to authenticated;
grant select on public.v_patch38_quality_indicator_register to authenticated;
grant select on public.v_patch38_master_data_exception_register to authenticated;
grant select on public.v_patch38_master_data_ownership_register to authenticated;
grant select on public.v_patch38_unified_work_queue to authenticated;
grant select on public.v_patch38_my_work_queue to authenticated;
grant select on public.v_patch38_department_work_queue to authenticated;
grant select on public.v_patch38_overdue_work_queue to authenticated;
grant select on public.v_patch38_escalated_work_queue to authenticated;
grant select on public.v_patch38_waiting_for_review_queue to authenticated;
grant select on public.v_patch38_executive_workload_summary to authenticated;
grant select on public.v_patch38_user_workload_summary to authenticated;
grant select on public.v_patch38_department_workload_summary to authenticated;
grant select on public.v_patch38_governance_operating_summary to authenticated;

create or replace function public.patch38_service_role_required()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if current_setting('role', true) <> 'service_role' then raise exception 'PATCH38_SERVICE_ROLE_REQUIRED'; end if;
end; $$;

create or replace function public.patch38_actor_has_master_data_authority(p_actor_user_id uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_user_id and ur.is_active = true
      and ur.role in ('super_admin','governance_admin','compliance_officer')
  );
$$;

create or replace function public.record_unified_work_queue_event(p_entity_type text, p_entity_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event_id uuid;
begin
  perform public.patch38_service_role_required();
  if nullif(trim(p_event_summary), '') is null then raise exception 'PATCH38_EVENT_SUMMARY_REQUIRED'; end if;
  insert into public.unified_work_queue_events(entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_event_id;
  return v_event_id;
end; $$;

create or replace function public.create_hospital_location(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_locations(location_code, location_name, location_name_ar, location_type, parent_location_id, owner_user_id, created_by)
  values (p_payload->>'location_code', p_payload->>'location_name', p_payload->>'location_name_ar', coalesce(nullif(p_payload->>'location_type',''),'hospital_area'), nullif(p_payload->>'parent_location_id','')::uuid, nullif(p_payload->>'owner_user_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_location', v_id, 'hospital_location_created', 'Hospital location created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_location_status(p_location_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_locations set active = p_active where id = p_location_id;
  perform public.record_unified_work_queue_event('hospital_master_location', p_location_id, 'hospital_location_status_updated', 'Hospital location status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_location_id,'active',p_active); end; $$;

create or replace function public.create_hospital_service(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_services(service_code, service_name, service_name_ar, service_type, department_id, owner_user_id, created_by)
  values (p_payload->>'service_code', p_payload->>'service_name', p_payload->>'service_name_ar', coalesce(nullif(p_payload->>'service_type',''),'clinical'), nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'owner_user_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_service', v_id, 'hospital_service_created', 'Hospital service created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_service_status(p_service_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_services set active = p_active where id = p_service_id;
  perform public.record_unified_work_queue_event('hospital_master_service', p_service_id, 'hospital_service_status_updated', 'Hospital service status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_service_id,'active',p_active); end; $$;

create or replace function public.create_hospital_clinical_area(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_clinical_areas(area_code, area_name, area_name_ar, area_type, department_id, location_id, owner_user_id, created_by)
  values (p_payload->>'area_code', p_payload->>'area_name', p_payload->>'area_name_ar', coalesce(nullif(p_payload->>'area_type',''),'clinical'), nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'location_id','')::uuid, nullif(p_payload->>'owner_user_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_clinical_area', v_id, 'hospital_clinical_area_created', 'Hospital clinical area created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_clinical_area_status(p_area_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_clinical_areas set active = p_active where id = p_area_id;
  perform public.record_unified_work_queue_event('hospital_master_clinical_area', p_area_id, 'hospital_clinical_area_status_updated', 'Hospital clinical area status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_area_id,'active',p_active); end; $$;

create or replace function public.create_hospital_committee(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_committees(committee_code, committee_name, committee_name_ar, committee_type, chair_user_id, department_id, created_by)
  values (p_payload->>'committee_code', p_payload->>'committee_name', p_payload->>'committee_name_ar', coalesce(nullif(p_payload->>'committee_type',''),'governance'), nullif(p_payload->>'chair_user_id','')::uuid, nullif(p_payload->>'department_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_committee', v_id, 'hospital_committee_created', 'Hospital committee created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_committee_status(p_committee_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_committees set active = p_active where id = p_committee_id;
  perform public.record_unified_work_queue_event('hospital_master_committee', p_committee_id, 'hospital_committee_status_updated', 'Hospital committee status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_committee_id,'active',p_active); end; $$;

create or replace function public.create_hospital_job_title(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_job_titles(job_title_code, job_title_name, job_title_name_ar, staff_category, clinical_role, created_by)
  values (p_payload->>'job_title_code', p_payload->>'job_title_name', p_payload->>'job_title_name_ar', coalesce(nullif(p_payload->>'staff_category',''),'employee'), coalesce(nullif(p_payload->>'clinical_role','')::boolean,false), p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_job_title', v_id, 'hospital_job_title_created', 'Hospital job title created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_job_title_status(p_job_title_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_job_titles set active = p_active where id = p_job_title_id;
  perform public.record_unified_work_queue_event('hospital_master_job_title', p_job_title_id, 'hospital_job_title_status_updated', 'Hospital job title status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_job_title_id,'active',p_active); end; $$;

create or replace function public.create_hospital_quality_indicator(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_quality_indicators(indicator_code, indicator_name, indicator_name_ar, indicator_domain, numerator_definition, denominator_definition, target_value, target_direction, department_id, owner_user_id, created_by)
  values (p_payload->>'indicator_code', p_payload->>'indicator_name', p_payload->>'indicator_name_ar', coalesce(nullif(p_payload->>'indicator_domain',''),'quality'), p_payload->>'numerator_definition', p_payload->>'denominator_definition', nullif(p_payload->>'target_value','')::numeric, coalesce(nullif(p_payload->>'target_direction',''),'higher_is_better'), nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'owner_user_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_quality_indicator', v_id, 'hospital_quality_indicator_created', 'Hospital quality indicator created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.update_hospital_quality_indicator_status(p_indicator_id uuid, p_active boolean, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_quality_indicators set active = p_active where id = p_indicator_id;
  perform public.record_unified_work_queue_event('hospital_master_quality_indicator', p_indicator_id, 'hospital_quality_indicator_status_updated', 'Hospital quality indicator status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_indicator_id,'active',p_active); end; $$;

create or replace function public.create_hospital_ownership_mapping(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_master_ownership_mappings(owner_entity_type, owner_entity_id, governed_entity_type, governed_entity_id, ownership_role, created_by)
  values (p_payload->>'owner_entity_type', nullif(p_payload->>'owner_entity_id','')::uuid, p_payload->>'governed_entity_type', nullif(p_payload->>'governed_entity_id','')::uuid, coalesce(nullif(p_payload->>'ownership_role',''),'owner'), p_actor_user_id) returning id into v_id;
  perform public.record_unified_work_queue_event('hospital_master_ownership_mapping', v_id, 'hospital_ownership_mapping_created', 'Hospital ownership mapping created.', p_actor_user_id); return v_id; end; $$;

create or replace function public.deactivate_hospital_ownership_mapping(p_mapping_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch38_service_role_required(); if not public.patch38_actor_has_master_data_authority(p_actor_user_id) then raise exception 'PATCH38_MASTER_DATA_AUTHORITY_REQUIRED'; end if;
  update public.hospital_master_ownership_mappings set active = false where id = p_mapping_id;
  perform public.record_unified_work_queue_event('hospital_master_ownership_mapping', p_mapping_id, 'hospital_ownership_mapping_deactivated', 'Hospital ownership mapping deactivated.', p_actor_user_id); return jsonb_build_object('status','deactivated','id',p_mapping_id); end; $$;

create or replace function public.get_my_work_queue(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch38_service_role_required();
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) into v_result from public.v_patch38_unified_work_queue q where q.assigned_to_user_id = p_actor_user_id;
  perform public.record_unified_work_queue_event('unified_work_queue', null, 'my_work_queue_viewed', 'My work queue viewed.', p_actor_user_id); return v_result; end; $$;

create or replace function public.get_department_work_queue(p_department_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch38_service_role_required();
  if not public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) then raise exception 'PATCH38_DEPARTMENT_QUEUE_AUTHORITY_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) into v_result from public.v_patch38_unified_work_queue q where q.department_id = p_department_id;
  perform public.record_unified_work_queue_event('unified_work_queue', null, 'department_work_queue_viewed', 'Department work queue viewed.', p_actor_user_id); return v_result; end; $$;

create or replace function public.get_executive_workload_summary(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch38_service_role_required();
  if not public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]) then raise exception 'PATCH38_EXECUTIVE_SUMMARY_AUTHORITY_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_result from public.v_patch38_executive_workload_summary s;
  perform public.record_unified_work_queue_event('unified_work_queue', null, 'executive_workload_summary_viewed', 'Executive workload summary viewed.', p_actor_user_id); return v_result; end; $$;

create or replace function public.get_governance_operating_summary(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch38_service_role_required();
  if not public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]) then raise exception 'PATCH38_GOVERNANCE_SUMMARY_AUTHORITY_REQUIRED'; end if;
  select to_jsonb(s) into v_result from public.v_patch38_governance_operating_summary s limit 1;
  perform public.record_unified_work_queue_event('unified_work_queue', null, 'governance_operating_summary_viewed', 'Governance operating summary viewed.', p_actor_user_id); return coalesce(v_result, '{}'::jsonb); end; $$;

revoke all on function public.patch38_service_role_required() from public, anon, authenticated; grant execute on function public.patch38_service_role_required() to service_role;
revoke all on function public.patch38_actor_has_master_data_authority(uuid) from public, anon, authenticated; grant execute on function public.patch38_actor_has_master_data_authority(uuid) to service_role;
revoke all on function public.record_unified_work_queue_event(text, uuid, text, text, uuid) from public, anon, authenticated; grant execute on function public.record_unified_work_queue_event(text, uuid, text, text, uuid) to service_role;
revoke all on function public.create_hospital_location(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_location(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_location_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_location_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_service(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_service(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_service_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_service_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_clinical_area(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_clinical_area(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_clinical_area_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_clinical_area_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_committee(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_committee(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_committee_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_committee_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_job_title(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_job_title(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_job_title_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_job_title_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_quality_indicator(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_quality_indicator(uuid, jsonb) to service_role;
revoke all on function public.update_hospital_quality_indicator_status(uuid, boolean, uuid) from public, anon, authenticated; grant execute on function public.update_hospital_quality_indicator_status(uuid, boolean, uuid) to service_role;
revoke all on function public.create_hospital_ownership_mapping(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_ownership_mapping(uuid, jsonb) to service_role;
revoke all on function public.deactivate_hospital_ownership_mapping(uuid, uuid) from public, anon, authenticated; grant execute on function public.deactivate_hospital_ownership_mapping(uuid, uuid) to service_role;
revoke all on function public.get_my_work_queue(uuid) from public, anon, authenticated; grant execute on function public.get_my_work_queue(uuid) to service_role;
revoke all on function public.get_department_work_queue(uuid, uuid) from public, anon, authenticated; grant execute on function public.get_department_work_queue(uuid, uuid) to service_role;
revoke all on function public.get_executive_workload_summary(uuid) from public, anon, authenticated; grant execute on function public.get_executive_workload_summary(uuid) to service_role;
revoke all on function public.get_governance_operating_summary(uuid) from public, anon, authenticated; grant execute on function public.get_governance_operating_summary(uuid) to service_role;

comment on table public.hospital_master_locations is 'Patch 38 governed hospital location master data.';
comment on table public.hospital_master_services is 'Patch 38 governed hospital service master data.';
comment on table public.hospital_master_clinical_areas is 'Patch 38 governed clinical and operating area master data.';
comment on table public.hospital_master_committees is 'Patch 38 governed hospital committee master data.';
comment on table public.hospital_master_job_titles is 'Patch 38 governed job title and staff category master data.';
comment on table public.hospital_master_quality_indicators is 'Patch 38 governed quality and accreditation indicator master data.';
comment on table public.hospital_master_ownership_mappings is 'Patch 38 generic ownership mapping between hospital master data and governance entities.';
comment on table public.unified_work_queue_events is 'Patch 38 event log for unified work queue and hospital master data governance actions.';
