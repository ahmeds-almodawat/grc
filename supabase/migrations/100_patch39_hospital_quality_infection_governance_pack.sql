-- =========================================================
-- Patch 39: Hospital Quality, Infection Control & Governance Pack
-- Additive hospital-specific operating registers linked to master data,
-- evidence bridge, accreditation clauses, and work queue compatible views.
-- =========================================================

create table if not exists public.infection_control_surveillance_events (
  id uuid primary key default gen_random_uuid(),
  event_reference text unique,
  event_type text not null check (event_type in ('hai_surveillance','outbreak','hand_hygiene_audit','isolation_check','sterilization_check','infection_control_round','exposure_event')),
  event_title text not null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.hospital_master_locations(id) on delete set null,
  service_id uuid references public.hospital_master_services(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','under_review','action_required','closed','cancelled')),
  observed_on date,
  due_date date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  accreditation_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.clinical_quality_indicator_results (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid references public.hospital_master_quality_indicators(id) on delete set null,
  indicator_code text,
  indicator_name text not null,
  department_id uuid references public.departments(id) on delete set null,
  service_id uuid references public.hospital_master_services(id) on delete set null,
  period_start date,
  period_end date,
  numerator numeric,
  denominator numeric,
  result_value numeric,
  target_value numeric,
  target_direction text not null default 'lower_is_better' check (target_direction in ('higher_is_better','lower_is_better','range')),
  performance_status text not null default 'not_assessed' check (performance_status in ('not_assessed','on_target','off_target','watch','critical')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.hospital_committee_meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid references public.hospital_master_committees(id) on delete set null,
  meeting_title text not null,
  meeting_date date,
  meeting_status text not null default 'planned' check (meeting_status in ('planned','held','minutes_pending','minutes_approved','cancelled')),
  chair_user_id uuid references public.profiles(id) on delete set null,
  minutes_document_id uuid,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_committee_actions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.hospital_committee_meetings(id) on delete set null,
  committee_id uuid references public.hospital_master_committees(id) on delete set null,
  action_title text not null,
  action_description text,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_department_id uuid references public.departments(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','under_review','completed','overdue','cancelled','escalated')),
  due_date date,
  linked_entity_type text check (linked_entity_type is null or linked_entity_type in ('accreditation_clause','evidence_request','capa','risk','audit_finding','ovr_rca','document','training')),
  linked_entity_id uuid,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.clinical_credentialing_records (
  id uuid primary key default gen_random_uuid(),
  practitioner_user_id uuid references public.profiles(id) on delete set null,
  practitioner_name text,
  department_id uuid references public.departments(id) on delete set null,
  job_title_id uuid references public.hospital_master_job_titles(id) on delete set null,
  credential_type text not null check (credential_type in ('license','privilege','certification','competency','training_requirement','scope_of_practice')),
  credential_title text not null,
  credential_status text not null default 'active' check (credential_status in ('active','pending_review','expired','suspended','revoked','waived')),
  issued_on date,
  expires_on date,
  due_date date,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  accreditation_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_biomedical_safety_evidence (
  id uuid primary key default gen_random_uuid(),
  safety_item_reference text unique,
  safety_domain text not null check (safety_domain in ('facility_safety','biomedical_equipment','fire_safety','emergency_preparedness','medical_gas','maintenance','environmental_safety','security_safety')),
  safety_item_title text not null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.hospital_master_locations(id) on delete set null,
  equipment_reference text,
  status text not null default 'open' check (status in ('open','in_progress','evidence_required','under_review','compliant','non_compliant','expired','cancelled')),
  due_date date,
  last_checked_on date,
  next_check_due date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  evidence_bridge_link_id uuid references public.evidence_bridge_links(id) on delete set null,
  accreditation_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_governance_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch39_infection_status on public.infection_control_surveillance_events(status, severity, due_date);
create index if not exists idx_patch39_infection_owner on public.infection_control_surveillance_events(owner_user_id, status);
create index if not exists idx_patch39_infection_department on public.infection_control_surveillance_events(department_id, status);
create index if not exists idx_patch39_quality_status on public.clinical_quality_indicator_results(performance_status, period_end);
create index if not exists idx_patch39_quality_owner on public.clinical_quality_indicator_results(owner_user_id, performance_status);
create index if not exists idx_patch39_meetings_committee on public.hospital_committee_meetings(committee_id, meeting_date);
create index if not exists idx_patch39_actions_assignee on public.hospital_committee_actions(assigned_to_user_id, status, due_date);
create index if not exists idx_patch39_actions_department on public.hospital_committee_actions(assigned_to_department_id, status);
create index if not exists idx_patch39_credentials_expiry on public.clinical_credentialing_records(credential_status, expires_on, due_date);
create index if not exists idx_patch39_credentials_practitioner on public.clinical_credentialing_records(practitioner_user_id, credential_status);
create index if not exists idx_patch39_facility_status on public.facility_biomedical_safety_evidence(status, due_date, next_check_due);
create index if not exists idx_patch39_facility_owner on public.facility_biomedical_safety_evidence(owner_user_id, status);
create index if not exists idx_patch39_governance_events_entity on public.hospital_governance_events(entity_type, entity_id, created_at desc);

alter table public.infection_control_surveillance_events enable row level security;
alter table public.clinical_quality_indicator_results enable row level security;
alter table public.hospital_committee_meetings enable row level security;
alter table public.hospital_committee_actions enable row level security;
alter table public.clinical_credentialing_records enable row level security;
alter table public.facility_biomedical_safety_evidence enable row level security;
alter table public.hospital_governance_events enable row level security;

drop policy if exists infection_control_surveillance_events_read on public.infection_control_surveillance_events;
create policy infection_control_surveillance_events_read on public.infection_control_surveillance_events for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists infection_control_surveillance_events_write on public.infection_control_surveillance_events;
create policy infection_control_surveillance_events_write on public.infection_control_surveillance_events for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());

drop policy if exists clinical_quality_indicator_results_read on public.clinical_quality_indicator_results;
create policy clinical_quality_indicator_results_read on public.clinical_quality_indicator_results for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists clinical_quality_indicator_results_write on public.clinical_quality_indicator_results;
create policy clinical_quality_indicator_results_write on public.clinical_quality_indicator_results for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());

drop policy if exists hospital_committee_meetings_read on public.hospital_committee_meetings;
create policy hospital_committee_meetings_read on public.hospital_committee_meetings for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or chair_user_id = auth.uid());
drop policy if exists hospital_committee_meetings_write on public.hospital_committee_meetings;
create policy hospital_committee_meetings_write on public.hospital_committee_meetings for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or chair_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or chair_user_id = auth.uid());

drop policy if exists hospital_committee_actions_read on public.hospital_committee_actions;
create policy hospital_committee_actions_read on public.hospital_committee_actions for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or assigned_to_user_id = auth.uid());
drop policy if exists hospital_committee_actions_write on public.hospital_committee_actions;
create policy hospital_committee_actions_write on public.hospital_committee_actions for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or assigned_to_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or assigned_to_user_id = auth.uid());

drop policy if exists clinical_credentialing_records_read on public.clinical_credentialing_records;
create policy clinical_credentialing_records_read on public.clinical_credentialing_records for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or practitioner_user_id = auth.uid() or reviewer_user_id = auth.uid());
drop policy if exists clinical_credentialing_records_write on public.clinical_credentialing_records;
create policy clinical_credentialing_records_write on public.clinical_credentialing_records for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or reviewer_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or reviewer_user_id = auth.uid());

