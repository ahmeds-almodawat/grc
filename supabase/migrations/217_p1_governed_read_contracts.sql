-- P1: restore intended authenticated reads behind existing RLS and publish
-- narrow security-invoker aggregates from canonical local data.

-- ---------------------------------------------------------------------------
-- 1. Governed table reads. RLS remains the authorization layer; browser DML
-- remains unavailable and anonymous access remains denied.
-- ---------------------------------------------------------------------------
grant select on table public.accreditation_clause_review_tasks to authenticated, service_role;
grant select on table public.audit_findings to authenticated, service_role;
grant select on table public.capa_action_plans to authenticated, service_role;
grant select on table public.committee_decisions to authenticated, service_role;
grant select on table public.compliance_items to authenticated, service_role;
grant select on table public.policy_requirements to authenticated, service_role;
grant select on table public.risks to authenticated, service_role;
grant select on table public.sop_procedure_steps to authenticated, service_role;
grant select on table public.live_grc_capa_register to authenticated, service_role;

revoke select on table public.accreditation_clause_review_tasks from anon;
revoke select on table public.audit_findings from anon;
revoke select on table public.capa_action_plans from anon;
revoke select on table public.committee_decisions from anon;
revoke select on table public.compliance_items from anon;
revoke select on table public.policy_requirements from anon;
revoke select on table public.risks from anon;
revoke select on table public.sop_procedure_steps from anon;
revoke select on table public.live_grc_capa_register from anon;

-- ---------------------------------------------------------------------------
-- 2. Trusted accreditation reads. The reference catalog is authenticated-only;
-- operating rows remain organization-scoped by their existing RLS policies.
-- ---------------------------------------------------------------------------
grant select on table public.accreditation_standards to authenticated, service_role;
grant select on table public.accreditation_standard_versions to authenticated, service_role;
grant select on table public.accreditation_chapters to authenticated, service_role;
grant select on table public.accreditation_requirements to authenticated, service_role;
grant select on table public.accreditation_measurable_elements to authenticated, service_role;
grant select on table public.accreditation_required_evidence to authenticated, service_role;
grant select on table public.accreditation_gap_findings to authenticated, service_role;
grant select on table public.accreditation_readiness_snapshots to authenticated, service_role;
grant select on table public.accreditation_crosswalk_mappings to authenticated, service_role;

revoke select on table public.accreditation_standards from anon;
revoke select on table public.accreditation_standard_versions from anon;
revoke select on table public.accreditation_chapters from anon;
revoke select on table public.accreditation_requirements from anon;
revoke select on table public.accreditation_measurable_elements from anon;
revoke select on table public.accreditation_required_evidence from anon;
revoke select on table public.accreditation_gap_findings from anon;
revoke select on table public.accreditation_readiness_snapshots from anon;
revoke select on table public.accreditation_crosswalk_mappings from anon;

alter view public.v_accreditation_readiness_summary set (security_invoker = true);
alter view public.v_accreditation_requirement_matrix set (security_invoker = true);
alter view public.v_accreditation_gap_dashboard set (security_invoker = true);

revoke all on public.v_accreditation_readiness_summary from public, anon;
revoke all on public.v_accreditation_requirement_matrix from public, anon;
revoke all on public.v_accreditation_gap_dashboard from public, anon;
grant select on public.v_accreditation_readiness_summary to authenticated, service_role;
grant select on public.v_accreditation_requirement_matrix to authenticated, service_role;
grant select on public.v_accreditation_gap_dashboard to authenticated, service_role;

revoke all on public.v_patch30_accreditation_readiness_summary from public, anon;
grant select on public.v_patch30_accreditation_readiness_summary to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Existing security-invoker operational views and their governed inputs.
-- ---------------------------------------------------------------------------
alter view public.v_delay_reason_queue set (security_invoker = true);
revoke all on public.v_delay_reason_queue from public, anon;
grant select on public.v_delay_reason_queue to authenticated, service_role;

