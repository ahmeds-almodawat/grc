-- =========================================================
-- GRC Control Center - Migration 012b
-- OVR workflow controls, closure guards and dashboard views
-- Requires 012a enum values first.
-- =========================================================

alter table public.ovr_reports
add column if not exists supervisor_due_date date;

alter table public.ovr_reports
add column if not exists quality_due_date date;

alter table public.ovr_reports
add column if not exists corrective_action_due_date date;

alter table public.ovr_reports
add column if not exists quality_closure_note text;

alter table public.ovr_reports
add column if not exists final_classification text;

alter table public.ovr_reports
add column if not exists final_severity_level public.ovr_severity_level;

create index if not exists idx_ovr_reports_supervisor_due on public.ovr_reports(supervisor_due_date);
create index if not exists idx_ovr_reports_quality_due on public.ovr_reports(quality_due_date);
create index if not exists idx_ovr_reports_corrective_due on public.ovr_reports(corrective_action_due_date);

create or replace function public.can_close_ovr(p_ovr_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ovr_reports o
    where o.id = p_ovr_report_id
      and (
        o.evidence_required = false
        or exists (
          select 1
          from public.evidence_files e
          where e.ovr_report_id = o.id
            and e.status = 'accepted'
        )
        or exists (
          select 1
          from public.projects p
          where p.id = o.linked_project_id
            and p.status = 'closed'
        )
      )
  );
$$;

