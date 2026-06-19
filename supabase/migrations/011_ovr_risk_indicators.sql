-- =========================================================
-- GRC Control Center - Migration 011
-- OVR Risk Indicators
-- Converts OVR frequency, severity, recurrence, closure delay
-- and overdue corrective actions into Risk dashboard signals.
-- =========================================================

-- Severity weight follows the OVR severity model:
-- Level 1 near miss = 1, Level 2 no injury = 2,
-- Level 3 minor = 3, Level 4 major = 5, Sentinel = 8.
create or replace function public.ovr_severity_weight(p_severity text)
returns integer
language sql
immutable
as $$
  select case p_severity
    when 'level_1' then 1
    when 'level_2' then 2
    when 'level_3' then 3
    when 'level_4' then 5
    when 'sentinel' then 8
    else 1
  end;
$$;

create or replace function public.ovr_signal_level(
  p_weighted_score integer,
  p_major_or_sentinel integer,
  p_repeated_alerts integer,
  p_overdue_actions integer
)
returns public.risk_level
language sql
immutable
as $$
  select case
    when coalesce(p_major_or_sentinel, 0) >= 1
      or coalesce(p_weighted_score, 0) >= 25
      or coalesce(p_overdue_actions, 0) >= 3 then 'critical'::public.risk_level
    when coalesce(p_weighted_score, 0) >= 15
      or coalesce(p_repeated_alerts, 0) >= 2
      or coalesce(p_overdue_actions, 0) >= 1 then 'high'::public.risk_level
    when coalesce(p_weighted_score, 0) >= 6
      or coalesce(p_repeated_alerts, 0) >= 1 then 'medium'::public.risk_level
    else 'low'::public.risk_level
  end;
$$;

-- Weighted feed per OVR. This allows the dashboard to explain why the signal changed.
create or replace view public.v_ovr_risk_indicator_feed as
select
  r.id,
  r.organization_id,
  r.department_id,
  coalesce(d.name_en, 'Company-wide') as department_name,
  r.ovr_number,
  r.logging_number,
  r.occurrence_date,
  r.occurrence_category,
  r.severity_level::text as severity_level,
  public.ovr_severity_weight(r.severity_level::text) as severity_weight,
  r.status,
  r.corrective_action_required,
  r.linked_project_id,
  case
    when p.id is not null
      and p.target_end_date is not null
      and p.target_end_date < current_date
      and p.status not in ('closed', 'cancelled')
    then true
    else false
  end as corrective_action_overdue,
  r.closed_at,
  case
    when r.closed_at is not null then round(extract(epoch from (r.closed_at - r.created_at)) / 86400.0, 1)
    else null
  end as closure_days,
  r.created_at
from public.ovr_reports r
left join public.departments d on d.id = r.department_id
left join public.projects p on p.id = r.linked_project_id;

-- Repeated-category alerts: 3+ OVRs from same category and department within 30 days.
create or replace view public.v_ovr_repeated_category_alerts as
select
  f.organization_id,
  f.department_id,
  f.department_name,
  f.occurrence_category,
  count(*)::integer as category_count_30d,
  max(f.severity_weight)::integer as max_severity_weight,
  case max(f.severity_weight)
    when 8 then 'sentinel'
    when 5 then 'level_4'
    when 3 then 'level_3'
    when 2 then 'level_2'
    else 'level_1'
  end as max_severity_level,
  case
    when max(f.severity_weight) >= 5 or count(*) >= 5 then 'high'::public.risk_level
    else 'medium'::public.risk_level
  end as alert_level
from public.v_ovr_risk_indicator_feed f
where f.occurrence_date >= current_date - interval '30 days'
  and f.status not in ('cancelled')
group by f.organization_id, f.department_id, f.department_name, f.occurrence_category
having count(*) >= 3;