revoke all on public.v_management_control_summary from public, anon;
grant select on public.v_management_control_summary to authenticated, service_role;

revoke all on public.v_live_grc_capa_queue from public, anon;
grant select on public.v_live_grc_capa_queue to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Canonical critical-attention feed expected by the dashboard runtime.
-- ---------------------------------------------------------------------------
create or replace view public.v_critical_attention_items
with (security_invoker = true)
as
select * from (
  select
    p.id,
    p.organization_id,
    'project'::text as item_type,
    p.title,
    d.name_en as department_name,
    owner.full_name_en as owner_name,
    p.target_end_date as due_date,
    p.status::text as status,
    p.risk_level::text as risk_level,
    p.progress_percent,
    case
      when p.risk_level::text = 'critical' then 1
      when p.risk_level::text = 'high' then 2
      when p.status::text = 'delayed' then 3
      else 8
    end as sort_rank
  from public.projects p
  left join public.departments d on d.id = p.department_id
  left join public.profiles owner on owner.id = p.owner_id
  where p.status::text not in ('closed','cancelled')
    and (
      p.risk_level::text in ('critical','high')
      or p.status::text in ('delayed','at_risk','completed_pending_evidence','completed_pending_approval')
      or (p.target_end_date is not null and p.target_end_date < current_date)
    )

  union all
  select
    r.id, r.organization_id, 'risk'::text, r.title, d.name_en, owner.full_name_en,
    r.next_review_date, r.status::text, r.risk_level::text, null::numeric,
    case when r.risk_level::text = 'critical' then 1 when r.risk_level::text = 'high' then 2 else 8 end
  from public.risks r
  left join public.departments d on d.id = r.department_id
  left join public.profiles owner on owner.id = r.owner_id
  where r.status::text not in ('closed','cancelled') and r.risk_level::text in ('critical','high')

  union all
  select
    c.id, c.organization_id, 'compliance'::text, c.title, d.name_en, owner.full_name_en,
    c.next_review_date, c.status::text, c.risk_level::text, null::numeric,
    case
      when c.next_review_date is not null and c.next_review_date < current_date then 1
      when c.risk_level::text = 'critical' then 2
      else 5
    end
  from public.compliance_obligations c
  left join public.departments d on d.id = c.department_id
  left join public.profiles owner on owner.id = c.owner_id
  where c.status::text not in ('closed','cancelled')
    and (c.risk_level::text in ('critical','high') or (c.next_review_date is not null and c.next_review_date <= current_date + 30))

  union all
  select
    a.id, a.organization_id, 'audit_finding'::text, a.title, d.name_en, owner.full_name_en,
    coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date),
    coalesce(a.finding_status, a.status::text),
    coalesce(a.severity_level, a.risk_level::text), null::numeric,
    case
      when coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date) < current_date then 1
      when coalesce(a.severity_level, a.risk_level::text) = 'critical' then 2
      else 4
    end
  from public.audit_findings a
  left join public.departments d on d.id = coalesce(a.responsible_department_id, a.department_id)
  left join public.profiles owner on owner.id = coalesce(a.responsible_owner_id, a.finding_owner_id, a.owner_id)
  where coalesce(a.finding_status, a.status::text) not in ('closed','cancelled')
    and (
      coalesce(a.severity_level, a.risk_level::text) in ('critical','high')
      or coalesce(a.revised_due_date, a.corrective_action_due_date, a.due_date) < current_date
    )

  union all
  select
    c.id, c.organization_id, 'capa'::text, c.capa_title, d.name_en, owner.full_name_en,
    coalesce(c.revised_due_date, c.completion_due_date, c.due_date), c.capa_status,
    coalesce(c.severity_level, c.risk_level), null::numeric,
    case
      when coalesce(c.revised_due_date, c.completion_due_date, c.due_date) < current_date then 1
      when coalesce(c.severity_level, c.risk_level) = 'critical' then 2
      else 4
    end
  from public.capa_action_plans c
  left join public.departments d on d.id = c.department_id
  left join public.profiles owner on owner.id = coalesce(c.capa_owner_id, c.action_owner_id)
  where c.capa_status not in ('closed','cancelled')
    and (
      coalesce(c.severity_level, c.risk_level) in ('critical','high')
      or coalesce(c.revised_due_date, c.completion_due_date, c.due_date) < current_date
    )

  union all
  select
    g.id, g.organization_id, 'governance_decision'::text, g.title, d.name_en, owner.full_name_en,
    g.due_date, g.status::text, g.risk_level::text, null::numeric,
    case when g.status::text = 'delayed' then 1 when g.priority::text = 'critical' then 2 else 6 end
  from public.committee_decisions g
  left join public.departments d on d.id = g.department_id
  left join public.profiles owner on owner.id = g.owner_id
  where g.status::text not in ('closed','cancelled')
    and (g.priority::text in ('critical','high') or g.risk_level::text in ('critical','high') or g.status::text in ('delayed','pending_evidence','pending_approval'))

  union all
  select
    o.id, o.organization_id, 'ovr'::text,
    coalesce(o.ovr_number, o.logging_number, 'OVR') || ' - ' || left(o.brief_description, 90),
    d.name_en, owner.full_name_en,
    coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date),
    o.status::text,
    coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text),
    null::numeric,
    case
      when coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text) in ('level_4','sentinel','critical') then 1
      when coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date) < current_date then 2
      else 4
    end
  from public.ovr_reports o
  left join public.departments d on d.id = o.department_id
  left join public.profiles owner on owner.id = o.owner_id
  where o.status::text not in ('closed','cancelled')
    and (
      coalesce(o.final_severity_level::text, o.quality_confirmed_severity, o.severity_level::text) in ('level_4','sentinel','critical','high')
      or coalesce(o.corrective_action_due_date, o.quality_due_date, o.supervisor_due_date) < current_date
      or o.status::text in ('returned_for_clarification','evidence_submitted','quality_closure_review')
    )
) attention
order by sort_rank, due_date nulls last;

