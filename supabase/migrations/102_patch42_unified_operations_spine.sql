-- =========================================================
-- Patch 42: Unified Operations Spine
-- Create one normalized operations queue layer that safely unions existing module work
-- =========================================================

create or replace view public.v_patch42_unified_operations_queue as

-- 1. Accreditation Tasks
select
  id::text as queue_item_id,
  'accreditation'::text as source_module,
  task_type as source_entity_type,
  id as source_entity_id,
  'Accreditation ' || task_type || ' Task' as title,
  outcome_notes as description,
  assigned_to_user_id,
  assigned_to_department_id,
  due_date,
  status,
  priority,
  'medium'::text as severity,
  (due_date < current_date and status not in ('approved','rejected','waived','cancelled','completed')) as is_overdue,
  (status = 'escalated') as is_escalated,
  false as is_blocked,
  false as evidence_required,
  null::text as evidence_status,
  (status = 'submitted') as waiting_for_review,
  case when status = 'submitted' then 'Review' else 'Action Required' end as next_action,
  'accreditation'::text as source_route_key,
  jsonb_build_object('clause_id', clause_id) as source_context,
  created_at,
  reviewed_at as updated_at
from public.accreditation_clause_review_tasks

UNION ALL

-- 2. Audit Execution Findings
select
  id::text,
  'audit',
  'audit_finding',
  id,
  finding_title,
  finding_description,
  owner_user_id,
  department_id,
  target_date,
  status,
  case when risk_rating in ('high','critical') then 'high' else 'medium' end,
  risk_rating,
  (target_date < current_date and status not in ('closed','accepted')),
  false,
  false,
  false,
  null,
  (status = 'pending_review'),
  'Address Finding',
  'audit_execution',
  jsonb_build_object('engagement_id', engagement_id),
  created_at,
  null::timestamptz
from public.audit_execution_findings

UNION ALL

-- 3. Audit Execution Steps
select
  id::text,
  'audit',
  'audit_test_step',
  id,
  step_title,
  step_description,
  assigned_to_user_id,
  null::uuid, -- department_id
  null::date, -- due_date
  status,
  'medium',
  'medium',
  false,
  false,
  false,
  (evidence_bridge_link_id is not null),
  null,
  (status = 'under_review'),
  'Execute Step',
  'audit_execution',
  jsonb_build_object('engagement_id', engagement_id),
  created_at,
  null::timestamptz
from public.audit_execution_test_steps

UNION ALL

-- 4. OVR RCA Cases
select
  id::text,
  'ovr',
  'rca_case',
  id,
  'RCA: ' || rca_reference,
  problem_statement,
  lead_investigator_user_id,
  department_id,
  due_date,
  status,
  'high',
  'high',
  (due_date < current_date and status not in ('closed','cancelled')),
  false,
  false,
  false,
  null,
  (status = 'under_review'),
  'Complete RCA',
  'ovr',
  jsonb_build_object('ovr_id', ovr_id),
  created_at,
  null::timestamptz
from public.ovr_rca_cases

UNION ALL

-- 5. Clinical Governance Escalations
select
  id::text,
  'clinical_governance',
  'escalation',
  id,
  'Escalation: ' || escalation_reason,
  resolution_notes,
  escalated_to_user_id,
  escalated_to_department_id,
  null::date,
  escalation_status,
  'high',
  'critical',
  false,
  true,
  false,
  false,
  null,
  (escalation_status = 'open'),
  'Resolve Escalation',
  'governance_center',
  jsonb_build_object('source_type', source_type, 'source_id', source_id),
  escalated_at as created_at,
  resolved_at as updated_at
from public.clinical_governance_escalations

UNION ALL

-- 6. Hospital Committee Actions
select
  id::text,
  'hospital_governance',
  'committee_action',
  id,
  action_title,
  action_description,
  assigned_to_user_id,
  assigned_to_department_id,
  due_date,
  status,
  priority,
  'medium',
  (due_date < current_date and status not in ('completed','cancelled')),
  (status = 'escalated'),
  false,
  (evidence_bridge_link_id is not null),
  null,
  (status = 'under_review'),
  'Complete Action',
  'governance_center',
  jsonb_build_object('committee_id', committee_id),
  created_at,
  completed_at
