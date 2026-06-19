-- =========================================================
-- GRC Control Center - Migration 013
-- Executive KPIs, analytics views, heatmaps and radar profile
-- =========================================================

-- Executive KPI scorecard. Scores are 0-100.
-- Some scores are "health" where higher is better; some are "pressure/exposure" where higher means more attention needed.
create or replace view v_grc_kpi_scorecard as
select
  o.id as organization_id,

  greatest(
    0,
    least(
      100,
      100
      - coalesce((select count(*) * 8 from projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status not in ('closed', 'cancelled')), 0)
      - coalesce((select count(*) * 3 from milestones m where m.organization_id = o.id and m.due_date < current_date and m.status not in ('closed', 'approved', 'cancelled')), 0)
      - coalesce((select count(*) from tasks t where t.organization_id = o.id and t.due_date < current_date and t.status not in ('closed', 'approved', 'cancelled')), 0)
      - coalesce((select count(*) * 4 from v_delay_reason_queue q where q.organization_id = o.id), 0)
    )
  )::integer as execution_health_score,

  least(
    100,
    coalesce((select count(*) * 14 from risks r where r.organization_id = o.id and r.status not in ('closed', 'cancelled') and r.risk_level = 'critical'), 0)
    + coalesce((select count(*) * 10 from escalation_events e where e.organization_id = o.id and e.status in ('open', 'acknowledged') and e.risk_level = 'critical'), 0)
    + coalesce((select count(*) * 10 from ovr_reports orp where orp.organization_id = o.id and orp.severity_level in ('level_4', 'sentinel') and orp.status not in ('closed', 'cancelled')), 0)
  )::integer as risk_exposure_score,

  least(
    100,
    coalesce((select count(*) * 7 from compliance_items c where c.organization_id = o.id and c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days' and c.status not in ('closed', 'cancelled')), 0)
    + coalesce((select count(*) * 10 from audit_findings af where af.organization_id = o.id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0)
  )::integer as compliance_pressure_score,

  least(
    100,
    coalesce((select weighted_score_30d from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
    + coalesce((select major_or_sentinel_ovrs_90d * 8 from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
    + coalesce((select repeated_category_alerts_30d * 5 from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
  )::integer as ovr_safety_signal_score,

  greatest(
    0,
    least(
      100,
      100 - coalesce((select count(*) * 3 from evidence_files ef where ef.organization_id = o.id and ef.status in ('submitted', 'needs_revision')), 0)
    )
  )::integer as evidence_discipline_score,

  least(
    100,
    coalesce((select count(*) * 5 from approvals a where a.organization_id = o.id and a.status = 'pending'), 0)
  )::integer as approval_bottleneck_score
from organizations o;

-- Department-level heatmap for executive attention.
create or replace view v_department_risk_heatmap as
with base as (
  select
    d.organization_id,
    d.id as department_id,
    coalesce(d.name_en, d.name_ar, 'Unassigned') as department_name,
    coalesce((select count(*) from projects p where p.department_id = d.id and p.status not in ('closed', 'cancelled')), 0) as active_projects,
    coalesce((select count(*) from projects p where p.department_id = d.id and p.target_end_date < current_date and p.status not in ('closed', 'cancelled')), 0) as overdue_projects,
    coalesce((select count(*) from milestones m join projects p on p.id = m.project_id where p.department_id = d.id and m.due_date < current_date and m.status not in ('closed', 'approved', 'cancelled')), 0) as overdue_milestones,
    coalesce((select count(*) from tasks t join projects p on p.id = t.project_id where p.department_id = d.id and t.due_date < current_date and t.status not in ('closed', 'approved', 'cancelled')), 0) as overdue_tasks,
    coalesce((select count(*) from risks r where r.department_id = d.id and r.status not in ('closed', 'cancelled') and r.risk_level = 'critical'), 0) as critical_risks,
    coalesce((select count(*) from compliance_items c where c.department_id = d.id and c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days' and c.status not in ('closed', 'cancelled')), 0) as compliance_expiring_30_days,
    coalesce((select count(*) from audit_findings af where af.department_id = d.id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0) as overdue_audit_findings,
    coalesce((select weighted_score_30d from v_ovr_risk_indicators_by_department oi where oi.department_id = d.id limit 1), 0) as ovr_weighted_score_30d
  from departments d
  where d.is_active = true
), scored as (
  select
    *,
    least(100, overdue_projects * 20 + overdue_milestones * 7 + overdue_tasks * 3)::integer as execution_pressure_score,
    least(100, critical_risks * 28 + overdue_audit_findings * 10)::integer as risk_pressure_score,
    least(100, compliance_expiring_30_days * 18 + overdue_audit_findings * 12)::integer as compliance_pressure_score,
    least(100, ovr_weighted_score_30d * 4)::integer as ovr_pressure_score
  from base
)
select
  organization_id,
  department_id,
  department_name,
  active_projects,
  overdue_projects,
  overdue_milestones,
  overdue_tasks,
  critical_risks,
  compliance_expiring_30_days,
  overdue_audit_findings,
  ovr_weighted_score_30d,
  execution_pressure_score,
  risk_pressure_score,
  compliance_pressure_score,
  ovr_pressure_score,
  least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0))::integer as overall_pressure_score,
  case
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 75 then 'critical'::risk_level
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 50 then 'high'::risk_level
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 25 then 'medium'::risk_level
    else 'low'::risk_level
  end as signal_level
from scored;

-- Six-month trend for core GRC activity.
create or replace view v_monthly_grc_trend as
with months as (
  select generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month')::date as month_start
), org_months as (
  select o.id as organization_id, m.month_start
  from organizations o
  cross join months m
)
select
  om.organization_id,
  om.month_start,
  to_char(om.month_start, 'Mon') as month_label,
  coalesce((select count(*) from projects p where p.organization_id = om.organization_id and date_trunc('month', p.created_at)::date = om.month_start), 0)::integer as new_projects,
  coalesce((select count(*) from projects p where p.organization_id = om.organization_id and p.closed_at is not null and date_trunc('month', p.closed_at)::date = om.month_start), 0)::integer as closed_projects,
  coalesce((select count(*) from risks r where r.organization_id = om.organization_id and date_trunc('month', r.created_at)::date = om.month_start), 0)::integer as new_risks,
  coalesce((select count(*) from audit_findings af where af.organization_id = om.organization_id and date_trunc('month', af.created_at)::date = om.month_start), 0)::integer as new_audit_findings,
  coalesce((select count(*) from ovr_reports orp where orp.organization_id = om.organization_id and date_trunc('month', orp.created_at)::date = om.month_start), 0)::integer as ovr_reports,
  coalesce((select count(*) from ovr_reports orp where orp.organization_id = om.organization_id and date_trunc('month', orp.created_at)::date = om.month_start and orp.severity_level in ('level_4', 'sentinel')), 0)::integer as major_ovrs
from org_months om
order by om.month_start;

-- Radar values are "maturity/health" scores where higher is better.
create or replace view v_radar_control_profile as
with s as (
  select * from v_grc_kpi_scorecard
), summary as (
  select
    s.organization_id,
    s.execution_health_score,
    greatest(0, 100 - s.risk_exposure_score) as risk_control_score,
    greatest(0, 100 - s.compliance_pressure_score) as compliance_control_score,
    greatest(0, 100 - least(100, coalesce((select count(*) * 10 from audit_findings af where af.organization_id = s.organization_id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0))) as audit_closure_score,
    greatest(0, 100 - s.ovr_safety_signal_score) as ovr_safety_score,
    s.evidence_discipline_score
  from s
)
select organization_id, 'execution' as dimension_key, 'Execution' as dimension_label_en, 'التنفيذ' as dimension_label_ar, execution_health_score::integer as score from summary
union all
select organization_id, 'risk', 'Risk control', 'ضبط المخاطر', risk_control_score::integer from summary
union all
select organization_id, 'compliance', 'Compliance', 'الالتزام', compliance_control_score::integer from summary
union all
select organization_id, 'audit', 'Audit closure', 'إغلاق المراجعة', audit_closure_score::integer from summary
union all
select organization_id, 'ovr', 'OVR safety', 'سلامة OVR', ovr_safety_score::integer from summary
union all
select organization_id, 'evidence', 'Evidence discipline', 'انضباط الأدلة', evidence_discipline_score::integer from summary;