revoke all on public.v_critical_attention_items from public, anon;
grant select on public.v_critical_attention_items to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Recent governed activity. This feed contains only immutable decisions,
-- governed review triggers, and committee decisions visible through RLS.
-- ---------------------------------------------------------------------------
create or replace view public.v_recent_governed_activity
with (security_invoker = true)
as
select
  d.id as activity_id,
  d.organization_id,
  'governance_decision'::text as activity_type,
  d.title,
  d.decision_code as reference_code,
  d.status::text as status,
  coalesce(d.updated_at, d.created_at) as occurred_at,
  d.due_date
from public.committee_decisions d
union all
select
  t.id,
  t.organization_id,
  'document_review'::text,
  coalesce(doc.document_title, 'Governed document review'),
  doc.document_code,
  t.status,
  coalesce(t.updated_at, t.created_at),
  t.due_date
from public.governed_document_review_triggers t
join public.controlled_documents doc on doc.id = t.document_id
union all
select
  decision.id,
  decision.organization_id,
  'criteria_linkage'::text,
  coalesce(doc.document_title, link.target_criterion_type || ' governance criterion'),
  doc.document_code,
  decision.decision_type,
  decision.decided_at,
  null::date
from public.governance_criteria_link_decisions decision
join public.governance_criteria_links link on link.id = decision.link_id
left join public.controlled_documents doc on doc.id = link.target_document_id;

revoke all on public.v_recent_governed_activity from public, anon;
grant select on public.v_recent_governed_activity to authenticated, service_role;

comment on view public.v_critical_attention_items is
  'P1 canonical role-scoped critical-attention feed backed by RLS-protected platform records.';
comment on view public.v_recent_governed_activity is
  'P1 recent governed activity from committee decisions, document review triggers, and immutable governance-link decisions.';