from public.hospital_committee_actions

UNION ALL

-- 7. Clinical Credentialing
select
  id::text,
  'hospital_governance',
  'credential',
  id,
  credential_title,
  'Credential Renewal',
  practitioner_user_id,
  department_id,
  due_date,
  credential_status,
  'medium',
  'medium',
  (due_date < current_date and credential_status not in ('active','waived')),
  false,
  false,
  (evidence_bridge_link_id is not null),
  null,
  (credential_status = 'pending_review'),
  'Renew Credential',
  'governance_center',
  jsonb_build_object('job_title_id', job_title_id),
  created_at,
  null::timestamptz
from public.clinical_credentialing_records

UNION ALL

-- 8. Facility Safety Evidence
select
  id::text,
  'hospital_governance',
  'facility_safety',
  id,
  safety_item_title,
  safety_item_reference,
  owner_user_id,
  department_id,
  due_date,
  status,
  'medium',
  'medium',
  (due_date < current_date and status not in ('compliant','cancelled')),
  false,
  false,
  true,
  null,
  (status = 'under_review'),
  'Provide Safety Evidence',
  'governance_center',
  jsonb_build_object('location_id', location_id),
  created_at,
  null::timestamptz
from public.facility_biomedical_safety_evidence

UNION ALL

-- 9. CAPA Actions (v220)
select
  id::text,
  'capa',
  'capa_action',
  id,
  action_title,
  corrective_action,
  owner_profile_id,
  null::uuid, -- department_id
  due_date,
  status,
  'medium',
  'medium',
  (due_date < current_date and status not in ('closed','rejected')),
  false,
  false,
  evidence_required,
  null,
  (status = 'submitted_for_review'),
  'Complete CAPA',
  'capa',
  jsonb_build_object('exception_id', exception_id),
  null::timestamptz,
  closure_approved_at
from public.v220_capa_actions;


-- Create views tailored to specific contexts:
create or replace view public.v_patch42_my_operations_queue as
select * from public.v_patch42_unified_operations_queue
where assigned_to_user_id = auth.uid();

create or replace view public.v_patch42_department_operations_queue as
select * from public.v_patch42_unified_operations_queue
where assigned_to_department_id in (
  select id from public.departments where manager_id = auth.uid()
);

create or replace view public.v_patch42_executive_operations_queue as
select * from public.v_patch42_unified_operations_queue
where is_overdue = true or is_escalated = true or is_blocked = true or severity in ('high','critical');

-- 1. Overdue
create or replace view public.v_patch42_overdue_operations_queue as
select * from public.v_patch42_unified_operations_queue
where is_overdue = true;

-- 2. Escalated
create or replace view public.v_patch42_escalated_operations_queue as
select * from public.v_patch42_unified_operations_queue
where is_escalated = true;

-- 3. Blocked
create or replace view public.v_patch42_blocked_operations_queue as
select * from public.v_patch42_unified_operations_queue
where is_blocked = true;

-- 4. Waiting for Review
create or replace view public.v_patch42_waiting_for_review_queue as
select * from public.v_patch42_unified_operations_queue
where waiting_for_review = true;

-- 5. Evidence Required
create or replace view public.v_patch42_evidence_required_queue as
select * from public.v_patch42_unified_operations_queue
where evidence_required = true;

-- 6. Missing Owner
create or replace view public.v_patch42_missing_owner_queue as
select * from public.v_patch42_unified_operations_queue
where assigned_to_user_id is null and status not in ('completed','closed','resolved','cancelled');

-- 7. Master Data Routing Exceptions
create or replace view public.v_patch42_master_data_routing_exceptions as
select * from public.v_patch42_unified_operations_queue
where (assigned_to_user_id is null and assigned_to_department_id is null)
and status not in ('completed','closed','resolved','cancelled');