create or replace function public.update_ovr_workflow(
  p_ovr_report_id uuid,
  p_next_status text,
  p_note text default null,
  p_supervisor_investigation text default null,
  p_corrective_action text default null,
  p_quality_manager_comments text default null,
  p_confirmed_severity_level public.ovr_severity_level default null,
  p_corrective_action_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor uuid := auth.uid();
begin
  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id;

  if not found then
    raise exception 'OVR report not found';
  end if;

  if not public.can_access_scope(v_ovr.organization_id, v_ovr.division_id, v_ovr.department_id, v_ovr.unit_id)
     and not public.can_manage_grc() then
    raise exception 'You are not allowed to update this OVR report';
  end if;

  if p_next_status in ('closed', 'quality_closure_review') and not public.can_manage_grc() then
    raise exception 'Only Quality/GRC authorized roles can close or approve closure of OVR reports';
  end if;

  if p_next_status = 'under_quality_review' and coalesce(trim(p_supervisor_investigation), trim(v_ovr.supervisor_investigation), '') = '' then
    raise exception 'Supervisor/HOD investigation is required before Quality review';
  end if;

  if p_next_status in ('action_plan_required', 'corrective_action_in_progress')
     and coalesce(trim(p_corrective_action), trim(v_ovr.corrective_action), '') = '' then
    raise exception 'Corrective action is required for this OVR workflow step';
  end if;

  if p_next_status = 'returned_for_clarification' and coalesce(trim(p_note), '') = '' then
    raise exception 'Return reason is required before returning OVR for clarification';
  end if;

  if p_next_status = 'closed' then
    if coalesce(trim(p_quality_manager_comments), trim(v_ovr.quality_manager_comments), '') = '' then
      raise exception 'Quality closure comments are required before closure';
    end if;

    if not public.can_close_ovr(p_ovr_report_id) then
      raise exception 'OVR cannot be closed until accepted evidence is uploaded or linked corrective project is closed';
    end if;
  end if;

  update public.ovr_reports
  set
    status = p_next_status::public.ovr_status,
    supervisor_investigation = coalesce(nullif(trim(p_supervisor_investigation), ''), supervisor_investigation),
    corrective_action = coalesce(nullif(trim(p_corrective_action), ''), corrective_action),
    quality_manager_comments = coalesce(nullif(trim(p_quality_manager_comments), ''), quality_manager_comments),
    quality_closure_note = case when p_next_status = 'closed' then coalesce(nullif(trim(p_note), ''), quality_closure_note) else quality_closure_note end,
    rejection_reason = case when p_next_status in ('returned_for_clarification', 'rejected') then p_note else rejection_reason end,
    severity_level = coalesce(p_confirmed_severity_level, severity_level),
    final_severity_level = case when p_next_status = 'closed' then coalesce(p_confirmed_severity_level, severity_level) else final_severity_level end,
    corrective_action_due_date = coalesce(p_corrective_action_due_date, corrective_action_due_date),
    supervisor_due_date = case when p_next_status = 'submitted' then current_date + 1 else supervisor_due_date end,
    quality_due_date = case when p_next_status in ('under_quality_review', 'evidence_submitted', 'quality_closure_review') then current_date + 2 else quality_due_date end,
    reviewed_at = case when p_next_status in ('under_quality_review', 'action_plan_required', 'corrective_action_in_progress', 'evidence_submitted', 'quality_closure_review', 'closed') then now() else reviewed_at end,
    closed_by = case when p_next_status = 'closed' then v_actor else closed_by end,
    closed_at = case when p_next_status = 'closed' then now() else closed_at end,
    updated_by = v_actor,
    updated_at = now()
  where id = p_ovr_report_id;

  insert into public.comments (organization_id, ovr_report_id, body, created_by)
  values (
    v_ovr.organization_id,
    p_ovr_report_id,
    concat('OVR workflow changed to ', p_next_status, case when coalesce(trim(p_note), '') <> '' then ': ' || p_note else '' end),
    v_actor
  );
end;
$$;

create or replace function public.create_ovr_corrective_action_project(p_ovr_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor uuid := auth.uid();
  v_project_id uuid;
begin
  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id;

  if not found then
    raise exception 'OVR report not found';
  end if;

  if v_ovr.linked_project_id is not null then
    return v_ovr.linked_project_id;
  end if;

  if not public.can_manage_grc()
     and not public.can_access_scope(v_ovr.organization_id, v_ovr.division_id, v_ovr.department_id, v_ovr.unit_id) then
    raise exception 'You are not allowed to create a corrective project for this OVR';
  end if;

  insert into public.projects (
    organization_id,
    title,
    description,
    category,
    source_type,
    source_reference_id,
    division_id,
    department_id,
    unit_id,
    owner_id,
    sponsor_id,
    start_date,
    target_end_date,
    priority,
    risk_level,
    status,
    evidence_required,
    closure_approval_required,
    created_by,
    updated_by
  ) values (
    v_ovr.organization_id,
    'OVR corrective action - ' || coalesce(v_ovr.ovr_number, v_ovr.logging_number, v_ovr.id::text),
    coalesce(v_ovr.corrective_action, v_ovr.brief_description),
    'OVR Corrective Action',
    'incident_ovr',
    v_ovr.id,
    v_ovr.division_id,
    v_ovr.department_id,
    v_ovr.unit_id,
    coalesce(v_ovr.owner_id, v_actor),
    v_actor,
    current_date,
    coalesce(v_ovr.corrective_action_due_date, current_date + 14),
    case when v_ovr.severity_level in ('level_4', 'sentinel') then 'critical' else 'high' end,
    case when v_ovr.severity_level in ('level_4', 'sentinel') then 'critical' else 'high' end,
    'active',
    true,
    true,
    v_actor,
    v_actor
  ) returning id into v_project_id;

  update public.ovr_reports
  set linked_project_id = v_project_id,
      corrective_action_required = true,
      status = 'corrective_action_in_progress',
      updated_by = v_actor,
      updated_at = now()
  where id = p_ovr_report_id;

  return v_project_id;
end;
$$;

create or replace view public.v_ovr_workflow_queue as
select
  o.id,
  o.organization_id,
  o.ovr_number,
  left(o.brief_description, 160) as title,
  d.name_en as department_name,
  pr.full_name_en as owner_name,
  o.occurrence_date,
  o.status,
  o.severity_level,
  case
    when o.status in ('submitted', 'under_supervisor_review') then 'supervisor_review'
    when o.status in ('under_quality_review', 'returned_for_clarification') then 'quality_review'
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then 'corrective_action'
    when o.status in ('evidence_submitted', 'quality_closure_review') then 'evidence_closure_review'
    else o.status::text
  end as workflow_stage,
  case
    when o.status in ('submitted', 'under_supervisor_review') then coalesce(o.supervisor_due_date, o.occurrence_date + 1)
    when o.status in ('under_quality_review', 'returned_for_clarification') then coalesce(o.quality_due_date, o.occurrence_date + 3)
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then coalesce(o.corrective_action_due_date, o.occurrence_date + 14)
    when o.status in ('evidence_submitted', 'quality_closure_review') then coalesce(o.quality_due_date, o.occurrence_date + 5)
    else null::date
  end as due_date,
  case
    when o.status in ('submitted', 'under_supervisor_review') then coalesce(o.supervisor_due_date, o.occurrence_date + 1) < current_date
    when o.status in ('under_quality_review', 'returned_for_clarification') then coalesce(o.quality_due_date, o.occurrence_date + 3) < current_date
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then coalesce(o.corrective_action_due_date, o.occurrence_date + 14) < current_date
    when o.status in ('evidence_submitted', 'quality_closure_review') then coalesce(o.quality_due_date, o.occurrence_date + 5) < current_date
    else false
  end as is_overdue,
  case
    when o.severity_level in ('level_4', 'sentinel') then 'critical'::public.risk_level
    when o.status in ('returned_for_clarification', 'rejected') then 'high'::public.risk_level
    when o.status in ('evidence_submitted', 'quality_closure_review') then 'high'::public.risk_level
    else 'medium'::public.risk_level
  end as risk_level
from public.ovr_reports o
left join public.departments d on d.id = o.department_id
left join public.profiles pr on pr.id = o.owner_id
where o.status not in ('draft', 'closed', 'cancelled')
order by is_overdue desc, due_date asc nulls last;

create or replace view public.v_ovr_workflow_control_summary as
select
  o.organization_id,
  count(*) filter (where o.status in ('submitted', 'under_supervisor_review')) as pending_supervisor_review,
  count(*) filter (where o.status = 'under_quality_review') as pending_quality_review,
  count(*) filter (where o.status = 'returned_for_clarification') as returned_for_clarification,
  count(*) filter (where o.status in ('evidence_submitted', 'quality_closure_review')) as pending_evidence_review,
  count(*) filter (where o.status not in ('closed', 'cancelled') and o.severity_level in ('level_4', 'sentinel')) as major_open_ovrs,
  count(*) filter (where q.is_overdue = true) as overdue_ovr_workflow_items
from public.ovr_reports o
left join public.v_ovr_workflow_queue q on q.id = o.id
group by o.organization_id;

create or replace view public.v_critical_attention_items as
select * from (
  select
    p.id,
    p.organization_id,
    'project'::text as item_type,
    p.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    p.target_end_date as due_date,
    p.status::text as status,
    p.risk_level,
    p.progress_percent,
    case when p.risk_level = 'critical' then 1 when p.risk_level = 'high' then 2 when p.status = 'delayed' then 3 else 8 end as sort_rank
  from public.projects p
  left join public.departments d on d.id = p.department_id
  left join public.profiles pr on pr.id = p.owner_id
  where p.status not in ('closed', 'cancelled')
    and (p.risk_level in ('critical', 'high') or p.status in ('delayed', 'at_risk', 'completed_pending_evidence', 'completed_pending_approval') or (p.target_end_date is not null and p.target_end_date < current_date))

  union all
  select r.id, r.organization_id, 'risk'::text, r.title, d.name_en, pr.full_name_en, r.next_review_date, r.status::text, r.risk_level, null::numeric, case when r.risk_level = 'critical' then 1 when r.risk_level = 'high' then 2 else 8 end
  from public.risks r
  left join public.departments d on d.id = r.department_id
  left join public.profiles pr on pr.id = r.owner_id
  where r.status not in ('closed', 'cancelled') and r.risk_level in ('critical', 'high')

  union all
  select c.id, c.organization_id, 'compliance'::text, c.title, d.name_en, pr.full_name_en, coalesce(c.expiry_date, c.due_date), c.status::text, c.risk_level, null::numeric, case when c.expiry_date is not null and c.expiry_date <= current_date + interval '7 days' then 1 when c.risk_level = 'critical' then 2 else 5 end
  from public.compliance_items c
  left join public.departments d on d.id = c.department_id
  left join public.profiles pr on pr.id = c.owner_id
  where c.status not in ('closed', 'cancelled') and (c.risk_level in ('critical', 'high') or (c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days') or (c.due_date is not null and c.due_date < current_date))

  union all
  select af.id, af.organization_id, 'audit_finding'::text, af.title, d.name_en, pr.full_name_en, af.due_date, af.status::text, af.risk_level, null::numeric, case when af.due_date is not null and af.due_date < current_date then 1 when af.risk_level = 'critical' then 2 else 4 end
  from public.audit_findings af
  left join public.departments d on d.id = af.department_id
  left join public.profiles pr on pr.id = af.owner_id
  where af.status not in ('closed', 'cancelled') and (af.risk_level in ('critical', 'high') or (af.due_date is not null and af.due_date < current_date))

  union all
  select cd.id, cd.organization_id, 'governance_decision'::text, cd.title, d.name_en, pr.full_name_en, cd.due_date, cd.status::text, cd.risk_level, null::numeric, case when cd.status = 'delayed' then 1 when cd.priority = 'critical' then 2 else 6 end
  from public.committee_decisions cd
  left join public.departments d on d.id = cd.department_id
  left join public.profiles pr on pr.id = cd.owner_id
  where cd.status not in ('closed', 'cancelled') and (cd.priority in ('critical', 'high') or cd.risk_level in ('critical', 'high') or cd.status in ('delayed', 'pending_evidence', 'pending_approval'))

  union all
  select
    o.id,
    o.organization_id,
    'ovr'::text,
    coalesce(o.ovr_number, o.logging_number, 'OVR') || ' - ' || left(o.brief_description, 90) as title,
    d.name_en,
    pr.full_name_en,
    q.due_date,
    o.status::text,
    q.risk_level,
    null::numeric,
    case when o.severity_level in ('level_4', 'sentinel') then 1 when q.is_overdue then 2 else 4 end
  from public.ovr_reports o
  left join public.v_ovr_workflow_queue q on q.id = o.id
  left join public.departments d on d.id = o.department_id
  left join public.profiles pr on pr.id = o.owner_id
  where o.status not in ('closed', 'cancelled')
    and (o.severity_level in ('level_4', 'sentinel') or q.is_overdue = true or o.status in ('returned_for_clarification', 'evidence_submitted', 'quality_closure_review'))
) q
order by sort_rank asc, due_date asc nulls last;