-- Department-level OVR risk indicator.
create or replace view public.v_ovr_risk_indicators_by_department as
with base as (
  select *
  from public.v_ovr_risk_indicator_feed
  where status not in ('cancelled')
), repeated as (
  select
    organization_id,
    department_id,
    count(*)::integer as repeated_category_alerts_30d,
    string_agg(occurrence_category, ', ' order by occurrence_category) as repeated_categories
  from public.v_ovr_repeated_category_alerts
  group by organization_id, department_id
), department_rollup as (
  select
    b.organization_id,
    b.department_id,
    max(b.department_name) as department_name,
    count(*) filter (where b.occurrence_date >= current_date - interval '30 days')::integer as ovr_count_30d,
    count(*) filter (where b.occurrence_date >= current_date - interval '90 days')::integer as ovr_count_90d,
    coalesce(sum(b.severity_weight) filter (where b.occurrence_date >= current_date - interval '30 days'), 0)::integer as weighted_score_30d,
    count(*) filter (
      where b.occurrence_date >= current_date - interval '90 days'
        and b.severity_level in ('level_4', 'sentinel')
    )::integer as major_or_sentinel_ovrs_90d,
    count(*) filter (where b.corrective_action_overdue = true)::integer as overdue_corrective_actions,
    round(avg(b.closure_days) filter (where b.closure_days is not null), 1) as avg_closure_days
  from base b
  group by b.organization_id, b.department_id
)
select
  d.organization_id,
  d.department_id,
  coalesce(d.department_name, 'Company-wide') as department_name,
  d.ovr_count_30d,
  d.ovr_count_90d,
  d.weighted_score_30d,
  d.major_or_sentinel_ovrs_90d,
  coalesce(r.repeated_category_alerts_30d, 0)::integer as repeated_category_alerts_30d,
  r.repeated_categories,
  d.overdue_corrective_actions,
  d.avg_closure_days,
  public.ovr_signal_level(
    d.weighted_score_30d,
    d.major_or_sentinel_ovrs_90d,
    coalesce(r.repeated_category_alerts_30d, 0),
    d.overdue_corrective_actions
  ) as risk_signal_level
from department_rollup d
left join repeated r
  on r.organization_id = d.organization_id
 and r.department_id is not distinct from d.department_id;

-- Executive OVR risk summary.
create or replace view public.v_ovr_risk_indicator_summary as
with feed as (
  select *
  from public.v_ovr_risk_indicator_feed
  where status not in ('cancelled')
), repeated as (
  select organization_id, count(*)::integer as repeated_category_alerts_30d
  from public.v_ovr_repeated_category_alerts
  group by organization_id
), rollup as (
  select
    o.id as organization_id,
    count(f.id) filter (where f.occurrence_date >= current_date - interval '30 days')::integer as total_ovrs_30d,
    count(f.id) filter (where f.occurrence_date >= current_date - interval '90 days')::integer as total_ovrs_90d,
    count(f.id) filter (where f.status not in ('closed', 'cancelled'))::integer as open_ovrs,
    coalesce(sum(f.severity_weight) filter (where f.occurrence_date >= current_date - interval '30 days'), 0)::integer as weighted_score_30d,
    count(f.id) filter (
      where f.occurrence_date >= current_date - interval '90 days'
        and f.severity_level in ('level_4', 'sentinel')
    )::integer as major_or_sentinel_ovrs_90d,
    count(f.id) filter (where f.corrective_action_overdue = true)::integer as overdue_corrective_actions,
    round(avg(f.closure_days) filter (where f.closure_days is not null), 1) as avg_closure_days
  from public.organizations o
  left join feed f on f.organization_id = o.id
  group by o.id
)
select
  r.organization_id,
  r.total_ovrs_30d,
  r.total_ovrs_90d,
  r.open_ovrs,
  r.weighted_score_30d,
  r.major_or_sentinel_ovrs_90d,
  coalesce(rep.repeated_category_alerts_30d, 0)::integer as repeated_category_alerts_30d,
  r.overdue_corrective_actions,
  r.avg_closure_days,
  public.ovr_signal_level(
    r.weighted_score_30d,
    r.major_or_sentinel_ovrs_90d,
    coalesce(rep.repeated_category_alerts_30d, 0),
    r.overdue_corrective_actions
  ) as overall_signal_level
from rollup r
left join repeated rep on rep.organization_id = r.organization_id;

-- Add OVR risk count into critical attention list by exposing a lightweight view
-- that can be joined later with the main executive dashboard.
create or replace view public.v_ovr_risk_attention_items as
select
  organization_id,
  department_id,
  department_name,
  'ovr_risk_indicator'::text as item_type,
  'OVR risk signal: ' || department_name as title,
  risk_signal_level,
  weighted_score_30d,
  repeated_category_alerts_30d,
  major_or_sentinel_ovrs_90d,
  overdue_corrective_actions
from public.v_ovr_risk_indicators_by_department
where risk_signal_level in ('critical', 'high');

-- Views read through the underlying RLS-enabled OVR/project tables in Supabase.
-- Grant explicit access for API clients.
grant select on public.v_ovr_risk_indicator_feed to authenticated;
grant select on public.v_ovr_repeated_category_alerts to authenticated;
grant select on public.v_ovr_risk_indicators_by_department to authenticated;
grant select on public.v_ovr_risk_indicator_summary to authenticated;
grant select on public.v_ovr_risk_attention_items to authenticated;