-- 8. Executive Operations Summary
create or replace view public.v_patch42_executive_operations_summary as
select 
  count(*) as open_work_count,
  count(*) filter (where is_overdue = true) as overdue_work_count,
  count(*) filter (where is_escalated = true) as escalated_work_count,
  count(*) filter (where waiting_for_review = true) as waiting_for_review_count,
  count(*) filter (where (assigned_to_user_id is null and assigned_to_department_id is null)) as master_data_exception_count,
  case 
    when count(*) filter (where is_escalated = true) > 0 then 'attention_required'
    when count(*) filter (where is_overdue = true) > 10 then 'watch'
    else 'on_track'
  end as executive_signal
from public.v_patch42_unified_operations_queue
where status not in ('completed','closed','resolved','cancelled');

-- 9. User Operations Summary
create or replace view public.v_patch42_user_operations_summary as
select 
  assigned_to_user_id,
  count(*) as open_work_count,
  count(*) filter (where is_overdue = true) as overdue_work_count,
  count(*) filter (where is_escalated = true) as escalated_work_count,
  min(due_date) as nearest_due_date
from public.v_patch42_unified_operations_queue
where assigned_to_user_id is not null and status not in ('completed','closed','resolved','cancelled')
group by assigned_to_user_id;

-- 10. Department Operations Summary
create or replace view public.v_patch42_department_operations_summary as
select 
  assigned_to_department_id as department_id,
  count(*) as open_work_count,
  count(*) filter (where is_overdue = true) as overdue_work_count,
  count(*) filter (where is_escalated = true) as escalated_work_count,
  count(*) filter (where waiting_for_review = true) as waiting_for_review_count
from public.v_patch42_unified_operations_queue
where assigned_to_department_id is not null and status not in ('completed','closed','resolved','cancelled')
group by assigned_to_department_id;

-- 11. Queue Item Detail Context
create or replace view public.v_patch42_queue_item_detail_context as
select 
  q.*,
  q.source_context->>'engagement_id' as engagement_id,
  q.source_context->>'clause_id' as clause_id,
  q.source_context->>'ovr_id' as ovr_id,
  q.source_context->>'committee_id' as committee_id,
  q.source_context->>'exception_id' as exception_id
from public.v_patch42_unified_operations_queue q;

-- Secure the views. Patch 42 exposes live operations work and must rely on
-- caller RLS through security_invoker views rather than definer privileges.
alter view if exists public.v_patch42_unified_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_my_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_department_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_executive_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_overdue_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_escalated_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_blocked_operations_queue set (security_invoker = true);
alter view if exists public.v_patch42_waiting_for_review_queue set (security_invoker = true);
alter view if exists public.v_patch42_evidence_required_queue set (security_invoker = true);
alter view if exists public.v_patch42_missing_owner_queue set (security_invoker = true);
alter view if exists public.v_patch42_master_data_routing_exceptions set (security_invoker = true);
alter view if exists public.v_patch42_executive_operations_summary set (security_invoker = true);
alter view if exists public.v_patch42_user_operations_summary set (security_invoker = true);
alter view if exists public.v_patch42_department_operations_summary set (security_invoker = true);
alter view if exists public.v_patch42_queue_item_detail_context set (security_invoker = true);

grant select on public.v_patch42_unified_operations_queue to authenticated;
grant select on public.v_patch42_my_operations_queue to authenticated;
grant select on public.v_patch42_department_operations_queue to authenticated;
grant select on public.v_patch42_executive_operations_queue to authenticated;
grant select on public.v_patch42_overdue_operations_queue to authenticated;
grant select on public.v_patch42_escalated_operations_queue to authenticated;
grant select on public.v_patch42_blocked_operations_queue to authenticated;
grant select on public.v_patch42_waiting_for_review_queue to authenticated;
grant select on public.v_patch42_evidence_required_queue to authenticated;
grant select on public.v_patch42_missing_owner_queue to authenticated;
grant select on public.v_patch42_master_data_routing_exceptions to authenticated;
grant select on public.v_patch42_executive_operations_summary to authenticated;
grant select on public.v_patch42_user_operations_summary to authenticated;
grant select on public.v_patch42_department_operations_summary to authenticated;
grant select on public.v_patch42_queue_item_detail_context to authenticated;