drop policy if exists facility_biomedical_safety_evidence_read on public.facility_biomedical_safety_evidence;
create policy facility_biomedical_safety_evidence_read on public.facility_biomedical_safety_evidence for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());
drop policy if exists facility_biomedical_safety_evidence_write on public.facility_biomedical_safety_evidence;
create policy facility_biomedical_safety_evidence_write on public.facility_biomedical_safety_evidence for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid()) with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]) or owner_user_id = auth.uid());

drop policy if exists hospital_governance_events_read on public.hospital_governance_events;
create policy hospital_governance_events_read on public.hospital_governance_events for select using (actor_user_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));
drop policy if exists hospital_governance_events_insert on public.hospital_governance_events;
create policy hospital_governance_events_insert on public.hospital_governance_events for insert with check (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

create or replace view public.v_patch39_infection_control_register as
select e.*, d.name_en as department_name_en, l.location_name, s.service_name, p.full_name_en as owner_name_en, c.clause_code, c.clause_title
from public.infection_control_surveillance_events e
left join public.departments d on d.id = e.department_id
left join public.hospital_master_locations l on l.id = e.location_id
left join public.hospital_master_services s on s.id = e.service_id
left join public.profiles p on p.id = e.owner_user_id
left join public.accreditation_clauses c on c.id = e.accreditation_clause_id;

create or replace view public.v_patch39_infection_control_open_actions as
select * from public.v_patch39_infection_control_register
where status in ('open','in_progress','under_review','action_required') or (due_date is not null and due_date < current_date and status not in ('closed','cancelled'));

create or replace view public.v_patch39_quality_indicator_performance as
select r.*, d.name_en as department_name_en, s.service_name, p.full_name_en as owner_name_en, qi.indicator_domain
from public.clinical_quality_indicator_results r
left join public.departments d on d.id = r.department_id
left join public.hospital_master_services s on s.id = r.service_id
left join public.profiles p on p.id = r.owner_user_id
left join public.hospital_master_quality_indicators qi on qi.id = r.indicator_id;

create or replace view public.v_patch39_quality_indicator_off_target_register as
select * from public.v_patch39_quality_indicator_performance
where performance_status in ('off_target','watch','critical');

create or replace view public.v_patch39_committee_meeting_register as
select m.*, c.committee_code, c.committee_name, chair.full_name_en as chair_name_en
from public.hospital_committee_meetings m
left join public.hospital_master_committees c on c.id = m.committee_id
left join public.profiles chair on chair.id = m.chair_user_id;

create or replace view public.v_patch39_committee_action_queue as
select a.*, c.committee_code, c.committee_name, assignee.full_name_en as assigned_to_name, d.name_en as assigned_department_name
from public.hospital_committee_actions a
left join public.hospital_master_committees c on c.id = a.committee_id
left join public.profiles assignee on assignee.id = a.assigned_to_user_id
left join public.departments d on d.id = a.assigned_to_department_id
where a.status not in ('completed','cancelled');

create or replace view public.v_patch39_overdue_committee_actions as
select * from public.v_patch39_committee_action_queue
where status = 'overdue' or (due_date is not null and due_date < current_date);

create or replace view public.v_patch39_credentialing_expiry_register as
select c.*, d.name_en as department_name_en, jt.job_title_name, reviewer.full_name_en as reviewer_name_en, ac.clause_code, ac.clause_title
from public.clinical_credentialing_records c
left join public.departments d on d.id = c.department_id
left join public.hospital_master_job_titles jt on jt.id = c.job_title_id
left join public.profiles reviewer on reviewer.id = c.reviewer_user_id
left join public.accreditation_clauses ac on ac.id = c.accreditation_clause_id
where c.credential_status in ('active','pending_review','expired') and (c.expires_on is null or c.expires_on <= current_date + interval '90 days' or c.due_date <= current_date + interval '90 days');

create or replace view public.v_patch39_privileging_competency_gap_register as
select *
from public.v_patch39_credentialing_expiry_register
where credential_type in ('privilege','competency','scope_of_practice','training_requirement') and (credential_status in ('pending_review','expired','suspended','revoked') or evidence_bridge_link_id is null);

create or replace view public.v_patch39_facility_biomedical_safety_register as
select f.*, d.name_en as department_name_en, l.location_name, p.full_name_en as owner_name_en, c.clause_code, c.clause_title
from public.facility_biomedical_safety_evidence f
left join public.departments d on d.id = f.department_id
left join public.hospital_master_locations l on l.id = f.location_id
left join public.profiles p on p.id = f.owner_user_id
left join public.accreditation_clauses c on c.id = f.accreditation_clause_id;

create or replace view public.v_patch39_facility_safety_evidence_gap_register as
select *
from public.v_patch39_facility_biomedical_safety_register
where status in ('open','evidence_required','non_compliant','expired') or evidence_bridge_link_id is null or (next_check_due is not null and next_check_due < current_date);

create or replace view public.v_patch39_hospital_governance_work_queue as
select 'hospital_governance'::text as source_module, 'infection_control_event'::text as work_type, id as work_id, event_title as work_title, event_type as work_description, status as work_status, severity as priority, owner_user_id as assigned_to_user_id, department_id, department_name_en as department_name, due_date, created_at, (due_date is not null and due_date < current_date and status not in ('closed','cancelled')) as is_overdue, (status = 'under_review') as waiting_for_review, (severity = 'critical' or status = 'action_required') as is_escalated, evidence_bridge_link_id as linked_entity_id, 'evidence_bridge'::text as linked_entity_type
from public.v_patch39_infection_control_register where status not in ('closed','cancelled')
union all
select 'hospital_governance','clinical_quality_indicator', id, indicator_name, indicator_code, performance_status, case when performance_status = 'critical' then 'critical' when performance_status = 'off_target' then 'high' when performance_status = 'watch' then 'medium' else 'low' end, owner_user_id, department_id, department_name_en, period_end, created_at, false, performance_status in ('watch','off_target','critical'), performance_status = 'critical', evidence_bridge_link_id, 'evidence_bridge'
from public.v_patch39_quality_indicator_performance where performance_status in ('off_target','watch','critical','not_assessed')
union all
select 'hospital_governance','committee_action', id, action_title, action_description, status, priority, assigned_to_user_id, assigned_to_department_id, assigned_department_name, due_date, created_at, (due_date is not null and due_date < current_date and status not in ('completed','cancelled')), status = 'under_review', status = 'escalated', linked_entity_id, linked_entity_type
from public.v_patch39_committee_action_queue
union all
select 'hospital_governance','credentialing_record', id, credential_title, credential_type, credential_status, case when credential_status in ('expired','suspended','revoked') then 'critical' when expires_on <= current_date + interval '30 days' then 'high' else 'medium' end, practitioner_user_id, department_id, department_name_en, coalesce(due_date, expires_on), created_at, (coalesce(due_date, expires_on) is not null and coalesce(due_date, expires_on) < current_date and credential_status <> 'waived'), credential_status = 'pending_review', credential_status in ('expired','suspended','revoked'), evidence_bridge_link_id, 'evidence_bridge'
from public.v_patch39_credentialing_expiry_register
union all
select 'hospital_governance','facility_biomedical_safety', id, safety_item_title, safety_domain, status, case when status in ('non_compliant','expired') then 'critical' when status = 'evidence_required' then 'high' else 'medium' end, owner_user_id, department_id, department_name_en, coalesce(due_date, next_check_due), created_at, (coalesce(due_date, next_check_due) is not null and coalesce(due_date, next_check_due) < current_date and status not in ('compliant','cancelled')), status = 'under_review', status in ('non_compliant','expired'), evidence_bridge_link_id, 'evidence_bridge'
from public.v_patch39_facility_biomedical_safety_register where status not in ('compliant','cancelled');

create or replace view public.v_patch39_accreditation_blocker_summary as
select accreditation_clause_id, clause_code, clause_title, count(*) as blocker_count,
  count(*) filter (where blocker_source = 'infection_control') as infection_control_blockers,
  count(*) filter (where blocker_source = 'credentialing') as credentialing_blockers,
  count(*) filter (where blocker_source = 'facility_safety') as facility_safety_blockers
from (
  select accreditation_clause_id, clause_code, clause_title, 'infection_control'::text as blocker_source from public.v_patch39_infection_control_register where accreditation_clause_id is not null and status in ('open','in_progress','under_review','action_required')
  union all
  select accreditation_clause_id, clause_code, clause_title, 'credentialing' from public.v_patch39_credentialing_expiry_register where accreditation_clause_id is not null and credential_status in ('pending_review','expired','suspended','revoked')
  union all
  select accreditation_clause_id, clause_code, clause_title, 'facility_safety' from public.v_patch39_facility_biomedical_safety_register where accreditation_clause_id is not null and status in ('open','evidence_required','non_compliant','expired')
) blockers
group by accreditation_clause_id, clause_code, clause_title;

create or replace view public.v_patch39_department_hospital_governance_scorecard as
select department_id, department_name,
  count(*) as open_item_count,
  count(*) filter (where is_overdue) as overdue_item_count,
  count(*) filter (where priority in ('high','critical')) as high_priority_item_count,
  count(*) filter (where waiting_for_review) as waiting_for_review_count,
  count(*) filter (where is_escalated) as escalated_item_count
from public.v_patch39_hospital_governance_work_queue
group by department_id, department_name;

create or replace view public.v_patch39_executive_hospital_quality_summary as
select
  (select count(*) from public.v_patch39_infection_control_open_actions) as open_infection_control_count,
  (select count(*) from public.v_patch39_quality_indicator_off_target_register) as off_target_indicator_count,
  (select count(*) from public.v_patch39_overdue_committee_actions) as overdue_committee_action_count,
  (select count(*) from public.v_patch39_credentialing_expiry_register where credential_status in ('pending_review','expired')) as credentialing_due_or_expired_count,
  (select count(*) from public.v_patch39_facility_safety_evidence_gap_register) as facility_safety_gap_count,
  (select count(*) from public.v_patch39_accreditation_blocker_summary) as accreditation_blocked_clause_count,
  case
    when (select count(*) from public.v_patch39_hospital_governance_work_queue where priority = 'critical' or is_escalated) > 0 then 'critical_attention_required'
    when (select count(*) from public.v_patch39_hospital_governance_work_queue where is_overdue) > 0 then 'overdue_items_present'
    else 'operating'
  end as executive_signal;

alter view public.v_patch39_infection_control_register set (security_invoker = true);
alter view public.v_patch39_infection_control_open_actions set (security_invoker = true);
alter view public.v_patch39_quality_indicator_performance set (security_invoker = true);
alter view public.v_patch39_quality_indicator_off_target_register set (security_invoker = true);
alter view public.v_patch39_committee_meeting_register set (security_invoker = true);
alter view public.v_patch39_committee_action_queue set (security_invoker = true);
alter view public.v_patch39_overdue_committee_actions set (security_invoker = true);
alter view public.v_patch39_credentialing_expiry_register set (security_invoker = true);
alter view public.v_patch39_privileging_competency_gap_register set (security_invoker = true);
alter view public.v_patch39_facility_biomedical_safety_register set (security_invoker = true);
alter view public.v_patch39_facility_safety_evidence_gap_register set (security_invoker = true);
alter view public.v_patch39_hospital_governance_work_queue set (security_invoker = true);
alter view public.v_patch39_accreditation_blocker_summary set (security_invoker = true);
alter view public.v_patch39_department_hospital_governance_scorecard set (security_invoker = true);
alter view public.v_patch39_executive_hospital_quality_summary set (security_invoker = true);

grant select on public.v_patch39_infection_control_register to authenticated;
grant select on public.v_patch39_infection_control_open_actions to authenticated;
grant select on public.v_patch39_quality_indicator_performance to authenticated;
grant select on public.v_patch39_quality_indicator_off_target_register to authenticated;
grant select on public.v_patch39_committee_meeting_register to authenticated;
grant select on public.v_patch39_committee_action_queue to authenticated;
grant select on public.v_patch39_overdue_committee_actions to authenticated;
grant select on public.v_patch39_credentialing_expiry_register to authenticated;
grant select on public.v_patch39_privileging_competency_gap_register to authenticated;
grant select on public.v_patch39_facility_biomedical_safety_register to authenticated;
grant select on public.v_patch39_facility_safety_evidence_gap_register to authenticated;
grant select on public.v_patch39_hospital_governance_work_queue to authenticated;
grant select on public.v_patch39_accreditation_blocker_summary to authenticated;
grant select on public.v_patch39_department_hospital_governance_scorecard to authenticated;
grant select on public.v_patch39_executive_hospital_quality_summary to authenticated;

create or replace function public.patch39_service_role_required()
returns void language plpgsql security definer set search_path = public, pg_temp as $$ begin
  if auth.role() <> 'service_role' then raise exception 'PATCH39_SERVICE_ROLE_REQUIRED'; end if;
end; $$;

create or replace function public.patch39_actor_has_hospital_governance_authority(p_actor_user_id uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.role in ('super_admin','executive','governance_admin','auditor','compliance_officer','department_manager')
      and coalesce(ur.active, true) = true
  );
$$;

create or replace function public.record_hospital_governance_event(p_entity_type text, p_entity_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required();
  insert into public.hospital_governance_events(entity_type, entity_id, event_type, event_summary, actor_user_id)
  values (p_entity_type, p_entity_id, p_event_type, p_event_summary, p_actor_user_id) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.create_infection_control_surveillance_event(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.infection_control_surveillance_events(event_reference,event_type,event_title,department_id,location_id,service_id,severity,status,observed_on,due_date,owner_user_id,evidence_bridge_link_id,accreditation_clause_id,created_by)
  values (p_payload->>'event_reference', p_payload->>'event_type', p_payload->>'event_title', nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'location_id','')::uuid, nullif(p_payload->>'service_id','')::uuid, coalesce(nullif(p_payload->>'severity',''),'medium'), coalesce(nullif(p_payload->>'status',''),'open'), nullif(p_payload->>'observed_on','')::date, nullif(p_payload->>'due_date','')::date, nullif(p_payload->>'owner_user_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, nullif(p_payload->>'accreditation_clause_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('infection_control_event', v_id, 'infection_control_event_created', 'Infection control surveillance event created.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_infection_control_event_status(p_event_id uuid, p_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.infection_control_surveillance_events set status = p_status where id = p_event_id;
  perform public.record_hospital_governance_event('infection_control_event', p_event_id, 'infection_control_status_updated', 'Infection control event status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_event_id,'event_status',p_status);
end; $$;

create or replace function public.close_infection_control_event(p_event_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.infection_control_surveillance_events set status = 'closed', closed_at = now() where id = p_event_id;
  perform public.record_hospital_governance_event('infection_control_event', p_event_id, 'infection_control_event_closed', 'Infection control event closed.', p_actor_user_id); return jsonb_build_object('status','closed','id',p_event_id);
end; $$;

create or replace function public.record_clinical_quality_indicator_result(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.clinical_quality_indicator_results(indicator_id,indicator_code,indicator_name,department_id,service_id,period_start,period_end,numerator,denominator,result_value,target_value,target_direction,performance_status,owner_user_id,evidence_bridge_link_id,created_by)
  values (nullif(p_payload->>'indicator_id','')::uuid, p_payload->>'indicator_code', p_payload->>'indicator_name', nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'service_id','')::uuid, nullif(p_payload->>'period_start','')::date, nullif(p_payload->>'period_end','')::date, nullif(p_payload->>'numerator','')::numeric, nullif(p_payload->>'denominator','')::numeric, nullif(p_payload->>'result_value','')::numeric, nullif(p_payload->>'target_value','')::numeric, coalesce(nullif(p_payload->>'target_direction',''),'lower_is_better'), coalesce(nullif(p_payload->>'performance_status',''),'not_assessed'), nullif(p_payload->>'owner_user_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('clinical_quality_indicator_result', v_id, 'clinical_quality_indicator_result_recorded', 'Clinical quality indicator result recorded.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_clinical_quality_indicator_status(p_result_id uuid, p_performance_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.clinical_quality_indicator_results set performance_status = p_performance_status where id = p_result_id;
  perform public.record_hospital_governance_event('clinical_quality_indicator_result', p_result_id, 'clinical_quality_indicator_status_updated', 'Clinical quality indicator status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_result_id,'performance_status',p_performance_status);
end; $$;

create or replace function public.create_hospital_committee_meeting(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_committee_meetings(committee_id,meeting_title,meeting_date,meeting_status,chair_user_id,minutes_document_id,evidence_bridge_link_id,created_by)
  values (nullif(p_payload->>'committee_id','')::uuid, p_payload->>'meeting_title', nullif(p_payload->>'meeting_date','')::date, coalesce(nullif(p_payload->>'meeting_status',''),'planned'), nullif(p_payload->>'chair_user_id','')::uuid, nullif(p_payload->>'minutes_document_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('hospital_committee_meeting', v_id, 'committee_meeting_created', 'Hospital committee meeting created.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_committee_meeting_status(p_meeting_id uuid, p_meeting_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.hospital_committee_meetings set meeting_status = p_meeting_status where id = p_meeting_id;
  perform public.record_hospital_governance_event('hospital_committee_meeting', p_meeting_id, 'committee_meeting_status_updated', 'Hospital committee meeting status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_meeting_id,'meeting_status',p_meeting_status);
end; $$;

create or replace function public.create_hospital_committee_action(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.hospital_committee_actions(meeting_id,committee_id,action_title,action_description,assigned_to_user_id,assigned_to_department_id,priority,status,due_date,linked_entity_type,linked_entity_id,evidence_bridge_link_id,created_by)
  values (nullif(p_payload->>'meeting_id','')::uuid, nullif(p_payload->>'committee_id','')::uuid, p_payload->>'action_title', p_payload->>'action_description', nullif(p_payload->>'assigned_to_user_id','')::uuid, nullif(p_payload->>'assigned_to_department_id','')::uuid, coalesce(nullif(p_payload->>'priority',''),'medium'), coalesce(nullif(p_payload->>'status',''),'open'), nullif(p_payload->>'due_date','')::date, nullif(p_payload->>'linked_entity_type',''), nullif(p_payload->>'linked_entity_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('hospital_committee_action', v_id, 'committee_action_created', 'Hospital committee action created.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_committee_action_status(p_action_id uuid, p_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.hospital_committee_actions set status = p_status where id = p_action_id;
  perform public.record_hospital_governance_event('hospital_committee_action', p_action_id, 'committee_action_status_updated', 'Hospital committee action status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_action_id,'action_status',p_status);
end; $$;

create or replace function public.complete_committee_action(p_action_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.hospital_committee_actions set status = 'completed', completed_at = now() where id = p_action_id;
  perform public.record_hospital_governance_event('hospital_committee_action', p_action_id, 'committee_action_completed', 'Hospital committee action completed.', p_actor_user_id); return jsonb_build_object('status','completed','id',p_action_id);
end; $$;

create or replace function public.create_clinical_credentialing_record(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.clinical_credentialing_records(practitioner_user_id,practitioner_name,department_id,job_title_id,credential_type,credential_title,credential_status,issued_on,expires_on,due_date,reviewer_user_id,evidence_bridge_link_id,accreditation_clause_id,created_by)
  values (nullif(p_payload->>'practitioner_user_id','')::uuid, p_payload->>'practitioner_name', nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'job_title_id','')::uuid, p_payload->>'credential_type', p_payload->>'credential_title', coalesce(nullif(p_payload->>'credential_status',''),'active'), nullif(p_payload->>'issued_on','')::date, nullif(p_payload->>'expires_on','')::date, nullif(p_payload->>'due_date','')::date, nullif(p_payload->>'reviewer_user_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, nullif(p_payload->>'accreditation_clause_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('clinical_credentialing_record', v_id, 'credentialing_record_created', 'Clinical credentialing record created.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_credentialing_record_status(p_record_id uuid, p_credential_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.clinical_credentialing_records set credential_status = p_credential_status where id = p_record_id;
  perform public.record_hospital_governance_event('clinical_credentialing_record', p_record_id, 'credentialing_record_status_updated', 'Clinical credentialing record status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_record_id,'credential_status',p_credential_status);
end; $$;

create or replace function public.mark_credentialing_record_reviewed(p_record_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.clinical_credentialing_records set credential_status = 'active', reviewer_user_id = coalesce(reviewer_user_id, p_actor_user_id) where id = p_record_id;
  perform public.record_hospital_governance_event('clinical_credentialing_record', p_record_id, 'credentialing_record_reviewed', 'Clinical credentialing record reviewed.', p_actor_user_id); return jsonb_build_object('status','reviewed','id',p_record_id);
end; $$;

create or replace function public.create_facility_biomedical_safety_evidence(p_actor_user_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$ declare v_id uuid; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  insert into public.facility_biomedical_safety_evidence(safety_item_reference,safety_domain,safety_item_title,department_id,location_id,equipment_reference,status,due_date,last_checked_on,next_check_due,owner_user_id,evidence_bridge_link_id,accreditation_clause_id,created_by)
  values (p_payload->>'safety_item_reference', p_payload->>'safety_domain', p_payload->>'safety_item_title', nullif(p_payload->>'department_id','')::uuid, nullif(p_payload->>'location_id','')::uuid, p_payload->>'equipment_reference', coalesce(nullif(p_payload->>'status',''),'open'), nullif(p_payload->>'due_date','')::date, nullif(p_payload->>'last_checked_on','')::date, nullif(p_payload->>'next_check_due','')::date, nullif(p_payload->>'owner_user_id','')::uuid, nullif(p_payload->>'evidence_bridge_link_id','')::uuid, nullif(p_payload->>'accreditation_clause_id','')::uuid, p_actor_user_id) returning id into v_id;
  perform public.record_hospital_governance_event('facility_biomedical_safety_evidence', v_id, 'facility_biomedical_safety_created', 'Facility biomedical safety evidence item created.', p_actor_user_id); return v_id;
end; $$;

create or replace function public.update_facility_biomedical_safety_status(p_safety_id uuid, p_status text, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.facility_biomedical_safety_evidence set status = p_status where id = p_safety_id;
  perform public.record_hospital_governance_event('facility_biomedical_safety_evidence', p_safety_id, 'facility_biomedical_safety_status_updated', 'Facility biomedical safety status updated.', p_actor_user_id); return jsonb_build_object('status','updated','id',p_safety_id,'safety_status',p_status);
end; $$;

create or replace function public.mark_facility_biomedical_safety_checked(p_safety_id uuid, p_last_checked_on date, p_next_check_due date, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  update public.facility_biomedical_safety_evidence set last_checked_on = p_last_checked_on, next_check_due = p_next_check_due, status = 'compliant' where id = p_safety_id;
  perform public.record_hospital_governance_event('facility_biomedical_safety_evidence', p_safety_id, 'facility_biomedical_safety_checked', 'Facility biomedical safety item checked.', p_actor_user_id); return jsonb_build_object('status','checked','id',p_safety_id);
end; $$;

create or replace function public.link_hospital_governance_item_to_evidence_bridge(p_entity_type text, p_entity_id uuid, p_evidence_bridge_link_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  if p_entity_type = 'infection_control_event' then update public.infection_control_surveillance_events set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  elsif p_entity_type = 'clinical_quality_indicator_result' then update public.clinical_quality_indicator_results set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  elsif p_entity_type = 'committee_meeting' then update public.hospital_committee_meetings set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  elsif p_entity_type = 'committee_action' then update public.hospital_committee_actions set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  elsif p_entity_type = 'credentialing_record' then update public.clinical_credentialing_records set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  elsif p_entity_type = 'facility_biomedical_safety' then update public.facility_biomedical_safety_evidence set evidence_bridge_link_id = p_evidence_bridge_link_id where id = p_entity_id;
  else raise exception 'PATCH39_UNSUPPORTED_EVIDENCE_LINK_ENTITY_TYPE'; end if;
  perform public.record_hospital_governance_event(p_entity_type, p_entity_id, 'hospital_governance_item_linked_to_evidence_bridge', 'Hospital governance item linked to evidence bridge.', p_actor_user_id);
  return jsonb_build_object('status','linked','entity_type',p_entity_type,'entity_id',p_entity_id,'evidence_bridge_link_id',p_evidence_bridge_link_id);
end; $$;

create or replace function public.link_hospital_governance_item_to_accreditation_clause(p_entity_type text, p_entity_id uuid, p_accreditation_clause_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  if p_entity_type = 'infection_control_event' then update public.infection_control_surveillance_events set accreditation_clause_id = p_accreditation_clause_id where id = p_entity_id;
  elsif p_entity_type = 'credentialing_record' then update public.clinical_credentialing_records set accreditation_clause_id = p_accreditation_clause_id where id = p_entity_id;
  elsif p_entity_type = 'facility_biomedical_safety' then update public.facility_biomedical_safety_evidence set accreditation_clause_id = p_accreditation_clause_id where id = p_entity_id;
  else raise exception 'PATCH39_UNSUPPORTED_ACCREDITATION_LINK_ENTITY_TYPE'; end if;
  perform public.record_hospital_governance_event(p_entity_type, p_entity_id, 'hospital_governance_item_linked_to_accreditation_clause', 'Hospital governance item linked to accreditation clause.', p_actor_user_id);
  return jsonb_build_object('status','linked','entity_type',p_entity_type,'entity_id',p_entity_id,'accreditation_clause_id',p_accreditation_clause_id);
end; $$;

create or replace function public.get_hospital_quality_summary(p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  select to_jsonb(s) into v_result from public.v_patch39_executive_hospital_quality_summary s limit 1;
  perform public.record_hospital_governance_event('hospital_quality_summary', null, 'hospital_quality_summary_viewed', 'Hospital quality summary viewed.', p_actor_user_id);
  return coalesce(v_result, '{}'::jsonb);
end; $$;

create or replace function public.get_department_hospital_governance_scorecard(p_department_id uuid, p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$ declare v_result jsonb; begin
  perform public.patch39_service_role_required(); if not public.patch39_actor_has_hospital_governance_authority(p_actor_user_id) then raise exception 'PATCH39_HOSPITAL_GOVERNANCE_AUTHORITY_REQUIRED'; end if;
  select to_jsonb(s) into v_result from public.v_patch39_department_hospital_governance_scorecard s where s.department_id = p_department_id limit 1;
  perform public.record_hospital_governance_event('department_hospital_governance_scorecard', p_department_id, 'department_hospital_governance_scorecard_viewed', 'Department hospital governance scorecard viewed.', p_actor_user_id);
  return coalesce(v_result, '{}'::jsonb);
end; $$;

revoke all on function public.patch39_service_role_required() from public, anon, authenticated; grant execute on function public.patch39_service_role_required() to service_role;
revoke all on function public.patch39_actor_has_hospital_governance_authority(uuid) from public, anon, authenticated; grant execute on function public.patch39_actor_has_hospital_governance_authority(uuid) to service_role;
revoke all on function public.record_hospital_governance_event(text, uuid, text, text, uuid) from public, anon, authenticated; grant execute on function public.record_hospital_governance_event(text, uuid, text, text, uuid) to service_role;
revoke all on function public.create_infection_control_surveillance_event(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_infection_control_surveillance_event(uuid, jsonb) to service_role;
revoke all on function public.update_infection_control_event_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_infection_control_event_status(uuid, text, uuid) to service_role;
revoke all on function public.close_infection_control_event(uuid, uuid) from public, anon, authenticated; grant execute on function public.close_infection_control_event(uuid, uuid) to service_role;
revoke all on function public.record_clinical_quality_indicator_result(uuid, jsonb) from public, anon, authenticated; grant execute on function public.record_clinical_quality_indicator_result(uuid, jsonb) to service_role;
revoke all on function public.update_clinical_quality_indicator_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_clinical_quality_indicator_status(uuid, text, uuid) to service_role;
revoke all on function public.create_hospital_committee_meeting(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_committee_meeting(uuid, jsonb) to service_role;
revoke all on function public.update_committee_meeting_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_committee_meeting_status(uuid, text, uuid) to service_role;
revoke all on function public.create_hospital_committee_action(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_hospital_committee_action(uuid, jsonb) to service_role;
revoke all on function public.update_committee_action_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_committee_action_status(uuid, text, uuid) to service_role;
revoke all on function public.complete_committee_action(uuid, uuid) from public, anon, authenticated; grant execute on function public.complete_committee_action(uuid, uuid) to service_role;
revoke all on function public.create_clinical_credentialing_record(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_clinical_credentialing_record(uuid, jsonb) to service_role;
revoke all on function public.update_credentialing_record_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_credentialing_record_status(uuid, text, uuid) to service_role;
revoke all on function public.mark_credentialing_record_reviewed(uuid, uuid) from public, anon, authenticated; grant execute on function public.mark_credentialing_record_reviewed(uuid, uuid) to service_role;
revoke all on function public.create_facility_biomedical_safety_evidence(uuid, jsonb) from public, anon, authenticated; grant execute on function public.create_facility_biomedical_safety_evidence(uuid, jsonb) to service_role;
revoke all on function public.update_facility_biomedical_safety_status(uuid, text, uuid) from public, anon, authenticated; grant execute on function public.update_facility_biomedical_safety_status(uuid, text, uuid) to service_role;
revoke all on function public.mark_facility_biomedical_safety_checked(uuid, date, date, uuid) from public, anon, authenticated; grant execute on function public.mark_facility_biomedical_safety_checked(uuid, date, date, uuid) to service_role;
revoke all on function public.link_hospital_governance_item_to_evidence_bridge(text, uuid, uuid, uuid) from public, anon, authenticated; grant execute on function public.link_hospital_governance_item_to_evidence_bridge(text, uuid, uuid, uuid) to service_role;
revoke all on function public.link_hospital_governance_item_to_accreditation_clause(text, uuid, uuid, uuid) from public, anon, authenticated; grant execute on function public.link_hospital_governance_item_to_accreditation_clause(text, uuid, uuid, uuid) to service_role;
revoke all on function public.get_hospital_quality_summary(uuid) from public, anon, authenticated; grant execute on function public.get_hospital_quality_summary(uuid) to service_role;
revoke all on function public.get_department_hospital_governance_scorecard(uuid, uuid) from public, anon, authenticated; grant execute on function public.get_department_hospital_governance_scorecard(uuid, uuid) to service_role;

comment on table public.infection_control_surveillance_events is 'Patch 39 infection control surveillance, HAI, outbreak, hand hygiene, isolation, sterilization, and exposure events.';
comment on table public.clinical_quality_indicator_results is 'Patch 39 clinical quality indicator result register linked to hospital master indicators.';
comment on table public.hospital_committee_meetings is 'Patch 39 hospital committee meeting, minutes, and evidence register.';
comment on table public.hospital_committee_actions is 'Patch 39 hospital committee decision and action queue.';
comment on table public.clinical_credentialing_records is 'Patch 39 clinical credentialing, privileging, licensing, and competency governance register.';
comment on table public.facility_biomedical_safety_evidence is 'Patch 39 facility, biomedical, fire safety, emergency preparedness, maintenance, and environmental safety evidence register.';
comment on table public.hospital_governance_events is 'Patch 39 audit trail for hospital quality, infection, committee, credentialing, and facility governance operations.';
