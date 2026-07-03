-- Migration: supabase/migrations/093_patch30_executive_dashboard_truth_layer.sql
-- Description: Adds Patch 30 Executive Dashboard Truth Layer tables, views, and functions.

-- 1. Create Tables
create table if not exists public.executive_truth_snapshots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  captured_at timestamptz not null default now(),
  captured_by uuid,
  snapshot_data jsonb not null,
  notes text
);

create table if not exists public.executive_truth_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_summary text not null,
  snapshot_id uuid references public.executive_truth_snapshots(id) on delete set null,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.executive_truth_snapshots enable row level security;
alter table public.executive_truth_events enable row level security;

-- Conservative RLS Policies
create policy "grc_executive_truth_snapshots_select_policy" on public.executive_truth_snapshots
  for select to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer', 'executive')
    )
  );

create policy "grc_executive_truth_snapshots_all_policy" on public.executive_truth_snapshots
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

create policy "grc_executive_truth_events_select_policy" on public.executive_truth_events
  for select to authenticated using (true);

create policy "grc_executive_truth_events_all_policy" on public.executive_truth_events
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
        and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    )
  );

-- Event Logging Helper
create or replace function public.log_executive_truth_event(
  p_event_type text,
  p_event_summary text,
  p_snapshot_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.executive_truth_events (event_type, event_summary, snapshot_id, actor_user_id)
  values (p_event_type, p_event_summary, p_snapshot_id, p_actor_user_id);
end;
$$;

revoke all on function public.log_executive_truth_event(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.log_executive_truth_event(text, text, uuid, uuid) to service_role;

-- 2. Create Views
-- 1. v_patch30_executive_truth_summary
create or replace view public.v_patch30_executive_truth_summary as
select
  (select count(*) from public.risks where status in ('open', 'under_review', 'mitigating', 'monitoring'))::integer as active_risks_count,
  (select count(*) from public.compliance_items where status = 'compliant')::integer as compliant_items_count,
  (select count(*) from public.compliance_items where status in ('non_compliant', 'expired'))::integer as non_compliant_items_count,
  (select count(*) from public.audit_findings where status in ('open', 'action_plan_submitted', 'in_progress', 'evidence_submitted', 'under_audit_review', 'rejected'))::integer as open_audit_findings_count,
  (select count(*) from public.approvals where status = 'pending')::integer as pending_approvals_count,
  (select count(*) from public.evidence_files)::integer as total_evidence_files_count;

-- 2. v_patch30_module_health_scorecard
create or replace view public.v_patch30_module_health_scorecard as
select 
  'Risk'::text as module_name,
  count(*)::integer as total_items,
  count(case when status in ('mitigated', 'closed') then 1 end)::integer as closed_items,
  count(case when status in ('open', 'under_review', 'mitigating', 'monitoring') then 1 end)::integer as open_items,
  0::integer as overdue_items,
  case 
    when count(*) = 0 then 100.0
    else round((count(case when status in ('mitigated', 'closed') then 1 end)::numeric / count(*)::numeric) * 100, 2)
  end as health_index
from public.risks
union all
select 
  'Compliance'::text as module_name,
  count(*)::integer as total_items,
  count(case when status = 'compliant' then 1 end)::integer as closed_items,
  count(case when status in ('not_started', 'in_progress', 'pending_evidence', 'pending_approval') then 1 end)::integer as open_items,
  count(case when status in ('non_compliant', 'expired') or (due_date < current_date and status <> 'compliant') then 1 end)::integer as overdue_items,
  case 
    when count(*) = 0 then 100.0
    else round((count(case when status = 'compliant' then 1 end)::numeric / count(*)::numeric) * 100, 2)
  end as health_index
from public.compliance_items
union all
select 
  'Audit'::text as module_name,
  count(*)::integer as total_items,
  count(case when status = 'closed' then 1 end)::integer as closed_items,
  count(case when status in ('open', 'action_plan_submitted', 'in_progress', 'evidence_submitted', 'under_audit_review', 'rejected') then 1 end)::integer as open_items,
  0::integer as overdue_items,
  case 
    when count(*) = 0 then 100.0
    else round((count(case when status = 'closed' then 1 end)::numeric / count(*)::numeric) * 100, 2)
  end as health_index
from public.audit_findings;

-- 3. v_patch30_open_executive_risk_register
create or replace view public.v_patch30_open_executive_risk_register as
select 
  r.id as risk_id,
  r.title as risk_title,
  r.severity_level,
  r.risk_level,
  r.status,
  r.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  (select count(*) from public.risk_controls rc where rc.risk_id = r.id)::integer as linked_controls_count
from public.risks r
left join public.departments d on r.department_id = d.id
where r.status in ('open', 'under_review', 'mitigating', 'monitoring')
  and r.risk_level in ('high', 'critical');

-- 4. v_patch30_overdue_governance_items
create or replace view public.v_patch30_overdue_governance_items as
select 
  'Compliance Item'::text as item_type,
  id as item_id,
  title as item_title,
  due_date,
  department_id,
  owner_id as owner_user_id,
  (current_date - due_date)::integer as days_overdue
from public.compliance_items
where status <> 'compliant' and due_date < current_date
union all
select 
  'Task'::text as item_type,
  id as item_id,
  title as item_title,
  due_date,
  department_id,
  owner_id as owner_user_id,
  (current_date - due_date)::integer as days_overdue
from public.tasks
where status <> 'completed' and due_date < current_date;

-- 5. v_patch30_evidence_gap_summary
create or replace view public.v_patch30_evidence_gap_summary as
select 
  'Compliance'::text as module_name,
  id as item_id,
  title as item_title,
  department_id,
  owner_id as owner_user_id
from public.compliance_items
where evidence_required = true 
  and not exists (
    select 1 from public.evidence_files ef 
    where ef.linked_item_type = 'compliance_obligation' and ef.linked_item_id = id
  )
union all
select 
  'Audit Finding'::text as module_name,
  id as item_id,
  title as item_title,
  department_id,
  owner_id as owner_user_id
from public.audit_findings
where not exists (
  select 1 from public.evidence_files ef 
  where ef.linked_item_type = 'audit_finding' and ef.linked_item_id = id
);

-- 6. v_patch30_workflow_bottleneck_summary
create or replace view public.v_patch30_workflow_bottleneck_summary as
select 
  'Approval'::text as workflow_type,
  id as item_id,
  title as item_title,
  status,
  created_at,
  (extract(epoch from (now() - created_at)) / 86400)::numeric(10, 2) as pending_days,
  approver_id as pending_actor_id
from public.approvals
where status = 'pending';

-- 7. v_patch30_accreditation_readiness_summary
create or replace view public.v_patch30_accreditation_readiness_summary as
select 
  'CBAHI Accreditation Standards'::text as standard_set,
  count(*)::integer as total_standards,
  count(case when status = 'compliant' then 1 end)::integer as compliant_count,
  count(case when status in ('non_compliant', 'expired') then 1 end)::integer as non_compliant_count,
  case 
    when count(*) = 0 then 0.0
    else round((count(case when status = 'compliant' then 1 end)::numeric / count(*)::numeric) * 100, 2)
  end as compliance_percentage
from public.compliance_items
where regulatory_body ilike '%CBAHI%';

-- 8. v_patch30_department_grc_scorecard
create or replace view public.v_patch30_department_grc_scorecard as
select 
  d.id as department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  (select count(*) from public.risks r where r.department_id = d.id and r.status in ('open', 'under_review', 'mitigating', 'monitoring'))::integer as open_risks,
  (select count(*) from public.compliance_items ci where ci.department_id = d.id and ci.status in ('non_compliant', 'expired'))::integer as non_compliant_obligations,
  (select count(*) from public.tasks t where t.department_id = d.id and t.status <> 'completed' and t.due_date < current_date)::integer as overdue_tasks
from public.departments d;

-- 9. v_patch30_governance_exception_register
create or replace view public.v_patch30_governance_exception_register as
select 
  'Approval Escalation'::text as exception_type,
  id as entity_id,
  title as summary,
  requester_id as initiator_user_id,
  created_at as logged_at
from public.approvals
where status = 'rejected';

-- 10. v_patch30_board_pack_truth_snapshot
create or replace view public.v_patch30_board_pack_truth_snapshot as
select 
  id as snapshot_id,
  title,
  captured_at,
  captured_by,
  notes,
  (snapshot_data->>'active_risks_count')::integer as active_risks,
  (snapshot_data->>'compliant_items_count')::integer as compliant_items,
  (snapshot_data->>'non_compliant_items_count')::integer as non_compliant_items,
  (snapshot_data->>'open_audit_findings_count')::integer as open_audit_findings
from public.executive_truth_snapshots;


-- 3. Create PL/pgSQL Functions (RPCs)
-- 1. create_executive_truth_snapshot
create or replace function public.create_executive_truth_snapshot(
  p_title text,
  p_notes text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot_id uuid;
  v_summary_data jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH30_TRUTH_SERVICE_ROLE_REQUIRED'; 
  end if;

  -- Gather GRC state snapshot data
  select jsonb_build_object(
    'active_risks_count', active_risks_count,
    'compliant_items_count', compliant_items_count,
    'non_compliant_items_count', non_compliant_items_count,
    'open_audit_findings_count', open_audit_findings_count,
    'pending_approvals_count', pending_approvals_count,
    'total_evidence_files_count', total_evidence_files_count
  ) into v_summary_data
  from public.v_patch30_executive_truth_summary;

  insert into public.executive_truth_snapshots (title, snapshot_data, notes, captured_by)
  values (p_title, v_summary_data, p_notes, p_actor_id)
  returning id into v_snapshot_id;

  perform public.log_executive_truth_event(
    'snapshot_created', 
    'Executive truth snapshot "' || p_title || '" was captured successfully.', 
    v_snapshot_id, 
    p_actor_id
  );

  return v_snapshot_id;
end;
$$;

revoke all on function public.create_executive_truth_snapshot(text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_executive_truth_snapshot(text, text, uuid) to service_role;

-- 2. refresh_executive_truth_snapshot
create or replace function public.refresh_executive_truth_snapshot(
  p_snapshot_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_summary_data jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH30_TRUTH_SERVICE_ROLE_REQUIRED'; 
  end if;

  select jsonb_build_object(
    'active_risks_count', active_risks_count,
    'compliant_items_count', compliant_items_count,
    'non_compliant_items_count', non_compliant_items_count,
    'open_audit_findings_count', open_audit_findings_count,
    'pending_approvals_count', pending_approvals_count,
    'total_evidence_files_count', total_evidence_files_count
  ) into v_summary_data
  from public.v_patch30_executive_truth_summary;

  update public.executive_truth_snapshots
  set snapshot_data = v_summary_data, captured_at = now(), captured_by = p_actor_id
  where id = p_snapshot_id;

  if not found then
    raise exception 'PATCH30_SNAPSHOT_NOT_FOUND';
  end if;

  perform public.log_executive_truth_event(
    'snapshot_refreshed', 
    'Executive truth snapshot was refreshed with active figures.', 
    p_snapshot_id, 
    p_actor_id
  );
end;
$$;

revoke all on function public.refresh_executive_truth_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_executive_truth_snapshot(uuid, uuid) to service_role;

-- 3. record_executive_truth_event
create or replace function public.record_executive_truth_event(
  p_event_type text,
  p_event_summary text,
  p_snapshot_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH30_TRUTH_SERVICE_ROLE_REQUIRED'; 
  end if;

  insert into public.executive_truth_events (event_type, event_summary, snapshot_id, actor_user_id)
  values (p_event_type, p_event_summary, p_snapshot_id, p_actor_id)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_executive_truth_event(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_executive_truth_event(text, text, uuid, uuid) to service_role;

-- 4. get_executive_truth_summary
create or replace function public.get_executive_truth_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH30_TRUTH_SERVICE_ROLE_REQUIRED'; 
  end if;

  select jsonb_build_object(
    'active_risks_count', active_risks_count,
    'compliant_items_count', compliant_items_count,
    'non_compliant_items_count', non_compliant_items_count,
    'open_audit_findings_count', open_audit_findings_count,
    'pending_approvals_count', pending_approvals_count,
    'total_evidence_files_count', total_evidence_files_count
  ) into v_result
  from public.v_patch30_executive_truth_summary;

  return v_result;
end;
$$;

revoke all on function public.get_executive_truth_summary() from public, anon, authenticated;
grant execute on function public.get_executive_truth_summary() to service_role;

-- 5. get_department_grc_scorecard
create or replace function public.get_department_grc_scorecard(p_department_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH30_TRUTH_SERVICE_ROLE_REQUIRED'; 
  end if;

  select jsonb_build_object(
    'department_id', department_id,
    'department_name_en', department_name_en,
    'department_name_ar', department_name_ar,
    'open_risks', open_risks,
    'non_compliant_obligations', non_compliant_obligations,
    'overdue_tasks', overdue_tasks
  ) into v_result
  from public.v_patch30_department_grc_scorecard
  where department_id = p_department_id;

  return v_result;
end;
$$;

revoke all on function public.get_department_grc_scorecard(uuid) from public, anon, authenticated;
grant execute on function public.get_department_grc_scorecard(uuid) to service_role;

-- Set Security Invoker on Views
alter view public.v_patch30_executive_truth_summary set (security_invoker = true);
alter view public.v_patch30_module_health_scorecard set (security_invoker = true);
alter view public.v_patch30_open_executive_risk_register set (security_invoker = true);
alter view public.v_patch30_overdue_governance_items set (security_invoker = true);
alter view public.v_patch30_evidence_gap_summary set (security_invoker = true);
alter view public.v_patch30_workflow_bottleneck_summary set (security_invoker = true);
alter view public.v_patch30_accreditation_readiness_summary set (security_invoker = true);
alter view public.v_patch30_department_grc_scorecard set (security_invoker = true);
alter view public.v_patch30_governance_exception_register set (security_invoker = true);
alter view public.v_patch30_board_pack_truth_snapshot set (security_invoker = true);
